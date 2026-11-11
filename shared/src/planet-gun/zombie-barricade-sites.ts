import type {PgSolid} from "./types.js";
import type {Vec3} from "../index.js";

export const PG_ZOMBIE_BARRICADE_REPAIR_MS=1500;
export interface PgZombieBarricadeInstallation {
 id:string;name:string;position:Vec3;yaw:number;entry:Vec3;interaction:Vec3;
 boards:readonly {id:string;solid:PgSolid}[];
 posts:readonly {id:string;solid:PgSolid}[];
}
function site(id:string,name:string,x:number,z:number,axis:"x"|"z",entry:Vec3,interaction:Vec3):PgZombieBarricadeInstallation {
 return {id,name,position:{x,y:0,z},yaw:axis==="x"?Math.PI/2:0,entry,interaction,
  boards:[.5,1.1,1.7].map((y,i)=>({id:`barricade-${id}-board-${i+1}`,solid:{id:`solid-barricade-${id}-board-${i+1}`,kind:"structure",mantle:false,center:{x,y,z},half:axis==="x"?{x:.13,y:.12,z:1.35}:{x:1.35,y:.12,z:.13}}})),
  posts:([-1,1] as const).map((direction,i)=>{const postId=`installation-barricade-${id}-post-${i===0?"left":"right"}`;return {id:postId,solid:{id:postId,kind:"structure",mantle:false,center:{x:x+(axis==="z"?direction*1.47:0),y:1.1,z:z+(axis==="x"?direction*1.47:0)},half:axis==="x"?{x:.16,y:1.1,z:.12}:{x:.12,y:1.1,z:.16}}};}),
 };
}
/** Entry screens fit clear ground beneath the gallery, independently of access doors. */
export const PG_ZOMBIE_BARRICADE_SITES:readonly PgZombieBarricadeInstallation[]=[
 site("northeast","Northeast entry",-18,-19.3,"z",{x:-18,y:0,z:-19.95},{x:-16.8,y:0,z:-18.5}),
 site("northwest","Northwest entry",-33.2,-18.5,"x",{x:-34,y:0,z:-18.5},{x:-32.3,y:0,z:-16.6}),
 site("southeast","Southeast entry",-18,-4.5,"z",{x:-17,y:0,z:-3},{x:-18,y:0,z:-6}),
];
