import {PG_BALANCE as B} from "./balance.js";
import {pgRayBox} from "./math.js";
import type {PgInput,PgMap,PgMotion} from "./types.js";

export const PG_LEAN={distance:.32,drop:.04,response:16,roll:.1} as const;
/** A lean moves the exposed upper body; the feet/movement capsule remain unchanged. */
export function pgLeanOffset(p:Pick<PgMotion,"yaw"|"lean">){
 const lean=Number.isFinite(p.lean)?Math.max(-1,Math.min(1,p.lean)):0;
 return {x:Math.cos(p.yaw)*PG_LEAN.distance*lean,y:-Math.abs(lean)*PG_LEAN.drop,z:-Math.sin(p.yaw)*PG_LEAN.distance*lean};
}
export function pgLeanEye(p:Pick<PgMotion,"position"|"yaw"|"lean"|"crouched">){
 const offset=pgLeanOffset(p);return {x:p.position.x+offset.x,y:p.position.y+(p.crouched?B.crouchEye:B.eye)+offset.y,z:p.position.z+offset.z};
}
/** Sweep the actual head and upper torso envelopes, including the camera inside the head. */
export function pgStepLean(p:PgMotion,input:PgInput,dt:number,map:PgMap,enabled:boolean){
 if(!enabled||!p.grounded||p.mode!=="ground"||input.sprint){p.lean=0;return;}
 const target=Math.hypot(p.velocity.x,p.velocity.z)<=4.6?(input.lean??0):0,current=Number.isFinite(p.lean)?p.lean:0;
 const proposed=current+(target-current)*(1-Math.exp(-dt*PG_LEAN.response));
 if(Math.abs(proposed)<.001){p.lean=0;return;}
 const offset=pgLeanOffset({yaw:p.yaw,lean:proposed});let fraction=1;
 for(const [height,radius,weight]of [[p.crouched?1.28:1.49,.43,1],[p.crouched ? .9 : 1.08,.4,.65]]as const){
  const origin={x:p.position.x,y:p.position.y+height,z:p.position.z},delta={x:offset.x*weight,y:offset.y*weight,z:offset.z*weight},length=Math.hypot(delta.x,delta.y,delta.z);
  if(length<1e-6)continue;const direction={x:delta.x/length,y:delta.y/length,z:delta.z/length};
  for(const solid of map.solids){
   const hit=pgRayBox(origin,direction,{...solid,half:{x:solid.half.x+radius,y:solid.half.y+radius,z:solid.half.z+radius}});
   if(hit!==null&&hit<=length)fraction=Math.min(fraction,Math.max(0,(hit-.01)/length));
  }
 }
 p.lean=Math.abs(proposed*fraction)<.001?0:proposed*fraction;
}
