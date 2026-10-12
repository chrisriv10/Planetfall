import type * as THREE from "three";

/** Visor-local lateral caps protrude through the faceted helmet as a second
 * pair of eye-shaped slits. Keep the central visor and lower band intact. */
export function isAstronautVisorCap(x: number, y: number): boolean {
  return Math.abs(x) > .32 && y > -.11;
}

export function configureAstronautVisorMask(material: THREE.MeshStandardMaterial): void {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.vertexShader = "varying vec2 vAstronautVisorPosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\nvAstronautVisorPosition = position.xy;");
    shader.fragmentShader = "varying vec2 vAstronautVisorPosition;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\nif (abs(vAstronautVisorPosition.x) > 0.32 && vAstronautVisorPosition.y > -0.11) discard;");
  };
  material.customProgramCacheKey = () => `${key}|astronaut-visor-cap-mask-v1`;
}
