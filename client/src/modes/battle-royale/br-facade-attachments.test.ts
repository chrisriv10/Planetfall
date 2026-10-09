import {describe,expect,it} from "vitest";
import {BR_STRUCTURES} from "@planetfall/shared";
import {buildBrDoorwayParts,buildBrFreightPilasters} from "./br-facade-attachments";
import {buildFacadeParts} from "./br-facades";
import {brFacadeIntersections} from "./br-facade-intersections";

describe("mounted doorway and freight hardware",()=>{
  it("preserves the full entrance below head height in every orientation",()=>{
    for(const source of BR_STRUCTURES)for(const entrance of ["north","south","east","west"] as const){
      const s={...source,entrance},along=entrance==="north"||entrance==="south"?"x":"z";
      const parts=buildBrDoorwayParts(s);
      if(!s.enterable){expect(parts).toEqual([]);continue;}
      expect(parts).toHaveLength(6);
      for(const p of parts){
        if(p.position.y-p.scale.y/2<3)expect(Math.abs(p.position[along]-s.position[along])-p.scale[along]/2).toBeGreaterThan(2.4);
        expect(Object.values(p.scale).every(v=>Number.isFinite(v)&&v>0)).toBe(true);
      }
      expect(brFacadeIntersections([...buildFacadeParts(s),...parts,...buildBrFreightPilasters(s)])).toEqual([]);
    }
  });
  it("joins each awning to its jamb brackets outside the window skin",()=>{
    for(const s of BR_STRUCTURES.filter(s=>s.enterable)){
      const parts=buildBrDoorwayParts(s),ns=s.entrance==="north"||s.entrance==="south",normal=ns?"z":"x";
      const sign=s.entrance==="north"||s.entrance==="east"?1:-1;
      const awning=parts.find(p=>p.scale.y===.22)!;
      const near=sign*(awning.position[normal]-s.position[normal])-awning.scale[normal]/2;
      expect(near).toBeCloseTo(s.size[normal]/2+.8);
      for(const arm of parts.filter(p=>p.scale.y===.25)){
        const far=sign*(arm.position[normal]-s.position[normal])+arm.scale[normal]/2;
        expect(far).toBeCloseTo(near);
        expect(arm.position.y+arm.scale.y/2).toBeGreaterThan(awning.position.y-awning.scale.y/2);
        expect(arm.position.y-arm.scale.y/2).toBeLessThan(4.2);
      }
    }
  });
  it("ends freight braces below the real clerestory with a visible wall gap",()=>{
    let checked=0;
    for(const s of BR_STRUCTURES){
      const parts=buildBrFreightPilasters(s);
      if(!parts.length)continue;
      checked++;expect(parts).toHaveLength(2);
      const panes=buildFacadeParts(s).filter(p=>p.face===s.entrance&&(p.finish==="glass"||p.finish==="lit"));
      for(const p of parts)expect(p.position.y+p.scale.y/2).toBeLessThanOrEqual(Math.min(...panes.map(p=>p.position.y-p.scale.y/2))-.149);
    }
    expect(checked).toBeGreaterThan(10);
  });
});
