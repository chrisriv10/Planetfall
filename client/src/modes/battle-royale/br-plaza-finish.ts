import * as THREE from "three";

export const BR_PLAZA_COLORS = ["#284d69", "#432b59", "#3d3659", "#432b5a", "#285546"] as const;

const FLOOR_PIGMENTS: Record<typeof BR_PLAZA_COLORS[number], string> = {
  "#284d69": "#294c58", // Nexus midnight teal.
  "#432b59": "#51344e", // Nova plum.
  "#3d3659": "#3a365c", // Academy violet.
  "#432b5a": "#48335b", // Mall purple.
  "#285546": "#294d42", // Farms deep green.
};

/** Authored dark swatches identify mineral floor pigments, not emissive light. */
export function brPlazaTint(color: string): THREE.Color {
  return new THREE.Color(FLOOR_PIGMENTS[color as typeof BR_PLAZA_COLORS[number]] ?? 0xa9b7bc);
}

/** Multiply each normalized clipped-patch UV by these factors. An 8m texture
 * repeat puts the existing 48/256 grid at 1.5m joints, regardless of patch size.
 * Geometry and texture ownership remain with the existing surface renderer.
 */
export function brPlazaUvScale(size: { x: number; z: number }): { x: number; y: number } {
  if (![size.x, size.z].every(v => Number.isFinite(v) && v > 0)) return { x: 1, y: 1 };
  return { x: size.x / 8, y: size.z / 8 };
}
