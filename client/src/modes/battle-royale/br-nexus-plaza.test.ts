import {describe,expect,it} from "vitest";
import {BR_POIS} from "@planetfall/shared";
import {buildNexusPlaza} from "./br-nexus-plaza";

describe("Zero Point plaza inlays",()=>{
  const zero=BR_POIS.find(poi=>poi.id==="zero-point")!;
  it("only decorates Zero Point with a fixed flat budget",()=>{
    expect(BR_POIS.filter(poi=>buildNexusPlaza(poi).length).map(poi=>poi.id)).toEqual(["zero-point"]);
    const parts=buildNexusPlaza(zero);
    expect(parts).toHaveLength(24);
    expect(parts.filter(part=>part.finish==="inset")).toHaveLength(12);
    expect(parts.filter(part=>part.finish==="energy")).toHaveLength(8);
    expect(parts.filter(part=>part.finish==="warning")).toHaveLength(4);
  });
  it("keeps every inlay outside the spire footprint and within the central plaza",()=>{
    for(const part of buildNexusPlaza(zero)){
      const radius=Math.hypot(part.position.x-zero.position.x,part.position.z-zero.position.z);
      expect(radius).toBeGreaterThan(15);
      expect(radius).toBeLessThan(22);
      expect(part.position.y+part.scale.y/2).toBeLessThan(.44);
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value=>Number.isFinite(value)&&value>0)).toBe(true);
      expect(Number.isFinite(part.rotationY)).toBe(true);
    }
  });
});
