import type { BrPoi, Vec3 } from "@planetfall/shared";

export type BrDistrictPropKit = "garden" | "waiting" | "cargo-cradle" | "solar-service";
export type BrDistrictPropFinish = "soil" | "canopy" | "brushedMetal" | "structuralDark"
  | "paintedMetal" | "industrialOrange" | "warningRed" | "solarPanel" | "windowLit";
export interface BrDistrictPropPart {
  geometry: "box" | "cylinder" | "octahedron";
  finish: BrDistrictPropFinish;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  surface: boolean;
}
export interface BrAuthoredDistrictProp {
  id: string;
  poiId: string;
  context: string;
  kit: BrDistrictPropKit;
  center: Vec3;
  radius: number;
  parts: BrDistrictPropPart[];
}

// Fixed world-space art placements, reviewed against the authored district
// footprints. No seeds, random retries, nearest-space searches, or fallback
// relocation. Changing the map must revalidate these explicit coordinates.
type Placement = readonly [context: string, kit: BrDistrictPropKit, x: number, z: number, quarterTurns: number];
const PLACEMENTS: Readonly<Record<string, readonly Placement[]>> = {
  "zero-point": [["south civic rest", "waiting", -20, -40, 1], ["east civic garden", "garden", 40, 40, 0], ["north service apron", "solar-service", -23, 72, 0]],
  "nova-plaza": [
    ["north promenade garden", "garden", -155, -75, 0],
    ["promenade waiting bay", "waiting", -145, -65, 1],
    // Street A's actual shoulders/forecourts: keep the 12m through-road,
    // intersection, storefront approach rectangles and loot pockets empty.
    // These five placements are individually authored; never derive a street
    // grid, repeat an interval or relocate them when a clearance test fails.
    ["west gateway south planter", "garden", -238, -147, 2],
    ["cafe west forecourt seat and lamp", "waiting", -238, -123, 2],
    ["kiosk southwest forecourt planter", "garden", -198, -123, 1],
    ["east junction south seat and lamp", "waiting", -162, -147, 3],
    ["studio west forecourt planter", "garden", -158, -123, 3],
  ],
  "dockyard-7": [["west freight cradle", "cargo-cradle", 128, -146, 1], ["south freight apron", "cargo-cradle", 158, -206, 0], ["north shift stop", "waiting", 158, -86, 1]],
  "helios-reactor": [["southwest inspection", "solar-service", 222, 18, 0], ["south maintenance cradle", "cargo-cradle", 282, 28, 1], ["east crew stop", "waiting", 332, 58, 1]],
  "astra-academy": [["west campus garden", "garden", -318, 125, 0], ["east campus garden", "garden", -238, 125, 0], ["south fieldwork station", "solar-service", -288, 15, 1]],
  "void-mall": [["west arrival garden", "garden", -133, 213, 0], ["east arrival waiting", "waiting", -53, 213, 1]],
  "orbital-farms": [["west cultivation pocket", "garden", 65, 324, 0], ["southwest irrigation array", "solar-service", 85, 234, 0], ["southeast irrigation array", "solar-service", 165, 234, 0]],
  "crash-site": [["west recovery cradle", "cargo-cradle", -396, -268, 1], ["east recovery cradle", "cargo-cradle", -270, -273, 0]],
  "thruster-works": [["west tooling cradle", "cargo-cradle", 292, -60, 1], ["south test instruments", "solar-service", 322, -110, 0], ["north crew stop", "waiting", 372, 0, 1]],
};

function kitParts(center: Vec3, rotationY: number, kit: BrDistrictPropKit, wreck: boolean): BrDistrictPropPart[] {
  const parts: BrDistrictPropPart[] = [];
  const add = (geometry: BrDistrictPropPart["geometry"], finish: BrDistrictPropFinish,
    x: number, y: number, z: number, sx: number, sy: number, sz: number, surface = false) => parts.push({ geometry, finish, rotationY, surface,
    position: { x: center.x + Math.cos(rotationY) * x + Math.sin(rotationY) * z, y,
      z: center.z - Math.sin(rotationY) * x + Math.cos(rotationY) * z }, scale: { x: sx, y: sy, z: sz }
  });
  if (kit === "garden") {
    add("box", "soil", 0, .07, 0, 2.8, .08, 2.6);
    for (const z of [-1.35, 1.35]) add("box", "brushedMetal", 0, .14, z, 2.8, .12, .08);
    add("cylinder", "soil", .4, 1.35, 0, .14, 2.7, .14);
    add("octahedron", "canopy", .4, 3.6, 0, 1.25, 1.45, 1.15);
    add("octahedron", "canopy", 1.05, 4.35, .12, .6, .8, .56);
  } else if (kit === "waiting") {
    // Backless slats and separate feet, not an opaque bench/cover box.
    for (const z of [-.22, 0, .22]) add("box", "brushedMetal", 0, .4, z, 2.3, .06, .15);
    for (const x of [-.85, .85]) add("box", "structuralDark", x, .18, 0, .1, .36, .5);
  } else if (kit === "cargo-cradle") {
    // Empty ankle-low loading frames identify industry without fake crates.
    for (const x of [-1, 1]) add("box", "paintedMetal", x, .13, 0, .12, .2, 2.8);
    for (const z of [-1.3, 1.3]) add("box", "brushedMetal", 0, .09, z, 2.1, .12, .12);
    add("box", wreck ? "warningRed" : "industrialOrange", 0, .045, -1.8, 1.4, .012, .12, true);
  } else {
    for (const x of [-.85, .85]) add("box", "structuralDark", x, .1, 0, .1, .16, 2.4);
    add("box", "solarPanel", 0, .22, 0, 1.9, .08, 2.4);
    add("box", "brushedMetal", 0, .282, 0, .055, .035, 2.4);
  }
  // Warm lenses rather than dynamic lights; thin stems remain obviously
  // non-cover and reuse the renderer's existing global material registry.
  if (kit !== "garden") {
    add("box", "structuralDark", 2, 1.3, .8, .08, 2.6, .08);
    add("box", "windowLit", 2, 2.72, .8, .18, .18, .18);
  }
  return parts;
}

/** Replaces only buildDistrictProps' seeded scatter block. Preserve the separate
 * buildNexusPlaza/addContextProps integration. World-space parts, max3 groups
 * per primary POI except Nova's seven street pockets; max7 parts/group.
 * Box lengths; cylinders/octas radius1.
 * Batch geometry+finish+surface: canopy=>materials.canopy(), surface=>surface
 * (finish,6), otherwise get(finish). cameraCollision=false, existing POI LOD.
 */
export function buildBrAuthoredDistrictProps(poi: Pick<BrPoi, "id">): BrAuthoredDistrictProp[] {
  return (PLACEMENTS[poi.id] ?? []).map(([context, kit, x, z, quarterTurns], index) => {
    const center = { x, y: 0, z };
    return { id: `${poi.id}-props-${index + 1}`, poiId: poi.id, context, kit, center, radius: 3,
      parts: kitParts(center, quarterTurns * Math.PI / 2, kit, poi.id === "crash-site") };
  });
}
