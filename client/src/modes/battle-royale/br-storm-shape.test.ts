import { describe, expect, it } from "vitest";
import { brStormBandPositions, brStormCurtainRepeats, brStormDetail, brStormLayerSpacing, BR_STORM_BAND_SEGMENTS } from "./br-storm-shape";

describe("BR storm presentation dimensions", () => {
  it("keeps a sub-metre ground boundary at opening and final radii", () => {
    for (const radius of [1,25,55,200,500,650]) {
      const positions=brStormBandPositions(radius);
      const outer=(BR_STORM_BAND_SEGMENTS+1)*3;
      expect(positions[outer]-positions[0]).toBeCloseTo(.76,3);
      for(let i=0;i<positions.length;i+=3) {
        expect(Math.abs(Math.hypot(positions[i],positions[i+2])-radius)).toBeLessThan(.381);
        expect(positions[i+1]).toBeCloseTo(.14);
      }
    }
  });
  it("handles a collapsed or invalid visual radius without NaN or inverted bands", () => {
    for(const radius of [0,.01,-5,NaN,Infinity]) {
      const positions=brStormBandPositions(radius);
      expect([...positions].every(Number.isFinite)).toBe(true);
      expect(positions[0]).toBeGreaterThanOrEqual(0);
    }
  });
  it("reuses the buffer during closing and closes the annulus seam", () => {
    const positions=brStormBandPositions(500);
    expect(brStormBandPositions(25,positions)).toBe(positions);
    expect(positions[0]).toBeCloseTo(positions[BR_STORM_BAND_SEGMENTS*3]);
    expect(positions[2]).toBeCloseTo(positions[BR_STORM_BAND_SEGMENTS*3+2]);
  });
  it("reduces decoration without removing the authoritative boundary on Low", () => {
    expect(brStormDetail("low")).toEqual({layers:1,arcs:4,sparks:90});
    expect(brStormDetail("medium").layers).toBe(2);
    expect(brStormDetail("high")).toEqual({layers:3,arcs:12,sparks:360});
  });
  it("thins decorative density as the circle closes without dropping the curtain", () => {
    for (const quality of ["low","medium","high"] as const) {
      let previous=brStormDetail(quality);
      for (const radius of [650,200,55,25,1,.01]) {
        const detail=brStormDetail(quality,radius);
        expect(detail.layers).toBe(previous.layers);
        expect(detail.arcs).toBeLessThanOrEqual(previous.arcs);
        expect(detail.sparks).toBeLessThanOrEqual(previous.sparks);
        expect(detail.arcs).toBeGreaterThan(0);
        expect(detail.sparks).toBeGreaterThan(0);
        previous=detail;
      }
      expect(previous.sparks).toBeLessThan(brStormDetail(quality).sparks);
    }
  });
  it("keeps secondary curtains close to tiny circles and closes horizontal texture repeats", () => {
    for (const radius of [.01,1,25,55,200,500,650]) {
      expect(brStormLayerSpacing(radius)*2).toBeLessThanOrEqual(Math.min(.7,radius*.05));
      expect(Number.isInteger(brStormCurtainRepeats(radius))).toBe(true);
      expect(brStormCurtainRepeats(radius)).toBeGreaterThanOrEqual(1);
    }
  });
});
