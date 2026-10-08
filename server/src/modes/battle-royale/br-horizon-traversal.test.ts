import { describe,expect,it } from "vitest";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

describe("Horizon Homes lower/upper street traversal",()=>{
  it.each([false,true])("walks the street into Nova and back with real grounded support (reverse=%s)",reverse=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
    const points=[{x:-255,y:.035,z:-15},{x:-255,y:.035,z:-35},{x:-255,y:5.035,z:-57},{x:-255,y:5.035,z:-65}];
    if(reverse)points.reverse();
    try{
      let feet={...points[0]},predicted={...feet};
      for(const target of points.slice(1)){
        for(let frame=0;frame<600&&Math.abs(target.z-feet.z)>.005;frame++){
          const desired={x:0,y:-.12,z:Math.sign(target.z-feet.z)*Math.min(.12,Math.abs(target.z-feet.z))};
          const actual=authority.move("horizon",feet,desired,false),anticipated=prediction.move(predicted,desired,false);
          feet={x:feet.x+actual.movement.x,y:feet.y+actual.movement.y,z:feet.z+actual.movement.z};
          predicted={x:predicted.x+anticipated.movement.x,y:predicted.y+anticipated.movement.y,z:predicted.z+anticipated.movement.z};
          expect(actual.grounded,JSON.stringify(feet)).toBe(true);
          expect(anticipated.grounded).toBe(true);
          expect(predicted.x).toBeCloseTo(feet.x,5);expect(predicted.y).toBeCloseTo(feet.y,5);expect(predicted.z).toBeCloseTo(feet.z,5);
          expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1),JSON.stringify(feet)).toBeLessThan(.08);
        }
        expect(Math.abs(target.z-feet.z)).toBeLessThan(.005);
        expect(feet.y).toBeCloseTo(target.y,1);
      }
    }finally{prediction.dispose();authority.dispose();}
  });
});
