import * as THREE from "three";

/** One reusable opaque glazing tile: cool reflected edge, warmer interior
 * falloff and a restrained diagonal reflection. No implied physical mullions.
 */
export function createBrLitGlazingTexture(): THREE.DataTexture {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1);
    const edge = Math.min(1, Math.min(u, 1 - u, v, 1 - v) * 12);
    const reflection = Math.max(0, 1 - Math.abs(u - .2 - v * .5) / .1) * .2;
    const light = (.28 + .55 * v) * edge;
    const at = (y * size + x) * 4;
    pixels[at] = Math.round(34 + light * 133 + reflection * 120);
    pixels[at + 1] = Math.round(54 + light * 116 + reflection * 140);
    pixels[at + 2] = Math.round(72 + light * 80 + reflection * 150);
    pixels[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
