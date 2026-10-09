import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createBrLitGlazingTexture } from "./br-lit-glazing";
import { BrMaterialLibrary } from "./br-materials";

describe("shared lit facade glazing", () => {
  it("uses one bounded opaque deterministic tile with shaded edges and reflections", () => {
    const texture = createBrLitGlazingTexture(), second = createBrLitGlazingTexture();
    expect(texture.image.width).toBe(64); expect(texture.image.height).toBe(64);
    expect(texture.image.data).toEqual(second.image.data);
    const data = texture.image.data!;
    expect(new Set(Array.from(data).filter((_, i) => i % 4 === 3))).toEqual(new Set([255]));
    expect(new Set(Array.from(data).filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(50);
    expect(data[(32 * 64 + 32) * 4]).toBeGreaterThan(data[(32 * 64) * 4]);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    texture.dispose(); second.dispose();
  });
  it("caches facade material separately from lamps and disposes its sole shared map once", () => {
    const context = new Proxy({}, { get: (_, key) => key === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => {} });
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
    try {
      const library = new BrMaterialLibrary();
      const facade = library.get("facadeWindowLit") as THREE.MeshStandardMaterial;
      const lamp = library.get("windowLit") as THREE.MeshStandardMaterial;
      expect(library.get("facadeWindowLit")).toBe(facade);
      expect(facade).not.toBe(lamp);
      expect(lamp.map).toBeNull();
      expect(facade.map).toBe(facade.emissiveMap);
      expect(facade.transparent).toBe(false);
      const disposeTexture = vi.spyOn(facade.map!, "dispose"), disposeMaterial = vi.spyOn(facade, "dispose");
      library.dispose(); library.dispose();
      expect(disposeTexture).toHaveBeenCalledTimes(1);
      expect(disposeMaterial).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
