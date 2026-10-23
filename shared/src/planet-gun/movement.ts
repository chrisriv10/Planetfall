import type {Vec3} from "../index.js";
import {PG_BALANCE as B} from "./balance.js";
import {PG_MAP} from "./map.js";
import {pgClamp} from "./math.js";
import type {PgInput,PgMap,PgMotion,PgSolid} from "./types.js";
const approach=(a:number,b:number,n:number)=>a+pgClamp(b-a,-n,n);
export function pgSpawnMotion(position:Vec3,yaw=0):PgMotion{return {position:{...position},velocity:{x:0,y:0,z:0},yaw,pitch:0,grounded:false,crouched:false,ion:100,launchY:position.y,jumpHeld:false,coyoteUntil:0,jumpBufferUntil:0,lastJumpAt:-1000,slideUntil:0,slideReadyAt:0,wallId:null,wallNormal:{x:0,y:0,z:0},wallUntil:0,wallReadyAt:0,mantleFrom:null,mantleTo:null,mantleStart:0,mantleUntil:0,mode:"air"};}
export function pgSanitizeInput(raw:unknown):PgInput|null {if(!raw||typeof raw!=="object")return null;const p=raw as PgInput;if(!Number.isSafeInteger(p.sequence)||p.sequence<0||![p.moveX,p.moveZ,p.yaw,p.pitch].every(Number.isFinite)||![p.jump,p.sprint,p.crouch,p.ads].every(v=>typeof v==="boolean"))return null;const n=Math.max(1,Math.hypot(p.moveX,p.moveZ));return {sequence:p.sequence,moveX:p.moveX/n,moveZ:p.moveZ/n,yaw:Math.atan2(Math.sin(p.yaw),Math.cos(p.yaw)),pitch:pgClamp(p.pitch,-1.45,1.45),jump:p.jump,sprint:p.sprint,crouch:p.crouch,ads:p.ads};}
export function pgCapsuleClear(position:Vec3,height:number,map:PgMap=PG_MAP,ignore?:string):boolean{return !map.solids.some(b=>b.id!==ignore&&position.y<b.center.y+b.half.y-.025&&position.y+height>b.center.y-b.half.y+.025&&Math.abs(position.x-b.center.x)<b.half.x+B.radius-.02&&Math.abs(position.z-b.center.z)<b.half.z+B.radius-.02);}
function overlapXZ(p:Vec3,b:PgSolid,r:number=B.radius):boolean{return Math.hypot(Math.max(0,Math.abs(p.x-b.center.x)-b.half.x),Math.max(0,Math.abs(p.z-b.center.z)-b.half.z))<=r;}
function wallContact(p:PgMotion,map:PgMap):{box:PgSolid;normal:Vec3}|null {
 for(const b of map.solids){if(!b.wallRunFaces||p.position.y+1<b.center.y-b.half.y||p.position.y>b.center.y+b.half.y-.3)continue;
  for(const f of b.wallRunFaces){const axis=f[0] as "x"|"z",other=axis==="x"?"z":"x",sign=f[1]==="+"?1:-1;
   const distance=(p.position[axis]-b.center[axis])*sign-b.half[axis];
   if(distance>=B.radius-.15&&distance<=B.radius+.35&&Math.abs(p.position[other]-b.center[other])<b.half[other]-.35&&b.half[other]>3){const normal={x:0,y:0,z:0};normal[axis]=sign;return {box:b,normal};}
  }
 }
 return null;
}
function beginMantle(p:PgMotion,dx:number,dz:number,at:number,map:PgMap):boolean {
 if(Math.hypot(dx,dz)<.1)return false;
 const reach={x:p.position.x+dx*.65,y:p.position.y,z:p.position.z+dz*.65};
 for(const b of map.solids){const top=b.center.y+b.half.y,rise=top-p.position.y;
  if(!b.mantle||b.half.x<.7||b.half.z<.7||rise<.35||rise>B.mantleHeight||!overlapXZ(reach,b))continue;
  const target={x:pgClamp(reach.x,b.center.x-b.half.x+B.radius+.05,b.center.x+b.half.x-B.radius-.05),y:top,z:pgClamp(reach.z,b.center.z-b.half.z+B.radius+.05,b.center.z+b.half.z-B.radius-.05)};
  if(Math.abs(target.x)>map.halfWidth-B.radius||Math.abs(target.z)>map.halfDepth-B.radius||!pgCapsuleClear(target,B.height,map,b.id))continue;
  p.mantleFrom={...p.position};p.mantleTo=target;p.mantleStart=at;p.mantleUntil=at+B.mantleMs;p.mode="mantle";p.wallId=null;return true;
 }
 return false;
}
/** Identical bounded kinematics for authority and prediction. Feet position is the collider origin. */
export function pgStepMovement(p:PgMotion,input:PgInput,dt:number,at:number,map:PgMap=PG_MAP):void {
 if(!Number.isFinite(dt)||dt<=0||dt>1/30+1e-6)throw new Error("PlanetGun requires a bounded fixed step");
 p.yaw=input.yaw;p.pitch=input.pitch;
 const jumpEdge=input.jump&&!p.jumpHeld;p.jumpHeld=input.jump;
 if(jumpEdge)p.jumpBufferUntil=at+B.jumpBufferMs;
 if(p.mantleTo&&p.mantleFrom){const t=pgClamp((at-p.mantleStart)/B.mantleMs,0,1),ease=t*t*(3-2*t);p.position={x:p.mantleFrom.x+(p.mantleTo.x-p.mantleFrom.x)*ease,y:p.mantleFrom.y+(p.mantleTo.y-p.mantleFrom.y)*ease,z:p.mantleFrom.z+(p.mantleTo.z-p.mantleFrom.z)*ease};p.mode="mantle";if(t>=1){p.mantleTo=null;p.mantleFrom=null;p.grounded=true;p.velocity.y=0;}return;}
 if(p.grounded){p.coyoteUntil=at+B.coyoteMs;p.launchY=p.position.y;}
 const c=Math.cos(input.yaw),s=Math.sin(input.yaw),dx=input.moveX*c+input.moveZ*s,dz=-input.moveX*s+input.moveZ*c,moving=Math.hypot(dx,dz)>.05;
 const speed=Math.hypot(p.velocity.x,p.velocity.z);
 if(p.grounded&&input.sprint&&input.crouch&&speed>7&&at>=p.slideReadyAt){p.slideUntil=at+B.slideMs;p.slideReadyAt=at+B.slideCooldownMs;}
 const sliding=at<p.slideUntil;
 p.crouched=(input.crouch||sliding)||!pgCapsuleClear(p.position,B.height,map);
 if(p.jumpBufferUntil>at&&(p.grounded||p.coyoteUntil>at)&&pgCapsuleClear(p.position,B.height,map)){
  p.velocity.y=B.jumpSpeed;p.grounded=false;p.crouched=false;p.coyoteUntil=0;p.jumpBufferUntil=0;p.lastJumpAt=at;p.slideUntil=0;
 }
 if(jumpEdge&&p.wallId){p.velocity.x+=p.wallNormal.x*5.5;p.velocity.z+=p.wallNormal.z*5.5;p.velocity.y=7.6;p.ion=Math.max(0,p.ion-8);p.wallId=null;p.wallReadyAt=at+450;p.lastJumpAt=at;}
 if(p.wallId&&(at>=p.wallUntil||p.ion<=0||p.grounded)){p.wallId=null;p.wallReadyAt=at+450;}
 const wall=!p.grounded&&at>=p.wallReadyAt&&speed>6.5&&p.ion>10?wallContact(p,map):null;
 if(wall){const inward=p.velocity.x*wall.normal.x+p.velocity.z*wall.normal.z,tangent=Math.abs(p.velocity.x*wall.normal.z-p.velocity.z*wall.normal.x);
  if(inward<-.3||tangent>6){if(p.wallId!==wall.box.id)p.wallUntil=at+B.wallMs;p.wallId=wall.box.id;p.wallNormal=wall.normal;p.velocity.x-=inward*wall.normal.x;p.velocity.z-=inward*wall.normal.z;}
 }else if(p.wallId){p.wallId=null;p.wallReadyAt=at+200;}
 const thrust=!p.grounded&&!p.wallId&&input.jump&&at-p.lastJumpAt>=120&&p.ion>0&&p.position.y<p.launchY+B.maxJumpRise;
 // Wall assistance slows descent, but must not preserve jump ascent as a lift.
 if(p.wallId){p.velocity.y=Math.max(-1.2,p.velocity.y-B.gravity*(p.velocity.y>0?1:.15)*dt);p.ion=Math.max(0,p.ion-B.wallDrain*dt);p.mode="wall-run";}
 else {p.velocity.y-=(B.gravity-(thrust?B.thrustAcceleration:0))*dt;if(thrust)p.ion=Math.max(0,p.ion-B.thrustDrain*dt);else p.ion=Math.min(100,p.ion+(p.grounded?B.ionRegen:4)*dt);p.mode=p.grounded?(sliding?"slide":input.sprint&&!input.ads&&!p.crouched?"sprint":"ground"):"air";}
 if(sliding&&p.grounded){const n=Math.max(.01,speed),next=Math.max(0,speed-4.5*dt);p.velocity.x=p.velocity.x/n*next+dx*dt*1.4;p.velocity.z=p.velocity.z/n*next+dz*dt*1.4;}
 else if(!p.wallId){const targetSpeed=p.crouched?B.crouchSpeed:input.sprint&&!input.ads?B.sprintSpeed:input.ads?B.runSpeed*.7:B.runSpeed,accel=p.grounded?(moving?B.acceleration:B.braking):B.airAcceleration;p.velocity.x=approach(p.velocity.x,dx*targetSpeed,accel*dt);p.velocity.z=approach(p.velocity.z,dz*targetSpeed,accel*dt);}
 let n=Math.hypot(p.velocity.x,p.velocity.z);if(n>B.maxSpeed){p.velocity.x*=B.maxSpeed/n;p.velocity.z*=B.maxSpeed/n;}
 let oldY=p.position.y;const height=p.crouched?B.crouchHeight:B.height;
 for(const axis of ["x","z"] as const){if(Math.abs(p.velocity[axis])<1e-8)continue;p.position[axis]+=p.velocity[axis]*dt;
  for(const b of map.solids){const top=b.center.y+b.half.y,bottom=b.center.y-b.half.y;
   if(p.position.y>=top-.04||p.position.y+height<=bottom+.02||!overlapXZ(p.position,b,B.radius-.01))continue;
   // Small stair steps are traversable only with clear standing headroom.
   if(p.grounded&&top-p.position.y<=.4+1e-6&&top>p.position.y){const raised={...p.position,y:top};if(pgCapsuleClear(raised,height,map,b.id)){p.position.y=top;oldY=Math.max(oldY,top);continue;}}
   if(!p.grounded&&input.jump&&beginMantle(p,dx,dz,at,map))return;
   const other=axis==="x"?"z":"x";if(Math.abs(p.position[other]-b.center[other])>=b.half[other]+B.radius-.02)continue;
   p.position[axis]=b.center[axis]+(Math.sign(p.position[axis]-b.center[axis])||1)*(b.half[axis]+B.radius);p.velocity[axis]=0;
  }
 }
 p.position.y+=p.velocity.y*dt;p.grounded=false;
 let support=-Infinity;
 for(const b of map.solids){if(!overlapXZ(p.position,b,B.radius*.65))continue;const top=b.center.y+b.half.y,bottom=b.center.y-b.half.y;
  if(p.velocity.y<=0&&oldY>=top-.07&&p.position.y<=top&&top>support)support=top;
  if(p.velocity.y>0&&oldY+height<=bottom+.03&&p.position.y+height>=bottom){p.position.y=bottom-height;p.velocity.y=0;}
 }
 if(Number.isFinite(support)){p.position.y=support;p.velocity.y=0;p.grounded=true;p.wallId=null;}
 p.ion=pgClamp(p.ion,0,100);
}
