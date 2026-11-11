import type {Vec3} from "../index.js";
import type {PgSolid} from "./types.js";
export const pgClamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function pgAim(yaw:number,pitch:number):Vec3{return {x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};}
/** Slab intersection in world units; direction must be normalized. */
export function pgRayBox(origin:Vec3,direction:Vec3,box:PgSolid):number|null {
 let near=0,far=Infinity;
 // Explicit slabs avoid allocating/iterating an axis array and dynamic property
 // lookups in the visibility hot path. Keep parallel/tangent/inside semantics.
 const lx=box.center.x-box.half.x,hx=box.center.x+box.half.x;
 if(Math.abs(direction.x)<1e-9){if(origin.x<lx||origin.x>hx)return null;}
 else {const a=(lx-origin.x)/direction.x,b=(hx-origin.x)/direction.x;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return null;}
 const ly=box.center.y-box.half.y,hy=box.center.y+box.half.y;
 if(Math.abs(direction.y)<1e-9){if(origin.y<ly||origin.y>hy)return null;}
 else {const a=(ly-origin.y)/direction.y,b=(hy-origin.y)/direction.y;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return null;}
 const lz=box.center.z-box.half.z,hz=box.center.z+box.half.z;
 if(Math.abs(direction.z)<1e-9){if(origin.z<lz||origin.z>hz)return null;}
 else {const a=(lz-origin.z)/direction.z,b=(hz-origin.z)/direction.z;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return null;}
 return far>=0?near:null;
}
export function pgRaySphere(o:Vec3,d:Vec3,c:Vec3,r:number):number|null {const x=o.x-c.x,y=o.y-c.y,z=o.z-c.z,b=x*d.x+y*d.y+z*d.z,q=b*b-x*x-y*y-z*z+r*r;if(q<0)return null;const n=-b-Math.sqrt(q),f=-b+Math.sqrt(q);return n>=0?n:f>=0?f:null;}
export function pgPilotHit(o:Vec3,d:Vec3,feet:Vec3,crouched:boolean,lean?:Vec3):{distance:number;headshot:boolean}|null {
 const head=pgRaySphere(o,d,{x:feet.x+(lean?.x??0),y:feet.y+(crouched?1.28:1.49)+(lean?.y??0),z:feet.z+(lean?.z??0)},.43);
 let body=Infinity,index=0;for(const y of crouched?[.3,.6,.9]:[.35,.72,1.08]){const weight=index++===0?0:index===2 ? .3 : .65,t=pgRaySphere(o,d,{x:feet.x+(lean?.x??0)*weight,y:feet.y+y+(lean?.y??0)*weight,z:feet.z+(lean?.z??0)*weight},.4);if(t!==null)body=Math.min(body,t);}
 if(head!==null&&head<body)return {distance:head,headshot:true};return Number.isFinite(body)?{distance:body,headshot:false}:null;
}
export function pgHash(seed:number):number {let x=Math.imul(seed^(seed>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return (x^(x>>>16))>>>0;}
export function pgShotAim(yaw:number,pitch:number,spread:number,seed:number):Vec3 {return pgAim(yaw+((pgHash(seed)%10001)/5000-1)*spread,pitch+((pgHash(seed+17)%10001)/5000-1)*spread);}
