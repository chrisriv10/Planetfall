import * as THREE from "three";

export const BR_CANOPY_FADE_START = .7;
export const BR_CANOPY_FADE_END = 2.35;

type ShaderSource = {
  vertexShader: string;
  fragmentShader: string;
};

/**
 * Camera collision intentionally ignores decorative vegetation so a tree cannot
 * shove the third-person boom into the player. Screen-door fading just the
 * canopy fragments around the camera keeps that decision without letting an
 * opaque crown fill the view when the player lands or backs beneath a tree.
 */
export function patchBrCanopyShader(shader: ShaderSource): void {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vBrCanopyWorldPosition;")
    .replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
vec4 brCanopyWorldPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  brCanopyWorldPosition = batchingMatrix * brCanopyWorldPosition;
#endif
#ifdef USE_INSTANCING
  brCanopyWorldPosition = instanceMatrix * brCanopyWorldPosition;
#endif
vBrCanopyWorldPosition = ( modelMatrix * brCanopyWorldPosition ).xyz;`
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vBrCanopyWorldPosition;")
    .replace(
      "#include <alphahash_fragment>",
      `diffuseColor.a *= smoothstep(${BR_CANOPY_FADE_START.toFixed(2)}, ${BR_CANOPY_FADE_END.toFixed(2)}, distance(vBrCanopyWorldPosition, cameraPosition));\n#include <alphahash_fragment>`
    );
}

export function createBrCanopyMaterial(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const material = base.clone();
  material.name = "br-canopy-camera-fade";
  material.alphaHash = true;
  material.onBeforeCompile = patchBrCanopyShader;
  material.customProgramCacheKey = () => "br-canopy-camera-fade-v2";
  material.needsUpdate = true;
  return material;
}
