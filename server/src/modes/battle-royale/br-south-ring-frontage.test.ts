import { describe,expect,it } from "vitest";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

describe("Salvage Crossing authoritative and predicted traversal",()=>{
  const paths=[
    {label:"continuous avenue-ring-loading route",points:[{x:-210,y:.035,z:-290},{x:-210,y:.035,z:-340},{x:-210,y:.035,z:-386}]},
    {label:"shop entrance",points:[{x:-210,y:.035,z:-315},{x:-227,y:.395,z:-315}]},
    {label:"office entrance",points:[{x:-210,y:.035,z:-315},{x:-193,y:.395,z:-315}]},
    {label:"warehouse entrance",points:[{x:-210,y:.035,z:-365},{x:-227,y:.395,z:-365}]},
    {label:"utility entrance",points:[{x:-210,y:.035,z:-365},{x:-193,y:.395,z:-365}]}
  ];
  it.each(paths.flatMap(path=>[false,true].map(reverse=>({...path,reverse}))))(
    "walks $label without snagging or divergent prediction (reverse=$reverse)",({label,points,reverse})=>{
      const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
      const path=reverse?points.slice().reverse():points;
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
            expect(feet.y).toBeGreaterThanOrEqual(0);expect(feet.y).toBeLessThan(.44);
            expect(predicted.x).toBeCloseTo(feet.x,5);expect(predicted.y).toBeCloseTo(feet.y,5);expect(predicted.z).toBeCloseTo(feet.z,5);
          }
          expect(Math.hypot(target.x-feet.x,target.z-feet.z)).toBeLessThan(.005);
          expect(feet.y).toBeCloseTo(target.y,1);
        }
      }finally{prediction.dispose();authority.dispose();}
    }
  );
});
