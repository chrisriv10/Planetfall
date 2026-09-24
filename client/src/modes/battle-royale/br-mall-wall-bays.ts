import { BR_MAP_BLOCKS, type BrMapBlock, type BrStructure } from "@planetfall/shared";
import type { RetailPart } from "./br-retail-interiors";
import { buildMallDirectories } from "./br-mall-directories";

export type MallWallBayPart = Omit<RetailPart, "finish"> & {
  finish: "frame" | "panel" | "energyPurple" | "energyCyan";
};
export interface MallWallBay {
  wallId: string;
  floorId: string;
  parts: MallWallBayPart[];
}

/** Shallow architectural surround for the authored directory mounts. Flanking
 * pale bays sit behind slim dark pilasters, with no added surface in front of
 * the directory or across its viewing area. All geometry remains within 25cm
 * of the existing wall face. No raised floor, rail, kiosk or collider is made.
 * frame/panel reuse retailTargets; the two small emissive strips use the shared
 * energyPurple/energyCyan materials. All parts use the existing unitBox. */
export function buildMallWallBays(structure: BrStructure, blocks: readonly BrMapBlock[] = BR_MAP_BLOCKS): MallWallBay[] {
  const bays: MallWallBay[] = [];
  for (const directory of buildMallDirectories(structure, blocks)) {
    const wall = blocks.find(block => block.id === directory.wallId)!;
    const floor = blocks.find(block => block.id === directory.floorId)!;
    const face = wall.position.x + wall.size.x / 2;
    const z = directory.signs[0].position.z;
    const base = floor.position.y + floor.size.y / 2;
    const halfWidth = 3.25;
    if (Math.abs(z - wall.position.z) + halfWidth + .3 >= wall.size.z / 2
      || Math.abs(z - floor.position.z) + halfWidth >= floor.size.z / 2) continue;
    const ceiling = blocks.filter(block => block.id.startsWith(`${structure.id}-`) && block.kind === "platform"
      && !block.rotation && block.position.y > floor.position.y + .5
      && Math.abs(face + .2 - block.position.x) < block.size.x / 2
      && Math.abs(z - block.position.z) + halfWidth < block.size.z / 2)
      .reduce((lowest, block) => Math.min(lowest, block.position.y - block.size.y / 2), Infinity);
    if (!Number.isFinite(ceiling)) continue;
    const height = Math.min(6.2, ceiling - base - .25);
    if (height < 3) continue;
    const parts: MallWallBayPart[] = [];
    const add = (finish: MallWallBayPart["finish"], lateral: number, y: number, width: number, tall: number, offset: number, depth: number) =>
      parts.push({ finish, position: { x: face + offset, y: base + y, z: z + lateral }, scale: { x: depth, y: tall, z: width } });
    for (const side of [-1, 1]) {
      // Recess is made by layering a shallow panel behind its pilasters, never
      // by cutting or moving the authoritative wall.
      add("panel", side * 2.45, height / 2 + .08, 1.15, height - .16, .055, .07);
      add("frame", side * 3.1, height / 2, .22, height, .14, .2);
      add("frame", side * 1.78, height / 2, .12, height, .12, .16);
      add("frame", side * 2.45, .3, 1.15, .16, .14, .2);
      add("frame", side * 2.45, 1.06, 1.15, .055, .12, .12);
      add("frame", side * 2.45, height - .12, 1.15, .09, .14, .2);
      // One short light per flank: restrained color, not a luminous wall slab.
      add(side < 0 ? "energyPurple" : "energyCyan", side * 2.94, 2.02, .045, .86, .105, .02);
    }
    if (height > 4) {
      // Tall anchor levels receive a broad upper wall panel, well above the
      // directory and below the supported ceiling; food-court levels stay open.
      add("panel", 0, height - .65, 3.2, .84, .055, .07);
      add("frame", 0, height - .12, 3.2, .09, .14, .2);
    }
    bays.push({ wallId: wall.id, floorId: floor.id, parts });
  }
  return bays;
}
