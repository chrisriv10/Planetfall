import * as THREE from "three";
import { BR_ISLAND_OUTLINE } from "@planetfall/shared";

/** One continuous decorative top skin bounded by the playable island outline.
 * World-space UVs retain the old 44m panel pitch and support createPanelTexture's
 * repeat(2, 2). The owning renderer registers/disposes the geometry and supplies
 * its existing panel material; this helper adds no collision geometry. */
export function buildBrIslandDeckGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // ShapeGeometry faces +Z; negating Z here and rotating -90 degrees about X
  // gives upward-facing triangles with the authored world X/Z coordinates.
  BR_ISLAND_OUTLINE.forEach(([x, z], index) => index ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), z = positions.getZ(index);
    // Match the former box tops at y=.004 + .004/2, removing their open seams.
    positions.setY(index, .006);
    uv.setXY(index, (x + 460) / 44, -(z + 452) / 44);
  }
  positions.needsUpdate = true;
  uv.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
