import { describe,expect,it } from "vitest";
import { BR_MAP_BLOCKS,BR_ROADS,stepBrMovement,type BrMotionState } from "@planetfall/shared";
import { BrPredictionPhysics } from "./br-physics";

describe("Battle Royale prediction support queries",()=>{
  it("predicts continuous grounded travel into and out of the lowered court",()=>{
    const physics=new BrPredictionPhysics();
    try{
      let feet={x:137.5,y:.035,z:147};
      for(const targetZ of [100,147]){
        for(let frame=0;frame<700&&Math.abs(feet.z-targetZ)>.2;frame++){
          const collision=physics.move(feet,{x:0,y:-.12,z:Math.sign(targetZ-feet.z)*.12},false);
          feet={x:feet.x+collision.movement.x,y:feet.y+collision.movement.y,z:feet.z+collision.movement.z};
          expect(collision.grounded,`z=${feet.z}, y=${feet.y}`).toBe(true);
        }
        expect(Math.abs(feet.z-targetZ)).toBeLessThan(.2);
        if(targetZ===100)expect(feet.y).toBeCloseTo(-2.965,2);
        expect(physics.supportDistance(feet)).toBeCloseTo(.055,2);
      }
    }finally{physics.dispose();}
  });
  it("predicts movement and drop altitude inside the real lowered Transit Court",()=>{
    const physics=new BrPredictionPhysics();
    try{
      let feet={x:123,y:-2.965,z:100};
      for(let frame=0;frame<30;frame++){
        const result=physics.move(feet,{x:.035,y:-.12,z:0},false);
        feet={x:feet.x+result.movement.x,y:feet.y+result.movement.y,z:feet.z+result.movement.z};
        expect(result.grounded).toBe(true);expect(feet.y).toBeCloseTo(-2.965);
      }
      expect(physics.supportDistance({x:123,y:1,z:100})).toBeCloseTo(4.02);
    }finally{physics.dispose();}
  });
  it("keeps the predicted jump airborne in parity with authority",()=>{
    const physics=new BrPredictionPhysics();
    try{
      let motion:BrMotionState={position:{x:72,y:.035,z:72},velocity:{x:0,y:0,z:0},yaw:0,grounded:true,crouched:false,deployment:"grounded",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0,lastGroundedAt:0,jumpBufferedUntil:0};
      let apex=motion.position.y;
      for(let frame=0;frame<24;frame++){
        motion=stepBrMovement(motion,{moveX:0,moveY:0,yaw:0,jump:frame===0,sprint:false,crouch:false},1/60,frame*1000/60,(position,desired,options)=>physics.move(position,desired,options.jumping,options.crouched));
        apex=Math.max(apex,motion.position.y);
        if(frame<12)expect(motion.grounded,`frame ${frame}`).toBe(false);
      }
      expect(apex).toBeGreaterThan(1.15);
      expect(motion.position.y).toBeGreaterThan(.45);
    }finally{physics.dispose();}
  });
  it("measures altitude to the main deck instead of raw origin assumptions",()=>{
    const physics=new BrPredictionPhysics();
    try{expect(physics.supportDistance({x:72,y:120,z:72})).toBeCloseTo(120,1);}finally{physics.dispose();}
  });
  it("uses an authored roof or platform below the pilot",()=>{
    const support=BR_MAP_BLOCKS.find(block=>(block.kind==="platform"||block.kind==="bridge")&&block.position.y+block.size.y/2>2)!;
    const top=support.position.y+support.size.y/2;
    const physics=new BrPredictionPhysics();
    try{const distance=physics.supportDistance({x:support.position.x,y:top+34,z:support.position.z});expect(distance).toBeGreaterThan(0);expect(distance).toBeLessThan(top+32);}finally{physics.dispose();}
  });
  it("predicts every authored service-road grade onto its raised district deck",()=>{
    for(const road of BR_ROADS.filter(entry=>entry.id.endsWith("-grade"))){
      const physics=new BrPredictionPhysics();
      try{
        const horizontal=Math.hypot(road.from.x-road.to.x,road.from.z-road.to.z);
        const direction={x:(road.from.x-road.to.x)/horizontal,z:(road.from.z-road.to.z)/horizontal};
        const feeder=BR_ROADS.find(other=>other!==road&&[other.from,other.to].some(p=>Math.hypot(p.x-road.to.x,p.z-road.to.z)<.001));
        const otherEnd=feeder?(Math.hypot(feeder.from.x-road.to.x,feeder.from.z-road.to.z)<.001?feeder.to:feeder.from):road.from;
        const amount=Math.min(1.2/Math.hypot(otherEnd.x-road.to.x,otherEnd.z-road.to.z),.4);
        let feet={x:road.to.x+(otherEnd.x-road.to.x)*amount,y:road.to.y+(otherEnd.y-road.to.y)*amount-.1+.04,z:road.to.z+(otherEnd.z-road.to.z)*amount};
        for(let step=0;step<900;step++){
          const remaining=Math.hypot(road.from.x-feet.x,road.from.z-feet.z);
          const result=physics.move(feet,{x:(road.from.x-feet.x)/remaining*.12,y:-.08,z:(road.from.z-feet.z)/remaining*.12},false);
          feet={x:feet.x+result.movement.x,y:feet.y+result.movement.y,z:feet.z+result.movement.z};
          if(Math.hypot(feet.x-road.from.x,feet.z-road.from.z)<2.2&&feet.y>road.from.y-.3)break;
        }
        expect(Math.hypot(feet.x-road.from.x,feet.z-road.from.z),road.id).toBeLessThan(2.2);
        expect(feet.y,road.id).toBeGreaterThan(road.from.y-.3);
      }finally{physics.dispose();}
    }
  });
});
