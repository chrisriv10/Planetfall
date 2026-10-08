import { describe,expect,it } from "vitest";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";
import { BR_ROADS } from "@planetfall/shared";

describe("Central Security ground-level street junction",()=>{
  it.each(["x","z"] as const)("crosses the %s frontage without an invisible raised floor",axis=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
    let feet=axis==="x"?{x:-173,y:.035,z:85}:{x:-145,y:.035,z:60};
    let predicted={...feet};
    const target=axis==="x"?-117:110;
    try{
      for(let frame=0;frame<600&&Math.abs(feet[axis]-target)>.005;frame++){
        const desired={x:0,y:-.12,z:0};desired[axis]=Math.min(.12,target-feet[axis]);
        const actual=authority.move("security",feet,desired,false),anticipated=prediction.move(predicted,desired,false);
        feet={x:feet.x+actual.movement.x,y:feet.y+actual.movement.y,z:feet.z+actual.movement.z};
        predicted={x:predicted.x+anticipated.movement.x,y:predicted.y+anticipated.movement.y,z:predicted.z+anticipated.movement.z};
        expect(actual.grounded,JSON.stringify(feet)).toBe(true);expect(anticipated.grounded).toBe(true);
        expect(feet.y,JSON.stringify(feet)).toBeCloseTo(.035,1);
        expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1),JSON.stringify(feet)).toBeLessThan(.08);
        expect(predicted.x).toBeCloseTo(feet.x,5);expect(predicted.y).toBeCloseTo(feet.y,5);expect(predicted.z).toBeCloseTo(feet.z,5);
      }
      expect(Math.abs(feet[axis]-target)).toBeLessThan(.005);
    }finally{prediction.dispose();authority.dispose();}
  });
  it("walks the feeder around the shop onto Zero's actual arterial plane",()=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
    const roads=BR_ROADS.filter(r=>r.id==="service-23"||r.id.startsWith("service-23-grade-part-"));
    let feet={...roads[0].from,y:.035},predicted={...feet};
    try{
      for(const road of roads){
        for(let frame=0;frame<600&&Math.hypot(road.to.x-feet.x,road.to.z-feet.z)>.005;frame++){
          const dx=road.to.x-feet.x,dz=road.to.z-feet.z,length=Math.hypot(dx,dz),step=Math.min(.12,length);
          const desired={x:dx/length*step,y:-.12,z:dz/length*step};
          const actual=authority.move("security",feet,desired,false),anticipated=prediction.move(predicted,desired,false);
          feet={x:feet.x+actual.movement.x,y:feet.y+actual.movement.y,z:feet.z+actual.movement.z};
          predicted={x:predicted.x+anticipated.movement.x,y:predicted.y+anticipated.movement.y,z:predicted.z+anticipated.movement.z};
          expect(actual.grounded,JSON.stringify(feet)).toBe(true);expect(anticipated.grounded).toBe(true);
          const rx=road.to.x-road.from.x,rz=road.to.z-road.from.z;
          const t=((feet.x-road.from.x)*rx+(feet.z-road.from.z)*rz)/(rx*rx+rz*rz);
          const floor=road.from.y+(road.to.y-road.from.y)*t-.1;
          expect(feet.y,JSON.stringify(feet)).toBeCloseTo(floor+.035,1);
          expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1)).toBeLessThan(.08);
          expect(predicted.x).toBeCloseTo(feet.x,5);expect(predicted.y).toBeCloseTo(feet.y,5);expect(predicted.z).toBeCloseTo(feet.z,5);
        }
        expect(Math.hypot(road.to.x-feet.x,road.to.z-feet.z)).toBeLessThan(.005);
      }
    }finally{prediction.dispose();authority.dispose();}
  });
});
