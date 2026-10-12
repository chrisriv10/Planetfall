import { expect, it } from "vitest";
import { brNextWaypoint, stepBrMovement, type BrMotionState } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics";

it.each([30,60])("replans continuously through Nova's northeast road bend at %i Hz without returning to its parallel street",frequency=>{
  const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
  try{
    let motion:BrMotionState={position:{x:-92,y:5.035,z:-60},velocity:{x:0,y:0,z:0},yaw:0,grounded:true,crouched:false,deployment:"grounded",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0};
    let predicted=structuredClone(motion),closestBend=Infinity;
    const target={x:-61.2927,y:.035,z:34.9233};
    for(let frame=0;frame<frequency*10&&motion.position.z<-45;frame++){
      const next=brNextWaypoint(motion.position,target),yaw=Math.atan2(next.x-motion.position.x,-(next.z-motion.position.z));
      const input={moveX:0,moveY:1,yaw,jump:false,sprint:false,crouch:false};
      motion=stepBrMovement(motion,input,1/frequency,1000+frame*1000/frequency,(p,d,o)=>authority.move("pilot",p,d,o.jumping,o.crouched));
      predicted=stepBrMovement(predicted,input,1/frequency,1000+frame*1000/frequency,(p,d,o)=>prediction.move(p,d,o.jumping,o.crouched));
      closestBend=Math.min(closestBend,Math.hypot(motion.position.x+120,motion.position.z+50));
      expect(motion.grounded).toBe(true);expect(predicted.grounded).toBe(true);
      expect(Math.hypot(motion.position.x-predicted.position.x,motion.position.y-predicted.position.y,motion.position.z-predicted.position.z)).toBeLessThan(.001);
    }
    expect(closestBend).toBeLessThan(1.5);
    expect(motion.position.z).toBeGreaterThan(-45);
    expect(motion.position.x).toBeLessThan(-120);
  }finally{authority.dispose();prediction.dispose();}
});
