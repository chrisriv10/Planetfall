import {expect,it} from "vitest";
import {stepBrMovement,type BrMotionState} from "@planetfall/shared";
import {BrPhysicsWorld} from "./br-physics";
import {BrPredictionPhysics} from "../../../../client/src/modes/battle-royale/br-physics";

it("keeps Ion Wings deployed when sliding down the Zero Point wall instead of landing on its vertical face",()=>{
  const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
  try{
    let state:BrMotionState={position:{x:-35,y:24,z:0},velocity:{x:38,y:-8,z:0},yaw:Math.PI/2,grounded:false,crouched:false,deployment:"chute",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0};
    let predicted=structuredClone(state),wallSamples=0;
    for(let frame=0;frame<120;frame++){
      const input={moveX:0,moveY:1,yaw:Math.PI/2,jump:false,sprint:false,crouch:false};
      state=stepBrMovement(state,input,1/30,1000+frame*1000/30,(p,d,o)=>authority.move("pilot",p,d,o.jumping,o.crouched));
      predicted=stepBrMovement(predicted,input,1/30,1000+frame*1000/30,(p,d,o)=>prediction.move(p,d,o.jumping,o.crouched));
      expect(Math.hypot(state.position.x-predicted.position.x,state.position.y-predicted.position.y,state.position.z-predicted.position.z)).toBeLessThan(.001);
      if(state.position.x< -14.4&&state.position.x> -15.1&&state.position.y>1){
        wallSamples++;
        expect(state.grounded,`wall at ${JSON.stringify(state.position)}`).toBe(false);
        expect(state.deployment).toBe("chute");
      }
    }
    expect(wallSamples).toBeGreaterThan(30);
    expect(state.grounded).toBe(true);expect(state.position.y).toBeCloseTo(.035,2);
  }finally{authority.dispose();prediction.dispose();}
});
