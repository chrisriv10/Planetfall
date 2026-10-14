import type { BrMapBlock, BrStructure } from "./map.js";

export interface BrRoofMass extends BrMapBlock {
  finish: "massing" | "machinery" | "accent";
}

/** Solid rooftop volumes share one definition for presentation, landing and
 * camera queries. Positions include the supplied structure's base elevation. */
export function buildBrRoofMassing(structure: BrStructure): BrRoofMass[] {
  if (!["apartment", "hotel", "tower"].includes(structure.archetype)
    || ["astra-observatory", "crash-fuselage", "thruster-foundry", "zero-spire"].includes(structure.id)) return [];
  const { x, y: baseY, z } = structure.position;
  const { x: width, y: height, z: depth } = structure.size;
  const result: BrRoofMass[] = [];
  const add = (suffix: string, finish: BrRoofMass["finish"], px: number, py: number, pz: number, sx: number, sy: number, sz: number) => {
    result.push({ id: `${structure.id}-roof-mass-${suffix}`, districtId: structure.districtId,
      position: { x: px, y: baseY + py, z: pz }, size: { x: sx, y: sy, z: sz },
      color: structure.color, kind: "building", finish });
  };
  for (let tier = 0; tier < (structure.roofAccess ? 1 : 2); tier++) {
    const tierHeight = Math.min(4.6, height * .15);
    add(`tier-${tier}`, "massing", x + (tier ? width * .08 : -width * .05), height + tierHeight * (tier + .5), z + (tier ? -depth * .06 : depth * .05), width * (.66 - tier * .12), tierHeight, depth * (.68 - tier * .1));
  }
  add("machinery", "machinery", x, height + (structure.archetype === "tower" ? 5.1 : 3.8), z, width * .28, structure.archetype === "tower" ? 5.8 : 3.2, depth * .28);
  add("cap", "accent", x, height + (structure.archetype === "tower" ? 8.15 : 5.55), z, width * .35, .32, depth * .35);
  return result;
}
