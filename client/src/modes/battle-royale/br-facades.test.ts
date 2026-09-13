import { describe, expect, it } from "vitest";
import { BR_STRUCTURES } from "@planetfall/shared";
import { buildFacadeParts, buildDistantFacadeParts, buildExteriorServiceParts } from "./br-facades";

describe("BR architectural skin", () => {
  it("gives cargo halls high glazing and solid lower wall cassettes", () => {
    for (const structure of BR_STRUCTURES.filter(s => ["warehouse", "hangar"].includes(s.archetype) || s.id === "thruster-foundry")) {
      const parts = buildFacadeParts(structure);
      const glass = parts.filter(p => p.finish === "glass" || p.finish === "lit");
      const cladding = parts.filter(p => p.finish === "metal");
      expect(glass.length).toBeGreaterThan(0);
      expect(cladding.length).toBeGreaterThan(0);
      expect(new Set(glass.map(p => p.position.y)).size).toBe(1);
      for (const pane of glass) expect(pane.position.y - pane.scale.y / 2).toBeGreaterThan(structure.size.y * .7);
      for (const panel of cladding) expect(panel.position.y + panel.scale.y / 2).toBeLessThan(structure.size.y * .65);
    }
  });
  it("keeps street planting low and out of entrances", () => {
    let plants = 0;
    for (const structure of BR_STRUCTURES) for (const part of buildFacadeParts(structure).filter(p => p.finish === "foliage")) {
      plants++;
      expect(part.position.y + part.scale.y / 2).toBeLessThan(1);
      expect(structure.style).toBe("city");
      const axis = part.face === "north" || part.face === "south" ? "x" : "z";
      if (structure.enterable && part.face === structure.entrance)
        expect(Math.abs(part.position[axis] - structure.position[axis]) - part.scale[axis] / 2).toBeGreaterThan(2.4);
    }
    expect(plants).toBeGreaterThan(50);
  });
  it("mounts service architecture outside rooms without blocking an entrance", () => {
    let checked = 0;
    for (const structure of BR_STRUCTURES) for (const part of buildExteriorServiceParts(structure)) {
      checked++;
      const axis = part.face === "north" || part.face === "south" ? "z" : "x";
      expect(Math.abs(part.position[axis] - structure.position[axis]) - part.scale[axis] / 2).toBeGreaterThan(structure.size[axis] / 2 + .325);
      expect(part.face).not.toBe(structure.entrance);
      expect(part.scale[axis]).toBeLessThanOrEqual(.55);
      expect(part.position.y - part.scale.y / 2).toBeGreaterThan(0);
      expect(part.position.y + part.scale.y / 2).toBeLessThan(structure.size.y);
    }
    expect(checked).toBeGreaterThan(100);
  });
  it("keeps every facade layer outside its authoritative wall", () => {
    for (const structure of BR_STRUCTURES) for (const part of buildFacadeParts(structure)) {
      const ns = part.face === "north" || part.face === "south";
      const axis = ns ? "z" : "x";
      const near = Math.abs(part.position[axis] - structure.position[axis]) - part.scale[axis] / 2;
      expect(near).toBeGreaterThan(structure.size[axis] / 2 + .325);
      for (const value of Object.values(part.scale)) expect(value).toBeGreaterThan(0);
      for (const value of Object.values(part.position)) expect(Number.isFinite(value)).toBe(true);
    }
  });
  it("never spans an open entrance, including east/west storefronts", () => {
    for (const structure of BR_STRUCTURES.filter(s => s.enterable)) {
      const axis = structure.entrance === "north" || structure.entrance === "south" ? "x" : "z";
      for (const part of buildFacadeParts(structure).filter(p => p.face === structure.entrance)) {
        expect(Math.abs(part.position[axis] - structure.position[axis]) - part.scale[axis] / 2).toBeGreaterThanOrEqual(2.39);
      }
    }
  });
  it("gives towers and industrial buildings different window proportions", () => {
    const tower = BR_STRUCTURES.find(s => s.archetype === "tower")!;
    const factory = { ...tower, archetype: "industrial" as const };
    const windows = (s: typeof tower) => buildFacadeParts(s).filter(p => p.finish === "glass");
    expect(windows(tower)[0].scale.y).toBeGreaterThan(windows(factory)[0].scale.y);
  });
  it("reduces distant glazing without bridging door openings", () => {
    for (const structure of BR_STRUCTURES) {
      const near = buildFacadeParts(structure).filter(p => p.finish === "glass" || p.finish === "lit");
      const far = buildDistantFacadeParts(structure);
      expect(far.length).toBeLessThanOrEqual(near.length);
      expect(far.length).toBeGreaterThan(0);
      const axis = structure.entrance === "north" || structure.entrance === "south" ? "x" : "z";
      for (const part of far) {
        expect(Object.values(part.scale).every(v => v > 0 && Number.isFinite(v))).toBe(true);
        if (structure.enterable && part.face === structure.entrance) {
          expect(Math.abs(part.position[axis] - structure.position[axis]) - part.scale[axis] / 2).toBeGreaterThan(2.4);
        }
      }
    }
  });
});
