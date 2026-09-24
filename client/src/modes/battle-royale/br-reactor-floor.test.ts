import {describe,expect,it} from "vitest";
import {BR_STRUCTURES} from "@planetfall/shared";
import {buildReactorFloorChannels} from "./br-reactor-floor";

describe("Helios floor power channels",()=>{
  const core=BR_STRUCTURES.find(structure=>structure.id==="helios-core")!;
  it("only decorates the enterable Helios Core with a bounded budget",()=>{
    expect(BR_STRUCTURES.filter(structure=>buildReactorFloorChannels(structure).length).map(structure=>structure.id)).toEqual(["helios-core"]);
    expect(buildReactorFloorChannels({...core,enterable:false})).toEqual([]);
    expect(buildReactorFloorChannels(core)).toHaveLength(20);
  });
  it("stays inset in the ground slab and preserves the central entry lane",()=>{
    for(const part of buildReactorFloorChannels(core)){
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value=>Number.isFinite(value)&&value>0)).toBe(true);
      expect(part.position.y+part.scale.y/2).toBeLessThan(.41);
      expect(Math.abs(part.position.x-core.position.x)-part.scale.x/2).toBeGreaterThan(6.7);
      expect(Math.abs(part.position.x-core.position.x)+part.scale.x/2).toBeLessThan(core.size.x/2-3.8);
      expect(Math.abs(part.position.z-core.position.z)+part.scale.z/2).toBeLessThan(core.size.z/2-1);
    }
  });
});
