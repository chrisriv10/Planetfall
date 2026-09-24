import { BR_MAP_BLOCKS, type BrMapBlock, type BrStructure, type Vec3 } from "@planetfall/shared";

export type MallAtriumWallFinish = "frame" | "panel" | "glass" | "energyPurple" | "energyCyan";

export interface MallAtriumWallPart {
  wallId: string;
  finish: MallAtriumWallFinish;
  position: Vec3;
  scale: Vec3;
}

/**
 * Shallow interior articulation mounted against real outer-wall colliders.
 * It never bridges entrance gaps or creates standalone concourse geometry.
 */
export function buildMallAtriumWalls(
  structure: BrStructure,
  blocks: readonly BrMapBlock[] = BR_MAP_BLOCKS
): MallAtriumWallPart[] {
  if (!structure.enterable || structure.archetype !== "mall" || structure.size.y < 10) return [];
  const walls = blocks.filter(block => block.id.startsWith(`${structure.id}-`)
    && block.kind === "wall" && !block.id.includes("-room-"))
    .sort((a, b) => a.id.localeCompare(b.id));
  const parts: MallAtriumWallPart[] = [];
  const floorCount = Math.max(1, structure.floors);
  const floorHeight = structure.size.y / floorCount;

  for (const wall of walls) {
    const alongX = wall.size.x >= wall.size.z;
    const span = alongX ? wall.size.x : wall.size.z;
    if (span < 5) continue;
    const bays = Math.max(1, Math.floor(span / 7.5));
    const pitch = span / bays;
    const inward = alongX
      ? Math.sign(structure.position.z - wall.position.z) || 1
      : Math.sign(structure.position.x - wall.position.x) || 1;
    const faceX = alongX ? wall.position.x : wall.position.x + inward * (wall.size.x / 2 + .045);
    const faceZ = alongX ? wall.position.z + inward * (wall.size.z / 2 + .045) : wall.position.z;
    const add = (finish: MallAtriumWallFinish, lateral: number, y: number, width: number, height: number, depth: number) => {
      parts.push({
        wallId: wall.id,
        finish,
        position: { x: alongX ? wall.position.x + lateral : faceX, y, z: alongX ? faceZ : wall.position.z + lateral },
        scale: { x: alongX ? width : depth, y: height, z: alongX ? depth : width }
      });
    };

    for (let level = 0; level < floorCount; level++) {
      const base = level * floorHeight;
      for (let bay = 0; bay < bays; bay++) {
        const center = -span / 2 + pitch * (bay + .5);
        const width = Math.max(2.4, pitch - .7);
        add("panel", center, base + floorHeight * .48, width, floorHeight - 1.15, .075);
        add("glass", center, base + floorHeight * .51, width - .5, Math.min(2.35, floorHeight * .34), .105);
        add("frame", center, base + .5, width, .18, .16);
        add("frame", center, base + floorHeight - .5, width, .16, .16);
        add("frame", center - width / 2, base + floorHeight * .49, .18, floorHeight - .95, .16);
        if ((bay + level) % 3 === 0) add((bay + level) % 2 ? "energyCyan" : "energyPurple",
          center + width * .34, base + floorHeight * .5, .055, Math.min(1.55, floorHeight * .24), .125);
      }
    }
  }
  return parts;
}
