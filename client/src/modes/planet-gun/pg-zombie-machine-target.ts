import {PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_FORGE_SITE,PG_ZOMBIE_TONIC_SOCKETS,PG_ZOMBIE_WALL_BUYS,type Vec3} from "@planetfall/shared";

const targets=[
 {kind:"arsenal" as const,site:PG_ZOMBIE_ARSENAL_SITE,radius:2.7},
 {kind:"forge" as const,site:PG_ZOMBIE_FORGE_SITE,radius:3},
 ...PG_ZOMBIE_TONIC_SOCKETS.map(site=>({kind:"tonic" as const,site,radius:2.7})),
 ...PG_ZOMBIE_WALL_BUYS.map(site=>({kind:"rack" as const,site,radius:2.7})),
];
/** Pick the nearest physical console before checking affordability; a neighboring
 * machine must never steal E merely because the intended purchase is unavailable. */
export function pgZombieMachineTarget(position:Vec3,visible:(at:Vec3)=>boolean=()=>true){
 let result:typeof targets[number]|null=null,best=Infinity;
 for(const target of targets){const at=target.site.interaction,distance=Math.hypot(position.x-at.x,position.y-at.y,position.z-at.z);
  if(distance<=target.radius&&distance<best&&visible(at)){best=distance;result=target;}
 }
 return result;
}
