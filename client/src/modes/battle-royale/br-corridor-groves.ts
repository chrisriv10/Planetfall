import {
  BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, BR_TRAVERSAL,
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
  traversal: readonly { position: Vec3 }[];
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

/** Containing circles protect the entire rotated planter/crown/strip, not just
 * trunks. A rejected candidate is omitted rather than shrinking its clearance. */
function partClear(part: BrCorridorGrovePart, inputs: Inputs): boolean {
  const point = part.position;
  const radius = part.geometry === "box" ? Math.hypot(part.scale.x, part.scale.z) / 2 : Math.max(part.scale.x, part.scale.z);
  if (!inside(point, inputs.outline)) return false;
  for (let i = 0, j = inputs.outline.length - 1; i < inputs.outline.length; j = i++) {
    const [x, z] = inputs.outline[i], [px, pz] = inputs.outline[j];
    if (distanceToSegment(point, { from: { x, y: 0, z }, to: { x: px, y: 0, z: pz }, width: 0, id: "edge", color: "" }) < radius + 1) return false;
  }
  if (inputs.roads.some(road => distanceToSegment(point, road) < road.width / 2 + radius + 2)) return false;
  if (inputs.structures.some(structure => Math.hypot(
    Math.max(0, Math.abs(point.x - structure.position.x) - structure.size.x / 2),
    Math.max(0, Math.abs(point.z - structure.position.z) - structure.size.z / 2)
  ) < radius + 2)) return false;
  if (inputs.blocks.some(block => Math.hypot(point.x - block.position.x, point.z - block.position.z)
    < Math.hypot(block.size.x, block.size.y, block.size.z) / 2 + radius + 1)) return false;
  return inputs.traversal.every(item => Math.hypot(point.x - item.position.x, point.z - item.position.z) >= radius + 6);
}

/** Sparse, visual-only planting pockets that frame long rotations. They stay
 * outside roads and gameplay geometry, and deliberately leave broad sightlines. */
export function buildBrCorridorGroves(overrides: Partial<Inputs> = {}): BrCorridorGrovePart[] {
  const inputs: Inputs = { roads: BR_ROADS, structures: BR_STRUCTURES, blocks: BR_MAP_BLOCKS, outline: BR_ISLAND_OUTLINE, traversal: BR_TRAVERSAL, ...overrides };
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
        const heading = Math.atan2(dz, dx);
        const treePositions = Array.from({ length: BR_CORRIDOR_TREES_PER_GROVE }, (_, tree) => {
          const along = (tree - 1.5) * 3.75;
          const across = (tree % 2 ? 1 : -1) * 1.35;
          return {
            x: center.x + Math.cos(heading) * along - Math.sin(heading) * across,
            y: 0,
            z: center.z + Math.sin(heading) * along + Math.cos(heading) * across
          };
        });
        // A center can be clear while one end of the composed grove clips a
        // crossing road or a neighbouring facade. Validate the actual trunks
        // before accepting the cluster so density never creates false cover.
        if (treePositions.some(tree => !clear(tree, inputs))) continue;
        const kit: BrCorridorGrovePart[] = [];
        const add = (geometry: BrCorridorGrovePart["geometry"], finish: BrCorridorGrovePart["finish"],
          anchor: Vec3, along: number, across: number, y: number, width: number, height: number, depth: number) => {
          kit.push({ geometry, finish, rotationY: -heading, position: {
            x: anchor.x + Math.cos(heading) * along - Math.sin(heading) * across,
            y, z: anchor.z + Math.sin(heading) * along + Math.cos(heading) * across
          }, scale: { x: width, y: height, z: depth } });
        };
        // Four distinct silhouettes create a readable grove rather than an
        // isolated decorative tree, while leaving the road and combat lane
        // deliberately open.
        for (let tree = 0; tree < treePositions.length; tree++) {
          const { x, z } = treePositions[tree];
          const height = 2.8 + ((centers.length + 1 + tree) % 3) * .65;
          const anchor = { x, y: 0, z };
          add("box", "soil", anchor, 0, 0, .08, 2.3, .12, 2.3);
          add("cylinder", "soil", anchor, 0, 0, height / 2, .16, height, .16);
          add("octahedron", "canopy", anchor, 0, 0, height + 1.05,
            1.05 + (tree % 3) * .18, 1.25 + (tree % 2) * .45, 1.05 + ((tree + 1) % 3) * .12);
          kit[kit.length - 1].rotationY += tree * .31;
          // Two low irrigation rails frame each soil cell without surrounding
          // it with a wall. The open ends and gaps preserve the grove's rhythm.
          for (const across of [-1.18, 1.18]) add("box", "brushedMetal", anchor, 0, across, .16, 2.5, .1, .09);
          // Only two of the four trees receive a subordinate crown. Keep their
          // silhouettes airy and reuse the existing camera-fading canopy finish.
          if (tree % 2) add("octahedron", "canopy", anchor, .58, .12, height + 1.8, .6, .72, .54);
        }
        // A broken alignment strip follows the same road heading as the trees.
        // Three.js rotates local X toward -Z, hence rotationY=-heading above.
        for (const along of [-4.6, 0, 4.6]) add("box", "sidewalk", center, along, 0, .02, 4.2, .01, .18);
        if (kit.some(part => !partClear(part, inputs))) continue;
        centers.push(center); parts.push(...kit);
        break;
      }
    }
  }
  return parts;
}
