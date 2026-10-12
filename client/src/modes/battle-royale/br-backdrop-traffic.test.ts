import { describe, expect, it } from "vitest";
import { seededRandom, BR_ISLAND_OUTLINE } from "@planetfall/shared";
import { brBackdropTrafficPoints, brStormStreakPositions } from "./br-presentation";

describe("distant backdrop traffic", () => {
  it("keeps entire finite segments outside the island cylinder and limits streak length", () => {
    const islandRadius = Math.max(...BR_ISLAND_OUTLINE.map(([x, z]) => Math.hypot(x, z)));
    for (const seed of [4821, 9821, 0, 17]) {
      const points = brBackdropTrafficPoints(seededRandom(seed));
      expect(points).toHaveLength(36);
      for (let i = 0; i < points.length; i += 2) {
        const a = points[i], b = points[i + 1];
        expect([...a.toArray(), ...b.toArray()].every(Number.isFinite)).toBe(true);
        const dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, -(a.x * dx + a.z * dz) / (dx * dx + dz * dz)));
        const closestRadius = Math.hypot(a.x + t * dx, a.z + t * dz);
        expect(closestRadius).toBeGreaterThan(800);
        expect(closestRadius).toBeGreaterThan(islandRadius + 100);
        expect(a.distanceTo(b)).toBeGreaterThan(18);
        expect(a.distanceTo(b)).toBeLessThan(39);
        expect(Math.min(a.y, b.y)).toBeGreaterThanOrEqual(159.5);
        expect(Math.max(a.y, b.y)).toBeLessThanOrEqual(480.5);
      }
    }
  });
  it("reconstructs the same background independently of scene/render timing", () => {
    expect(brBackdropTrafficPoints()).toEqual(brBackdropTrafficPoints());
  });
  it("keeps storm accents short and above the ground-level play space",()=>{
    const points=brStormStreakPositions();
    expect(points).toEqual(brStormStreakPositions());
    for(let i=0;i<points.length;i+=6){
      expect([...points.slice(i,i+6)].every(Number.isFinite)).toBe(true);
      expect(points[i+1]).toBeGreaterThanOrEqual(60);
      expect(points[i+4]-points[i+1]).toBeGreaterThanOrEqual(8);
      expect(points[i+4]-points[i+1]).toBeLessThanOrEqual(18);
      expect(Math.hypot(points[i],points[i+2])).toBeCloseTo(1.006,2);
    }
  });
});
