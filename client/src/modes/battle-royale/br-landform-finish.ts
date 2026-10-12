import type { BrLandform } from "@planetfall/shared";
import * as THREE from "three";

const SOIL = new THREE.Color(0x193b43);
const SLOPE = new THREE.Color(0x286951);
const CREST = new THREE.Color(0x509876);

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

/** One opacity weight per existing vertex; no terrain buffers are modified. */
export function buildBrLandformBlend(
  landform: Readonly<Pick<BrLandform, "vertices" | "height">>,
): Float32Array {
  const blend = new Float32Array(landform.vertices.length / 3);
  const shoulder = landform.height * .16;
  for (let index = 0; index < blend.length; index++) {
    const y = landform.vertices[index * 3 + 1];
    const progress = Number.isFinite(shoulder) && shoulder > 0 && Number.isFinite(y)
      ? Math.max(0, Math.min(1, y / shoulder)) : 0;
    blend[index] = smoothstep(progress);
  }
  return blend;
}

const configuredMaterials = new WeakSet<THREE.MeshStandardMaterial>();

/** Composite the low shoulder over the real deck texture. Fully faded fragments
 * are discarded, while the opaque slope retains depth writes and occlusion.
 * The caller owns the material and supplies the landformBlend geometry attribute.
 */
export function configureBrLandformMaterial(material: THREE.MeshStandardMaterial): void {
  if (configuredMaterials.has(material)) return;
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer);
    shader.vertexShader = "attribute float landformBlend;\nvarying float vLandformBlend;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvLandformBlend = landformBlend;",
    );
    shader.fragmentShader = "varying float vLandformBlend;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphatest_fragment>",
      "diffuseColor.a *= clamp(vLandformBlend, 0.0, 1.0);\n#include <alphatest_fragment>",
    );
  };
  material.customProgramCacheKey = () => `${previousKey}|br-landform-blend-v1`;
  material.transparent = true;
  material.depthWrite = true;
  material.alphaTest = .001;
  material.needsUpdate = true;
  configuredMaterials.add(material);
}

/** Build linear vertex colors without changing the authored terrain buffers.
 * Heights are relative to the island deck. The low shoulder approaches the
 * supplied deck tint; grass and deck textures still shade differently.
 */
export function buildBrLandformColors(
  landform: Readonly<Pick<BrLandform, "vertices" | "height">>,
  deckTint: THREE.Color,
): Float32Array {
  const colors = new Float32Array(landform.vertices.length);
  const validHeight = Number.isFinite(landform.height) && landform.height > 0;
  for (let index = 0; index < landform.vertices.length; index += 3) {
    const y = landform.vertices[index + 1];
    const height = validHeight && Number.isFinite(y)
      ? Math.max(0, Math.min(1, y / landform.height)) : 0;
    let from: THREE.Color;
    let to: THREE.Color;
    let progress: number;
    if (height < .16) {
      from = deckTint; to = SOIL; progress = height / .16;
    } else if (height < .45) {
      from = SOIL; to = SLOPE; progress = (height - .16) / .29;
    } else {
      from = SLOPE; to = CREST; progress = (height - .45) / .55;
    }
    const blend = smoothstep(progress);
    colors[index] = from.r + (to.r - from.r) * blend;
    colors[index + 1] = from.g + (to.g - from.g) * blend;
    colors[index + 2] = from.b + (to.b - from.b) * blend;
  }
  return colors;
}
