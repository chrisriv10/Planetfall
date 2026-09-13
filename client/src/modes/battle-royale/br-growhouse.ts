import { BR_LOOT_SOCKETS, type BrStructure, type Vec3 } from "@planetfall/shared";

export type GrowhousePart = { position: Vec3; scale: Vec3; rotationZ?: number; finish: "frame" | "glass" | "base" };

/** Shallow roof-light monitors, not new rooms or replacement collision roofs.
 * Keep perimeter landing/access lanes and never project down into a room. */
export function buildGrowhouseRoof(structure: BrStructure): GrowhousePart[] {
  if (structure.archetype !== "greenhouse" || structure.roofAccess) return [];
  const parts: GrowhousePart[] = [];
  const { x, z } = structure.position;
  const width = structure.size.x - 8, length = structure.size.z - 8;
  const count = Math.max(1, Math.floor(width / 7));
  const half = Math.min(2.6, width / count / 2 - .7), rise = 1.35;
  const y = structure.size.y + .38;
  const slope = Math.atan2(rise, half), slopeLength = Math.hypot(half, rise);
  const add = (finish: GrowhousePart["finish"], px: number, py: number, pz: number, sx: number, sy: number, sz: number, rotationZ = 0) =>
    parts.push({ finish, position: { x: px, y: py, z: pz }, scale: { x: sx, y: sy, z: sz }, rotationZ });
  for (let index = 0; index < count; index++) {
    const cx = x + (index - (count - 1) / 2) * width / count;
    // Some non-roof-access buildings still have aerial loot sockets. Leave
    // that whole monitor bay clear rather than hiding an item under glazing.
    if(BR_LOOT_SOCKETS.some(socket=>socket.structureId===structure.id&&socket.kind==="roof"&&
      Math.abs(socket.position.x-cx)<half+1&&Math.abs(socket.position.z-z)<length/2+1))continue;
    add("base", cx, y, z, half * 2 + .3, .3, length + .3);
    add("frame", cx, y + rise + .14, z, .18, .18, length + .35);
    for (const side of [-1, 1]) {
      add("glass", cx + side * half / 2, y + rise / 2 + .15, z, slopeLength, .08, length, -side * slope);
      add("frame", cx + side * half, y + .15, z, .18, .2, length + .35);
      const bays = Math.ceil(length / 3);
      for (let bay = 0; bay <= bays; bay++) {
        add("frame", cx + side * half / 2, y + rise / 2 + .22, z - length / 2 + bay * length / bays,
          slopeLength + .1, .12, .14, -side * slope);
      }
    }
  }
  return parts;
}
