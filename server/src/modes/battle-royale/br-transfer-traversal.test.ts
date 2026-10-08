import { describe,expect,it } from "vitest";
import { BR_ROADS } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

const boulevard=BR_ROADS.find(r=>r.id==="transit-farm-boulevard")!;
const paths=[
  {name:"power approach through production boulevard",points:[boulevard.from,{x:194,y:4.1,z:178},{x:201,y:4.1,z:184},{x:215,y:4.1,z:208},{x:225,y:4.1,z:224}]},
  {name:"Farms street through transfer arrival",points:[{x:189,y:4.1,z:220},{x:189,y:4.1,z:184},{x:201,y:4.1,z:184}]}
];

describe("Production Transfer continuous traversal",()=>{
  it.each(paths.flatMap(p=>[p,{name:`${p.name} in reverse`,points:[...p.points].reverse()}]))("walks $name with prediction/authority parity",({points})=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
    try{
      let feet={...points[0],y:points[0].y-.1+.035},predicted={...feet};
      for(const target of points.slice(1)){
        for(let frame=0;frame<600&&Math.hypot(target.x-feet.x,target.z-feet.z)>.15;frame++){
          const distance=Math.hypot(target.x-feet.x,target.z-feet.z);
          const step=Math.min(.12,distance);
          const desired={x:(target.x-feet.x)/distance*step,y:-.12,z:(target.z-feet.z)/distance*step};
          const actual=authority.move("transfer",feet,desired,false);
          const anticipated=prediction.move(predicted,desired,false);
          feet={x:feet.x+actual.movement.x,y:feet.y+actual.movement.y,z:feet.z+actual.movement.z};
          predicted={x:predicted.x+anticipated.movement.x,y:predicted.y+anticipated.movement.y,z:predicted.z+anticipated.movement.z};
          expect(actual.grounded,JSON.stringify(feet)).toBe(true);
          expect(anticipated.grounded,JSON.stringify(predicted)).toBe(true);
          expect(predicted.x).toBeCloseTo(feet.x,5);
          expect(predicted.y).toBeCloseTo(feet.y,5);
          expect(predicted.z).toBeCloseTo(feet.z,5);
          const contact=authority.rayDistance(feet,{x:0,y:-1,z:0},1);
          expect(contact).toBeGreaterThan(.015);
          expect(contact,JSON.stringify({feet,target})).toBeLessThan(.08);
        }
        expect(Math.hypot(target.x-feet.x,target.z-feet.z)).toBeLessThan(.15);
        expect(feet.y).toBeCloseTo(target.y-.1+.035,1);
      }
    }finally{prediction.dispose();authority.dispose();}
  });
});
