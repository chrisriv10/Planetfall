/** Presentation-only authored parking. Coordinates are world-space, including Y.
 * These are decorative/noncollidable models, never authoritative cover or vehicles.
 * Keep these envelopes in sync with the complete br-world model factories, including
 * outboard hover rails/skids. No runtime relocation or random scattering is allowed.
 */
export type BrContextVehicleKind = "hover-taxi" | "cargo-mover" | "maintenance-rover";

export const BR_CONTEXT_VEHICLE_BOUNDS = {
  "hover-taxi": { halfX: 3.15, halfZ: 1.475, minY: -1.25, maxY: 1.4975, originHeight: 1.45, groundGap: .2 },
  "cargo-mover": { halfX: 2.9, halfZ: 1.71, minY: -.55, maxY: 2.175, originHeight: .75, groundGap: .2 },
  "maintenance-rover": { halfX: 2.2, halfZ: 1.6, minY: -.66, maxY: 2.34, originHeight: .66, groundGap: 0 }
} as const;

export interface BrContextVehiclePlacement {
  id: string;
  districtId: string;
  kind: BrContextVehicleKind;
  purpose: string;
  position: { x: number; y: number; z: number };
  groundHeight: number;
  rotationY: number;
}

/** Returns independent transforms for renderer assembly. Subtract the district
 * group's world Y from position.y when adding to the elevated district group.
 */
export function buildBrContextVehiclePlacements(): BrContextVehiclePlacement[] {
  const authored: Array<[string, string, BrContextVehicleKind, number, number, number, number, string]> = [
    ["nova-cafe-taxi", "nova-plaza", "hover-taxi", -205, -122, 5, 0, "Cafe-side pickup apron, parallel to the east/west boulevard"],
    ["nova-studio-taxi", "nova-plaza", "hover-taxi", -134, -123, 5, 0, "Studio east pickup apron, beyond the garden and arrival seating"],
    ["dock-west-cargo", "dockyard-7", "cargo-mover", 127, -164, 0, 0, "Freight B north service apron"],
    ["dock-east-cargo", "dockyard-7", "cargo-mover", 224, -170, 0, Math.PI / 2, "Hangar east service lane, clear of Freight A entrance"],
    ["thruster-cargo", "thruster-works", "cargo-mover", 332, -111, 0, 0, "Foundry south staging apron east of the test instruments, outside entrance approach"],
    ["thruster-rover", "thruster-works", "maintenance-rover", 408, -103, 0, Math.PI / 2, "Pump B rear maintenance apron, parallel to east perimeter road"]
  ];
  return authored.map(([id, districtId, kind, x, z, groundHeight, rotationY, purpose]) => ({
    id, districtId, kind, purpose, groundHeight, rotationY,
    position: { x, y: groundHeight + BR_CONTEXT_VEHICLE_BOUNDS[kind].originHeight, z }
  }));
}

/** Conservative full-model world footprint; useful for visual assembly audits. */
export function brContextVehicleFootprint(placement: BrContextVehiclePlacement) {
  const { halfX, halfZ } = BR_CONTEXT_VEHICLE_BOUNDS[placement.kind];
  const c = Math.abs(Math.cos(placement.rotationY)), s = Math.abs(Math.sin(placement.rotationY));
  const x = c * halfX + s * halfZ, z = s * halfX + c * halfZ;
  return { minX: placement.position.x - x, maxX: placement.position.x + x,
    minZ: placement.position.z - z, maxZ: placement.position.z + z };
}
