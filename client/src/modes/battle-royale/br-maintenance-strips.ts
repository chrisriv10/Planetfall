import {
  BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, BR_TRAVERSAL,
  type BrMapBlock, type BrRoadSegment, type BrStructure, type Vec3
} from "@planetfall/shared";

export interface MaintenanceStripPart {
  finish: "structuralDark" | "brushedMetal" | "energyCyan";
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  layer: 6 | 7;
}
export interface MaintenanceStrip {
  roadId: string;
  center: Vec3;
  parts: MaintenanceStripPart[];
}
interface MaintenanceInputs {
  roads: readonly BrRoadSegment[];
  structures: readonly BrStructure[];
  blocks: readonly BrMapBlock[];
  traversal: readonly { position: Vec3 }[];
  outline: readonly (readonly [number, number])[];
}
const defaults: MaintenanceInputs = {
  roads: BR_ROADS, structures: BR_STRUCTURES, blocks: BR_MAP_BLOCKS,
  traversal: BR_TRAVERSAL, outline: BR_ISLAND_OUTLINE
};
const radius = 6.5;
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const distanceToSegment = (p: Vec3, a: Vec3, b: Vec3) => {
  const dx = b.x - a.x, dz = b.z - a.z, lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSquared)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};

function clear(center: Vec3, inputs: MaintenanceInputs, strips: MaintenanceStrip[]): boolean {
  let inside = false;
  for (let i = 0, j = inputs.outline.length - 1; i < inputs.outline.length; j = i++) {
    const [x, z] = inputs.outline[i], [px, pz] = inputs.outline[j];
    if ((z > center.z) !== (pz > center.z) && center.x < (px - x) * (center.z - z) / (pz - z) + x) inside = !inside;
    if (distanceToSegment(center, { x, y: 0, z }, { x: px, y: 0, z: pz }) < radius + 2) return false;
  }
  if (!inside) return false;
  for (const road of inputs.roads) {
    if (distanceToSegment(center, road.from, road.to) < road.width / 2 + radius + 2) return false;
    if (Math.min(distance(center, road.from), distance(center, road.to)) < radius + 24) return false;
  }
  for (const structure of inputs.structures) {
    const dx = Math.max(0, Math.abs(center.x - structure.position.x) - structure.size.x / 2);
    const dz = Math.max(0, Math.abs(center.z - structure.position.z) - structure.size.z / 2);
    if (Math.hypot(dx, dz) < radius + 4) return false;
  }
  for (const block of inputs.blocks) {
    if (!["cover", "ramp", "bridge"].includes(block.kind)) continue;
    // Conservative for all authored rotations, including sloped access ramps.
    if (distance(center, block.position) < radius + 2 + Math.hypot(block.size.x, block.size.y, block.size.z) / 2) return false;
  }
  if (inputs.traversal.some(t => distance(center, t.position) < radius + 8)) return false;
  return strips.every(strip => distance(center, strip.center) >= 24);
}

function parts(center: Vec3, angle: number, plate: boolean): MaintenanceStripPart[] {
  const result: MaintenanceStripPart[] = [];
  const add = (finish: MaintenanceStripPart["finish"], x: number, z: number, width: number, depth: number, layer: 6 | 7) => {
    result.push({ finish, layer, rotationY: -angle,
      position: { x: center.x + Math.cos(angle) * x - Math.sin(angle) * z, y: layer === 6 ? .046 : .062,
        z: center.z + Math.sin(angle) * x + Math.cos(angle) * z },
      scale: { x: width, y: .008, z: depth }
    });
  };
  // Dark inlay and thin metal lips suggest a flush covered conduit trench.
  add("structuralDark", 0, 0, 12, 1.1, 6);
  for (const z of [-.57, .57]) add("brushedMetal", 0, z, 12, .07, 7);
  for (const x of plate ? [-4, 4] : [-4, 0, 4]) add("brushedMetal", x, 0, .08, 1.02, 7);
  // Short lights leave most of the trench quiet, rather than a continuous neon road.
  for (const x of [-2, 2]) add("energyCyan", x, -.34, .75, .065, 7);
  if (plate) {
    add("brushedMetal", 0, 0, 1.6, .86, 7);
    // Two inset handle slots are offset on top of the hatch, kept under 8cm.
    for (const x of [-.48, .48]) {
      add("structuralDark", x, .18, .28, .07, 7);
      result[result.length - 1].position.y = .074;
    }
  }
  return result;
}

/** Pure, bounded visual dressing: <=18 strips, <=198 unit boxes. Every piece
 * stays below 8cm; there are no posts, crates or new colliders. Batch by finish
 * and layer with materials.surface(finish, layer), cameraCollision=false.
 * World-space coordinates support a per-strip detail group centered on center. */
export function buildMaintenanceStrips(overrides: Partial<MaintenanceInputs> = {}): MaintenanceStrip[] {
  const inputs = { ...defaults, ...overrides };
  const valid = (road: BrRoadSegment) => Number.isFinite(road.width) && road.width > 0
    && [road.from.x, road.from.z, road.to.x, road.to.z].every(Number.isFinite);
  inputs.roads = inputs.roads.filter(valid);
  const ordered = [...inputs.roads].filter(road => distance(road.from, road.to) >= 140)
    .sort((a, b) => distance(b.from, b.to) - distance(a.from, a.to) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const strips: MaintenanceStrip[] = [];
  for (const road of ordered) {
    const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, length = Math.hypot(dx, dz);
    const seed = [...road.id].reduce((value, char) => value + char.charCodeAt(0), 0);
    const side = seed % 2 ? 1 : -1;
    let count = 0;
    for (const t of [.3, .7, .5]) {
      if (strips.length >= 18) return strips;
      for (const direction of [side, -side]) {
        const offset = road.width / 2 + radius + 2.5;
        const center = { x: road.from.x + dx * t - dz / length * offset * direction, y: 0,
          z: road.from.z + dz * t + dx / length * offset * direction };
        if (!clear(center, inputs, strips)) continue;
        strips.push({ roadId: road.id, center, parts: parts(center, Math.atan2(dz, dx), (seed + count) % 3 === 0) });
        count++;
        break;
      }
      if (count === 2) break;
    }
  }
  return strips;
}
