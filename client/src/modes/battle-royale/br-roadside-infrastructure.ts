import {
  BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_ROADS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES, BR_TRAVERSAL,
  type BrDistrictStyle, type BrMapBlock, type BrRoadSegment, type BrSecondaryLocation, type BrStructure, type Vec3
} from "@planetfall/shared";

export type RoadsideFinish = "sidewalk" | "structuralDark" | "brushedMetal" | "windowLit"
  | "industrialOrange" | "energyPurple" | "energyCyan" | "grass" | "warningRed" | "soil" | "canopy";
export interface RoadsidePart {
  geometry: "box" | "cylinder" | "octahedron";
  finish: RoadsideFinish;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  surface: boolean;
}
export interface RoadsideSite {
  roadId: string;
  locationId: string;
  style: BrDistrictStyle;
  center: Vec3;
  parts: RoadsidePart[];
}
interface RoadsideInputs {
  roads: readonly BrRoadSegment[];
  locations: readonly BrSecondaryLocation[];
  structures: readonly BrStructure[];
  blocks: readonly BrMapBlock[];
  outline: readonly (readonly [number, number])[];
  traversal: readonly { position: Vec3 }[];
}

const SITE_RADIUS = 4;
const MAX_SITES = 22;
const defaults: RoadsideInputs = {
  roads: BR_ROADS, locations: BR_SECONDARY_LOCATIONS, structures: BR_STRUCTURES,
  blocks: BR_MAP_BLOCKS, outline: BR_ISLAND_OUTLINE, traversal: BR_TRAVERSAL
};
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const finitePoint = (p: Vec3) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
const segmentDistance = (p: Vec3, from: Vec3, to: Vec3) => {
  const dx = to.x - from.x, dz = to.z - from.z, squared = dx * dx + dz * dz;
  const t = squared > 0 ? Math.max(0, Math.min(1, ((p.x - from.x) * dx + (p.z - from.z) * dz) / squared)) : 0;
  return Math.hypot(p.x - from.x - t * dx, p.z - from.z - t * dz);
};

function insideDeck(center: Vec3, outline: RoadsideInputs["outline"]): boolean {
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const [x, z] = outline[index], [px, pz] = outline[previous];
    if ((z > center.z) !== (pz > center.z) && center.x < (px - x) * (center.z - z) / (pz - z) + x) inside = !inside;
    if (segmentDistance(center, { x, y: 0, z }, { x: px, y: 0, z: pz }) < SITE_RADIUS + 2) return false;
  }
  return inside;
}

function siteClear(center: Vec3, roads: RoadsideInputs["roads"], inputs: RoadsideInputs, sites: RoadsideSite[]): boolean {
  if (!insideDeck(center, inputs.outline)) return false;
  for (const road of roads) {
    if (segmentDistance(center, road.from, road.to) < road.width / 2 + SITE_RADIUS + 2) return false;
    if (Math.min(distance(center, road.from), distance(center, road.to)) < SITE_RADIUS + 32) return false;
  }
  for (const structure of inputs.structures) {
    const dx = Math.max(0, Math.abs(center.x - structure.position.x) - structure.size.x / 2);
    const dz = Math.max(0, Math.abs(center.z - structure.position.z) - structure.size.z / 2);
    if (Math.hypot(dx, dz) < SITE_RADIUS + 4) return false;
  }
  for (const block of inputs.blocks) {
    if (!["cover", "ramp", "bridge"].includes(block.kind)) continue;
    // A sphere around authored cover/access geometry is conservative even when
    // a ramp rotates about X/Z. No renderer-only interpretation of its slope.
    const radius = Math.hypot(block.size.x, block.size.y, block.size.z) / 2;
    if (distance(center, block.position) < radius + SITE_RADIUS + 2) return false;
  }
  if (inputs.traversal.some(t => distance(center, t.position) < SITE_RADIUS + 8)) return false;
  return sites.every(site => distance(center, site.center) >= 32);
}

function partsForSite(center: Vec3, angle: number, style: BrDistrictStyle): RoadsidePart[] {
  const transit = style === "city" || style === "mall" || style === "academy" || style === "nexus";
  const accent: RoadsideFinish = style === "wreck" ? "warningRed"
    : style === "farm" ? "grass"
    : style === "city" || style === "mall" || style === "academy" ? "energyPurple"
    : style === "nexus" ? "energyCyan" : "industrialOrange";
  const parts: RoadsidePart[] = [];
  const add = (finish: RoadsideFinish, x: number, y: number, z: number, width: number, height: number, depth: number, surface = false,
    geometry: RoadsidePart["geometry"] = "box") => {
    parts.push({ geometry, finish, surface, rotationY: -angle,
      position: { x: center.x + Math.cos(angle) * x - Math.sin(angle) * z, y, z: center.z + Math.sin(angle) * x + Math.cos(angle) * z },
      scale: { x: width, y: height, z: depth }
    });
  };
  // Painted shoulder bay: no raised pad, enclosing walls, or broad false cover.
  for (const side of [-1, 1]) {
    add("sidewalk", 0, .055, side * 1.65, 5.5, .012, .09, true);
    add(accent, side * 2.7, .055, 0, .09, .012, 3.3, true);
  }
  // A slender stop/service marker at the back of the bay, facing the road.
  add("brushedMetal", -2.1, 1.45, 1.1, .12, 2.9, .12);
  add("structuralDark", -2.1, 2.36, 1.1, .58, .82, .12);
  add(accent, -2.1, 2.58, 1.015, .42, .12, .04);
  add("windowLit", -2.1, 2.32, 1.015, .38, .06, .04);
  add("windowLit", -2.18, 2.14, 1.015, .22, .045, .04);
  add(accent, -2.1, 2.95, 1.1, .24, .08, .24);
  if (transit) {
    // Small waiting-position inlays, not benches or opaque shelter panels.
    for (const x of [-.7, .3, 1.3]) add("sidewalk", x, .055, .85, .5, .012, .1, true);
    // One deliberately stylized tree turns the bay into a recognizable rest
    // pocket without filling the road corridor. Its complete crown remains
    // inside the site's already-tested clearance circle and carries no
    // collision or camera obstruction. Nexus trees are artificial cyan forms;
    // the other districts use the shared soft canopy material.
    add("soil", 1.15, .1, -.82, 2.25, .1, 1.05, false);
    add("soil", 1.15, 1.2, -.82, .22, 2.4, .22, false, "cylinder");
    const foliage: RoadsideFinish = style === "nexus" ? "energyCyan" : "canopy";
    add(foliage, 1.15, 3.05, -.82, 1.08, 1.42, 1.08, false, "octahedron");
    add(foliage, .82, 3.82, -.72, .64, .82, .64, false, "octahedron");
    add(foliage, .38, 2.92, -.72, .58, .72, .58, false, "octahedron");
    add(foliage, 1.83, 3.2, -.88, .54, .68, .54, false, "octahedron");
    add(accent, 1.15, .18, -.82, 1.65, .035, .08, false);
  } else {
    // Flush service grate lends utility/farm corridors a different ground kit.
    for (let rib = 0; rib < 5; rib++) add("brushedMetal", .5 + rib * .25, .055, .3, .1, .012, 1.1, true);
  }
  return parts;
}

/** At most twenty-two sparse roadside rest/service pockets. Sorts copies, accepts authored geometry as
 * exclusion input, and never modifies road/collider/navigation data. All parts
 * use cached primitive geometry; surface parts use materials.surface(finish, 6).
 * Keep every generated instance cameraCollision=false and apply visual LOD. */
export function buildRoadsideInfrastructure(overrides: Partial<RoadsideInputs> = {}): RoadsideSite[] {
  const inputs = { ...defaults, ...overrides };
  const roads = inputs.roads.filter(road => finitePoint(road.from) && finitePoint(road.to) && Number.isFinite(road.width) && road.width > 0);
  const locations = inputs.locations.filter(location => finitePoint(location.position));
  if (!locations.length) return [];
  // The rebuilt network uses shorter authored approach segments in addition to
  // long arterials. Include those medium corridors, while the full clearance
  // pass below still prevents bays from occupying intersections or local lanes.
  const ordered = [...roads].filter(road => distance(road.from, road.to) >= 82)
    .sort((a, b) => distance(b.from, b.to) - distance(a.from, a.to) || a.id.localeCompare(b.id));
  const sites: RoadsideSite[] = [];
  for (const road of ordered) {
    if (sites.length >= MAX_SITES) break;
    const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, length = Math.hypot(dx, dz);
    const preferredSide = [...road.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 2 ? 1 : -1;
    let placed = false;
    for (const t of [.5, .35, .65, .24, .76]) {
      for (const side of [preferredSide, -preferredSide]) {
        const offset = road.width / 2 + SITE_RADIUS + 2.5;
        const center = { x: road.from.x + dx * t - dz / length * offset * side, y: 0, z: road.from.z + dz * t + dx / length * offset * side };
        if (!siteClear(center, roads, inputs, sites)) continue;
        const location = [...locations].sort((a, b) => {
          const score = (entry: BrSecondaryLocation) => Math.min(distance(entry.position, road.from), distance(entry.position, road.to)) < 1
            ? -1 : distance(entry.position, center);
          return score(a) - score(b) || a.id.localeCompare(b.id);
        })[0];
        sites.push({ roadId: road.id, locationId: location.id, style: location.style, center,
          parts: partsForSite(center, Math.atan2(dz, dx) + (side < 0 ? Math.PI : 0), location.style) });
        placed = true;
        break;
      }
      if (placed) break;
    }
  }
  return sites;
}
