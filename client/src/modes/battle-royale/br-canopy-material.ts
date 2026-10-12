import * as THREE from "three";

export const BR_CANOPY_FADE_START = 2.35;
export const BR_CANOPY_FADE_END = 2.5;

type ShaderSource = {
  vertexShader: string;
  fragmentShader: string;
};

/**
 * Camera collision intentionally ignores decorative vegetation so a tree cannot
 * shove the third-person boom into the player. Clear close fragments entirely
 * so they cannot resemble stippled ground. Only the outer 15cm transition uses
 * alpha hashing; fragments beyond the existing 2.5m envelope remain unchanged.
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
      `float brCanopyCameraDistance = distance(vBrCanopyWorldPosition, cameraPosition);\nif (brCanopyCameraDistance <= ${BR_CANOPY_FADE_START.toFixed(2)}) discard;\ndiffuseColor.a *= smoothstep(${BR_CANOPY_FADE_START.toFixed(2)}, ${BR_CANOPY_FADE_END.toFixed(2)}, brCanopyCameraDistance);\n#include <alphahash_fragment>`
    );
}

export function createBrCanopyMaterial(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const material = base.clone();
  material.name = "br-canopy-camera-fade";
  material.alphaHash = true;
  material.onBeforeCompile = patchBrCanopyShader;
  material.customProgramCacheKey = () => "br-canopy-camera-fade-v3";
  material.needsUpdate = true;
  return material;
}
