import { BR_STRUCTURES, type BrStructure } from "@planetfall/shared";
import type { BrAuthoredSecondaryDressing, BrAuthoredSecondaryPart } from "./br-authored-secondary-dressing";

/** Authored Dock–Engine compound entry treatment. Ground graphics sit flush on
 * the real deck; small service plaques attach to solid facade below glazing.
 * World transforms include the authoritative building elevation exactly once.
 * Batch using the existing secondary dressing contract and LOD group. Boxes
 * only, borrowed materials, no resources, collision, lights or runtime updates.
 * The east roadway and the shared court at z=-180 receive no additional props.
 */
export function buildBrEngineGateFrontage(structures: readonly BrStructure[] = BR_STRUCTURES): BrAuthoredSecondaryDressing[] {
  const result: BrAuthoredSecondaryDressing[] = [];
  for (const [id, context, code] of [
    ["engine-gate-approach-workshop", "Workshop pedestrian service apron and wall inspection plaque", 1],
    ["engine-gate-approach-relay", "Relay pedestrian service apron and wall circuit plaque", 2]
  ] as const) {
    const s = structures.find(s => s.id === id);
    if (!s) continue;
    // This is an authored east-facing compound, not a generic placement kit.
    if (s.entrance !== "east") continue;
    const wall = s.position.x + s.size.x / 2, ground = s.position.y, z = s.position.z;
    const parts: BrAuthoredSecondaryPart[] = [];
    const add = (name: string, finish: BrAuthoredSecondaryPart["finish"], x: number, y: number, pz: number,
      sx: number, sy: number, sz: number, surface = false) => parts.push({
      name: `${id}-${name}`, geometry: "box", finish, position: { x, y: ground + y, z: pz },
      scale: { x: sx, y: sy, z: sz }, rotationY: 0, surface
    });
    // A short pedestrian apron stops 2.3m before the road's western edge.
    // This is a thin material marking, not an invented slab or loading platform.
    add("entry-apron", "concrete", wall + 4.3, .009, z, 6.8, .012, 5.8, true);
    for (const side of [-1, 1]) {
      add(`edge-${side}`, "brushedMetal", wall + 4.3, .024, z + side * 2.8, 6.5, .012, .09, true);
      add(`arrival-tick-${side}`, "industrialOrange", wall + 7.45, .025, z + side * 2.35, .12, .012, .8, true);
    }
    for (const offset of [-1.4, 0, 1.4]) add(`walk-mark-${offset}`, "brushedMetal", wall + 4.6 + offset, .024, z, .16, .012, 1.1, true);
    // Keep the opaque plaque entirely on the southern solid jamb wing, above
    // existing low service vents and below the actual clerestory/sill.
    const panelZ = z - 4.5;
    add("plaque-backing", "structuralDark", wall + .52, 2.82, panelZ, .12, 1, 1.7);
    add("plaque-face", "paintedMetal", wall + .587, 2.82, panelZ, .014, .82, 1.5);
    add("plaque-header", "industrialOrange", wall + .602, 3.12, panelZ, .012, .065, 1.2);
    for (const offset of [-.12, .05]) add(`plaque-row-${offset}`, "brushedMetal", wall + .603, 2.82 + offset, panelZ + .14, .012, .035, .75);
    for (let index = 0; index < code; index++) add(`plaque-code-${index}`, "windowLit", wall + .606, 2.53, panelZ - .48 + index * .22, .014, .08, .1);
    result.push({ id: `${id}-frontage`, family: "workyard", context,
      center: { x: wall + 4, y: ground, z }, radius: 6.5, parts });
  }
  return result;
}
