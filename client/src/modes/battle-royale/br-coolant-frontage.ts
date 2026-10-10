import { BR_STRUCTURES, type BrStructure } from "@planetfall/shared";
import type { BrAuthoredSecondaryDressing, BrAuthoredSecondaryPart } from "./br-authored-secondary-dressing";

/** Literal Coolant Exchange frontage: flush aprons and solid-wall plaques.
 * World heights include the building base once. Existing cached box/material
 * batches and district detail LOD own rendering; no resources or colliders.
 */
export function buildBrCoolantFrontage(structures: readonly BrStructure[] = BR_STRUCTURES): BrAuthoredSecondaryDressing[] {
  const result: BrAuthoredSecondaryDressing[] = [];
  for (const spec of [
    { id: "coolant-frontage-office", entrance: "east", x: 18, width: 20, depth: 24, height: 11, sign: 1,
      plaqueY: 1.06, plaqueHeight: .44, plaqueZ: -5, accent: "energyCyan", context: "Exchange office entry and low wall directory" },
    { id: "coolant-frontage-maintenance", entrance: "west", x: 56, width: 18, depth: 20, height: 6, sign: -1,
      plaqueY: 2.75, plaqueHeight: .85, plaqueZ: -4.5, accent: "industrialOrange", context: "Cooling maintenance entry and inspection plaque" },
  ] as const) {
    const s = structures.find(s => s.id === spec.id);
    // Plaque intervals are measured against these authored skins, not guessed
    // on arbitrary resized buildings or a differently oriented doorway.
    if (!s?.enterable || s.entrance !== spec.entrance || s.position.x !== spec.x || s.position.z !== 98
      || s.position.y !== 0 || s.size.x !== spec.width || s.size.z !== spec.depth || s.size.y !== spec.height) continue;
    const wall = s.position.x + spec.sign * s.size.x / 2;
    const start = wall + spec.sign * .85, edge = 37 - spec.sign * 3.7;
    const length = (edge - start) * spec.sign, center = (start + edge) / 2;
    const parts: BrAuthoredSecondaryPart[] = [];
    const add = (name: string, finish: BrAuthoredSecondaryPart["finish"], x: number, y: number, z: number,
      sx: number, sy: number, sz: number, surface = false) => parts.push({
      name: `${s.id}-${name}`, geometry: "box", finish, position: { x, y, z }, scale: { x: sx, y: sy, z: sz }, rotationY: 0, surface });
    add("entry-apron", "concrete", center, .012, 98, length, .016, 4.8, true);
    for (const side of [-1, 1]) add(`apron-edge-${side}`, "brushedMetal", center, .026, 98 + side * 2.3, length - .2, .012, .08, true);
    const plaqueZ = 98 + spec.plaqueZ;
    add("plaque-backing", "structuralDark", wall + spec.sign * .52, spec.plaqueY, plaqueZ, .12, spec.plaqueHeight, 1.5);
    add("plaque-face", "paintedMetal", wall + spec.sign * .587, spec.plaqueY, plaqueZ, .014, spec.plaqueHeight - .1, 1.32);
    add("plaque-header", spec.accent, wall + spec.sign * .602, spec.plaqueY + spec.plaqueHeight * .3, plaqueZ, .012, .035, 1.1);
    for (const [index, offset] of [-.06, .05].entries()) add(`directory-row-${index}`, "brushedMetal", wall + spec.sign * .603,
      spec.plaqueY + offset, plaqueZ + .1, .012, .028, .8);
    result.push({ id: `${s.id}-frontage`, family: "workyard", context: spec.context,
      center: { x: center, y: 0, z: 96 }, radius: 6, parts });
  }
  return result;
}
