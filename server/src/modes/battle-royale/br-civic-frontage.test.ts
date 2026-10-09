import { describe,expect,it } from "vitest";
import { BR_BALANCE, BR_MAP_BLOCKS } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

describe("Lower civic route, upper-grade clearance and three actual entrances",()=>{
  const paths=[
    {label:"existing Zero feeder and lower civic continuation",points:[{x:-70,y:.035,z:42},{x:-108,y:.035,z:42},{x:-108,y:.035,z:85},{x:-145,y:.035,z:85},{x:-145,y:.035,z:180}]},
    {label:"short civic court",points:[{x:-145,y:.035,z:180},{x:-132,y:.035,z:180}]},
    {label:"bookshop door",floor:"civic-frontage-bookshop-floor",points:[{x:-145,y:.035,z:170},{x:-159,y:.395,z:170}]},
    {label:"clinic door",floor:"civic-frontage-clinic-floor",points:[{x:-145,y:.035,z:166},{x:-128,y:.395,z:166}]},
    {label:"service door",floor:"civic-frontage-service-floor",points:[{x:-145,y:.035,z:145},{x:-128,y:.395,z:145}]}
  ];
  it.each(paths.flatMap(path=>[false,true].map(reverse=>({...path,reverse}))))(
    "walks $label with support and prediction parity (reverse=$reverse)",({label,points,floor:floorId,reverse})=>{
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
            const edge=floor?Math.abs(Math.abs(feet.x-floor.position.x)-floor.size.x/2):Infinity;
            if(edge>.6)expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1),JSON.stringify(feet)).toBeLessThan(.08);
            else{expect(feet.y).toBeGreaterThanOrEqual(0);expect(feet.y).toBeLessThanOrEqual(.44);}
            // Check the real 1.4m standing capsule plus .1m clearance, including
            // the established lower feeder. rayDistance returns maximum on no hit.
            if(!floor)expect(authority.rayDistance({...feet,y:feet.y+.1},{x:0,y:1,z:0},BR_BALANCE.playerHeight),JSON.stringify(feet)).toBe(BR_BALANCE.playerHeight);
            expect(predicted.x).toBeCloseTo(feet.x,5);expect(predicted.y).toBeCloseTo(feet.y,5);expect(predicted.z).toBeCloseTo(feet.z,5);
          }
          expect(Math.hypot(target.x-feet.x,target.z-feet.z)).toBeLessThan(.005);
          expect(feet.y).toBeCloseTo(target.y,1);
        }
      }finally{prediction.dispose();authority.dispose();}
    }
  );
});
