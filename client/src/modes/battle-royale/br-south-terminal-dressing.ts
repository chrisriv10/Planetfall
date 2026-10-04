import type { Vec3 } from "@planetfall/shared";
import type { BrMaterialKey } from "./br-materials";

export interface BrSouthTerminalPart {
  name: string;
  finish: BrMaterialKey;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  surface: boolean;
  detail: "essential" | "enhanced";
}

export interface BrSouthTerminalDressing {
  id: "south-terminal-wayfinding-pocket";
  context: string;
  center: Vec3;
  parts: BrSouthTerminalPart[];
}

type Part = readonly [name: string, finish: BrMaterialKey, x: number, y: number, z: number,
  sx: number, sy: number, sz: number, rotationY?: number, surface?: boolean,
  detail?: BrSouthTerminalPart["detail"]];

// Authored world transforms for the current elevated SOUTH TERMINAL deck.
// The western wayfinding pocket is outside both road corridors. Freestanding
// pieces are only slender posts or overhead members; schedule panels are
// embedded in the real terminal wall and avoid its west entrance opening.
const PARTS: readonly Part[] = [
  // A broad but entirely flush terminal hardstand gives the open western deck
  // deliberate scale. Broken muted outlines read as deck inlays, not a second
  // road or a raised platform, and stop well before both road corridors.
  ["apron-north", "brushedMetal", -4.5, 3.612, -385.5, 25, .012, .18, 0, true],
  ["apron-south", "brushedMetal", -4.5, 3.612, -407.5, 25, .012, .18, 0, true],
  ["apron-west", "brushedMetal", -16.5, 3.612, -396.5, .18, .012, 22.2, 0, true],
  ["apron-east", "brushedMetal", 7.5, 3.612, -396.5, .18, .012, 22.2, 0, true],
  ["apron-inner-north", "paintedMetal", -4.5, 3.62, -389, 17, .008, .12, 0, true, "enhanced"],
  ["apron-inner-south", "paintedMetal", -4.5, 3.62, -404, 17, .008, .12, 0, true, "enhanced"],
  ["apron-inner-west", "paintedMetal", -13, 3.62, -396.5, .12, .008, 15, 0, true, "enhanced"],
  ["apron-inner-east", "paintedMetal", 4, 3.62, -396.5, .12, .008, 15, 0, true, "enhanced"],
  ["holding-lane-a", "structuralWhite", -4.5, 3.626, -402, 15, .006, .09, 0, true],
  ["holding-lane-b", "structuralWhite", -4.5, 3.626, -398, 15, .006, .09, 0, true],
  ["holding-lane-c", "structuralWhite", -4.5, 3.626, -394, 15, .006, .09, 0, true],
  ["holding-tick-a", "industrialOrange", -11, 3.633, -402.5, .14, .006, 1.15, 0, true],
  ["holding-tick-b", "industrialOrange", -7, 3.633, -402.5, .14, .006, 1.15, 0, true],
  ["holding-tick-c", "industrialOrange", -3, 3.633, -402.5, .14, .006, 1.15, 0, true],
  ["holding-tick-d", "industrialOrange", 1, 3.633, -402.5, .14, .006, 1.15, 0, true],
  ["terminal-code-a", "structuralWhite", -15.4, 3.633, -390.2, .28, .006, 2.1, 0, true],
  ["terminal-code-b", "industrialOrange", -15.4, 3.633, -394, .28, .006, 3, 0, true],
  ["terminal-code-c", "structuralWhite", -15.4, 3.633, -398.6, .28, .006, 1.7, 0, true],

  ["route-west", "energyCyan", -9, 3.618, -398, .12, .016, 10, 0, true],
  ["route-east", "energyCyan", -3, 3.618, -398, .12, .016, 10, 0, true],
  ["route-north", "structuralWhite", -6, 3.629, -393.2, 6.1, .006, .11, 0, true],
  ["route-mid", "brushedMetal", -6, 3.629, -398, 6.1, .006, .11, 0, true],
  ["route-south", "structuralWhite", -6, 3.629, -402.8, 6.1, .006, .11, 0, true],
  ["bearing-spine", "paintedMetal", -6, 3.632, -398, .18, .006, 2.8, 0, true, "enhanced"],
  ["bearing-west", "paintedMetal", -7.2, 3.632, -398, 1.1, .006, .09, 0, true, "enhanced"],
  ["bearing-east", "paintedMetal", -4.8, 3.632, -398, 1.1, .006, .09, 0, true, "enhanced"],
  ["direction-tick-north", "industrialOrange", -6, 3.635, -395.8, 1.3, .006, .12, -.34, true],
  ["direction-tick-south", "industrialOrange", -6, 3.635, -400.2, 1.3, .006, .12, .34, true],

  ["edge-post-north", "structuralDark", -18.4, 4.53, -389.5, .12, 1.82, .12],
  ["edge-light-north", "energyCyan", -18.4, 5.49, -389.5, .2, .18, .2],
  ["edge-post-mid", "structuralDark", -18.4, 4.53, -407.5, .12, 1.82, .12],
  ["edge-light-mid", "energyCyan", -18.4, 5.49, -407.5, .2, .18, .2],
  ["edge-post-south", "structuralDark", -18.4, 4.53, -445.5, .12, 1.82, .12],
  ["edge-light-south", "energyCyan", -18.4, 5.49, -445.5, .2, .18, .2],

  ["directory-post-west", "structuralDark", -13.2, 5.08, -398, .12, 2.9, .12],
  ["directory-post-east", "structuralDark", -10.8, 5.08, -398, .12, 2.9, .12],
  ["directory-header", "brushedMetal", -12, 6.59, -398, 2.56, .12, .14],
  ["directory-lens", "energyCyan", -12, 6.51, -397.91, 1.25, .04, .035],

  ["terminal-panel-north", "paintedMetal", 24.94, 5.78, -391.7, .12, 1.5, 2.1],
  ["terminal-lens-north", "energyCyan", 24.87, 6.12, -391.7, .025, .12, 1.35],
  ["terminal-panel-south", "paintedMetal", 24.94, 5.78, -404.3, .12, 1.5, 2.1],
  ["terminal-lens-south", "industrialOrange", 24.87, 6.12, -404.3, .025, .12, 1.35],
];

export function buildBrSouthTerminalDressing(): BrSouthTerminalDressing {
  return {
    id: "south-terminal-wayfinding-pocket",
    context: "Open terminal wayfinding pocket, edge beacons and wall schedules",
    center: { x: -6, y: 3.6, z: -398 },
    parts: PARTS.map(([name, finish, x, y, z, sx, sy, sz, rotationY = 0, surface = false,
      detail = "essential"]) => ({
      name, finish, position: { x, y, z }, scale: { x: sx, y: sy, z: sz }, rotationY, surface, detail
    }))
  };
}
