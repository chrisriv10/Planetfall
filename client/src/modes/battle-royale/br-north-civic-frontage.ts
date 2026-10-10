import { BR_STRUCTURES, type BrStructure } from "@planetfall/shared";
import type { BrAuthoredSecondaryDressing, BrAuthoredSecondaryPart } from "./br-authored-secondary-dressing";

/** Literal North Civic frontage: flush aprons and solid-wall plaques.
 * World heights include the building base once. Existing cached box/material
 * batches and district detail LOD own rendering; no resources or colliders.
 */
export function buildBrNorthCivicFrontage(structures: readonly BrStructure[] = BR_STRUCTURES): BrAuthoredSecondaryDressing[] {
  const result: BrAuthoredSecondaryDressing[] = [];
  for (const spec of [
    { id: "north-civic-archive", entrance: "east", x: -44, width: 22, depth: 24, height: 9, sign: 1,
      plaqueY: 4.55, plaqueHeight: .7, plaqueZ: -5, accent: "energyCyan", context: "Archive entry and interstorey directory" },
    { id: "north-civic-exchange", entrance: "west", x: 0, width: 18, depth: 20, height: 6, sign: -1,
      plaqueY: 4.65, plaqueHeight: .3, plaqueZ: -4.5, accent: "energyPurple", context: "Exchange storefront entry and display identity" },
  ] as const) {
    const s = structures.find(s => s.id === spec.id);
    // Plaque intervals are measured against these authored skins, not guessed
    // on arbitrary resized buildings or a differently oriented doorway.
    if (!s?.enterable || s.entrance !== spec.entrance || s.position.x !== spec.x || s.position.z !== 155
      || s.position.y !== 0 || s.size.x !== spec.width || s.size.z !== spec.depth || s.size.y !== spec.height) continue;
    const wall = s.position.x + spec.sign * s.size.x / 2;
    const start = wall + spec.sign * .85, edge = -15 - spec.sign * 3.7;
    const length = (edge - start) * spec.sign, center = (start + edge) / 2;
    const parts: BrAuthoredSecondaryPart[] = [];
    const add = (name: string, finish: BrAuthoredSecondaryPart["finish"], x: number, y: number, z: number,
      sx: number, sy: number, sz: number, surface = false) => parts.push({
      name: `${s.id}-${name}`, geometry: "box", finish, position: { x, y, z }, scale: { x: sx, y: sy, z: sz }, rotationY: 0, surface });
    add("entry-apron", "concrete", center, .012, 155, length, .016, 4.8, true);
    for (const side of [-1, 1]) add(`apron-edge-${side}`, "brushedMetal", center, .026, 155 + side * 2.3, length - .2, .012, .08, true);
    const plaqueZ = 155 + spec.plaqueZ;
    add("plaque-backing", "structuralDark", wall + spec.sign * .52, spec.plaqueY, plaqueZ, .12, spec.plaqueHeight, 1.5);
    add("plaque-face", "paintedMetal", wall + spec.sign * .587, spec.plaqueY, plaqueZ, .014, spec.plaqueHeight - .1, 1.32);
    add("plaque-header", spec.accent, wall + spec.sign * .602, spec.plaqueY + spec.plaqueHeight * .3, plaqueZ, .012, .035, 1.1);
    for (const [index, offset] of [-.06, .05].entries()) add(`directory-row-${index}`, "brushedMetal", wall + spec.sign * .603,
      spec.plaqueY + offset, plaqueZ + .1, .012, .028, .8);
    result.push({ id: `${s.id}-frontage`, family: "civic", context: spec.context,
      center: { x: center, y: 0, z: 153 }, radius: 9, parts });
  }
  return result;
}

