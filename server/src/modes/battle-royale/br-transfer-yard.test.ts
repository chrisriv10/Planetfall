import { describe,expect,it } from "vitest";
import { BR_MAP_BLOCKS } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

describe("Transfer Yard ground street and actual entrances",()=>{
  const paths=[
    {label:"ring arrival and main street",points:[{x:102,y:.035,z:-335},{x:102,y:.035,z:-394}]},
    {label:"intentional service court",points:[{x:102,y:.035,z:-394},{x:125,y:.035,z:-394}]},
    {label:"east-facing shop door",floor:"transfer-yard-shop-floor",points:[{x:102,y:.035,z:-365},{x:84,y:.395,z:-365}]},
    {label:"west-facing office door",floor:"transfer-yard-office-floor",points:[{x:102,y:.035,z:-372},{x:122,y:.395,z:-372}]},
    {label:"east-facing utility door",floor:"transfer-yard-utility-floor",points:[{x:102,y:.035,z:-391},{x:82,y:.395,z:-391}]}
  ];
  it.each(paths.flatMap(path=>[false,true].map(reverse=>({...path,reverse}))))(
    "walks $label with real support and prediction parity (reverse=$reverse)",({label,points,floor:floorId,reverse})=>{
      const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
      const path=reverse?points.slice().reverse():points;
      const floor=floorId?BR_MAP_BLOCKS.find(b=>b.id===floorId)!:null;
      let feet={...path[0]},predicted={...feet};
      try{
        for(const target of path.slice(1)){
          for(let frame=0;frame<1800&&Math.hypot(target.x-feet.x,target.z-feet.z)>.005;frame++){
            const dx=target.x-feet.x,dz=target.z-feet.z,distance=Math.hypot(dx,dz),step=Math.min(.12,distance);
            const desired={x:dx/distance*step,y:-.12,z:dz/distance*step};
            const actual=authority.move(label,feet,desired,false),anticipated=prediction.move(predicted,desired,false);
            feet={x:feet.x+actual.movement.x,y:feet.y+actual.movement.y,z:feet.z+actual.movement.z};
            predicted={x:predicted.x+anticipated.movement.x,y:predicted.y+anticipated.movement.y,z:predicted.z+anticipated.movement.z};
            expect(actual.grounded,JSON.stringify(feet)).toBe(true);expect(anticipated.grounded).toBe(true);
            // Only the narrow intentional floor-lip autostep can lift the
            // capsule before its center reaches a .36m indoor floor.
            const edge=floor?Math.abs(Math.abs(feet.x-floor.position.x)-floor.size.x/2):Infinity;
            if(edge>.6)expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1),JSON.stringify(feet)).toBeLessThan(.08);
            else{expect(feet.y).toBeGreaterThanOrEqual(0);expect(feet.y).toBeLessThanOrEqual(.44);}
            expect(predicted.x).toBeCloseTo(feet.x,5);expect(predicted.y).toBeCloseTo(feet.y,5);expect(predicted.z).toBeCloseTo(feet.z,5);
          }
          expect(Math.hypot(target.x-feet.x,target.z-feet.z)).toBeLessThan(.005);
          expect(feet.y).toBeCloseTo(target.y,1);
        }
      }finally{prediction.dispose();authority.dispose();}
    }
  );
});
