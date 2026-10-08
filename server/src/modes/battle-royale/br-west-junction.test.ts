import { describe,expect,it } from "vitest";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";
import type { Vec3 } from "@planetfall/shared";

const floorContact=(physics:BrPhysicsWorld,feet:Vec3)=>physics.rayDistance(feet,{x:0,y:-1,z:0},1);

describe("West Junction real controller traversal",()=>{
  it("distinguishes real capsule support from a floating grounded flag",()=>{
    const physics=new BrPhysicsWorld();
    try{
      expect(floorContact(physics,{x:-330,y:.035,z:-165})).toBeLessThan(.08);
      expect(floorContact(physics,{x:-330,y:.535,z:-165})).toBeGreaterThan(.5);
    }finally{physics.dispose();}
  });
  const paths=[
    {label:"ground collector and junction",points:[{x:-375,y:.035,z:-125},{x:-330,y:.035,z:-128.71900826446281}]},
    {label:"continuous Nova grade",points:[{x:-330,y:.035,z:-128.71900826446281},{x:-300,y:.035,z:-131.19834710743802},{x:-262,y:5.035,z:-134.3388429752066},{x:-254,y:5.035,z:-135}]},
    {label:"service street",points:[{x:-330,y:.035,z:-118},{x:-330,y:.035,z:-180}]},
    {label:"shop door",points:[{x:-312,y:.035,z:-118},{x:-312,y:.395,z:-107}]},
    {label:"office door",points:[{x:-294,y:.035,z:-142},{x:-294,y:.395,z:-158}]},
    {label:"utility door",points:[{x:-330,y:.035,z:-152},{x:-347,y:.395,z:-152}]}
  ];
  it.each(paths.flatMap(path=>[false,true].map(reverse=>({...path,reverse}))))(
    "walks $label grounded with prediction parity (reverse=$reverse)",({label,points,reverse})=>{
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
            expect(feet.y).toBeGreaterThanOrEqual(0);expect(feet.y).toBeLessThan(5.44);
            // Continuous roads/grades must have real floor contact every frame.
            // Doorway autostep intentionally raises the capsule before its
            // center reaches the .36m floor lip; a center ray cannot measure
            // contact during that transition. Door paths retain grounded,
            // endpoint-height, arrival and prediction-parity assertions.
            if(!label.endsWith("door"))expect(floorContact(authority,feet),JSON.stringify(feet)).toBeLessThan(.08);
            expect(predicted.x).toBeCloseTo(feet.x,5);expect(predicted.y).toBeCloseTo(feet.y,5);expect(predicted.z).toBeCloseTo(feet.z,5);
          }
          expect(Math.hypot(target.x-feet.x,target.z-feet.z)).toBeLessThan(.005);
          expect(feet.y).toBeCloseTo(target.y,1);
        }
      }finally{prediction.dispose();authority.dispose();}
    }
  );
});
