import { BR_MAP_BLOCKS, type BrMapBlock, type BrStructure, type Vec3 } from "@planetfall/shared";
import type { RetailPart } from "./br-retail-interiors";

export interface MallDirectorySign {
  text: string;
  position: Vec3;
  width: number;
  height: number;
  rotationY: number;
}
export interface MallDirectory {
  floorId: string;
  wallId: string;
  parts: RetailPart[];
  signs: MallDirectorySign[];
}

/** Mall identity belongs on existing perimeter walls, leaving the furnished
 * partitions, central loot and east-side stairs alone. Each directory is a
 * shallow wall skin supported by an actual floor. No freestanding kiosk,
 * imaginary balcony or new movement/collision volume is introduced.
 * Reuse the retail material batches; labels use createMountedSign, rotationY
 * and scale(width, height, 1). Coordinates are world-space. */
export function buildMallDirectories(structure: BrStructure, blocks: readonly BrMapBlock[] = BR_MAP_BLOCKS): MallDirectory[] {
  if (!structure.enterable || structure.districtId !== "void-mall"
    || !["void-anchor", "void-food-court"].includes(structure.id)) return [];
  const westWallId = `${structure.id}-${structure.entrance === "east" ? "back" : "west"}`;
  const wall = blocks.find(block => block.id === westWallId && block.kind === "wall" && !block.rotation);
  if (!wall) return [];
  const face = wall.position.x + wall.size.x / 2;
  const z = structure.position.z - structure.size.z * .28;
  const boardWidth = 3.2;
  // The whole board must fit on the solid wall, including its casing.
  if (Math.abs(z - wall.position.z) + boardWidth / 2 + .2 > wall.size.z / 2) return [];
  const floors = blocks.filter(block => block.id.startsWith(`${structure.id}-`)
    && block.kind === "platform" && !block.id.endsWith("-roof") && !block.rotation
    && face + .1 >= block.position.x - block.size.x / 2
    && face + .54 <= block.position.x + block.size.x / 2
    && Math.abs(z - block.position.z) + boardWidth / 2 < block.size.z / 2)
    .sort((a, b) => a.position.y - b.position.y || (a.id < b.id ? -1 : 1));
  const directories: MallDirectory[] = [];
  const food = structure.id === "void-food-court";
  for (const floor of floors.slice(0, 3)) {
    const base = floor.position.y + floor.size.y / 2;
    const ceiling = blocks.filter(block => block.id.startsWith(`${structure.id}-`) && block.kind === "platform"
      && !block.rotation && block.position.y > floor.position.y + .5
      && Math.abs(face + .3 - block.position.x) < block.size.x / 2
      && Math.abs(z - block.position.z) + boardWidth / 2 < block.size.z / 2)
      .reduce((lowest, block) => Math.min(lowest, block.position.y - block.size.y / 2), Infinity);
    if (!Number.isFinite(ceiling) || ceiling - base < 3.3) continue;
    const parts: RetailPart[] = [], signs: MallDirectorySign[] = [];
    const add = (finish: RetailPart["finish"], lateral: number, height: number, width: number, tall: number, offset: number, depth: number) =>
      parts.push({ finish, position: { x: face + offset, y: base + height, z: z + lateral }, scale: { x: depth, y: tall, z: width } });
    add("frame", 0, 1.95, boardWidth, 2.42, .12, .22);
    add("panel", 0, 1.95, 3, 2.22, .25, .06);
    add("accent", 0, 3.2, 3.2, .08, .22, .25);
    add("light", 0, .82, 2.8, .045, .3, .035);
    // Two understated row separators keep the directory a designed object
    // rather than another floating sign, with a narrow projecting lower lip.
    for (const height of [1.43, 2.18]) add("frame", 0, height, 2.74, .035, .295, .025);
    add("frame", 0, .71, 3.22, .08, .29, .48);
    const label = (text: string, height: number, width: number, tall: number) =>
      signs.push({ text, position: { x: face + .325, y: base + height, z }, width, height: tall, rotationY: Math.PI / 2 });
    label(food ? "FOOD COURT" : "VOID MALL", 2.78, 2.76, .58);
    label(`LEVEL ${String(directories.length + 1).padStart(2, "0")}`, 2.38, 1.56, .26);
    label(food ? "CAFE / ION JUICE" : "SHOPS / DINING", 1.85, 2.66, .48);
    label("DIRECTORY", 1.12, 1.76, .3);
    directories.push({ floorId: floor.id, wallId: wall.id, parts, signs });
  }
  return directories;
}
