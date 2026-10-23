import type {Vec3} from "../index.js";
import type {PgSolid} from "./types.js";
export const pgClamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function pgAim(yaw:number,pitch:number):Vec3{return {x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};}
/** Slab intersection in world units; direction must be normalized. */
export function pgRayBox(origin:Vec3,direction:Vec3,box:PgSolid):number|null {
 let near=0,far=Infinity;
 for(const k of ["x","y","z"] as const){const low=box.center[k]-box.half[k],high=box.center[k]+box.half[k];if(Math.abs(direction[k])<1e-9){if(origin[k]<low||origin[k]>high)return null;continue;}let a=(low-origin[k])/direction[k],b=(high-origin[k])/direction[k];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;}
 return far>=0?near:null;
}
export function pgRaySphere(o:Vec3,d:Vec3,c:Vec3,r:number):number|null {const x=o.x-c.x,y=o.y-c.y,z=o.z-c.z,b=x*d.x+y*d.y+z*d.z,q=b*b-x*x-y*y-z*z+r*r;if(q<0)return null;const n=-b-Math.sqrt(q),f=-b+Math.sqrt(q);return n>=0?n:f>=0?f:null;}
export function pgPilotHit(o:Vec3,d:Vec3,feet:Vec3,crouched:boolean):{distance:number;headshot:boolean}|null {
 const head=pgRaySphere(o,d,{x:feet.x,y:feet.y+(crouched?1.28:1.49),z:feet.z},.43);
 let body=Infinity;for(const y of crouched?[.3,.6,.9]:[.35,.72,1.08]){const t=pgRaySphere(o,d,{x:feet.x,y:feet.y+y,z:feet.z},.4);if(t!==null)body=Math.min(body,t);}
 if(head!==null&&head<body)return {distance:head,headshot:true};return Number.isFinite(body)?{distance:body,headshot:false}:null;
}
export function pgHash(seed:number):number {let x=Math.imul(seed^(seed>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return (x^(x>>>16))>>>0;}
export function pgShotAim(yaw:number,pitch:number,spread:number,seed:number):Vec3 {return pgAim(yaw+((pgHash(seed)%10001)/5000-1)*spread,pitch+((pgHash(seed+17)%10001)/5000-1)*spread);}
