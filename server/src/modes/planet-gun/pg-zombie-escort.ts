import {PG_BALANCE,pgCapsuleClear,type PgMap,type PgPlayer,type Vec3} from "@planetfall/shared";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

/** Stable world-space formation slots, shared only by this room's living roster. */
export class PgZombieEscort {
 private cached:{map:PgMap;anchorId:string;origin:Vec3;roster:string;goals:Map<string,Vec3>}|null=null;
 goal(player:PgPlayer,human:PgPlayer,bots:PgPlayer[],map:PgMap,navigation:PgZombieNavigation):Vec3|null {
  const ordered=[...bots].sort((a,b)=>a.id.localeCompare(b.id)),roster=ordered.map(p=>p.id).join("\0"),cached=this.cached;
  if(!cached||cached.map!==map||cached.anchorId!==human.id||cached.roster!==roster||distance(cached.origin,human.position)>.65){
   const goals=new Map<string,Vec3>(),origin={...human.position};
   for(let index=0;index<ordered.length;index++){
    const bot=ordered[index],preferred=index*2*Math.PI/Math.max(1,ordered.length),candidates=[];
    for(const radius of [3.2,2.7,3.8])for(let angle=0;angle<24;angle++){
     const theta=angle*Math.PI/12,delta=Math.abs(Math.atan2(Math.sin(theta-preferred),Math.cos(theta-preferred)));
     candidates.push({point:{x:origin.x+Math.cos(theta)*radius,y:origin.y,z:origin.z+Math.sin(theta)*radius},score:delta+Math.abs(radius-3.2)});
    }
    candidates.sort((a,b)=>a.score-b.score);
    const slot=candidates.find(({point})=>pgCapsuleClear(point,PG_BALANCE.height,map)&&navigation.supported(point)&&[...goals.values()].every(other=>distance(point,other)>=2.4)&&navigation.reachable(origin,point)&&navigation.reachable(bot.position,point));
    if(slot)goals.set(bot.id,slot.point);
   }
   this.cached={map,anchorId:human.id,origin,roster,goals};
  }
  const slot=this.cached!.goals.get(player.id);
  if(slot&&distance(slot,human.position)>=2&&navigation.reachable(player.position,slot))return {...slot};
  // A sealed or crowded court must never turn an unavailable slot into a
  // direct goal at the human, or into movement through a blocking solid.
  return distance(player.position,human.position)>.01&&pgCapsuleClear(player.position,PG_BALANCE.height,map)&&navigation.supported(player.position)?{...player.position}:null;
 }
}
