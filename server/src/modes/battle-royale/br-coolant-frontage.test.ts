import {describe,expect,it} from "vitest";
import {BR_MAP_BLOCKS} from "@planetfall/shared";
import {BrPhysicsWorld} from "./br-physics.js";
import {BrPredictionPhysics} from "../../../../client/src/modes/battle-royale/br-physics.js";

const paths=[
  {label:"through-street",points:[{x:37,y:.035,z:58},{x:37,y:.035,z:121}]},
  {label:"avenue junction",points:[{x:37,y:.035,z:121},{x:70+10*63/95,y:.035,z:121}]},
  {label:"control office door",floor:"coolant-frontage-office-floor",points:[{x:37,y:.035,z:98},{x:25,y:.395,z:98}]},
  {label:"maintenance door",floor:"coolant-frontage-maintenance-floor",points:[{x:37,y:.035,z:98},{x:51,y:.395,z:98}]},
  {label:"office ground corridor beside stairs",points:[{x:23.4,y:.395,z:106},{x:26.8,y:.395,z:106},{x:26.8,y:.395,z:98}]},
  {label:"office internal elevation",points:[{x:23.4,y:.395,z:106},{x:23.4,y:5.71,z:88}]}
];
describe("Coolant frontage actual circulation",()=>{
 it.each(paths.flatMap(path=>[false,true].map(reverse=>({...path,reverse}))))("walks $label with support, arrival and prediction parity (reverse=$reverse)",({label,points,floor:floorId,reverse})=>{
  const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics(),path=reverse?points.slice().reverse():points;
  const floor=floorId?BR_MAP_BLOCKS.find(b=>b.id===floorId)!:null;
  let feet={...path[0]},predicted={...feet};
  try{
   for(const target of path.slice(1)){
    for(let frame=0;frame<1800&&Math.hypot(target.x-feet.x,target.z-feet.z)>.005;frame++){
     const dx=target.x-feet.x,dz=target.z-feet.z,distance=Math.hypot(dx,dz),step=Math.min(.12,distance),desired={x:dx/distance*step,y:-.12,z:dz/distance*step};
     const actual=authority.move(label,feet,desired,false),anticipated=prediction.move(predicted,desired,false);
     feet={x:feet.x+actual.movement.x,y:feet.y+actual.movement.y,z:feet.z+actual.movement.z};
     predicted={x:predicted.x+anticipated.movement.x,y:predicted.y+anticipated.movement.y,z:predicted.z+anticipated.movement.z};
     expect(actual.grounded,JSON.stringify(feet)).toBe(true);expect(anticipated.grounded).toBe(true);
     const edge=floor?Math.abs(Math.abs(feet.x-floor.position.x)-floor.size.x/2):Infinity;
     // At the internal landing edge the real capsule can still contact the
     // landing behind its centre while the centre ray sees the descending
     // ramp. Measure that contact inside the unchanged .45m footprint.
     if(label==="office internal elevation"&&Math.abs(feet.z-90.85)<.6){
      const support=Math.min(...[0,-.4,.4].map(z=>authority.rayDistance({...feet,z:feet.z+z},{x:0,y:-1,z:0},1)));
      expect(support,JSON.stringify(feet)).toBeLessThan(.08);
     }else if(edge>.6)expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1),JSON.stringify(feet)).toBeLessThan(.08);
     else{expect(feet.y).toBeGreaterThanOrEqual(0);expect(feet.y).toBeLessThanOrEqual(.44);}
     expect(predicted.x).toBeCloseTo(feet.x,5);expect(predicted.y).toBeCloseTo(feet.y,5);expect(predicted.z).toBeCloseTo(feet.z,5);
    }
    expect(Math.hypot(target.x-feet.x,target.z-feet.z)).toBeLessThan(.005);expect(feet.y).toBeCloseTo(target.y,1);
   }
  }finally{prediction.dispose();authority.dispose();}
 });
});
