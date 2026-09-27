import type { BrTerrace, Vec3 } from "@planetfall/shared";

export const BR_TERRACE_ACCESS_GAP = 6.4;
export type BrTerraceDetailFinish = "structuralDark" | "brushedMetal" | "soil" | "grass"
  | "energyCyan" | "energyPurple" | "warningRed";
export interface BrTerraceDetailPart {
  geometry: "box" | "octahedron";
  finish: BrTerraceDetailFinish;
  role: "fascia" | "rim" | "planter" | "light";
  position: Vec3;
  scale: Vec3;
  rotationY: number;
}

/** Visual-only terrace skin, using world-space unit-box/radius-one octahedron
 * transforms. Deck height is terrace.height, matching the shared platform,
 * not position.y+height. No tall rail panels or collision-like cover masses.
 * The access-side gap is wider than the authored 4.8m ramp; all footprints
 * remain inside the real platform. Fascia outer faces lie on the authoritative
 * platform skin: use materials.surface(finish,1) for fascia to avoid coplanar
 * fighting, get(finish) otherwise. Batch by geometry+finish+role as needed;
 * cameraCollision=false. Never render an extra terrace platform or ramp here.
 */
export function buildBrTerraceDetails(terrace: BrTerrace): BrTerraceDetailPart[] {
  const { size, height, accessSide, position } = terrace;
  if (![position.x, position.y, position.z, size.x, size.z, height].every(Number.isFinite)
    || Math.min(size.x, size.z) < 12 || height < .6
    || !["north", "south", "east", "west"].includes(accessSide)) return [];
  const northSouth = accessSide === "north" || accessSide === "south";
  const nx = accessSide === "east" ? 1 : accessSide === "west" ? -1 : 0;
  const nz = accessSide === "north" ? 1 : accessSide === "south" ? -1 : 0;
  const halfWidth = (northSouth ? size.x : size.z) / 2;
  const halfDepth = (northSouth ? size.z : size.x) / 2;
  const rotationY = Math.atan2(nx, nz);
  const accent: BrTerraceDetailFinish = terrace.id.includes("salvage") || terrace.districtId === "crash-site"
    ? "warningRed" : terrace.districtId.includes("academy") || terrace.districtId.includes("astra")
      ? "energyPurple" : "energyCyan";
  const parts: BrTerraceDetailPart[] = [];
  const add = (role: BrTerraceDetailPart["role"], finish: BrTerraceDetailFinish,
    x: number, y: number, z: number, sx: number, sy: number, sz: number,
    geometry: BrTerraceDetailPart["geometry"] = "box") => parts.push({ role, finish, geometry, rotationY,
    position: { x: position.x + nz * x + nx * z, y, z: position.z - nx * x + nz * z },
    scale: { x: sx, y: sy, z: sz }
  });
  const edge = (x: number, z: number, sx: number, sz: number) => {
    const sideEdge = sx === .12;
    add("fascia", "structuralDark", sideEdge ? Math.sign(x) * (halfWidth - .06) : x,
      height - .22, sideEdge ? z : Math.sign(z) * (halfDepth - .06), sx, .28, sz);
    // A low metal edge strip, not a waist-height railing suggesting collision.
    add("rim", "brushedMetal", x, height + .04, z, sx, .035, sz);
  };
  const inset = .16;
  edge(0, -halfDepth + inset, size[northSouth ? "x" : "z"] - .32, .12);
  for (const side of [-1, 1]) {
    edge(side * (halfWidth - inset), 0, .12, halfDepth * 2 - .56);
    const length = halfWidth - .22 - BR_TERRACE_ACCESS_GAP / 2;
    edge(side * (BR_TERRACE_ACCESS_GAP / 2 + length / 2), halfDepth - inset, length, .12);
    // Two back-corner planted service beds leave a generous central route and
    // the entire ramp landing empty. Six airy low leaves, no opaque shrubs.
    const x = side * (halfWidth - 1.3), z = -halfDepth + 1.5;
    add("planter", "soil", x, height + .07, z, 1.6, .08, 2);
    for (const lateral of [-.86, .86]) add("planter", "brushedMetal", x + lateral, height + .12, z, .08, .18, 2);
    for (const offset of [-.6, 0, .6]) add("planter", "grass", x, height + .31, z + offset, .42, .22, .36, "octahedron");
    // Slim edge status stalks, no signboards or dynamic point lights.
    add("light", "brushedMetal", x, height + .71, z - 1.2, .08, 1.4, .08);
    add("light", accent, x, height + 1.48, z - 1.2, .16, .14, .16);
  }
  return parts;
}
