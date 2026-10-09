import { describe, expect, it } from "vitest";
import { BR_BRIDGE_PIERS, BR_GREENWAY_TREES, BR_MAP_BLOCKS } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

describe("new visible piers and trunks obey authority and prediction",()=>{
  it("blocks capsules at each footprint instead of letting players walk through decoration",()=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
    try {
      const solids=[...BR_BRIDGE_PIERS,...BR_GREENWAY_TREES.map(t=>BR_MAP_BLOCKS.find(b=>b.id===`${t.id}-trunk`)!)];
      for(const solid of solids){
        const floor=solid.position.y-solid.size.y/2;
        const start={x:solid.position.x-solid.size.x/2-1.1,y:floor+.035,z:solid.position.z};
        let feet={...start},predicted={...start};
        expect(authority.rayDistance({...start,y:floor+.8},{x:1,y:0,z:0},2),solid.id).toBeCloseTo(1.1,2);
        for(let frame=0;frame<120;frame++){
          const input={x:.1,y:-.02,z:0};
          const actual=authority.move(solid.id,feet,input,false),anticipated=prediction.move(predicted,input,false);
          feet={x:feet.x+actual.movement.x,y:feet.y+actual.movement.y,z:feet.z+actual.movement.z};
          predicted={x:predicted.x+anticipated.movement.x,y:predicted.y+anticipated.movement.y,z:predicted.z+anticipated.movement.z};
          expect(predicted.x,solid.id).toBeCloseTo(feet.x,5);expect(predicted.y,solid.id).toBeCloseTo(feet.y,5);expect(predicted.z,solid.id).toBeCloseTo(feet.z,5);
          expect(feet.y,solid.id).toBeGreaterThanOrEqual(floor+.03);
          expect(actual.grounded,solid.id).toBe(true);expect(anticipated.grounded,solid.id).toBe(true);
        }
        expect(feet.x,solid.id).toBeLessThan(solid.position.x-solid.size.x/2-.2);
        expect(feet.x,solid.id).toBeGreaterThan(start.x+.4);
        expect(feet.y,solid.id).toBeCloseTo(floor+.035,1);
      }
    } finally {prediction.dispose();authority.dispose();}
  });
});
