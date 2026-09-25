import {
  BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES,
  type BrMapBlock, type BrRoadSegment, type BrStructure, type Vec3
} from "@planetfall/shared";

export type BrCorridorGrovePart = {
  geometry: "cylinder" | "octahedron" | "box";
  finish: "soil" | "canopy" | "sidewalk" | "brushedMetal";
  position: Vec3;
  scale: Vec3;
  rotationY: number;
};

export const BR_CORRIDOR_GROVE_MAX = 22;
export const BR_CORRIDOR_TREES_PER_GROVE = 4;

type Inputs = {
  roads: readonly BrRoadSegment[];
  structures: readonly BrStructure[];
  blocks: readonly BrMapBlock[];
  outline: readonly (readonly [number, number])[];
};

const distanceToSegment = (point: Vec3, road: BrRoadSegment): number => {
  const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z;
  const length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((point.x - road.from.x) * dx + (point.z - road.from.z) * dz) / length)) : 0;
  return Math.hypot(point.x - road.from.x - dx * t, point.z - road.from.z - dz * t);
};

const inside = (point: Vec3, outline: Inputs["outline"]): boolean => {
  let result = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const [x, z] = outline[index], [px, pz] = outline[previous];
    if ((z > point.z) !== (pz > point.z) && point.x < (px - x) * (point.z - z) / (pz - z) + x) result = !result;
  }
  return result;
};

const clear = (point: Vec3, inputs: Inputs): boolean => inside(point, inputs.outline)
  && inputs.roads.every(road => distanceToSegment(point, road) > road.width / 2 + 5)
  && inputs.structures.every(structure => Math.hypot(
    Math.max(0, Math.abs(point.x - structure.position.x) - structure.size.x / 2),
    Math.max(0, Math.abs(point.z - structure.position.z) - structure.size.z / 2)
  ) > 6)
  && inputs.blocks.every(block => Math.hypot(point.x - block.position.x, point.z - block.position.z) > Math.hypot(block.size.x, block.size.z) / 2 + 4);

/** Sparse, visual-only planting pockets that frame long rotations. They stay
 * outside roads and gameplay geometry, and deliberately leave broad sightlines. */
export function buildBrCorridorGroves(overrides: Partial<Inputs> = {}): BrCorridorGrovePart[] {
  const inputs: Inputs = { roads: BR_ROADS, structures: BR_STRUCTURES, blocks: BR_MAP_BLOCKS, outline: BR_ISLAND_OUTLINE, ...overrides };
  const parts: BrCorridorGrovePart[] = [];
  const centers: Vec3[] = [];
  for (const road of inputs.roads.filter(entry => Math.hypot(entry.to.x - entry.from.x, entry.to.z - entry.from.z) > 145)) {
    if (centers.length >= BR_CORRIDOR_GROVE_MAX) break;
    const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, length = Math.hypot(dx, dz);
    for (const t of [.24, .5, .76]) {
      if (centers.length >= BR_CORRIDOR_GROVE_MAX) break;
      for (const side of [-1, 1]) {
        const offset = road.width / 2 + 11;
        const center = { x: road.from.x + dx * t - dz / length * offset * side, y: 0, z: road.from.z + dz * t + dx / length * offset * side };
        if (!clear(center, inputs) || centers.some(previous => Math.hypot(center.x - previous.x, center.z - previous.z) < 32)) continue;
        centers.push(center);
        const heading = Math.atan2(dz, dx);
        // Four distinct silhouettes create a readable grove rather than an
        // isolated decorative tree, while leaving the road and combat lane
        // deliberately open.
        for (let tree = 0; tree < BR_CORRIDOR_TREES_PER_GROVE; tree++) {
          const along = (tree - 1.5) * 3.75;
          const across = (tree % 2 ? 1 : -1) * 1.35;
          const x = center.x + Math.cos(heading) * along - Math.sin(heading) * across;
          const z = center.z + Math.sin(heading) * along + Math.cos(heading) * across;
          const height = 2.8 + ((centers.length + tree) % 3) * .65;
          parts.push({ geometry: "box", finish: "soil", position: { x, y: .08, z }, scale: { x: 2.3, y: .12, z: 2.3 }, rotationY: heading });
          parts.push({ geometry: "cylinder", finish: "soil", position: { x, y: height / 2, z }, scale: { x: .16, y: height, z: .16 }, rotationY: heading });
          parts.push({ geometry: "octahedron", finish: "canopy", position: { x, y: height + 1.05, z }, scale: { x: 1.05 + (tree % 3) * .18, y: 1.25 + (tree % 2) * .45, z: 1.05 + ((tree + 1) % 3) * .12 }, rotationY: heading + tree * .31 });
        }
        parts.push({ geometry: "box", finish: "sidewalk", position: { x: center.x, y: .02, z: center.z }, scale: { x: 14.5, y: .01, z: .18 }, rotationY: heading });
        break;
      }
    }
  }
  return parts;
}
