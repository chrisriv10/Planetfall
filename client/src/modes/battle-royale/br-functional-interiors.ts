import {
  BR_LOOT_SOCKETS,
  BR_MAP_BLOCKS,
  type BrMapBlock,
  type BrStructure,
  type Vec3
} from "@planetfall/shared";

export type FunctionalInteriorPart = {
  finish: "dark" | "panel" | "light";
  position: Vec3;
  scale: Vec3;
  role: "wall" | "ceiling" | "inlay";
};

type LootSocket = (typeof BR_LOOT_SOCKETS)[number];
type Bay = { wall: BrMapBlock; floor: BrMapBlock; alongX: boolean; inward: number; lateral: number; width: number };

const SUPPORTED = new Set<BrStructure["archetype"]>([
  "warehouse", "hangar", "lab", "academy", "office", "industrial", "utility"
]);
const overlaps = (position: Vec3, scale: Vec3, otherPosition: Vec3, otherScale: Vec3, padding = 0) =>
  Math.abs(position.x - otherPosition.x) < (scale.x + otherScale.x) / 2 + padding
  && Math.abs(position.y - otherPosition.y) < (scale.y + otherScale.y) / 2 + padding
  && Math.abs(position.z - otherPosition.z) < (scale.z + otherScale.z) / 2 + padding;
const projectedSize = (block: BrMapBlock): Vec3 => {
  let { x, y, z } = block.size;
  const rx = block.rotation?.x ?? 0, ry = block.rotation?.y ?? 0, rz = block.rotation?.z ?? 0;
  if (rx) [y, z] = [Math.abs(Math.cos(rx)) * y + Math.abs(Math.sin(rx)) * z,
    Math.abs(Math.sin(rx)) * y + Math.abs(Math.cos(rx)) * z];
  if (ry) [x, z] = [Math.abs(Math.cos(ry)) * x + Math.abs(Math.sin(ry)) * z,
    Math.abs(Math.sin(ry)) * x + Math.abs(Math.cos(ry)) * z];
  if (rz) [x, y] = [Math.abs(Math.cos(rz)) * x + Math.abs(Math.sin(rz)) * y,
    Math.abs(Math.sin(rz)) * x + Math.abs(Math.cos(rz)) * y];
  return { x, y, z };
};
const floorsFor = (structure: BrStructure, blocks: readonly BrMapBlock[]) => blocks
  .filter(block => block.id.startsWith(`${structure.id}-`) && block.kind === "platform" && !block.id.endsWith("-roof") && !block.rotation)
  .sort((a, b) => a.position.y - b.position.y || b.size.x * b.size.z - a.size.x * a.size.z || a.id.localeCompare(b.id));

function supportForWall(wall: BrMapBlock, structure: BrStructure, blocks: readonly BrMapBlock[]) {
  const bottom = wall.position.y - wall.size.y / 2;
  return floorsFor(structure, blocks).find(floor => {
    const top = floor.position.y + floor.size.y / 2;
    return top >= bottom - .01 && top <= bottom + .5
      && Math.abs(wall.position.x - floor.position.x) < floor.size.x / 2 + .8
      && Math.abs(wall.position.z - floor.position.z) < floor.size.z / 2 + .8;
  });
}

function makeBay(wall: BrMapBlock, floor: BrMapBlock, structure: BrStructure): Bay | undefined {
  if (wall.rotation || floor.rotation || ![...Object.values(wall.position), ...Object.values(wall.size)].every(Number.isFinite)) return;
  const alongX = wall.size.x >= wall.size.z, axis = alongX ? "x" : "z", normal = alongX ? "z" : "x";
  const inward = Math.sign(structure.position[normal] - wall.position[normal]) || 1;
  const start = Math.max(wall.position[axis] - wall.size[axis] / 2 + .75, floor.position[axis] - floor.size[axis] / 2 + .75);
  const end = Math.min(wall.position[axis] + wall.size[axis] / 2 - .75, floor.position[axis] + floor.size[axis] / 2 - .75);
  const width = Math.min(7.2, end - start);
  return width >= 3.2 ? { wall, floor, alongX, inward, lateral: (start + end) / 2, width } : undefined;
}

function candidateBays(structure: BrStructure, blocks: readonly BrMapBlock[]): Bay[] {
  const roomWalls = blocks.filter(block => block.kind === "wall" && block.id.startsWith(`${structure.id}-room-`));
  if (roomWalls.length) return roomWalls.flatMap(wall => {
    const floor = supportForWall(wall, structure, blocks), bay = floor && makeBay(wall, floor, structure);
    return bay ? [bay] : [];
  });
  const back = blocks.find(block => block.id === `${structure.id}-back` && block.kind === "wall");
  if (!back) return [];
  const byLevel = new Map<number, BrMapBlock>();
  for (const floor of floorsFor(structure, blocks)) {
    const top = floor.position.y + floor.size.y / 2, prior = byLevel.get(top);
    if (!prior || floor.size.x * floor.size.z > prior.size.x * prior.size.z) byLevel.set(top, floor);
  }
  return [...byLevel.values()].flatMap(floor => {
    const bay = makeBay(back, floor, structure);
    return bay ? [bay] : [];
  });
}

/**
 * Presentation-only functional dressing attached to existing authoritative
 * walls, ceilings and slabs. Input `structure` and `blocks` must share world
 * elevation; output X/Z stays world-space while Y is structure-local. This
 * prevents district elevation from being applied twice by the renderer group.
 */
export function buildFunctionalInterior(
  structure: BrStructure,
  blocks: readonly BrMapBlock[] = BR_MAP_BLOCKS,
  lootSockets: readonly LootSocket[] = BR_LOOT_SOCKETS
): FunctionalInteriorPart[] {
  if (!structure.enterable || !SUPPORTED.has(structure.archetype)) return [];
  const parts: FunctionalInteriorPart[] = [];
  const ownBlocks = blocks.filter(block => block.id.startsWith(`${structure.id}-`));
  const loot = lootSockets.filter(socket => socket.structureId === structure.id);
  const storeyHeight = structure.size.y / Math.max(1, structure.floors);
  for (const bay of candidateBays(structure, blocks)) {
    const floorWorldY = bay.floor.position.y + bay.floor.size.y / 2;
    const floorY = floorWorldY - structure.position.y;
    const wallTop = bay.wall.position.y + bay.wall.size.y / 2 - structure.position.y;
    const usable = Math.min(wallTop, floorY + storeyHeight - .28) - floorY;
    if (usable < 3.1) continue;
    const normalAxis = bay.alongX ? "z" : "x";
    const wallFace = bay.wall.position[normalAxis] + bay.inward * (bay.wall.size[normalAxis] / 2 + .035);
    const worldAt = (lateral: number, y: number, inward: number): Vec3 => bay.alongX
      ? { x: lateral, y: floorY + y, z: wallFace + bay.inward * inward }
      : { x: wallFace + bay.inward * inward, y: floorY + y, z: lateral };
    const worldScale = (lateral: number, y: number, inward: number): Vec3 => bay.alongX
      ? { x: lateral, y, z: inward } : { x: inward, y, z: lateral };
    const group: FunctionalInteriorPart[] = [];
    const add = (finish: FunctionalInteriorPart["finish"], role: FunctionalInteriorPart["role"],
      lateral: number, y: number, inward: number, width: number, height: number, depth: number) => group.push({
        finish, role, position: worldAt(lateral, y, inward), scale: worldScale(width, height, depth)
      });
    const industrial = structure.archetype === "industrial" || structure.archetype === "utility";
    const cargo = structure.archetype === "warehouse" || structure.archetype === "hangar";
    const panelHeight = Math.min(2.35, usable - .7), panelCenter = .42 + panelHeight / 2;
    add("dark", "wall", bay.lateral, panelCenter, .06, bay.width, panelHeight, .12);
    add("panel", "wall", bay.lateral, panelCenter, .135, bay.width - .22, panelHeight - .2, .06);
    if (cargo) {
      for (const offset of [-.34, 0, .34]) add("dark", "wall", bay.lateral + offset * bay.width, panelCenter, .19, .1, panelHeight - .35, .08);
      for (const y of [.82, 1.48]) add(y === .82 ? "light" : "dark", "wall", bay.lateral, y, .205, bay.width - .75, .08, .025);
    } else if (industrial) {
      for (const offset of [-.31, .31]) {
        add("dark", "wall", bay.lateral + offset * bay.width, panelCenter, .2, .13, panelHeight - .3, .09);
        add("light", "wall", bay.lateral + offset * bay.width, panelCenter + .48, .255, .035, .72, .018);
      }
      add("panel", "wall", bay.lateral, .94, .21, bay.width * .36, .62, .04);
    } else {
      for (const offset of [-.27, .27]) add("dark", "wall", bay.lateral + offset * bay.width, panelCenter, .2, .11, panelHeight - .3, .08);
      for (const y of [.95, 1.45, 1.95]) add(y === 1.45 ? "light" : "dark", "wall", bay.lateral, y, .225, bay.width - .8, .11, .025);
      add("light", "wall", bay.lateral - bay.width * .38, 1.48, .255, .04, 1.35, .018);
    }
    add("dark", "inlay", bay.lateral, .013, .72, bay.width * .72, .012, .12);
    add("light", "inlay", bay.lateral, .022, .72, bay.width * .3, .006, .04);
    if (usable >= 3.45) {
      const ceilingY = usable - .1;
      add("dark", "ceiling", bay.lateral, ceilingY, .68, bay.width * .76, .12, 1.25);
      add("light", "ceiling", bay.lateral, ceilingY - .075, 1.28, bay.width * .58, .025, .05);
    }
    const unsafe = group.some(part => {
      const worldPosition = { ...part.position, y: part.position.y + structure.position.y };
      if (loot.some(socket => overlaps(worldPosition, part.scale, socket.position, { x: 1.2, y: 1.6, z: 1.2 }, .25))) return true;
      return ownBlocks.some(block => (block.kind === "ramp" || block.id.includes("-room-")) && block.id !== bay.wall.id
        && overlaps(worldPosition, part.scale, block.position, projectedSize(block), .08));
    });
    if (!unsafe) parts.push(...group);
  }
  return parts;
}
