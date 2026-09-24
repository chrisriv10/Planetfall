import { BR_MAP_BLOCKS, type BrMapBlock, type BrStructure, type Vec3 } from "@planetfall/shared";

export interface MallCeilingEdgePart {
  finish: "structuralDark" | "brushedMetal" | "energyPurple" | "energyCyan";
  position: Vec3;
  scale: Vec3;
}
export interface MallCeilingEdge {
  slabId: string;
  parts: MallCeilingEdgePart[];
}
const validBlock = (block: BrMapBlock) => !block.rotation
  && Object.values(block.position).every(Number.isFinite)
  && Object.values(block.size).every(value => Number.isFinite(value) && value > 0);
const fits = (x: number, z: number, width: number, depth: number, block: BrMapBlock, margin: number) =>
  Math.abs(x - block.position.x) + width / 2 + margin < block.size.x / 2
  && Math.abs(z - block.position.z) + depth / 2 + margin < block.size.z / 2;

/** Shallow perimeter coffers on the real left-hand overhead slabs and roof.
 * This slim west-side band complements the existing central retail tracks; it
 * introduces no roof plane, imaginary skylight opening, hanging sign or rail.
 * Every box is at most 6cm below a supported ceiling and leaves the complete
 * east stair opening/landings and central ceiling field unobstructed.
 * World-space unitBox specs, shared get(finish) materials, cameraCollision=false. */
export function buildMallCeilingEdges(structure: BrStructure, blocks: readonly BrMapBlock[] = BR_MAP_BLOCKS): MallCeilingEdge[] {
  if (!structure.enterable || structure.districtId !== "void-mall"
    || !["void-anchor", "void-food-court"].includes(structure.id)
    || !Object.values(structure.position).every(Number.isFinite)
    || !Object.values(structure.size).every(value => Number.isFinite(value) && value > 0)) return [];
  const own = blocks.filter(block => block.id.startsWith(`${structure.id}-`));
  const slabs = own.filter(block => block.kind === "platform" && validBlock(block)
    && (block.id === `${structure.id}-roof` || new RegExp(`^${structure.id}-deck-[12]-left$`).test(block.id)))
    .sort((a, b) => a.position.y - b.position.y || (a.id < b.id ? -1 : 1)).slice(0, 3);
  const result: MallCeilingEdge[] = [];
  for (const slab of slabs) {
    const ceiling = slab.position.y - slab.size.y / 2;
    const x = structure.position.x - structure.size.x / 2 + 1.8;
    const span = Math.min(28, structure.size.z - 4);
    if (span < 8) continue;
    const count = Math.min(5, Math.floor(span / 4));
    const pitch = span / count;
    const parts: MallCeilingEdgePart[] = [];
    const add = (finish: MallCeilingEdgePart["finish"], px: number, pz: number, width: number, depth: number, lens = false) => {
      if (!fits(px, pz, width, depth, slab, .4)) return;
      const part: MallCeilingEdgePart = { finish,
        position: { x: px, y: ceiling - (lens ? .051 : .025), z: pz },
        scale: { x: width, y: lens ? .012 : .04, z: depth }
      };
      // A real floor below must provide headroom across this whole piece.
      const supports = own.filter(block => block.kind === "platform" && validBlock(block)
        && block.position.y < slab.position.y - .5 && fits(px, pz, width, depth, block, 0));
      const floorTop = supports.reduce((highest, block) => Math.max(highest, block.position.y + block.size.y / 2), -Infinity);
      if (!Number.isFinite(floorTop) || part.position.y - part.scale.y / 2 - floorTop < 3.2) return;
      // Short food-court rooms have partitions reaching the ceiling. Omit
      // intersecting modules rather than drawing decorative rails through them.
      const intersectsWall = own.some(block => block.kind === "wall" && validBlock(block)
        && Math.abs(part.position.x - block.position.x) < (part.scale.x + block.size.x) / 2 + .08
        && Math.abs(part.position.z - block.position.z) < (part.scale.z + block.size.z) / 2 + .08
        && Math.abs(part.position.y - block.position.y) < (part.scale.y + block.size.y) / 2 + .04);
      if (intersectsWall) return;
      parts.push(part);
    };
    for (let bay = 0; bay < count; bay++) {
      const z = structure.position.z - span / 2 + pitch * (bay + .5);
      // Open coffer: paired longitudinal lips and a short end batten; no fill.
      for (const side of [-1, 1]) add("structuralDark", x + side * .65, z, .1, pitch - .35);
      add("brushedMetal", x, z - pitch / 2 + .2, 1.2, .12);
      if (bay % 2 === 0) add(bay % 4 === 0 ? "energyPurple" : "energyCyan", x - .65, z, .045, .75, true);
    }
    if (parts.length) result.push({ slabId: slab.id, parts });
  }
  return result;
}
