import type { Vec3 } from "@planetfall/shared";
import type { BrMaterialKey } from "./br-materials";

export interface BrSouthShipworksPart {
  name: string;
  finish: BrMaterialKey;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  surface: boolean;
}

export interface BrSouthShipworksDressing {
  id: "south-shipworks-maintenance-route";
  context: string;
  center: Vec3;
  parts: BrSouthShipworksPart[];
}

type Part = readonly [name: string, finish: BrMaterialKey, x: number, y: number, z: number,
  sx: number, sy: number, sz: number, rotationY?: number, surface?: boolean];

// Literal world transforms for the current authored SOUTH SHIPWORKS plan.
// Flush road-edge markings deliberately stop before the east-west junction.
// Every raised element is a shallow fixture embedded into an existing exterior
// wall, away from the three west/east entrance openings; there is no new cover.
const PARTS: readonly Part[] = [
  ["north-west-edge", "industrialOrange", 185.15, 4.118, -383.5, .16, .016, 15, 0, true],
  ["north-east-edge", "industrialOrange", 194.85, 4.118, -383.5, .16, .016, 15, 0, true],
  ["south-west-edge", "industrialOrange", 185.15, 4.118, -416.5, .16, .016, 17, 0, true],
  ["south-east-edge", "industrialOrange", 194.85, 4.118, -416.5, .16, .016, 17, 0, true],
  ["north-west-caution", "structuralWhite", 185.15, 4.129, -378, .7, .006, .18, -.34, true],
  ["north-east-caution", "structuralWhite", 194.85, 4.129, -378, .7, .006, .18, .34, true],
  ["north-west-caution-2", "structuralWhite", 185.15, 4.129, -388, .7, .006, .18, -.34, true],
  ["north-east-caution-2", "structuralWhite", 194.85, 4.129, -388, .7, .006, .18, .34, true],
  ["south-west-caution", "structuralWhite", 185.15, 4.129, -411, .7, .006, .18, -.34, true],
  ["south-east-caution", "structuralWhite", 194.85, 4.129, -411, .7, .006, .18, .34, true],
  ["south-west-caution-2", "structuralWhite", 185.15, 4.129, -422, .7, .006, .18, -.34, true],
  ["south-east-caution-2", "structuralWhite", 194.85, 4.129, -422, .7, .006, .18, .34, true],

  ["utility-north-panel", "paintedMetal", 199.94, 5.85, -376.5, .12, 1.45, 2.2],
  ["utility-north-frame", "brushedMetal", 199.87, 5.85, -376.5, .035, 1.18, 1.8],
  ["utility-north-lens", "industrialOrange", 199.84, 6.2, -376.5, .018, .12, 1.25],
  ["utility-south-panel", "paintedMetal", 199.94, 5.85, -389.5, .12, 1.45, 2.2],
  ["utility-south-frame", "brushedMetal", 199.87, 5.85, -389.5, .035, 1.18, 1.8],
  ["utility-south-lens", "energyCyan", 199.84, 6.2, -389.5, .018, .12, 1.25],

  ["hotel-north-panel", "paintedMetal", 201.94, 5.72, -409.4, .12, 1.25, 2.1],
  ["hotel-north-frame", "brushedMetal", 201.87, 5.72, -409.4, .035, 1.02, 1.7],
  ["hotel-north-lens", "industrialOrange", 201.84, 6.02, -409.4, .018, .11, 1.18],
  ["hotel-south-panel", "paintedMetal", 201.94, 5.72, -424.6, .12, 1.25, 2.1],
  ["hotel-south-frame", "brushedMetal", 201.87, 5.72, -424.6, .035, 1.02, 1.7],
  ["hotel-south-lens", "energyCyan", 201.84, 6.02, -424.6, .018, .11, 1.18],

  ["transit-north-panel", "paintedMetal", 179.06, 5.9, -410.8, .12, 1.35, 2],
  ["transit-north-frame", "brushedMetal", 179.13, 5.9, -410.8, .035, 1.1, 1.62],
  ["transit-north-lens", "industrialOrange", 179.16, 6.23, -410.8, .018, .11, 1.12],
  ["transit-south-panel", "paintedMetal", 179.06, 5.9, -423.2, .12, 1.35, 2],
  ["transit-south-frame", "brushedMetal", 179.13, 5.9, -423.2, .035, 1.1, 1.62],
  ["transit-south-lens", "energyCyan", 179.16, 6.23, -423.2, .018, .11, 1.12],
];

export function buildBrSouthShipworksDressing(): BrSouthShipworksDressing {
  return {
    id: "south-shipworks-maintenance-route",
    context: "Road-edge guidance and wall-mounted shipworks diagnostics",
    center: { x: 190, y: 4.1, z: -400 },
    parts: PARTS.map(([name, finish, x, y, z, sx, sy, sz, rotationY = 0, surface = false]) => ({
      name, finish, position: { x, y, z }, scale: { x: sx, y: sy, z: sz }, rotationY, surface
    }))
  };
}
