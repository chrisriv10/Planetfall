import { describe, expect, it } from "vitest";
import { PG_MAP, type PgSolid } from "@planetfall/shared";
import { pgPerimeterRailArt } from "./pg-perimeter-rail-art";

describe("perimeter rail presentation", () => {
  const rails = PG_MAP.solids.filter(s => s.kind === "rail");
  it("partitions the opaque envelope without an exposed duplicate top face", () => {
    expect(rails.length).toBeGreaterThan(0);
    for (const solid of rails) {
      const before = JSON.stringify(solid);
      const { body, details } = pgPerimeterRailArt(solid);
      const cap = details[0].box;
      expect(body[1] - body[4] / 2).toBeCloseTo(solid.center.y - solid.half.y);
      expect(body[1] + body[4] / 2).toBeCloseTo(cap[1] - cap[4] / 2);
      expect(cap[1] + cap[4] / 2).toBeCloseTo(solid.center.y + solid.half.y);
      expect(body[1] + body[4] / 2).toBeLessThan(cap[1] + cap[4] / 2 - .1);
      for (const axis of [0, 2]) {
        expect(body[axis]).toBe(cap[axis]);
        expect(body[axis + 3]).toBe(cap[axis + 3]);
      }
      expect(JSON.stringify(solid)).toBe(before);
    }
  });
  it("backs shallow relief with opaque geometry and separates successive exposed fronts by 2cm", () => {
    for (const solid of rails) {
      const wide = solid.half.x > solid.half.z, axis = wide ? 2 : 0, along = wide ? 0 : 2;
      const c = wide ? solid.center.z : solid.center.x;
      const h = wide ? solid.half.z : solid.half.x;
      const halfLength = wide ? solid.half.x : solid.half.z;
      const { details } = pgPerimeterRailArt(solid);
      for (const detail of details.slice(1)) {
        const b = detail.box, offset = Math.abs(b[axis] - c) - h;
        const front = offset + b[axis + 3] / 2;
        const expected = detail.key === "barrier-inset" ? .02 : detail.key === "barrier-rib" ? .04 : .06;
        expect(front).toBeCloseTo(expected, 8);
        expect(offset - b[axis + 3] / 2).toBeLessThan(0);
        expect(Math.abs(b[along] - (wide ? solid.center.x : solid.center.z)) + b[along + 3] / 2).toBeLessThanOrEqual(halfLength);
        expect(b[1] + b[4] / 2).toBeLessThan(solid.center.y + solid.half.y - .12);
      }
      expect(new Set(details.map(d => d.key)).size).toBe(4);
    }
  });
  it("bounds detail count for long rails and follows translated/scaled authoritative input", () => {
    const solid: PgSolid = { id: "test", kind: "rail", mantle: false,
      center: { x: 10, y: 12, z: -5 }, half: { x: 1000, y: 2, z: .25 } };
    const { body, details } = pgPerimeterRailArt(solid);
    expect(details.length).toBeLessThanOrEqual(131);
    expect(body[1] - body[4] / 2).toBeCloseTo(10);
    expect(details.every(d => d.box.slice(3).every(n => n > 0))).toBe(true);
  });
});
