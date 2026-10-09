import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { BR_POIS } from "@planetfall/shared";
import { brDistrictPalette, BR_COLONY_DECK_COLOR } from "./br-district-palette";
import { BrMaterialLibrary } from "./br-materials";

describe("midnight colony palette", () => {
  it("distinguishes authored districts with saturated dark structural paint", () => {
    const colors = new Set<number>();
    for (const poi of BR_POIS) {
      const p = brDistrictPalette(poi.color), hsl = p.shell.getHSL({ h: 0, s: 0, l: 0 });
      colors.add(p.shell.getHex());
      expect(hsl.s).toBeGreaterThan(.35);
      expect(hsl.l).toBeLessThan(.12);
      expect(p.facade.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(hsl.l);
    }
    expect(colors.size).toBe(8);
    const nova = brDistrictPalette("#ff6bba").shell, nexus = brDistrictPalette("#70f5ff").shell;
    expect(nova.r).toBeGreaterThan(nova.g * 3);
    expect(nexus.b).toBeGreaterThan(nexus.r * 3);
    expect(brDistrictPalette("#a88cff").id).toBe(brDistrictPalette("#c565ff").id);
    expect(new THREE.Color(BR_COLONY_DECK_COLOR).getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(.1);
  });
  it("bounds exterior materials by family, shares maps and leaves interiors and lamps neutral", () => {
    const context = new Proxy({}, { get: (_, key) => key === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => {} });
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
    try {
      const lib = new BrMaterialLibrary();
      const interior = lib.get("interiorWall") as THREE.MeshStandardMaterial;
      const original = interior.color.clone(), white = lib.get("structuralWhite") as THREE.MeshStandardMaterial;
      const shells = new Set<THREE.Material>(), facades = new Set<THREE.Material>();
      for (let hue = 0; hue < 360; hue++) {
        const color = new THREE.Color().setHSL(hue / 360, .8, .5);
        const shell = lib.districtShell(color), facade = lib.districtFacade(color);
        shells.add(shell); facades.add(facade);
        expect(shell.bumpMap).toBe(white.bumpMap); expect(facade.bumpMap).toBe(interior.bumpMap);
        expect(shell.emissive.getHex()).toBe(0); expect(facade.emissive.getHex()).toBe(0);
      }
      expect(shells.size).toBe(8); expect(facades.size).toBe(8);
      expect(interior.color).toEqual(original);
      const paint = lib.architecturalPaint("#ff6bba");
      expect(lib.architecturalPaint("#ff6bba")).toBe(paint);
      expect(paint.color.r).toBeGreaterThan(paint.color.g * 2);
      expect(paint.emissive.getHex()).toBe(0);
      const disposals = [...shells, ...facades].map(m => vi.spyOn(m, "dispose"));
      const textureDisposal = vi.spyOn(white.bumpMap!, "dispose");
      lib.dispose(); lib.dispose();
      for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
      expect(textureDisposal).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
