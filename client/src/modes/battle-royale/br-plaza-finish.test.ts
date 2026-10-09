import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { BR_TERRAIN_PATCHES } from "@planetfall/shared";
import { BR_PLAZA_COLORS, brPlazaTint, brPlazaUvScale } from "./br-plaza-finish";
import { BrMaterialLibrary } from "./br-materials";

describe("mineral plaza finish", () => {
  it("gives all five authored plazas distinct dark district pigments", () => {
    expect(new Set(BR_PLAZA_COLORS)).toEqual(new Set(BR_TERRAIN_PATCHES.filter(p => p.kind === "plaza").map(p => p.color)));
    const gray = new THREE.Color(0xa9b7bc);
    for (const color of BR_PLAZA_COLORS) {
      expect(brPlazaTint(color)).not.toEqual(gray);
      const hsl = brPlazaTint(color).getHSL({ h: 0, s: 0, l: 0 });
      expect(hsl.s).toBeGreaterThan(.25);
      expect(hsl.l).toBeLessThan(.13);
    }
    expect(new Set(BR_PLAZA_COLORS.map(c => brPlazaTint(c).getHex()))).toHaveProperty("size", 5);
    const nova = brPlazaTint("#432b59"), nexus = brPlazaTint("#284d69"), farm = brPlazaTint("#285546");
    expect(nova.r).toBeGreaterThan(nova.g * 1.5);
    expect(nexus.b).toBeGreaterThan(nexus.r * 2);
    expect(farm.g).toBeGreaterThan(farm.r * 2);
    expect(brPlazaTint("not-a-plaza-color")).toEqual(gray);
  });
  it("scales normalized UV to 8m repeats without altering patch geometry", () => {
    for (const patch of BR_TERRAIN_PATCHES.filter(p => p.kind === "plaza")) {
      const before = JSON.stringify(patch), uv = brPlazaUvScale(patch.size);
      expect(uv.x).toBe(patch.size.x / 8); expect(uv.y).toBe(patch.size.z / 8);
      expect(patch.size.x / uv.x * 48 / 256).toBe(1.5);
      expect(patch.size.z / uv.y * 48 / 256).toBe(1.5);
      expect(JSON.stringify(patch)).toBe(before);
    }
    expect(brPlazaUvScale({ x: 0, z: NaN })).toEqual({ x: 1, y: 1 });
  });
  it("shares existing sidewalk maps, caches tints, preserves nonplaza materials and disposes once", () => {
    const context = new Proxy({}, { get: (_, key) => key === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => {} });
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
    try {
      const library = new BrMaterialLibrary();
      const sidewalk = library.surface("sidewalk", 2) as THREE.MeshStandardMaterial;
      const originalColor = sidewalk.color.clone();
      const materials = BR_PLAZA_COLORS.map(c => library.plazaSurface(c, 2) as THREE.MeshStandardMaterial);
      for (const [i, material] of materials.entries()) {
        expect(library.plazaSurface(BR_PLAZA_COLORS[i], 2)).toBe(material);
        expect(material.bumpMap).toBe(sidewalk.bumpMap);
        expect(material.roughnessMap).toBe(sidewalk.roughnessMap);
        expect(material.map).toBe(sidewalk.map);
        expect(material.emissive.getHex()).toBe(0);
        expect(material.emissiveMap).toBe(sidewalk.emissiveMap);
        expect(material.roughness).toBe(sidewalk.roughness);
        expect(material.metalness).toBe(sidewalk.metalness);
        expect(material.color).toEqual(brPlazaTint(BR_PLAZA_COLORS[i]));
        expect(material.polygonOffsetFactor).toBe(sidewalk.polygonOffsetFactor);
      }
      expect(library.plazaSurface("#ffffff", 2)).toBe(sidewalk);
      expect(sidewalk.color).toEqual(originalColor);
      const materialDisposals = materials.map(m => vi.spyOn(m, "dispose"));
      const textureDisposal = vi.spyOn(sidewalk.bumpMap!, "dispose");
      library.dispose(); library.dispose();
      for (const disposal of materialDisposals) expect(disposal).toHaveBeenCalledTimes(1);
      expect(textureDisposal).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
