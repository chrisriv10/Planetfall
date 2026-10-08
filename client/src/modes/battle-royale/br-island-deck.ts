import * as THREE from "three";
import { BR_ISLAND_OUTLINE, brBaseDeckPolygons, brTriangulateDeckPolygon } from "@planetfall/shared";

/** One continuous decorative top skin bounded by the playable island outline.
 * World-space UVs retain the old 44m panel pitch and support createPanelTexture's
 * repeat(2, 2). The owning renderer registers/disposes the geometry and supplies
 * its existing panel material; this helper adds no collision geometry. */
export function buildBrIslandDeckGeometry(): THREE.BufferGeometry {
  const vertices:number[]=[],indices:number[]=[];
  for(const polygon of brBaseDeckPolygons(BR_ISLAND_OUTLINE)){
    const offset=vertices.length/3;
    for(const p of polygon)vertices.push(p.x,p.y+.006,p.z);
    indices.push(...brTriangulateDeckPolygon(polygon).map(index=>index+offset));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), z = positions.getZ(index);
    // Match the former box tops at y=.004 + .004/2, removing their open seams.
    uv.setXY(index, (x + 460) / 44, -(z + 452) / 44);
  }
  positions.needsUpdate = true;
  uv.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
