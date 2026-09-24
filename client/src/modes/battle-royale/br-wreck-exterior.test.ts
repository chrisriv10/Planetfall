import { describe,expect,it } from "vitest";
import { BR_STRUCTURES } from "@planetfall/shared";
import { buildWreckExterior } from "./br-wreck-exterior";

describe("Crash Site exterior silhouette",()=>{
  const fuselage=BR_STRUCTURES.find(structure=>structure.id==="crash-fuselage")!;
  const parts=buildWreckExterior(fuselage);
  it("adds asymmetric wings, a tail, and a bounded impact scar",()=>{
    expect(parts.filter(part=>part.finish==="hull")).toHaveLength(2);
    expect(parts.some(part=>part.finish==="frame"&&part.position.y>fuselage.size.y+2)).toBe(true);
    expect(parts.filter(part=>part.finish==="scorch")).toHaveLength(2);
    expect(parts.filter(part=>part.finish==="rib")).toHaveLength(6);
    expect(parts.filter(part=>part.finish==="breach")).toHaveLength(2);
    expect(parts.filter(part=>part.finish==="stripe")).toHaveLength(2);
  });
  it("keeps solid silhouette pieces at or above the real roof",()=>{
    for(const part of parts.filter(part=>!["scorch","rib","breach","stripe"].includes(part.finish)))expect(part.position.y-part.scale.y/2).toBeGreaterThanOrEqual(fuselage.size.y-.01);
    expect(parts.flatMap(part=>[...Object.values(part.position),...Object.values(part.scale),part.rotationY??0,part.rotationZ??0]).every(Number.isFinite)).toBe(true);
  });
  it("mounts torn side detail outside the long walls without creating cover-sized depth",()=>{
    for(const part of parts.filter(part=>["rib","breach","stripe"].includes(part.finish))){
      expect(Math.abs(part.position.z)-part.scale.z/2).toBeGreaterThan(fuselage.size.z/2+.35);
      expect(Math.abs(part.position.x)+part.scale.x/2).toBeLessThan(fuselage.size.x/2-1);
      expect(part.scale.z).toBeLessThanOrEqual(.14);
      expect(part.position.y-part.scale.y/2).toBeGreaterThan(.7);
      expect(part.position.y+part.scale.y/2).toBeLessThan(fuselage.size.y+.2);
    }
  });
});
