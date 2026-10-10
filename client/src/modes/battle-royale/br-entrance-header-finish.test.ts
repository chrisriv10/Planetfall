import { describe, expect, it } from "vitest";
import { BR_STRUCTURES, BR_ENTRANCE_HEADERS, brEntranceHeadroom, buildBrEntranceHeader } from "@planetfall/shared";
import { buildBrEntranceHeaderFinish } from "./br-entrance-header-finish";
import { buildBrDoorwayParts } from "./br-facade-attachments";
import { brFacadeIntersections } from "./br-facade-intersections";

describe("solid-backed entrance header finish", () => {
  it("clears the literal doorway frame and canopy for every enterable building", () => {
    let checked = 0;
    for (const s of BR_STRUCTURES.filter(s => s.enterable)) {
      const headerParts = buildBrEntranceHeaderFinish(s);
      const doorwayParts = buildBrDoorwayParts(s).map(p => ({ ...p, position: { ...p.position, y: p.position.y + s.position.y } }));
      expect(brFacadeIntersections([...headerParts, ...doorwayParts]), s.id).toEqual([]);
      const along = s.entrance === "north" || s.entrance === "south" ? "x" : "z";
      for (const window of headerParts.filter(p => p.finish === "glass")) {
        for (const attachment of doorwayParts.filter(p => Math.abs(p.position[along] - s.position[along]) < 2.4 + p.scale[along] / 2)) {
          expect(window.position.y - window.scale.y / 2, s.id).toBeGreaterThan(attachment.position.y + attachment.scale.y / 2);
        }
      }
      checked++;
    }
    expect(checked).toBe(107);
  });
  it("keeps every catalog finish on real upper wall and preserves the complete aperture", () => {
    const before = JSON.stringify(BR_STRUCTURES);
    let decorated = 0;
    for (const s of BR_STRUCTURES) {
      const parts = buildBrEntranceHeaderFinish(s);
      if (!s.enterable) { expect(parts).toEqual([]); continue; }
      decorated++;
      const header = BR_ENTRANCE_HEADERS.find(h => h.id === `${s.id}-entrance-header`)!;
      expect(header, s.id).toEqual(buildBrEntranceHeader(s));
      expect(parts.length, s.id).toBeGreaterThanOrEqual(2);
      expect(parts.length, s.id).toBeLessThanOrEqual(6);
      const ns = s.entrance === "north" || s.entrance === "south";
      const along = ns ? "x" : "z", normal = ns ? "z" : "x";
      const sign = s.entrance === "north" || s.entrance === "east" ? 1 : -1;
      for (const p of parts) {
        expect(p.face).toBe(s.entrance);
        expect(p.position.y - p.scale.y / 2, s.id).toBeGreaterThanOrEqual(s.position.y + brEntranceHeadroom(s) - 1e-9);
        expect(p.position.y + p.scale.y / 2, s.id).toBeLessThanOrEqual(s.position.y + s.size.y + 1e-9);
        expect(Math.abs(p.position[along] - header.position[along]) + p.scale[along] / 2).toBeLessThanOrEqual(2.4);
        const outward = sign * (p.position[normal] - header.position[normal]);
        expect(outward - p.scale[normal] / 2).toBeGreaterThanOrEqual(.325 - 1e-9);
        expect(outward + p.scale[normal] / 2).toBeLessThan(.56);
        for (const n of Object.values(p.scale)) expect(n).toBeGreaterThan(0);
      }
    }
    expect(decorated).toBe(BR_ENTRANCE_HEADERS.length);
    expect(decorated).toBeGreaterThan(100);
    expect(JSON.stringify(BR_STRUCTURES)).toBe(before);
  });
  it("uses all four orientations and follows translated building bases exactly", () => {
    const source = BR_STRUCTURES.find(s => s.enterable)!;
    for (const entrance of ["north", "south", "east", "west"] as const) {
      const s = { ...source, entrance };
      const first = buildBrEntranceHeaderFinish(s);
      const translated = buildBrEntranceHeaderFinish({ ...s, position: { x: s.position.x + 20, y: s.position.y + 8, z: s.position.z - 12 } });
      expect(translated.length).toBe(first.length);
      first.forEach((p, i) => {
        expect(translated[i].position.x).toBeCloseTo(p.position.x + 20);
        expect(translated[i].position.y).toBeCloseTo(p.position.y + 8);
        expect(translated[i].position.z).toBeCloseTo(p.position.z - 12);
        expect(translated[i].scale).toEqual(p.scale);
      });
    }
  });
});
