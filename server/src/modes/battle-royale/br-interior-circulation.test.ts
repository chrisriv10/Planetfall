import {expect,it} from 'vitest';
import {BR_STRUCTURES,BR_MAP_BLOCKS,BR_BALANCE,stepBrMovement,type BrMotionState} from '@planetfall/shared';
import {BrPhysicsWorld} from './br-physics.js';
import {BrPredictionPhysics} from '../../../../client/src/modes/battle-royale/br-physics.js';

it('walks every interior stair flight continuously in both directions with supported landings and prediction parity',()=>{
 const physics=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();let flights=0;
 try{
  for(const structure of BR_STRUCTURES.filter(s=>s.enterable&&s.floors>1)){
   for(let floor=1;floor<structure.floors;floor++)for(const reverse of [false,true]){
    const ramp=BR_MAP_BLOCKS.find(b=>b.id===`${structure.id}-stairs-${floor}`)!;
    const run=ramp.size.z*Math.cos(ramp.rotation!.x),rise=structure.size.y/structure.floors;
    const low=structure.position.y+(floor-1)*rise,lowFeet=low+(floor===1?.395:.21);
    let feet={x:ramp.position.x,y:reverse?low+rise+.21:lowFeet,z:ramp.position.z+(reverse?-1:1)*(run/2+.35)};
    let predicted={...feet},arrived=false;
    const target={x:feet.x,y:reverse?lowFeet:low+rise+.21,z:ramp.position.z+(reverse?1:-1)*(run/2+.35)};
    for(let frame=0;frame<1200;frame++){
     const dz=target.z-feet.z,desired={x:0,y:-.1,z:Math.sign(dz)*Math.min(.12,Math.abs(dz))};
     const a=physics.move('stair-review',feet,desired,false),b=prediction.move(predicted,desired,false);
     feet={x:feet.x+a.movement.x,y:feet.y+a.movement.y,z:feet.z+a.movement.z};
     predicted={x:predicted.x+b.movement.x,y:predicted.y+b.movement.y,z:predicted.z+b.movement.z};
     const label=`${structure.id} floor ${floor} ${reverse?'down':'up'}`;
     expect(Math.hypot(feet.x-predicted.x,feet.y-predicted.y,feet.z-predicted.z),label).toBeLessThan(.001);
     expect(physics.rayDistance({...feet,y:feet.y+1},{x:0,y:-1,z:0},3)-1,label).toBeLessThan(.45);
     if(Math.abs(dz)<.05&&a.grounded){expect(Math.abs(feet.y-target.y),label).toBeLessThan(.15);arrived=true;break;}
    }
    expect(arrived,`${structure.id} floor ${floor}, reverse=${reverse}`).toBe(true);flights++;
   }
  }
  expect(flights).toBe(130);
 }finally{prediction.dispose();physics.dispose();}
});

it('ends interior partitions beside the stairwell and supports both ends of each upper-floor opening',()=>{
 for(const s of BR_STRUCTURES.filter(s=>s.enterable&&s.floors>1)){
  const stairX=s.position.x+s.size.x*.27,opening=Math.min(5.2,s.size.x*.22);
  for(const wall of BR_MAP_BLOCKS.filter(b=>b.id.startsWith(`${s.id}-room-`))){
   expect(Math.abs(wall.position.x-stairX)-wall.size.x/2,s.id).toBeGreaterThanOrEqual(opening/2+.55-1e-9);
  }
  for(let floor=1;floor<s.floors;floor++){
   for(const suffix of ['landing','lower-landing']){
    const landing=BR_MAP_BLOCKS.find(b=>b.id===`${s.id}-deck-${floor}-${suffix}`)!;
    expect(landing,s.id).toBeDefined();expect(landing.size.x).toBe(opening);
    expect(landing.position.y).toBeCloseTo(s.position.y+floor*s.size.y/s.floors,8);
   }
  }
 }
});

it('keeps production movement supported on every interior stair at server and render tick rates',()=>{
 const physics=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
 try{
  for(const dt of [1/30,1/60,.1])for(const sprint of [false,true])for(const s of BR_STRUCTURES.filter(s=>s.enterable&&s.floors>1)){
   for(let floor=1;floor<s.floors;floor++)for(const reverse of [false,true]){
    const ramp=BR_MAP_BLOCKS.find(b=>b.id===`${s.id}-stairs-${floor}`)!;
    const run=ramp.size.z*Math.cos(ramp.rotation!.x),rise=s.size.y/s.floors;
    const low=s.position.y+(floor-1)*rise,lowFeet=low+(floor===1?.395:.21);
    let state:BrMotionState={position:{x:ramp.position.x,y:reverse?low+rise+.21:lowFeet,z:ramp.position.z+(reverse?-1:1)*(run/2+.35)},
     velocity:{x:0,y:0,z:(reverse?1:-1)*(sprint?BR_BALANCE.sprintSpeed:BR_BALANCE.walkSpeed)},yaw:reverse?Math.PI:0,grounded:true,crouched:false,deployment:'grounded',downed:false,
     lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0};
    let predicted={...state,position:{...state.position},velocity:{...state.velocity}},arrived=false;
    const target=ramp.position.z+(reverse?1:-1)*(run/2+.35),label=`${s.id}/${floor}/${reverse?'down':'up'}/${dt}/${sprint?'sprint':'walk'}`;
    for(let frame=0;frame<2400;frame++){
     const remaining=Math.abs(target-state.position.z),input={moveX:0,moveY:Math.sign((target-state.position.z)*(reverse?1:-1))*Math.min(1,remaining/.4),yaw:state.yaw,jump:false,sprint,crouch:false};
     state=stepBrMovement(state,input,dt,10000+frame*dt*1000,(p,d,o)=>physics.move('production-stair',p,d,o.jumping,o.crouched));
     predicted=stepBrMovement(predicted,input,dt,10000+frame*dt*1000,(p,d,o)=>prediction.move(p,d,o.jumping,o.crouched));
     expect(Math.hypot(state.position.x-predicted.position.x,state.position.y-predicted.position.y,state.position.z-predicted.position.z),label).toBeLessThan(.001);
     expect(physics.rayDistance({...state.position,y:state.position.y+1},{x:0,y:-1,z:0},3)-1,`${label} frame ${frame}: ${JSON.stringify(state)}`).toBeLessThan(.45);
     // A capsule leaving the upper ramp lip may lose the grounded flag for
     // a contact frame, but must remain within the existing .18m snap range.
     if(!state.grounded){
      expect(physics.rayDistance({...state.position,y:state.position.y+1},{x:0,y:-1,z:0},3)-1,`${label} frame ${frame}: ${JSON.stringify(state)}`).toBeLessThan(.18);
      expect(state.velocity.y,label).toBeLessThanOrEqual(0);
     }
     if(Math.abs(target-state.position.z)<.05&&state.grounded){arrived=true;expect(Math.abs(state.position.y-(reverse?lowFeet:low+rise+.21)),label).toBeLessThan(.15);break;}
    }
    expect(arrived,`${label}: ${JSON.stringify(state.position)}`).toBe(true);
   }
  }
 }finally{prediction.dispose();physics.dispose();}
});
