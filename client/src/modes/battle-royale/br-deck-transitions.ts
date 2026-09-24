import {
  BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_ROADS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES, BR_TERRAIN_PATCHES, BR_TRAVERSAL,
  type BrMapBlock, type BrRoadSegment, type BrSecondaryLocation, type BrStructure, type BrTerrainPatch, type Vec3
} from "@planetfall/shared";
import { buildMaintenanceStrips } from "./br-maintenance-strips";
import { buildRoadsideInfrastructure } from "./br-roadside-infrastructure";

export const BR_DECK_TRANSITION_RADIUS = 9;
export interface DeckTransitionPart {
  finish: "paintedMetal" | "concrete" | "brushedMetal" | "sidewalk" | "industrialOrange" | "grass";
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  layer: 6 | 7;
}
export interface DeckTransitionSite {
  roadId: string;
  patchId: string;
  center: Vec3;
  parts: DeckTransitionPart[];
}
interface TransitionInputs {
  roads: readonly BrRoadSegment[];
  structures: readonly BrStructure[];
  blocks: readonly BrMapBlock[];
  locations: readonly BrSecondaryLocation[];
  patches: readonly BrTerrainPatch[];
  traversal: readonly { position: Vec3 }[];
  outline: readonly (readonly [number, number])[];
  reserved: readonly { position: Vec3; radius: number }[];
}
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const segmentDistance = (p: Vec3, a: Vec3, b: Vec3) => {
  const dx = b.x - a.x, dz = b.z - a.z, sq = dx * dx + dz * dz;
  const t = sq ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / sq)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};
const boxDistance = (p: Vec3, position: Vec3, size: Vec3, rotation = 0) => {
  const dx = p.x - position.x, dz = p.z - position.z;
  const localX = dx * Math.cos(rotation) - dz * Math.sin(rotation);
  const localZ = dx * Math.sin(rotation) + dz * Math.cos(rotation);
  return Math.hypot(Math.max(0, Math.abs(localX) - size.x / 2), Math.max(0, Math.abs(localZ) - size.z / 2));
};

/** Mirrors the renderer's actual existing roadside/maintenance exclusion call.
 * Call at world construction only; callers with cached sites may pass reserved
 * directly to avoid rebuilding these deterministic presentation specs. */
export function existingDeckTransitionReservations(): TransitionInputs["reserved"] {
  const roadside = buildRoadsideInfrastructure();
  const maintenance = buildMaintenanceStrips({ traversal: [...BR_TRAVERSAL, ...roadside.map(site => ({ position: site.center }))] });
  const utilityBoxes = BR_ROADS.map(road => {
    const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, length = Math.hypot(dx, dz);
    return { position: { x: road.from.x + dx * .58 - dz / length * road.width * .74, y: 0,
      z: road.from.z + dz * .58 + dx / length * road.width * .74 }, radius: 1 };
  });
  return [...roadside.map(site => ({ position: site.center, radius: 4 })),
    ...maintenance.map(site => ({ position: site.center, radius: 6.5 })), ...utilityBoxes];
}

function clear(center: Vec3, inputs: TransitionInputs, sites: DeckTransitionSite[]): boolean {
  const radius = BR_DECK_TRANSITION_RADIUS;
  let inside = false;
  for (let i = 0, j = inputs.outline.length - 1; i < inputs.outline.length; j = i++) {
    const [x, z] = inputs.outline[i], [px, pz] = inputs.outline[j];
    if ((z > center.z) !== (pz > center.z) && center.x < (px - x) * (center.z - z) / (pz - z) + x) inside = !inside;
    if (segmentDistance(center, { x, y: 0, z }, { x: px, y: 0, z: pz }) < radius + 3) return false;
  }
  if (!inside) return false;
  if (inputs.roads.some(road => segmentDistance(center, road.from, road.to) < road.width / 2 + radius + 3
    || Math.min(distance(center, road.from), distance(center, road.to)) < radius + 20)) return false;
  if (inputs.structures.some(s => boxDistance(center, s.position, s.size) < radius + 4)) return false;
  for (const block of inputs.blocks) {
    const clearance = block.rotation
      ? distance(center, block.position) - Math.hypot(block.size.x, block.size.y, block.size.z) / 2
      : boxDistance(center, block.position, block.size);
    if (clearance < radius + 3) return false;
  }
  if (inputs.patches.some(p => boxDistance(center, p.position, p.size, p.rotation) < radius + 2)) return false;
  // All corners of the rotated secondary kit fit within 38m of its center.
  if (inputs.locations.some(location => distance(center, location.position) < radius + 40)) return false;
  if (inputs.traversal.some(t => distance(center, t.position) < radius + 8)) return false;
  if (inputs.reserved.some(site => distance(center, site.position) < radius + site.radius + 2)) return false;
  return sites.every(site => distance(center, site.center) >= radius * 2 + 6);
}

function parts(center: Vec3, angle: number, kind: BrTerrainPatch["kind"]): DeckTransitionPart[] {
  const result: DeckTransitionPart[] = [];
  const accent: DeckTransitionPart["finish"] = kind === "industrial" ? "industrialOrange" : kind === "park" ? "grass" : "sidewalk";
  const add = (finish: DeckTransitionPart["finish"], x: number, z: number, width: number, depth: number, layer: 6 | 7 = 6) => {
    result.push({ finish, layer, rotationY: -angle,
      position: { x: center.x + Math.cos(angle) * x - Math.sin(angle) * z, y: layer === 6 ? .025 : .044,
        z: center.z + Math.sin(angle) * x + Math.cos(angle) * z },
      scale: { x: width, y: .01, z: depth }
    });
  };
  // Two dark inset plates, each 5 x 5.4m, separated by 2m of exposed deck.
  // No joining border or center seam: the ground visibly continues between
  // and around the plates instead of reading as one pale landing platform.
  for (const side of [-1, 1]) {
    add("paintedMetal", side * 3.5, 0, 5, 5.4);
    add("brushedMetal", side * 3.5, 2.9, 4.3, .055, 7);
  }
  // Short shoulder-transition bars, not route arrows or luminous boundary lines.
  for (const x of [-4.8, -3.5, -2.2]) add(accent, x, -2.2, .54, .14, 7);
  add("brushedMetal", 3.5, .5, 1.8, 1.2, 7);
  result[result.length - 1].position.y = .037;
  for (const side of [-1, 1]) add("paintedMetal", 3.5 + side * .55, .5, .065, .82, 7);
  return result;
}

/** <=12 approach fields / <=120 boxes, all tops <=4.9cm. Default inputs are
 * read-only authored data; existing presentation reservations are computed once
 * per build. Batch by finish+layer with unitBox/materials.surface(finish,layer),
 * cameraCollision=false. Put the global detail group behind quality !== low.
 * Replaces buildConnectiveDressing's legacy floating roadside hatches; utility
 * boxes remain separate and their current placements are reserved above. */
export function buildDeckTransitions(overrides: Partial<TransitionInputs> = {}): DeckTransitionSite[] {
  const inputs: TransitionInputs = {
    roads: BR_ROADS, structures: BR_STRUCTURES, blocks: BR_MAP_BLOCKS, locations: BR_SECONDARY_LOCATIONS,
    patches: BR_TERRAIN_PATCHES, traversal: BR_TRAVERSAL, outline: BR_ISLAND_OUTLINE,
    reserved: overrides.reserved ?? existingDeckTransitionReservations(), ...overrides
  };
  inputs.roads = inputs.roads.filter(road => [road.from.x, road.from.z, road.to.x, road.to.z, road.width].every(Number.isFinite)
    && road.width > 0 && distance(road.from, road.to) > 0);
  if (!inputs.patches.length || inputs.outline.length < 3 || inputs.outline.some(p => !p.every(Number.isFinite))) return [];
  const roads = [...inputs.roads].filter(road => distance(road.from, road.to) >= 150)
    .sort((a, b) => distance(b.from, b.to) - distance(a.from, a.to) || (a.id < b.id ? -1 : 1));
  const sites: DeckTransitionSite[] = [];
  for (const road of roads) {
    if (sites.length === 12) break;
    const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, length = Math.hypot(dx, dz);
    let placed = false;
    for (const t of [.22, .78, .38, .62]) {
      for (const side of [-1, 1]) {
        const offset = road.width / 2 + BR_DECK_TRANSITION_RADIUS + 4;
        const center = { x: road.from.x + dx * t - dz / length * offset * side, y: 0, z: road.from.z + dz * t + dx / length * offset * side };
        if (!clear(center, inputs, sites)) continue;
        const patch = [...inputs.patches].sort((a, b) => boxDistance(center, a.position, a.size, a.rotation)
          - boxDistance(center, b.position, b.size, b.rotation) || (a.id < b.id ? -1 : 1))[0];
        sites.push({ roadId: road.id, patchId: patch.id, center, parts: parts(center, Math.atan2(dz, dx), patch.kind) });
        placed = true;
        break;
      }
      if (placed) break;
    }
  }
  return sites;
}
