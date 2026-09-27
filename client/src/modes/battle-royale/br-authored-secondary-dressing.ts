import type { BrDistrictPlan, Vec3 } from "@planetfall/shared";
import type { BrMaterialKey } from "./br-materials";

export interface BrAuthoredSecondaryPart {
  name: string;
  geometry: "box" | "cylinder" | "octahedron";
  finish: BrMaterialKey | "canopy";
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  surface: boolean;
}
export interface BrAuthoredSecondaryDressing {
  id: string;
  family: BrDistrictPlan["kind"];
  context: string;
  center: Vec3;
  radius: number;
  parts: BrAuthoredSecondaryPart[];
}

// Every tuple is a literal WORLD transform, not an offset or a placement seed.
// Cylinders/octahedra have radius 1; boxes have side 1. Surface tops are <= .04m.
// No colliders, point lights, per-frame work, runtime selection or quality-dependent
// map composition. Batch by geometry + finish + surface, using materials.canopy()
// for leaves (camera-near fade), materials.surface(finish, 1) for surface=true,
// otherwise materials.get(finish). Attach batches to the existing site LOD group.
type Part = readonly [name: string, geometry: BrAuthoredSecondaryPart["geometry"],
  finish: BrAuthoredSecondaryPart["finish"], x: number, y: number, z: number,
  sx: number, sy: number, sz: number, yaw?: number, surface?: boolean];
interface Site {
  id: string;
  family: BrDistrictPlan["kind"];
  context: string;
  center: readonly [number, number];
  parts: readonly Part[];
}

/** Replaces secondary park paths/trees, district corner kits, radial cargo props,
 * turbines, crop loops, hover vehicles and transit shelters as ONE authored layer.
 * Do not render the old generic 40m secondary disk or quadrant deck kit beneath it.
 * Short paths are furniture aprons, not implied new roads or walkable platforms.
 * Cargo/turbine/vehicle motifs are deliberately empty cradles, low fan/solar insets
 * and charging aprons: no broad non-colliding masses that could imply hard cover.
 * The site radius (3m) encloses every part, including tree crowns and surface corners.
 */
const SITES: readonly Site[] = [
  { id: "central-heights", family: "neighborhood", context: "East street pocket: tree and residents' bench", center: [-60, -72], parts: [
    ["paving", "box", "sidewalk", -60, .016, -72, 4, .016, 3, 0, true],
    ["tree-bed", "box", "soil", -61, .032, -72, 1.35, .016, 1.35, 0, true],
    ["tree-stem", "cylinder", "structuralDark", -61, 1.62, -72, .09, 3.16, .09],
    ["tree-crown", "octahedron", "canopy", -61, 3.6, -72, 1.05, 1.1, 1.05],
    ["bench", "box", "brushedMetal", -59, .36, -72, .65, .12, 1.8],
    ["bench-foot-a", "box", "structuralDark", -59, .17, -72.6, .48, .26, .12],
    ["bench-foot-b", "box", "structuralDark", -59, .17, -71.4, .48, .26, .12],
    ["entry-apron", "box", "concrete", -60, .032, -73.15, 2.4, .016, .38, 0, true],
  ] },
  { id: "relay-market", family: "commercial", context: "Market loading apron and open waiting frame", center: [42, -73], parts: [
    ["apron", "box", "paintedMetal", 42, .016, -73, 4, .016, 3, 0, true],
    ["frame-west", "box", "structuralDark", 40.7, 1.5, -73.7, .12, 2.92, .12],
    ["frame-east", "box", "structuralDark", 43.3, 1.5, -73.7, .12, 2.92, .12],
    ["frame-header", "box", "brushedMetal", 42, 2.93, -73.7, 2.72, .12, .16],
    ["header-lens", "box", "windowLit", 42, 2.93, -73.6, 1.1, .06, .04],
    ["waiting-seat", "box", "structuralWhite", 42, .34, -73.5, 1.8, .16, .48],
    ["seat-foot", "box", "structuralDark", 42, .15, -73.5, 1.2, .22, .25],
    ["walk-strip", "box", "sidewalk", 42, .032, -72.2, 3.4, .016, .65, 0, true],
  ] },
  { id: "comet-hotel", family: "commercial", context: "Hotel garden arrival seat", center: [-46, -189], parts: [
    ["arrival-apron", "box", "sidewalk", -46, .016, -189, 4, .016, 3, 0, true],
    ["tree-bed", "box", "soil", -47, .032, -189.2, 1.35, .016, 1.35, 0, true],
    ["tree-stem", "cylinder", "structuralDark", -47, 1.62, -189.2, .09, 3.16, .09],
    ["tree-crown", "octahedron", "canopy", -47, 3.5, -189.2, 1.05, 1, 1.05],
    ["seat", "box", "brushedMetal", -45, .36, -189.2, .65, .12, 1.8],
    ["seat-base", "box", "paintedMetal", -45, .17, -189.2, .45, .26, 1.2],
    ["arrival-line", "box", "concrete", -46, .032, -187.9, 3.4, .016, .3, 0, true],
    ["path-lens", "box", "windowLit", -46, .037, -190.25, .65, .006, .08, 0, true],
  ] },
  { id: "horizon-homes", family: "neighborhood", context: "Residents' east-side garden", center: [-215, -35], parts: [
    ["garden-apron", "box", "concrete", -215, .016, -35, 4, .016, 3, 0, true],
    ["planting-bed", "box", "soil", -216, .032, -35, 1.35, .016, 1.4, 0, true],
    ["tree-stem", "cylinder", "structuralDark", -216, 1.62, -35, .09, 3.16, .09],
    ["tree-crown", "octahedron", "canopy", -216, 3.7, -35, .95, 1.2, 1],
    ["seat", "box", "structuralWhite", -214, .36, -35, .65, .12, 1.8],
    ["seat-base", "box", "paintedMetal", -214, .17, -35, .45, .26, 1.2],
    ["front-path", "box", "sidewalk", -215, .032, -33.85, 3.4, .016, .42, 0, true],
    ["path-end", "box", "brushedMetal", -213.5, .034, -35, .12, .012, 1.8, 0, true],
  ] },
  { id: "academy-dorms", family: "campus", context: "Dormitory study-garden pocket", center: [-335, 140], parts: [
    ["study-apron", "box", "sidewalk", -335, .016, 140, 4, .016, 3, 0, true],
    ["tree-bed", "box", "soil", -336, .032, 140, 1.3, .016, 1.3, 0, true],
    ["tree-stem", "cylinder", "structuralDark", -336, 1.62, 140, .09, 3.16, .09],
    ["tree-crown", "octahedron", "canopy", -336, 3.7, 140, 1, 1.2, 1],
    ["study-seat", "box", "structuralWhite", -334, .35, 140, .65, .14, 1.8],
    ["seat-base", "box", "structuralDark", -334, .16, 140, .4, .24, 1.2],
    ["walk-strip", "box", "concrete", -335, .032, 141.15, 3.2, .016, .42, 0, true],
    ["study-lens", "box", "energyCyan", -335, .037, 138.85, .55, .006, .07, 0, true],
  ] },
  { id: "west-overlook", family: "civic", context: "Public lookout rest apron", center: [-415, 40], parts: [
    ["rest-apron", "box", "sidewalk", -415, .016, 40, 4, .016, 3, 0, true],
    ["seat", "box", "brushedMetal", -415, .35, 40.5, 2.2, .14, .6],
    ["seat-base", "box", "structuralDark", -415, .16, 40.5, 1.5, .24, .35],
    ["beacon-post", "box", "structuralWhite", -416.3, 1.25, 39.25, .12, 2.42, .12],
    ["beacon-lens", "box", "windowLit", -416.3, 2.25, 39.25, .15, .28, .15],
    ["compass-inlay", "box", "brushedMetal", -415, .032, 39.3, 1.6, .016, .13, 0, true],
    ["compass-cross", "box", "paintedMetal", -415, .037, 39.3, .13, .006, .85, 0, true],
    ["front-walk", "box", "concrete", -415, .032, 41.15, 3.4, .016, .32, 0, true],
  ] },
  { id: "signal-station", family: "workyard", context: "Antenna service: inset fan and charging strip", center: [-405, -165], parts: [
    ["service-apron", "box", "paintedMetal", -405, .016, -165, 4, .016, 3, 0, true],
    ["fan-ring", "cylinder", "brushedMetal", -405.8, .12, -165, .65, .16, .65],
    ["fan-inset", "cylinder", "structuralDark", -405.8, .21, -165, .5, .02, .5],
    ["fan-spoke", "box", "brushedMetal", -405.8, .235, -165, .85, .03, .08],
    ["charge-post", "box", "structuralWhite", -403.8, 1.1, -165.8, .14, 2.12, .14],
    ["post-lens", "box", "energyCyan", -403.8, 2.06, -165.8, .16, .13, .16],
    ["charge-inlay", "box", "industrialOrange", -404, .032, -164.3, 1.4, .016, .13, 0, true],
    ["walk-strip", "box", "concrete", -405, .032, -163.9, 3.4, .016, .32, 0, true],
  ] },
  { id: "salvage-row", family: "salvage", context: "Empty recovery cradle and inspection lamp", center: [-275, -335], parts: [
    ["recovery-apron", "box", "concrete", -275, .016, -335, 4, .016, 3, 0, true],
    ["cradle-west", "box", "cargoMetal", -275.8, .16, -335, .16, .24, 1.8],
    ["cradle-east", "box", "cargoMetal", -274.2, .16, -335, .16, .24, 1.8],
    ["cradle-tie", "box", "brushedMetal", -275, .11, -335.65, 1.5, .14, .14],
    ["inspection-post", "box", "structuralDark", -276.3, 1.2, -336, .14, 2.32, .14],
    ["inspection-lens", "box", "windowLit", -276.3, 2.27, -336, .17, .14, .17],
    ["recovery-mark", "box", "industrialOrange", -275, .032, -333.9, 2.8, .016, .12, 0, true],
    ["service-hatch", "box", "paintedMetal", -276.2, .032, -334.5, .5, .016, .5, 0, true],
  ] },
  { id: "emergency-depot", family: "salvage", context: "Rescue equipment return apron", center: [-190, -395], parts: [
    ["return-apron", "box", "paintedMetal", -190, .016, -395, 4, .016, 3, 0, true],
    ["empty-rack-west", "box", "brushedMetal", -190.8, .17, -395, .16, .26, 1.6],
    ["empty-rack-east", "box", "brushedMetal", -189.2, .17, -395, .16, .26, 1.6],
    ["rack-tie", "box", "cargoMetal", -190, .11, -395.65, 1.5, .14, .14],
    ["rescue-post", "box", "structuralWhite", -191.3, 1.2, -396, .14, 2.32, .14],
    ["rescue-lens", "box", "windowLit", -191.3, 2.27, -396, .17, .14, .17],
    ["return-mark", "box", "industrialOrange", -190, .032, -393.9, 2.6, .016, .14, 0, true],
    ["return-tick", "box", "structuralWhite", -188.5, .032, -395, .12, .016, 1.4, 0, true],
  ] },
  { id: "south-terminal", family: "civic", context: "Terminal passenger waiting frame", center: [-15, -390], parts: [
    ["terminal-apron", "box", "sidewalk", -15, .016, -390, 4, .016, 3, 0, true],
    ["frame-west", "box", "structuralDark", -16.3, 1.5, -390.8, .12, 2.92, .12],
    ["frame-east", "box", "structuralDark", -13.7, 1.5, -390.8, .12, 2.92, .12],
    ["frame-header", "box", "brushedMetal", -15, 2.93, -390.8, 2.72, .12, .16],
    ["header-lens", "box", "windowLit", -15, 2.93, -390.7, 1.1, .06, .04],
    ["terminal-seat", "box", "structuralWhite", -15, .34, -390.6, 1.8, .16, .48],
    ["seat-foot", "box", "structuralDark", -15, .15, -390.6, 1.2, .22, .25],
    ["walk-strip", "box", "concrete", -15, .032, -389.2, 3.4, .016, .65, 0, true],
  ] },
  { id: "cargo-spur", family: "workyard", context: "Empty freight cradle at spur shoulder", center: [125, -260], parts: [
    ["freight-apron", "box", "paintedMetal", 125, .016, -260, 4, .016, 3, 0, true],
    ["cradle-west", "box", "cargoMetal", 124.2, .16, -260, .16, .24, 1.8],
    ["cradle-east", "box", "cargoMetal", 125.8, .16, -260, .16, .24, 1.8],
    ["cradle-tie", "box", "brushedMetal", 125, .11, -260.65, 1.5, .14, .14],
    ["dock-post", "box", "structuralDark", 123.7, 1.1, -261, .14, 2.12, .14],
    ["dock-lens", "box", "energyCyan", 123.7, 2.06, -261, .16, .13, .16],
    ["freight-mark", "box", "industrialOrange", 125, .032, -258.9, 2.8, .016, .12, 0, true],
    ["service-hatch", "box", "brushedMetal", 126.4, .032, -260, .45, .016, .7, 0, true],
  ] },
  { id: "dock-service", family: "workyard", context: "Dock turbine inspection inset", center: [255, -250], parts: [
    ["inspection-apron", "box", "concrete", 255, .016, -250, 4, .016, 3, 0, true],
    ["turbine-rim", "cylinder", "brushedMetal", 254.2, .12, -250, .65, .16, .65],
    ["turbine-inset", "cylinder", "structuralDark", 254.2, .21, -250, .5, .02, .5],
    ["turbine-spoke", "box", "brushedMetal", 254.2, .235, -250, .85, .03, .08],
    ["diagnostic-post", "box", "structuralWhite", 256.2, 1.1, -250.8, .14, 2.12, .14],
    ["diagnostic-lens", "box", "energyCyan", 256.2, 2.06, -250.8, .16, .13, .16],
    ["maintenance-line", "box", "industrialOrange", 255, .032, -248.9, 3, .016, .12, 0, true],
    ["equipment-hatch", "box", "paintedMetal", 256, .032, -249.7, .8, .016, .6, 0, true],
  ] },
  { id: "engine-gate", family: "workyard", context: "Engine coolant maintenance apron", center: [435, -155], parts: [
    ["engine-apron", "box", "paintedMetal", 435, .016, -155, 4, .016, 3, 0, true],
    ["cooler-rim", "cylinder", "brushedMetal", 434.2, .12, -155, .65, .16, .65],
    ["cooler-inset", "cylinder", "structuralDark", 434.2, .21, -155, .5, .02, .5],
    ["cooler-spoke", "box", "brushedMetal", 434.2, .235, -155, .85, .03, .08],
    ["power-post", "box", "structuralWhite", 436.2, 1.1, -155.8, .14, 2.12, .14],
    ["power-lens", "box", "energyCyan", 436.2, 2.06, -155.8, .16, .13, .16],
    ["power-hatch", "box", "brushedMetal", 436, .032, -154.7, .8, .016, .6, 0, true],
    ["access-strip", "box", "concrete", 435, .032, -153.9, 3.4, .016, .32, 0, true],
  ] },
  { id: "east-checkpoint", family: "civic", context: "Checkpoint pedestrian waiting frame", center: [335, 285], parts: [
    ["checkpoint-apron", "box", "sidewalk", 335, .016, 285, 4, .016, 3, 0, true],
    ["frame-west", "box", "structuralDark", 333.7, 1.5, 284.2, .12, 2.92, .12],
    ["frame-east", "box", "structuralDark", 336.3, 1.5, 284.2, .12, 2.92, .12],
    ["frame-header", "box", "brushedMetal", 335, 2.93, 284.2, 2.72, .12, .16],
    ["header-lens", "box", "windowLit", 335, 2.93, 284.3, 1.1, .06, .04],
    ["waiting-seat", "box", "structuralWhite", 335, .34, 284.4, 1.8, .16, .48],
    ["seat-foot", "box", "structuralDark", 335, .15, 284.4, 1.2, .22, .25],
    ["walk-strip", "box", "concrete", 335, .032, 285.8, 3.4, .016, .65, 0, true],
  ] },
  { id: "helios-relay", family: "workyard", context: "Relay solar calibration bench", center: [395, 165], parts: [
    ["calibration-apron", "box", "concrete", 395, .016, 165, 4, .016, 3, 0, true],
    ["panel-base", "box", "structuralDark", 394.5, .13, 165, 1.6, .18, 1.1],
    ["solar-test-panel", "box", "solarPanel", 394.5, .25, 165, 1.8, .06, 1.3],
    ["panel-seam", "box", "brushedMetal", 394.5, .286, 165, .045, .012, 1.3],
    ["calibration-post", "box", "structuralWhite", 396.3, 1.1, 164.1, .14, 2.12, .14],
    ["post-lens", "box", "energyCyan", 396.3, 2.06, 164.1, .16, .13, .16],
    ["cable-cover", "box", "paintedMetal", 396.1, .032, 165, .18, .016, 1.4, 0, true],
    ["walk-strip", "box", "sidewalk", 395, .032, 166.15, 3.4, .016, .32, 0, true],
  ] },
  { id: "orbital-overlook", family: "civic", context: "Open-air orbital viewing seat", center: [340, 205], parts: [
    ["view-apron", "box", "sidewalk", 340, .016, 205, 4, .016, 3, 0, true],
    ["view-seat", "box", "brushedMetal", 340, .35, 205.5, 2.2, .14, .6],
    ["seat-base", "box", "structuralDark", 340, .16, 205.5, 1.5, .24, .35],
    ["view-post", "box", "structuralWhite", 338.7, 1.25, 204.25, .12, 2.42, .12],
    ["view-lens", "box", "windowLit", 338.7, 2.25, 204.25, .15, .28, .15],
    ["bearing-inlay", "box", "brushedMetal", 340, .032, 204.3, 1.6, .016, .13, 0, true],
    ["bearing-cross", "box", "paintedMetal", 340, .037, 204.3, .13, .006, .85, 0, true],
    ["approach", "box", "concrete", 340, .032, 206.15, 3.4, .016, .32, 0, true],
  ] },
  { id: "farm-service", family: "agricultural", context: "Two cultivated inset beds and irrigation monitor", center: [260, 360], parts: [
    ["farm-path", "box", "sidewalk", 260, .016, 360, 4, .016, 3, 0, true],
    ["west-bed", "box", "soil", 259.15, .032, 360, 1.05, .016, 1.9, 0, true],
    ["east-bed", "box", "soil", 260.85, .032, 360, 1.05, .016, 1.9, 0, true],
    ["west-crop", "box", "grass", 259.15, .15, 360, .65, .22, 1.55],
    ["east-crop", "box", "grass", 260.85, .17, 360, .65, .26, 1.55],
    ["irrigation-post", "box", "structuralWhite", 261.45, .9, 359, .12, 1.72, .12],
    ["irrigation-lens", "box", "energyCyan", 261.45, 1.67, 359, .14, .12, .14],
    ["center-path", "box", "concrete", 260, .032, 360, .45, .016, 2.6, 0, true],
  ] },
  { id: "solar-field", family: "agricultural", context: "Solar sample garden with low test cells", center: [105, 390], parts: [
    ["solar-apron", "box", "concrete", 105, .016, 390, 4, .016, 3, 0, true],
    ["panel-base", "box", "structuralDark", 104.4, .13, 390, 1.5, .18, 1.1],
    ["test-cell", "box", "solarPanel", 104.4, .25, 390, 1.7, .06, 1.3],
    ["test-seam", "box", "brushedMetal", 104.4, .286, 390, .045, .012, 1.3],
    ["sample-bed", "box", "soil", 106.1, .032, 390, .7, .016, 1.8, 0, true],
    ["sample-crop", "box", "grass", 106.1, .15, 390, .4, .22, 1.45],
    ["solar-marker", "box", "industrialOrange", 105, .032, 388.9, 2.8, .016, .12, 0, true],
    ["walk-strip", "box", "sidewalk", 105, .032, 391.15, 3.4, .016, .32, 0, true],
  ] },
  { id: "north-gardens", family: "agricultural", context: "Garden specimen and seed beds", center: [-25, 435], parts: [
    ["garden-path", "box", "sidewalk", -25, .016, 435, 4, .016, 3, 0, true],
    ["tree-bed", "box", "soil", -26, .032, 435, 1.35, .016, 1.35, 0, true],
    ["tree-stem", "cylinder", "structuralDark", -26, 1.62, 435, .09, 3.16, .09],
    ["tree-crown", "octahedron", "canopy", -26, 3.6, 435, 1.05, 1.1, 1.05],
    ["seed-bed", "box", "soil", -24, .032, 435, .85, .016, 1.9, 0, true],
    ["seed-crop", "box", "grass", -24, .15, 435, .55, .22, 1.55],
    ["cross-path", "box", "concrete", -25, .032, 436.15, 3.4, .016, .42, 0, true],
    ["garden-lens", "box", "windowLit", -25, .037, 433.85, .55, .006, .07, 0, true],
  ] },
  { id: "mall-annex", family: "commercial", context: "Annex garden waiting pocket", center: [-185, 395], parts: [
    ["annex-apron", "box", "sidewalk", -185, .016, 395, 4, .016, 3, 0, true],
    ["tree-bed", "box", "soil", -186, .032, 395, 1.35, .016, 1.35, 0, true],
    ["tree-stem", "cylinder", "structuralDark", -186, 1.62, 395, .09, 3.16, .09],
    ["tree-crown", "octahedron", "canopy", -186, 3.5, 395, 1.05, 1, 1.05],
    ["annex-seat", "box", "brushedMetal", -184, .36, 395, .65, .12, 1.8],
    ["seat-base", "box", "paintedMetal", -184, .17, 395, .45, .26, 1.2],
    ["entry-strip", "box", "concrete", -185, .032, 396.15, 3.4, .016, .42, 0, true],
    ["entry-lens", "box", "energyPurple", -185, .037, 393.85, .55, .006, .07, 0, true],
  ] },
  { id: "academy-commons", family: "campus", context: "Commons specimen tree and student seating", center: [-285, 265], parts: [
    ["commons-apron", "box", "sidewalk", -285, .016, 265, 4, .016, 3, 0, true],
    ["specimen-bed", "box", "soil", -286, .032, 265, 1.35, .016, 1.35, 0, true],
    ["specimen-stem", "cylinder", "structuralDark", -286, 1.62, 265, .09, 3.16, .09],
    ["specimen-crown", "octahedron", "canopy", -286, 3.7, 265, .95, 1.2, 1],
    ["student-seat", "box", "structuralWhite", -284, .36, 265, .65, .12, 1.8],
    ["seat-base", "box", "paintedMetal", -284, .17, 265, .45, .26, 1.2],
    ["entry-strip", "box", "concrete", -285, .032, 266.15, 3.4, .016, .42, 0, true],
    ["study-lens", "box", "energyCyan", -285, .037, 263.85, .55, .006, .07, 0, true],
  ] },
  { id: "west-park", family: "campus", context: "Park edge specimen rest pocket", center: [-435, 165], parts: [
    ["park-path", "box", "concrete", -435, .016, 165, 4, .016, 3, 0, true],
    ["tree-bed", "box", "soil", -436, .032, 165, 1.35, .016, 1.35, 0, true],
    ["tree-stem", "cylinder", "structuralDark", -436, 1.62, 165, .09, 3.16, .09],
    ["tree-crown", "octahedron", "canopy", -436, 3.6, 165, 1, 1.1, 1],
    ["park-seat", "box", "brushedMetal", -434, .36, 165, .65, .12, 1.8],
    ["seat-base", "box", "structuralDark", -434, .17, 165, .45, .26, 1.2],
    ["entry-strip", "box", "sidewalk", -435, .032, 166.15, 3.4, .016, .42, 0, true],
    ["park-lens", "box", "windowLit", -435, .037, 163.85, .55, .006, .07, 0, true],
  ] },
  { id: "coolant-plant", family: "workyard", context: "Plant cooling-fan maintenance inset", center: [100, 210], parts: [
    ["plant-apron", "box", "paintedMetal", 100, .016, 210, 4, .016, 3, 0, true],
    ["cooling-rim", "cylinder", "brushedMetal", 99.2, .12, 210, .65, .16, .65],
    ["cooling-inset", "cylinder", "structuralDark", 99.2, .21, 210, .5, .02, .5],
    ["cooling-spoke", "box", "brushedMetal", 99.2, .235, 210, .85, .03, .08],
    ["cooling-post", "box", "structuralWhite", 101.2, 1.1, 209.2, .14, 2.12, .14],
    ["cooling-lens", "box", "energyCyan", 101.2, 2.06, 209.2, .16, .13, .16],
    ["valve-hatch", "box", "brushedMetal", 101, .032, 210.3, .8, .016, .6, 0, true],
    ["access-strip", "box", "concrete", 100, .032, 211.1, 3.4, .016, .32, 0, true],
  ] },
  { id: "central-security", family: "civic", context: "Security office public waiting apron", center: [-160, 115], parts: [
    ["public-apron", "box", "sidewalk", -160, .016, 115, 4, .016, 3, 0, true],
    ["public-seat", "box", "brushedMetal", -160, .35, 115.5, 2.2, .14, .6],
    ["seat-base", "box", "structuralDark", -160, .16, 115.5, 1.5, .24, .35],
    ["public-post", "box", "structuralWhite", -161.3, 1.25, 114.25, .12, 2.42, .12],
    ["public-lens", "box", "windowLit", -161.3, 2.25, 114.25, .15, .28, .15],
    ["queue-inlay", "box", "paintedMetal", -160, .032, 114.3, 1.6, .016, .13, 0, true],
    ["queue-end", "box", "brushedMetal", -158.6, .032, 115, .12, .016, 1.5, 0, true],
    ["entry-walk", "box", "concrete", -160, .032, 116.15, 3.4, .016, .32, 0, true],
  ] },
  { id: "south-shipworks", family: "workyard", context: "Ship component empty inspection cradle", center: [160, -390], parts: [
    ["shipworks-apron", "box", "paintedMetal", 160, .016, -390, 4, .016, 3, 0, true],
    ["cradle-west", "box", "cargoMetal", 159.2, .16, -390, .16, .24, 1.8],
    ["cradle-east", "box", "cargoMetal", 160.8, .16, -390, .16, .24, 1.8],
    ["cradle-tie", "box", "brushedMetal", 160, .11, -390.65, 1.5, .14, .14],
    ["inspection-post", "box", "structuralWhite", 158.7, 1.1, -391, .14, 2.12, .14],
    ["inspection-lens", "box", "energyCyan", 158.7, 2.06, -391, .16, .13, .16],
    ["component-mark", "box", "industrialOrange", 160, .032, -388.9, 2.8, .016, .12, 0, true],
    ["service-hatch", "box", "brushedMetal", 161.4, .032, -390, .45, .016, .7, 0, true],
  ] },
  { id: "east-freight", family: "workyard", context: "Freight empty charging bay", center: [300, -290], parts: [
    ["charging-apron", "box", "concrete", 300, .016, -290, 4, .016, 3, 0, true],
    ["parking-line-west", "box", "industrialOrange", 299.1, .032, -290, .12, .016, 1.9, 0, true],
    ["parking-line-east", "box", "industrialOrange", 300.9, .032, -290, .12, .016, 1.9, 0, true],
    ["parking-stop", "box", "paintedMetal", 300, .1, -290.8, 1.5, .12, .18],
    ["charging-post", "box", "structuralWhite", 298.65, 1.1, -291, .14, 2.12, .14],
    ["charging-lens", "box", "energyCyan", 298.65, 2.06, -291, .16, .13, .16],
    ["cable-hatch", "box", "brushedMetal", 301.4, .032, -290, .45, .016, .7, 0, true],
    ["access-strip", "box", "sidewalk", 300, .032, -288.9, 3.4, .016, .32, 0, true],
  ] },
  { id: "northwest-housing", family: "neighborhood", context: "Housing north garden seat", center: [-230, 405], parts: [
    ["housing-apron", "box", "sidewalk", -230, .016, 405, 4, .016, 3, 0, true],
    ["tree-bed", "box", "soil", -231, .032, 405, 1.35, .016, 1.35, 0, true],
    ["tree-stem", "cylinder", "structuralDark", -231, 1.62, 405, .09, 3.16, .09],
    ["tree-crown", "octahedron", "canopy", -231, 3.6, 405, 1.05, 1.1, 1.05],
    ["housing-seat", "box", "structuralWhite", -229, .36, 405, .65, .12, 1.8],
    ["seat-base", "box", "paintedMetal", -229, .17, 405, .45, .26, 1.2],
    ["entry-strip", "box", "concrete", -230, .032, 406.15, 3.4, .016, .42, 0, true],
    ["garden-lens", "box", "windowLit", -230, .037, 403.85, .55, .006, .07, 0, true],
  ] },
  { id: "west-salvage", family: "salvage", context: "Salvage low sorting cradle", center: [-395, -180], parts: [
    ["sorting-apron", "box", "concrete", -395, .016, -180, 4, .016, 3, 0, true],
    ["sorting-rail-west", "box", "cargoMetal", -395.8, .16, -180, .16, .24, 1.8],
    ["sorting-rail-east", "box", "cargoMetal", -394.2, .16, -180, .16, .24, 1.8],
    ["sorting-tie", "box", "brushedMetal", -395, .11, -180.65, 1.5, .14, .14],
    ["inspection-post", "box", "structuralDark", -396.3, 1.2, -181, .14, 2.32, .14],
    ["inspection-lens", "box", "windowLit", -396.3, 2.27, -181, .17, .14, .17],
    ["sorting-mark", "box", "industrialOrange", -395, .032, -178.9, 2.8, .016, .12, 0, true],
    ["service-hatch", "box", "paintedMetal", -393.6, .032, -180, .45, .016, .7, 0, true],
  ] },
  { id: "east-rim", family: "workyard", context: "Rim sensor calibration inset", center: [395, 80], parts: [
    ["sensor-apron", "box", "paintedMetal", 395, .016, 80, 4, .016, 3, 0, true],
    ["sensor-ring", "cylinder", "brushedMetal", 394.2, .12, 80, .65, .16, .65],
    ["sensor-inset", "cylinder", "structuralDark", 394.2, .21, 80, .5, .02, .5],
    ["sensor-spoke", "box", "brushedMetal", 394.2, .235, 80, .85, .03, .08],
    ["sensor-post", "box", "structuralWhite", 396.2, 1.1, 79.2, .14, 2.12, .14],
    ["sensor-lens", "box", "energyCyan", 396.2, 2.06, 79.2, .16, .13, .16],
    ["sensor-hatch", "box", "brushedMetal", 396, .032, 80.3, .8, .016, .6, 0, true],
    ["access-strip", "box", "concrete", 395, .032, 81.1, 3.4, .016, .32, 0, true],
  ] },
  { id: "west-rim", family: "campus", context: "Northeast campus garden on the actual island deck", center: [-340, 345], parts: [
    ["rim-path", "box", "concrete", -340, .016, 345, 4, .016, 3, 0, true],
    ["tree-bed", "box", "soil", -341, .032, 345, 1.35, .016, 1.35, 0, true],
    ["tree-stem", "cylinder", "structuralDark", -341, 1.62, 345, .09, 3.16, .09],
    ["tree-crown", "octahedron", "canopy", -341, 3.6, 345, 1, 1.1, 1],
    ["rim-seat", "box", "brushedMetal", -339, .36, 345, .65, .12, 1.8],
    ["seat-base", "box", "structuralDark", -339, .17, 345, .45, .26, 1.2],
    ["entry-strip", "box", "sidewalk", -340, .032, 346.15, 3.4, .016, .42, 0, true],
    ["study-lens", "box", "energyCyan", -340, .037, 343.85, .55, .006, .07, 0, true],
  ] },
];

// Individually authored connective landmarks, intentionally separate from the 30
// named secondary sites. No nearest-POI assignment or synthesized placement.
const TRANSITIONS: readonly Site[] = [
  { id: "coolant-exchange-garden", family: "campus", context: "Coolant exchange garden rest pocket", center: [-25, 125], parts: [
    ["exchange-path", "box", "sidewalk", -25, .016, 125, 4, .016, 3, 0, true],
    ["tree-bed", "box", "soil", -26, .032, 125, 1.35, .016, 1.35, 0, true],
    ["tree-stem", "cylinder", "structuralDark", -26, 1.62, 125, .09, 3.16, .09],
    ["tree-crown", "octahedron", "canopy", -26, 3.6, 125, 1.05, 1.1, 1.05],
    ["rest-seat", "box", "brushedMetal", -24, .36, 125, .65, .12, 1.8],
    ["seat-base", "box", "structuralDark", -24, .17, 125, .45, .26, 1.2],
    ["entry-strip", "box", "concrete", -25, .032, 126.15, 3.4, .016, .42, 0, true],
    ["path-lens", "box", "energyCyan", -25, .037, 123.85, .55, .006, .07, 0, true],
  ] },
  { id: "south-orbit-service", family: "workyard", context: "South orbit empty charging apron", center: [25, -175], parts: [
    ["service-apron", "box", "paintedMetal", 25, .016, -175, 4, .016, 3, 0, true],
    ["parking-west", "box", "industrialOrange", 24.1, .032, -175, .12, .016, 1.9, 0, true],
    ["parking-east", "box", "industrialOrange", 25.9, .032, -175, .12, .016, 1.9, 0, true],
    ["parking-stop", "box", "brushedMetal", 25, .1, -175.8, 1.5, .12, .18],
    ["charging-post", "box", "structuralWhite", 23.65, 1.1, -176, .14, 2.12, .14],
    ["charging-lens", "box", "energyCyan", 23.65, 2.06, -176, .16, .13, .16],
    ["cable-hatch", "box", "brushedMetal", 26.4, .032, -175, .45, .016, .7, 0, true],
    ["access-strip", "box", "concrete", 25, .032, -173.9, 3.4, .016, .32, 0, true],
  ] },
  { id: "crash-transit-salvage", family: "salvage", context: "Recovery route open waiting frame", center: [-200, -275], parts: [
    ["recovery-path", "box", "concrete", -200, .016, -275, 4, .016, 3, 0, true],
    ["frame-west", "box", "cargoMetal", -201.3, 1.5, -275.8, .12, 2.92, .12],
    ["frame-east", "box", "cargoMetal", -198.7, 1.5, -275.8, .12, 2.92, .12],
    ["frame-header", "box", "brushedMetal", -200, 2.93, -275.8, 2.72, .12, .16],
    ["header-lens", "box", "windowLit", -200, 2.93, -275.7, 1.1, .06, .04],
    ["recovery-seat", "box", "paintedMetal", -200, .34, -275.6, 1.8, .16, .48],
    ["seat-foot", "box", "structuralDark", -200, .15, -275.6, 1.2, .22, .25],
    ["walk-strip", "box", "sidewalk", -200, .032, -274.2, 3.4, .016, .65, 0, true],
  ] },
  { id: "east-power-node", family: "workyard", context: "East power solar diagnostic inset", center: [175, -25], parts: [
    ["power-apron", "box", "concrete", 175, .016, -25, 4, .016, 3, 0, true],
    ["panel-base", "box", "structuralDark", 174.5, .13, -25, 1.6, .18, 1.1],
    ["solar-test-panel", "box", "solarPanel", 174.5, .25, -25, 1.8, .06, 1.3],
    ["panel-seam", "box", "brushedMetal", 174.5, .286, -25, .045, .012, 1.3],
    ["power-post", "box", "structuralWhite", 176.3, 1.1, -25.9, .14, 2.12, .14],
    ["power-lens", "box", "energyCyan", 176.3, 2.06, -25.9, .16, .13, .16],
    ["cable-cover", "box", "paintedMetal", 176.1, .032, -25, .18, .016, 1.4, 0, true],
    ["walk-strip", "box", "sidewalk", 175, .032, -23.85, 3.4, .016, .32, 0, true],
  ] },
];

// Decode only: none of the transform values depend on site position, road order,
// a seed, frame time or another map input. Fresh objects protect the authored data.
function decode(site: Site): BrAuthoredSecondaryDressing {
  return { id: site.id, family: site.family, context: site.context,
    center: { x: site.center[0], y: 0, z: site.center[1] }, radius: 3,
    parts: site.parts.map(([name, geometry, finish, x, y, z, sx, sy, sz, rotationY = 0, surface = false]) => ({
      name, geometry, finish, position: { x, y, z }, scale: { x: sx, y: sy, z: sz }, rotationY, surface,
    })) };
}

export function buildBrAuthoredSecondaryDressing(site: { id: string }): BrAuthoredSecondaryDressing | undefined {
  const authored = SITES.find(entry => entry.id === site.id);
  return authored ? decode(authored) : undefined;
}

export function buildBrAuthoredTransitionDressing(): BrAuthoredSecondaryDressing[] {
  return TRANSITIONS.map(decode);
}
