import {expect,it} from "vitest";
import {BR_BALANCE,BR_MAP_BLOCKS,BR_TRAVERSAL,stepBrMovement,type BrMotionState} from "@planetfall/shared";
import {BrPhysicsWorld} from "./br-physics";
import {BrPredictionPhysics} from "../../../../client/src/modes/battle-royale/br-physics";

for(const lift of BR_TRAVERSAL.filter(device=>device.kind==="grav-lift")){
  it(`${lift.id} has a clear full-height launch corridor`,()=>{
    const radius=3.2+BR_BALANCE.playerRadius;
    const obstacles=BR_MAP_BLOCKS.filter(block=>
      block.position.y+block.size.y/2>lift.position.y+BR_BALANCE.playerHeight&&
      block.position.y-block.size.y/2<lift.target.y+BR_BALANCE.playerHeight&&
      Math.abs(block.position.x-lift.position.x)<block.size.x/2+radius&&
      Math.abs(block.position.z-lift.position.z)<block.size.z/2+radius);
    expect(obstacles.map(block=>block.id)).toEqual([]);
  });
  it.each([30,60])(`${lift.id} reaches its authored height with authoritative/predicted collision at %i Hz`,frequency=>{
    const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
    try{
      let motion:BrMotionState={position:{...lift.position,y:lift.position.y+.035},velocity:{x:0,y:0,z:0},yaw:0,grounded:true,crouched:false,deployment:"grounded",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0};
      let predicted=structuredClone(motion),peak=motion.position.y,launches=0;
      for(let frame=0;frame<frequency*2;frame++){
        const input={moveX:0,moveY:0,yaw:0,jump:false,sprint:false,crouch:false};
        motion=stepBrMovement(motion,input,1/frequency,1000+frame*1000/frequency,(p,d,o)=>authority.move("pilot",p,d,o.jumping,o.crouched));
        predicted=stepBrMovement(predicted,input,1/frequency,1000+frame*1000/frequency,(p,d,o)=>prediction.move(p,d,o.jumping,o.crouched));
        if(motion.traversed)launches++;
        peak=Math.max(peak,motion.position.y);
        expect(Math.hypot(motion.position.x-predicted.position.x,motion.position.y-predicted.position.y,motion.position.z-predicted.position.z)).toBeLessThan(.001);
      }
      expect(peak).toBeGreaterThanOrEqual(lift.target.y-.25);
      expect(peak).toBeLessThanOrEqual(lift.target.y+2);
      expect(launches).toBe(1);
    }finally{authority.dispose();prediction.dispose();}
  });
}
