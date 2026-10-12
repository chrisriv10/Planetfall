import { describe, expect, it, vi } from "vitest";
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
    expect(canopy.customProgramCacheKey()).toBe("br-canopy-camera-fade-v3");
    source.dispose();
    canopy.dispose();
  });
});

describe("BR canopy clear camera bubble", () => {
  it("discards close fragments before applying the bounded alpha-hash transition", () => {
    const shader = { vertexShader: "#include <common>\n#include <worldpos_vertex>", fragmentShader: "#include <common>\n#include <alphahash_fragment>" };
    patchBrCanopyShader(shader);
    expect(shader.vertexShader).toContain("brCanopyWorldPosition = batchingMatrix * brCanopyWorldPosition");
    expect(shader.vertexShader).toContain("brCanopyWorldPosition = instanceMatrix * brCanopyWorldPosition");
    expect(shader.vertexShader).toContain("vBrCanopyWorldPosition = ( modelMatrix * brCanopyWorldPosition ).xyz");
    expect(shader.fragmentShader).toContain("if (brCanopyCameraDistance <= 2.35) discard;");
    expect(shader.fragmentShader).toContain("smoothstep(2.35, 2.50, brCanopyCameraDistance)");
    expect(shader.fragmentShader.indexOf("discard;")).toBeLessThan(shader.fragmentShader.indexOf("smoothstep"));
    expect(shader.fragmentShader.indexOf("smoothstep")).toBeLessThan(shader.fragmentShader.indexOf("#include <alphahash_fragment>"));
  });
  it("fully clears the identified Dockyard upper crown from the saved camera", () => {
    const camera = new THREE.Vector3(124.58428278683121, 4.76, -148.1002018376874);
    const crown = new THREE.Mesh(new THREE.OctahedronGeometry(1, 1));
    crown.position.set(123.78, 3.82, -148.32); crown.scale.set(.64, .82, .64); crown.rotation.y = -4.71238898038469;
    crown.updateMatrixWorld(true);
    const vertices = crown.geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(crown.matrixWorld);
      expect(vertex.distanceTo(camera)).toBeLessThan(BR_CANOPY_FADE_START);
    }
    // A triangle is convex, so its interior is also within the clear sphere
    // when all three vertices are inside. This tests the actual offending crown.
    crown.geometry.dispose(); (crown.material as THREE.Material).dispose();
  });
  it("limits the adjustment to a local 15cm fade, leaving distant fragments fully opaque", () => {
    expect(BR_CANOPY_FADE_START).toBe(2.35); expect(BR_CANOPY_FADE_END).toBeLessThanOrEqual(2.5);
    expect(BR_CANOPY_FADE_END - BR_CANOPY_FADE_START).toBeCloseTo(.15);
    for (const distance of [2.5, 3, 4, 10, 100]) expect(THREE.MathUtils.smoothstep(distance, BR_CANOPY_FADE_START, BR_CANOPY_FADE_END)).toBe(1);
  });
  it("retains source textures and material ownership without changing trunk materials", () => {
    const texture = new THREE.Texture(), source = new THREE.MeshStandardMaterial({ color: 0x3d8c68, map: texture });
    const textureDispose = vi.spyOn(texture, "dispose"), sourceDispose = vi.spyOn(source, "dispose");
    const canopy = createBrCanopyMaterial(source);
    expect(canopy).not.toBe(source); expect(canopy.map).toBe(texture);
    expect(canopy.color).toEqual(source.color); expect(canopy.depthWrite).toBe(source.depthWrite);
    expect(canopy.alphaHash).toBe(true); expect(source.alphaHash).toBe(false);
    expect(canopy.customProgramCacheKey()).toBe("br-canopy-camera-fade-v3");
    canopy.dispose(); expect(sourceDispose).not.toHaveBeenCalled(); expect(textureDispose).not.toHaveBeenCalled();
    source.dispose(); texture.dispose();
  });
});
