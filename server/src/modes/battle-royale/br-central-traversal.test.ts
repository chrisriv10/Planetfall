import { describe,expect,it } from "vitest";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

describe("Central Heights / Zero actual street support",()=>{
  const routes=[
    {id:"Nova access",points:[{x:-101,y:5.035,z:-82},{x:-45,y:.035,z:-82}]},
    {id:"apartment/shop frontage",points:[{x:-65,y:.035,z:-107},{x:-65,y:.035,z:-35}]},
    {id:"Zero south/west circuit",points:[{x:68,y:.035,z:-58},{x:-70,y:.035,z:-58},{x:-70,y:.035,z:56}]}
  ];
  it.each(routes.flatMap(route=>[false,true].map(reverse=>({...route,reverse}))))(
    "walks $id in both directions (reverse=$reverse)",({id,points,reverse})=>{
      const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
      const path=reverse?points.slice().reverse():points;
      let feet={...path[0]},predicted={...feet};
      try{
        for(const target of path.slice(1)){
          for(let frame=0;frame<1600&&Math.hypot(target.x-feet.x,target.z-feet.z)>.005;frame++){
            const dx=target.x-feet.x,dz=target.z-feet.z,length=Math.hypot(dx,dz),step=Math.min(.12,length);
            const desired={x:dx/length*step,y:-.12,z:dz/length*step};
            const actual=authority.move(id,feet,desired,false),anticipated=prediction.move(predicted,desired,false);
            feet={x:feet.x+actual.movement.x,y:feet.y+actual.movement.y,z:feet.z+actual.movement.z};
            predicted={x:predicted.x+anticipated.movement.x,y:predicted.y+anticipated.movement.y,z:predicted.z+anticipated.movement.z};
            expect(actual.grounded,JSON.stringify(feet)).toBe(true);expect(anticipated.grounded).toBe(true);
            expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1),JSON.stringify(feet)).toBeLessThan(.08);
            expect(predicted.x).toBeCloseTo(feet.x,5);expect(predicted.y).toBeCloseTo(feet.y,5);expect(predicted.z).toBeCloseTo(feet.z,5);
          }
          expect(Math.hypot(target.x-feet.x,target.z-feet.z)).toBeLessThan(.005);
          expect(feet.y).toBeCloseTo(target.y,1);
        }
      }finally{prediction.dispose();authority.dispose();}
    });
});
