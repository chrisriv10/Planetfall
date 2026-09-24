import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  BR_CANOPY_FADE_END,
  BR_CANOPY_FADE_START,
  createBrCanopyMaterial,
  patchBrCanopyShader
} from "./br-canopy-material";

describe("BR canopy camera fade", () => {
  it("injects instance-aware world position and applies fade before alpha hashing", () => {
    const shader = {
      vertexShader: "#include <common>\n#include <worldpos_vertex>",
      fragmentShader: "#include <common>\n#include <alphahash_fragment>"
    };
    patchBrCanopyShader(shader);
    expect(shader.vertexShader).toContain("vec4 brCanopyWorldPosition = vec4( transformed, 1.0 )");
    expect(shader.vertexShader).toContain("brCanopyWorldPosition = instanceMatrix * brCanopyWorldPosition");
    expect(shader.vertexShader).toContain("vBrCanopyWorldPosition = ( modelMatrix * brCanopyWorldPosition ).xyz");
    expect(shader.vertexShader).not.toContain("vBrCanopyWorldPosition = worldPosition.xyz");
    expect(shader.fragmentShader).toContain("distance(vBrCanopyWorldPosition, cameraPosition)");
    expect(shader.fragmentShader.indexOf("smoothstep")).toBeLessThan(shader.fragmentShader.indexOf("#include <alphahash_fragment>"));
  });

  it("uses a narrow near-camera envelope and leaves the source material untouched", () => {
    const source = new THREE.MeshStandardMaterial({ color: 0x3d8c68 });
    const canopy = createBrCanopyMaterial(source);
    expect(BR_CANOPY_FADE_START).toBeGreaterThanOrEqual(.5);
    expect(BR_CANOPY_FADE_END).toBeLessThanOrEqual(2.5);
    expect(canopy).not.toBe(source);
    expect(canopy.alphaHash).toBe(true);
    expect(source.alphaHash).toBe(false);
    expect(canopy.customProgramCacheKey()).toBe("br-canopy-camera-fade-v2");
    source.dispose();
    canopy.dispose();
  });
});
