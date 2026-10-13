import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BR_LANDFORMS } from "@planetfall/shared";
import { BR_COLONY_DECK_COLOR } from "./br-district-palette";
import { buildBrLandformBlend, buildBrLandformColors, configureBrLandformMaterial } from "./br-landform-finish";

describe("landform shoulder finish", () => {
  it("fades only the low shoulder and preserves canonical buffers", () => {
    for (const hill of BR_LANDFORMS) {
      const vertices = hill.vertices.slice(), indices = hill.indices.slice();
      const blend = buildBrLandformBlend(hill);
      expect(blend.length).toBe(vertices.length / 3);
      expect(buildBrLandformBlend(hill)).toEqual(blend);
      blend.forEach((opacity, index) => {
        expect(Number.isFinite(opacity)).toBe(true);
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
        if (vertices[index * 3 + 1] === 0) expect(opacity).toBe(0);
        if (vertices[index * 3 + 1] >= hill.height * .16) expect(opacity).toBe(1);
      });
      expect(hill.vertices).toEqual(vertices);
      expect(hill.indices).toEqual(indices);
    }
    const sample = (y: number) => buildBrLandformBlend({ height: 1, vertices: new Float32Array([0, y, 0]) })[0];
    expect(sample(.08)).toBeCloseTo(.5);
    expect(sample(.00001)).toBeLessThan(.000001);
    expect(sample(.16 - .00001)).toBeGreaterThan(.999999);
  });

  it("preserves compile hooks and patches alpha before discard with a stable distinct cache key", () => {
    const material = new THREE.MeshStandardMaterial();
    material.polygonOffset = true;
    material.polygonOffsetFactor = -8;
    material.polygonOffsetUnits = -8;
    let calls = 0;
    material.onBeforeCompile = shader => { calls++; shader.fragmentShader += "\n// prior hook"; };
    material.customProgramCacheKey = () => "existing-hook-key";
    configureBrLandformMaterial(material);
    const key = material.customProgramCacheKey();
    configureBrLandformMaterial(material);
    expect(material.customProgramCacheKey()).toBe(key);
    expect(key).toBe("existing-hook-key|br-landform-blend-v1");
    const shader = {
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
      uniforms: {},
    } as Parameters<typeof material.onBeforeCompile>[0];
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(calls).toBe(1);
    expect(shader.vertexShader).toContain("attribute float landformBlend;");
    expect(shader.vertexShader).toContain("vLandformBlend = landformBlend;");
    expect(shader.fragmentShader).toContain("// prior hook");
    const alpha = shader.fragmentShader.indexOf("diffuseColor.a *= clamp(vLandformBlend");
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(shader.fragmentShader.indexOf("#include <alphatest_fragment>"));
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(true);
    expect(material.polygonOffset).toBe(false);
    expect(material.polygonOffsetFactor).toBe(0);
    expect(material.polygonOffsetUnits).toBe(0);
    expect(material.alphaTest).toBe(.001);
    material.dispose();
  });
  it("colors all four canonical hills without changing terrain or caller tint", () => {
    const deck = new THREE.Color(BR_COLONY_DECK_COLOR);
    const tintBefore = deck.clone();
    expect(BR_LANDFORMS).toHaveLength(4);
    for (const hill of BR_LANDFORMS) {
      const vertices = hill.vertices.slice();
      const indices = hill.indices.slice();
      const colors = buildBrLandformColors(hill, deck);
      expect(colors.length).toBe(vertices.length);
      expect(buildBrLandformColors(hill, deck)).toEqual(colors);
      expect(hill.vertices).toEqual(vertices);
      expect(hill.indices).toEqual(indices);
      expect([...colors].every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
      let perimeterCount = 0;
      let upperCount = 0;
      for (let index = 0; index < vertices.length; index += 3) {
        if (vertices[index + 1] === 0) {
          perimeterCount++;
          expect(colors[index]).toBeCloseTo(deck.r, 7);
          expect(colors[index + 1]).toBeCloseTo(deck.g, 7);
          expect(colors[index + 2]).toBeCloseTo(deck.b, 7);
        }
        if (vertices[index + 1] / hill.height >= .45) {
          upperCount++;
          expect(colors[index + 1]).toBeGreaterThan(colors[index] * 1.5);
          expect(colors[index + 1]).toBeGreaterThan(colors[index + 2]);
          expect(colors[index + 1]).toBeGreaterThan(deck.g * 2);
        }
      }
      expect(perimeterCount).toBeGreaterThan(0);
      expect(upperCount).toBeGreaterThan(0);
    }
    expect(deck).toEqual(tintBefore);
  });

  it("approaches deck tint continuously and joins soil and slope without jumps", () => {
    const deck = new THREE.Color(BR_COLONY_DECK_COLOR);
    const at = (height: number) => buildBrLandformColors({
      height: 1, vertices: new Float32Array([0, height, 0]),
    }, deck);
    for (const boundary of [0, .16, .45, 1]) {
      const left = at(boundary - .00001);
      const right = at(boundary + .00001);
      for (let channel = 0; channel < 3; channel++) {
        expect(Math.abs(left[channel] - right[channel])).toBeLessThan(.000001);
      }
    }
    expect(at(0)).toEqual(at(-1));
    expect(at(1)).toEqual(at(2));
    expect(at(1)).toEqual(new Float32Array(new THREE.Color(0x509876).toArray()));
  });

  it("keeps malformed height values at the supplied finite deck tint", () => {
    const deck = new THREE.Color(BR_COLONY_DECK_COLOR);
    for (const height of [0, -1, NaN, Infinity]) {
      const colors = buildBrLandformColors({ height, vertices: new Float32Array([1, 2, 3]) }, deck);
      expect(colors).toEqual(new Float32Array(deck.toArray()));
    }
  });
});
