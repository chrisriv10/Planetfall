import { describe,expect,it } from "vitest";
import { BR_MAP_BLOCKS,BR_ROADS,stepBrMovement,type BrMotionState } from "@planetfall/shared";
import { BrPredictionPhysics } from "./br-physics";

describe("Battle Royale prediction support queries",()=>{
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
        let feet={x:road.to.x-direction.x*1.2,y:.04,z:road.to.z-direction.z*1.2};
        for(let step=0;step<900;step++){
          const result=physics.move(feet,{x:direction.x*.12,y:-.08,z:direction.z*.12},false);
          feet={x:feet.x+result.movement.x,y:feet.y+result.movement.y,z:feet.z+result.movement.z};
          if(Math.hypot(feet.x-road.from.x,feet.z-road.from.z)<2.2&&feet.y>road.from.y-.3)break;
        }
        expect(Math.hypot(feet.x-road.from.x,feet.z-road.from.z),road.id).toBeLessThan(2.2);
        expect(feet.y,road.id).toBeGreaterThan(road.from.y-.3);
      }finally{physics.dispose();}
    }
  });
});
