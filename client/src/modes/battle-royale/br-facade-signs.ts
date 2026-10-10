import { BR_SECONDARY_LOCATIONS, BR_STRUCTURES, type BrStructure, type Vec3 } from "@planetfall/shared";

export const BR_PRIMARY_FACADE_SIGN_TEXT: Readonly<Record<string, string>> = {
  "zero-spire": "ZERO POINT", "nova-cafe": "ORBITAL CAFE", "nova-arcade": "ARCADE", "nova-market": "MARKET",
  "dock-hangar": "DOCK 07", "helios-core": "HELIOS", "astra-hall": "ASTRA", "void-anchor": "VOID MALL",
  "void-food-court": "FOOD COURT", "farm-processing": "GROW LAB", "crash-medbay": "MED BAY", "thruster-foundry": "THRUSTER WORKS",
  "north-civic-archive": "CIVIC ARCHIVE", "north-civic-exchange": "ORBIT EXCHANGE"
};

/** Preserve the production naming contract; the eight newer secondary sites
 * without a `district-1` structure keep their district title only. */
export function getBrFacadeSignText(structure: BrStructure): string | null {
  const location = BR_SECONDARY_LOCATIONS.find(l => l.id === structure.districtId && structure.id === `${l.id}-1`);
  return BR_PRIMARY_FACADE_SIGN_TEXT[structure.id] ?? location?.name ?? null;
}

export function brFacadeSignOmission(structure: BrStructure): "high-roof" | "narrow-frontage" | null {
  if (structure.size.y > 12) return "high-roof";
  const span = structure.entrance === "north" || structure.entrance === "south" ? structure.size.x : structure.size.z;
  return span / 2 - 4.4 < 4 ? "narrow-frontage" : null;
}

/** Reviewable catalog: omitted crests retain their name and reason. Keep the
 * existing POI/secondary district titles when integrating these omissions. */
export function buildBrFacadeSignCatalog(structures: readonly BrStructure[] = BR_STRUCTURES) {
  return structures.flatMap(structure => {
    const text = getBrFacadeSignText(structure);
    return text ? [{ structureId: structure.id, text, omission: brFacadeSignOmission(structure), sign: buildBrFacadeSign(structure, text) }] : [];
  });
}

export interface BrFacadeSignPart {
  name: "backplate" | "cap-foot" | "post" | "panel-bracket";
  finish: "structuralDark" | "brushedMetal";
  position: Vec3;
  scale: Vec3;
}
export interface BrFacadeSign {
  label: { text: string; position: Vec3; width: number; height: number; rotationY: number };
  parts: BrFacadeSignPart[];
}

/** Small roof-cap crest on the left solid frontage wing. All coordinates are
 * absolute world coordinates, including elevation. Label is a mounted plane,
 * never a sprite; parts borrow unit-box geometry/material batches. No physics,
 * per-frame work, dynamic lights, textures or GPU resources are owned here.
 *
 * The full doorway and its roof-access continuation remain laterally clear.
 * Cap feet overlap the wall cap for support; posts sit behind the awning's .8m
 * inner edge, and short panel brackets carry the plate beyond the cornice.
 * Roofs over 12m and cramped frontages omit the crest explicitly; callers keep
 * the existing district title instead of raising unreadable duplicate signs.
 */
export function buildBrFacadeSign(structure: BrStructure, text: string): BrFacadeSign | null {
  if (!text.trim() || brFacadeSignOmission(structure)) return null;
  const ns = structure.entrance === "north" || structure.entrance === "south";
  const direction = structure.entrance === "north" || structure.entrance === "east" ? 1 : -1;
  const span = ns ? structure.size.x : structure.size.z;
  const normal = (ns ? structure.size.z : structure.size.x) / 2;
  // A metre at the corner and 3.2m around the entrance preserve jamb hardware.
  const width = Math.min(8.5, span / 2 - 4.4);
  if (width < 2) return null;
  const lateral = -span / 2 + 1.1 + width / 2;
  const roof = structure.position.y + structure.size.y;
  const height = 1.2;
  const panelBottom = Math.max(roof + .65, structure.position.y + 4.85);
  const panelY = panelBottom + height / 2;
  const world = (along: number, y: number, offset: number): Vec3 => ({
    x: structure.position.x + (ns ? along : direction * (normal + offset)), y,
    z: structure.position.z + (ns ? direction * (normal + offset) : along)
  });
  const parts: BrFacadeSignPart[] = [];
  const add = (name: BrFacadeSignPart["name"], finish: BrFacadeSignPart["finish"], along: number,
    y: number, offset: number, w: number, h: number, depth: number) => parts.push({
    name, finish, position: world(along, y, offset), scale: { x: ns ? w : depth, y: h, z: ns ? depth : w }
  });
  add("backplate", "structuralDark", lateral, panelY, 1.15, width + .2, height + .12, .14);
  for (const side of [-1, 1]) {
    const along = lateral + side * (width / 2 - .3);
    add("cap-foot", "brushedMetal", along, roof + .2, .25, .24, .12, .96);
    const postBottom = roof + .2, postTop = panelY + .06;
    add("post", "brushedMetal", along, (postBottom + postTop) / 2, .65, .12, postTop - postBottom, .12);
    add("panel-bracket", "brushedMetal", along, panelY, .875, .12, .12, .57);
  }
  return { label: { text, position: world(lateral, panelY, 1.235), width, height,
    rotationY: structure.entrance === "north" ? 0 : structure.entrance === "south" ? Math.PI : structure.entrance === "east" ? Math.PI / 2 : -Math.PI / 2 }, parts };
}
