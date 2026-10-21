import type { Vec3 } from "../index.js";
import { PR_BALANCE as B } from "./balance.js";
import { prInsideTile,prObstacleTransform,prPlatformCenter,type PrTileState } from "./obstacles.js";
import type { PrInput,PrMotion,PrRoundDefinition } from "./types.js";

export function prSpawn(position:Vec3):PrMotion {
  return {position:{...position},velocity:{x:0,y:0,z:0},grounded:false,yaw:Math.PI,coyoteUntil:0,jumpBufferedUntil:0,diveUntil:0,diveReadyAt:0,jumpHeld:false,diveHeld:false,supportId:null};
}
export function prSanitizeInput(raw:unknown):PrInput|null {
  if(!raw||typeof raw!=="object")return null;
  const p=raw as PrInput;
  if(!Number.isSafeInteger(p.sequence)||p.sequence<0||!Number.isFinite(p.moveX)||!Number.isFinite(p.moveZ)||typeof p.jump!=="boolean"||typeof p.dive!=="boolean")return null;
  const length=Math.max(1,Math.hypot(p.moveX,p.moveZ));
  return {sequence:p.sequence,moveX:p.moveX/length,moveZ:p.moveZ/length,jump:p.jump,dive:p.dive};
}
const approach=(a:number,b:number,amount:number)=>a+Math.max(-amount,Math.min(amount,b-a));
/** Fixed-step shared kinematics. Input is a planar direction, never a position.
 * Platform tops and hex boundaries are the same authored data the renderer uses.
 * Call at <=1/30s; integration callers subdivide larger frame intervals. */
export function prStepMotion(state:PrMotion,input:PrInput,dt:number,elapsedMs:number,round:PrRoundDefinition,seed:number,tiles?:PrTileState):void {
  if(dt<=0||dt>1/30+1e-6)throw new Error("PlanetRun movement requires a bounded fixed step");
  const oldY=state.position.y;
  if(input.jump&&!state.jumpHeld)state.jumpBufferedUntil=elapsedMs+B.jumpBufferMs;
  if(state.grounded)state.coyoteUntil=elapsedMs+B.coyoteMs;
  state.jumpHeld=input.jump;
  const length=Math.hypot(input.moveX,input.moveZ);
  if(length>.05)state.yaw=Math.atan2(input.moveX,input.moveZ);
  if(input.dive&&!state.diveHeld&&elapsedMs>=state.diveReadyAt){
    const dx=length>.05?input.moveX/length:Math.sin(state.yaw),dz=length>.05?input.moveZ/length:Math.cos(state.yaw);
    state.velocity.x=dx*B.diveSpeed;state.velocity.z=dz*B.diveSpeed;
    state.velocity.y=Math.min(state.velocity.y,1.5);state.diveUntil=elapsedMs+B.diveDurationMs;state.diveReadyAt=elapsedMs+B.diveCooldownMs;
  }
  state.diveHeld=input.dive;
  if(state.jumpBufferedUntil>elapsedMs&&(state.grounded||state.coyoteUntil>elapsedMs)&&state.diveUntil<=elapsedMs){
    state.velocity.y=B.jumpSpeed;state.grounded=false;state.coyoteUntil=0;state.jumpBufferedUntil=0;
  }
  if(state.diveUntil<=elapsedMs){
    const acceleration=state.grounded?(length>.01?B.groundAcceleration:B.braking):B.airAcceleration;
    state.velocity.x=approach(state.velocity.x,input.moveX*B.runSpeed,acceleration*dt);
    state.velocity.z=approach(state.velocity.z,input.moveZ*B.runSpeed,acceleration*dt);
  }
  let gravity=1;
  const support=round.platforms.find(p=>p.id===state.supportId);
  if(support&&state.grounded){
    const previous=prPlatformCenter(support,elapsedMs-dt*1000),current=prPlatformCenter(support,elapsedMs);
    state.position.x+=current.x-previous.x+(support.conveyor?.x??0)*dt;
    state.position.z+=current.z-previous.z+(support.conveyor?.z??0)*dt;
    gravity=support.gravityScale??1;
  }else if(support)gravity=support.gravityScale??1;
  // Gravity zones extend above their authored deck while airborne. Support is
  // cleared after takeoff, so tying gravity only to support loses the zone.
  for(const p of round.platforms)if(p.gravityScale!==undefined){const c=prPlatformCenter(p,elapsedMs);
    if(Math.abs(state.position.x-c.x)<=p.half.x&&Math.abs(state.position.z-c.z)<=p.half.z&&state.position.y>=c.y+p.half.y-.1&&state.position.y<c.y+15)gravity=p.gravityScale;
  }
  state.velocity.y-=B.gravity*gravity*dt;
  state.position.x+=state.velocity.x*dt;state.position.y+=state.velocity.y*dt;state.position.z+=state.velocity.z*dt;
  // Platform side/underside collision uses the same authored box as its top.
  // A pilot below the rim cannot pass through a raised slab's visible sides.
  for(const p of round.platforms){
    const c=prPlatformCenter(p,elapsedMs),top=c.y+p.half.y,bottom=c.y-p.half.y;
    if(state.position.y>=top-.06||state.position.y+B.height<=bottom)continue;
    const dx=state.position.x-c.x,dz=state.position.z-c.z;
    if(Math.abs(dx)>=p.half.x+B.radius||Math.abs(dz)>=p.half.z+B.radius)continue;
    if(oldY+B.height<=bottom+.06&&state.velocity.y>0){state.position.y=bottom-B.height;state.velocity.y=0;continue;}
    if(oldY>=top-.06&&state.velocity.y<=0)continue;
    const px=p.half.x+B.radius-Math.abs(dx),pz=p.half.z+B.radius-Math.abs(dz);
    if(px<pz){state.position.x+=px*(Math.sign(dx)||1);state.velocity.x=0;}
    else {state.position.z+=pz*(Math.sign(dz)||1);state.velocity.z=0;}
  }
  state.grounded=false;state.supportId=null;
  let top=-Infinity,supportId:string|null=null;
  if(state.velocity.y<=0){
    for(const p of round.platforms){const c=prPlatformCenter(p,elapsedMs),y=c.y+p.half.y;
      if(Math.hypot(Math.max(0,Math.abs(state.position.x-c.x)-p.half.x),Math.max(0,Math.abs(state.position.z-c.z)-p.half.z))<=B.radius*.6&&oldY>=y-.06&&state.position.y<=y&&y>top){top=y;supportId=p.id;}
    }
    for(const tile of round.tiles)if((!tiles||tiles.intact(tile.id,elapsedMs))&&oldY>=tile.center.y-.06&&state.position.y<=tile.center.y&&tile.center.y>top&&prInsideTile(tile,state.position.x,state.position.z)){top=tile.center.y;supportId=`tile:${tile.id}`;}
  }
  if(supportId!==null){state.position.y=top;state.velocity.y=0;state.grounded=true;state.supportId=supportId;}
  for(const o of round.obstacles){
    const transform=prObstacleTransform(o,elapsedMs,seed);if(!transform.active)continue;
    const dx=state.position.x-o.center.x,dz=state.position.z-o.center.z;
    const angle=o.kind==="rotator"?transform.yaw:0,c=Math.cos(angle),s=Math.sin(angle),x=dx*c+dz*s,z=-dx*s+dz*c;
    const pilotY=state.position.y+B.height/2;
    if(Math.abs(x)>o.half.x+B.radius||Math.abs(z)>o.half.z+B.radius||Math.abs(pilotY-o.center.y)>o.half.y+B.height/2)continue;
    if(o.kind==="boost"){
      if(state.diveReadyAt>elapsedMs)continue;
      state.velocity.z=-o.strength;state.velocity.y=5;state.diveUntil=elapsedMs+400;state.diveReadyAt=elapsedMs+1000;continue;
    }
    // Resolve to the nearest face; bounded impulse cannot repeatedly accelerate.
    const px=o.half.x+B.radius-Math.abs(x),pz=o.half.z+B.radius-Math.abs(z);
    const nx=px<pz?Math.sign(x)||1:0,nz=px<pz?0:Math.sign(z)||1,depth=Math.min(px,pz);
    const wx=nx*c-nz*s,wz=nx*s+nz*c;
    state.position.x+=wx*depth;state.position.z+=wz*depth;
    state.velocity.x=wx*o.strength;state.velocity.z=wz*o.strength;
    if(o.kind!=="door")state.velocity.y=Math.max(state.velocity.y,3.5);
    state.diveUntil=Math.max(state.diveUntil,elapsedMs+160);
  }
}

export function prBump(a:PrMotion,b:PrMotion):void {
  if(Math.abs(a.position.y-b.position.y)>B.height*.8)return;
  const x=b.position.x-a.position.x,z=b.position.z-a.position.z,d=Math.hypot(x,z);
  if(d>=B.radius*2)return;
  const nx=d>.0001?x/d:1,nz=d>.0001?z/d:0,push=Math.min(B.bumpLimit,(B.radius*2-d)*.5);
  a.position.x-=nx*push;a.position.z-=nz*push;b.position.x+=nx*push;b.position.z+=nz*push;
}
