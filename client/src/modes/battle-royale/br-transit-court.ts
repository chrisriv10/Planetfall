import { BR_ELEVATION_REGIONS, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES,
  type BrMapBlock, type BrRoadSegment, type BrStructure, type Vec3 } from "@planetfall/shared";
import type { BrAuthoredSecondaryPart } from "./br-authored-secondary-dressing";

interface CourtRegion { districtId: string; x: number; z: number; width: number; depth: number; height: number; }
export interface BrTransitCourtInputs {
  structures: readonly BrStructure[];
  roads: readonly BrRoadSegment[];
  elevationRegions: readonly CourtRegion[];
  retainingBlocks: readonly BrMapBlock[];
}
export interface BrTransitCourtSign {
  text: string; subtitle: string; position: Vec3; rotationY: number; width: number; height: number;
}
export interface BrTransitCourtDressing {
  center: Vec3;
  radius: number;
  parts: BrAuthoredSecondaryPart[];
  signs: BrTransitCourtSign[];
  batches: { geometry: BrAuthoredSecondaryPart["geometry"]; finish: BrAuthoredSecondaryPart["finish"];
    surface: boolean; parts: BrAuthoredSecondaryPart[] }[];
}

/** Fixed Transit Court composition, world coordinates. Boxes have unit sides;
 * cylinders have unit radius/height, octahedra unit radius. Batch by supplied
 * geometry/finish/surface; use canopy() for foliage, surface(finish, 1) for
 * paving and get(finish) otherwise. No colliders, lights or frame updates.
 * Keep the existing authoritative floors/roads/walls: these are thin finishes.
 * Attach to a district LOD group with cameraCollision=false. Signs use unit
 * planes facing local +Z and the material library's cached sign textures.
 */
export function buildBrTransitCourtDressing(input: BrTransitCourtInputs = {
  structures: BR_STRUCTURES, roads: BR_ROADS, elevationRegions: BR_ELEVATION_REGIONS, retainingBlocks: BR_MAP_BLOCKS,
}): BrTransitCourtDressing | undefined {
  const region = input.elevationRegions.find(r => r.districtId === "transit-court");
  const road = input.roads.find(r => r.id === "transit-court-main");
  const buildings = input.structures.filter(s => s.districtId === "transit-court" && s.enterable);
  if (!region || !road || buildings.length !== 4) return undefined;
  const floor = region.height, streetX = road.from.x;
  const parts: BrAuthoredSecondaryPart[] = [], signs: BrTransitCourtSign[] = [];
  const add = (name: string, geometry: BrAuthoredSecondaryPart["geometry"], finish: BrAuthoredSecondaryPart["finish"],
    x: number, y: number, z: number, sx: number, sy: number, sz: number, surface = false) => {
    parts.push({ name, geometry, finish, position: { x, y, z }, scale: { x: sx, y: sy, z: sz }, rotationY: 0, surface });
  };
  const paving = (name: string, finish: BrAuthoredSecondaryPart["finish"], x: number, z: number, sx: number, sz: number, layer = .02) =>
    add(name, "box", finish, x, floor + layer, z, sx, .012, sz, true);
  const westEdge = streetX - road.width / 2, eastEdge = streetX + road.width / 2;
  // Sidewalks stop before either grade. The west ribbon is interrupted at the
  // authored service cross-street; no paving hides the road surface there.
  for (const [side, x] of [["west", westEdge - 2], ["east", eastEdge + 2]] as const) {
    const runs = side === "west" ? [[64, 89.8], [96.2, 123]] : [[64, 123]];
    for (const [start, end] of runs) {
      paving(`${side}-sidewalk-${start}`, "sidewalk", x, (start + end) / 2, 3.5, end - start);
      paving(`${side}-street-border-${start}`, "brushedMetal", side === "west" ? westEdge - .35 : eastEdge + .35,
        (start + end) / 2, .15, end - start, .034);
    }
  }
  const names: Record<string, [string, string]> = {
    "transit-cafe": ["COURT CAFE", "COFFEE / PROVISIONS"],
    "transit-service-store": ["SERVICE STORE", "SUPPLIES / REPAIR"],
    "transit-ticket-hall": ["TRANSIT COURT", "TICKETS / CONNECTIONS"],
    "transit-maintenance": ["TRANSIT SERVICE", "MAINTENANCE 04"],
  };
  for (const building of buildings) {
    const eastFacing = building.entrance === "east", direction = eastFacing ? 1 : -1;
    const facadeX = building.position.x + direction * building.size.x / 2;
    const walkX = eastFacing ? westEdge - 3.75 : eastEdge + 3.75;
    const span = Math.abs(walkX - facadeX), x = (walkX + facadeX) / 2;
    // Whole-frontage forecourts give the small buildings a shared civic scale;
    // the contrasting 3.2m entry strip leads directly to each centered door.
    paving(`${building.id}-forecourt`, "concrete", x, building.position.z, span, building.size.z);
    paving(`${building.id}-entry-path`, "sidewalk", x, building.position.z, span, 3.2, .034);
    for (const end of [-1, 1]) paving(`${building.id}-apron-border-${end}`, "paintedMetal", x,
      building.position.z + end * (building.size.z / 2 - .15), span, .16, .034);
    const signY = building.position.y + 3.5;
    const label = names[building.id];
    if (label) signs.push({ text: label[0], subtitle: label[1], position: { x: facadeX + direction * .035, y: signY, z: building.position.z },
      rotationY: direction * Math.PI / 2, width: 4.6, height: .8 });
  }
  // Two quiet waiting gardens occupy the inter-building gaps. Tall crowns
  // frame the street; thin stems and low open benches do not suggest cover.
  for (const [id, x, z] of [["west", 105, 94], ["east", 172, 94], ["south-store", 110, 133]] as const) {
    paving(`${id}-garden`, "soil", x, z, 5.8, 5.8);
    for (const dx of [-2.85, 2.85]) paving(`${id}-garden-edge-${dx}`, "concrete", x + dx, z, .12, 5.8, .034);
    add(`${id}-tree-stem`, "cylinder", "structuralDark", x, floor + 2.7, z, .14, 5.4, .14);
    add(`${id}-tree-crown`, "octahedron", "canopy", x, floor + 5.55, z, 2.4, 2.2, 2.4);
    add(`${id}-tree-crown-top`, "octahedron", "canopy", x + .3, floor + 6.9, z, 1.55, 1.35, 1.55);
    const seatX = id === "east" ? x - 4 : x + 4;
    paving(`${id}-seat-apron`, "sidewalk", seatX, z, 1.8, 4);
    for (const dx of [-.2, 0, .2]) add(`${id}-seat-slat-${dx}`, "box", "brushedMetal", seatX + dx, floor + .46, z, .15, .09, 2.8);
    for (const dz of [-.9, .9]) add(`${id}-seat-foot-${dz}`, "box", "structuralDark", seatX, floor + .21, z + dz, .52, .42, .1);
  }
  // Timetable lamps sit between the door approaches, outside the west cross
  // street. Small attached cards and warm downlights read as transit furniture.
  for (const [id, x, z] of [["cafe-stop", 126, 85.5], ["hall-stop", 148, 87], ["service-stop", 148, 101]] as const) {
    add(`${id}-post`, "box", "structuralDark", x, floor + 1.9, z, .1, 3.8, .1);
    add(`${id}-head`, "box", "paintedMetal", x, floor + 3.78, z, .75, .12, .3);
    add(`${id}-light`, "box", "windowLit", x, floor + 3.712, z, .54, .016, .18);
    add(`${id}-timetable`, "box", "structuralWhite", x, floor + 1.9, z - .06, .42, .64, .045);
  }
  // Trim is glued to the INSIDE face of authoritative retaining blocks. No
  // new perimeter walls or parapets; the central ramp corridor remains bare.
  for (const wall of input.retainingBlocks.filter(b => b.districtId === "transit-court" && b.id.includes("-retaining-"))) {
    const vertical = wall.size.x < wall.size.z;
    const length = vertical ? wall.size.z : wall.size.x;
    const faceX = vertical ? wall.position.x + Math.sign(region.x - wall.position.x) * (wall.size.x / 2 + .012) : wall.position.x;
    const faceZ = vertical ? wall.position.z : wall.position.z + Math.sign(region.z - wall.position.z) * (wall.size.z / 2 + .012);
    const intervals = vertical ? [[-length / 2, length / 2]] : [[-length / 2, streetX - road.width / 2 - 1 - wall.position.x], [streetX + road.width / 2 + 1 - wall.position.x, length / 2]];
    for (const [start, end] of intervals) for (const h of [.28, wall.size.y - .28]) {
      if (end <= start) continue;
      add(`${wall.id}-band-${start}-${h}`, "box", h < 1 ? "paintedMetal" : "brushedMetal",
        faceX + (vertical ? 0 : (start + end) / 2), wall.position.y - wall.size.y / 2 + h,
        faceZ + (vertical ? (start + end) / 2 : 0), vertical ? .024 : end - start, .16, vertical ? end - start : .024);
    }
    for (const along of [-length * .35, 0, length * .35]) {
      if (!vertical && Math.abs(wall.position.x + along - streetX) < road.width / 2 + 1) continue;
      add(`${wall.id}-joint-${along}`, "box", "paintedMetal", faceX + (vertical ? 0 : along), wall.position.y,
        faceZ + (vertical ? along : 0), vertical ? .024 : .12, wall.size.y - .12, vertical ? .12 : .024);
    }
  }
  const groups = new Map<string, BrTransitCourtDressing["batches"][number]>();
  for (const part of parts) {
    const key = `${part.geometry}:${part.finish}:${part.surface}`;
    let batch = groups.get(key);
    if (!batch) { batch = { geometry: part.geometry, finish: part.finish, surface: part.surface, parts: [] }; groups.set(key, batch); }
    batch.parts.push(part);
  }
  return { center: { x: region.x, y: floor, z: region.z }, radius: Math.hypot(region.width, region.depth) / 2 + .1,
    parts, signs, batches: [...groups.values()] };
}
