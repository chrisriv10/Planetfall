import {expect,it} from "vitest";
import {BR_MAP_BLOCKS,BR_STRUCTURES} from "@planetfall/shared";
import {buildBrNorthCivicIdentity} from "../../../../client/src/modes/battle-royale/br-north-civic-identity.js";
import {BrPhysicsWorld} from "./br-physics.js";

it("mounts the complete Civic identity footprints against actual authoritative surfaces",()=>{
 const physics=new BrPhysicsWorld();let checked=0;
 try{
  for(const id of ["north-civic-archive","north-civic-exchange"]){
   const structure=BR_STRUCTURES.find(s=>s.id===id)!;
   const identity=buildBrNorthCivicIdentity(structure);expect(identity.supported).toBe(true);
   for(const part of identity.parts){
    const support=BR_MAP_BLOCKS.find(b=>b.id===part.supportId)!;
    const world={...part.position,y:part.position.y+structure.position.y};
    for(const a of [-.49,0,.49])for(const b of [-.49,0,.49]){
     if(part.attachment==="wall"){
      const sign=Math.sign(structure.position.x-support.position.x);
      const origin={x:world.x+sign*(part.scale.x/2+.01),y:world.y+a*part.scale.y,z:world.z+b*part.scale.z};
      const distance=Math.abs(origin.x-(support.position.x+sign*support.size.x/2));
      expect(distance).toBeLessThan(.15);
      expect(physics.rayDistance(origin,{x:-sign,y:0,z:0},.3),part.name).toBeCloseTo(distance,4);
     }else{
      const floor=part.attachment==="floor",direction=floor?-1:1;
      const origin={x:world.x+a*part.scale.x,y:world.y-direction*.01,z:world.z+b*part.scale.z};
      const surface=support.position.y+(floor?1:-1)*support.size.y/2;
      const distance=Math.abs(origin.y-surface);
      expect(distance).toBeLessThan(.05);
      expect(physics.rayDistance(origin,{x:0,y:direction,z:0},.15),part.name).toBeCloseTo(distance,4);
     }
     checked++;
    }
   }
  }
  expect(checked).toBe(1062);
 }finally{physics.dispose();}
});
