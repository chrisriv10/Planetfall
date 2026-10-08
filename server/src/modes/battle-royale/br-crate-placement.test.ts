import { describe,expect,it } from "vitest";
import { BR_SECONDARY_CRATE_SOCKETS } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

describe("Star Crate deck support",()=>{
  it("has matching real ray support under the whole secondary crate in both physics worlds",()=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
    try{
      for(const {districtId,position} of BR_SECONDARY_CRATE_SOCKETS){
        for(const dx of [-.95,0,.95])for(const dz of [-.75,0,.75]){
          const origin={...position,x:position.x+dx,z:position.z+dz};
          const direction={x:0,y:-1,z:0};
          expect(authority.rayDistance(origin,direction,2),`${districtId}: ${dx},${dz}`).toBeCloseTo(.62,3);
          // supportDistance deliberately casts 2cm above the queried feet.
          expect(prediction.supportDistance(origin,2),`${districtId}: ${dx},${dz}`).toBeCloseTo(.64,3);
        }
      }
    }finally{prediction.dispose();authority.dispose();}
  });
});
