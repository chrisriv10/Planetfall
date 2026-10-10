import {describe,expect,it} from "vitest";
import {BrPhysicsWorld} from "./br-physics.js";
import {BrPredictionPhysics} from "../../../../client/src/modes/battle-royale/br-physics.js";
const paths=[
 {label:"Zero through-street",points:[{x:-5,y:.035,z:58},{x:-5,y:.035,z:86},{x:-15,y:.035,z:104},{x:-15,y:.035,z:170}]},
 {label:"mall corner link",points:[{x:-15,y:.035,z:170},{x:-5,y:.035,z:184},{x:-5,y:.035,z:190}]},
 {label:"mall continuation",points:[{x:-5,y:.035,z:190},{x:-5,y:.035,z:240}]},
 {label:"archive door",door:-33,points:[{x:-15,y:.035,z:155},{x:-34.7,y:.395,z:155}]},
 {label:"exchange door",door:-9,points:[{x:-15,y:.035,z:155},{x:-5,y:.395,z:155}]},
 {label:"archive ground circulation",points:[{x:-34.7,y:.395,z:155},{x:-34.7,y:.395,z:164},{x:-44,y:.395,z:164},{x:-49,y:.395,z:155}]},
 {label:"archive internal elevation",points:[{x:-38.06,y:.395,z:164},{x:-38.06,y:4.71,z:145},{x:-44,y:4.71,z:145},{x:-44,y:4.71,z:155},{x:-49,y:4.71,z:155}]}
];
describe("North Civic collision-backed circulation",()=>{
 it.each(paths.flatMap(path=>[false,true].map(reverse=>({...path,reverse}))))("walks $label with support and prediction parity (reverse=$reverse)",({label,points,door,reverse})=>{
  const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics(),path=reverse?points.slice().reverse():points;
  let feet={...path[0]},predicted={...feet};
  try{
   for(const target of path.slice(1)){
    for(let frame=0;frame<1800&&Math.hypot(target.x-feet.x,target.z-feet.z)>.005;frame++){
     const dx=target.x-feet.x,dz=target.z-feet.z,distance=Math.hypot(dx,dz),step=Math.min(.12,distance),desired={x:dx/distance*step,y:-.12,z:dz/distance*step};
     const actual=authority.move(label,feet,desired,false),anticipated=prediction.move(predicted,desired,false);
     feet={x:feet.x+actual.movement.x,y:feet.y+actual.movement.y,z:feet.z+actual.movement.z};
     predicted={x:predicted.x+anticipated.movement.x,y:predicted.y+anticipated.movement.y,z:predicted.z+anticipated.movement.z};
     expect(actual.grounded,JSON.stringify(feet)).toBe(true);expect(anticipated.grounded).toBe(true);
     if(door!==undefined&&Math.abs(feet.x-door)<=.6){expect(feet.y).toBeGreaterThanOrEqual(0);expect(feet.y).toBeLessThanOrEqual(.44);}
     else if(label==="archive internal elevation"&&Math.abs(feet.z-149.15)<.6){
      const support=Math.min(...[0,-.4,.4].map(z=>authority.rayDistance({...feet,z:feet.z+z},{x:0,y:-1,z:0},1)));
      expect(support,JSON.stringify(feet)).toBeLessThan(.08);
     }else expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1),JSON.stringify(feet)).toBeLessThan(.08);
     expect(predicted.x).toBeCloseTo(feet.x,5);expect(predicted.y).toBeCloseTo(feet.y,5);expect(predicted.z).toBeCloseTo(feet.z,5);
    }
    expect(Math.hypot(target.x-feet.x,target.z-feet.z)).toBeLessThan(.005);expect(feet.y).toBeCloseTo(target.y,1);
   }
  }finally{prediction.dispose();authority.dispose();}
 });
});
