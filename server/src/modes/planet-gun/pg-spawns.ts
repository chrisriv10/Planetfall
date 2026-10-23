import {PG_MAP,PG_BALANCE,pgAim,pgCapsuleClear,pgRayBox,type PgPlayer,type PgSpawn,type PgTeam,type Vec3} from "@planetfall/shared";

export interface PgSpawnDanger {position:Vec3;at:number;}
/** Score all authored anchors: permit a team-side flip when the home side is camped. */
export function pgChooseSpawn(team:PgTeam,players:Iterable<Pick<PgPlayer,"team"|"hp"|"position">>,danger:readonly PgSpawnDanger[],now:number):PgSpawn {
  const alive=[...players].filter(p=>p.hp>0);
  const candidates=PG_MAP.spawns.filter(s=>pgCapsuleClear(s.position,PG_BALANCE.height,PG_MAP));
  if(!candidates.length)throw new Error("Nova Block has no collision-clear spawn anchors");
  const score=(s:PgSpawn)=>{
    let value=s.team===team?12:0;
    for(const p of alive){
      const dx=p.position.x-s.position.x,dz=p.position.z-s.position.z,d=Math.hypot(dx,dz);
      if(p.team===team){if(d<2)value-=120;continue;}
      value+=Math.min(35,d)*.45;
      if(d<12)value-=(12-d)*12;
      if(d>.001){const direction=pgAim(Math.atan2(-dx,-dz),0),origin={...s.position,y:s.position.y+1.4};
        if(!PG_MAP.solids.some(b=>{const t=pgRayBox(origin,direction,b);return t!==null&&t<d;}))value-=65;
      }
    }
    for(const death of danger){const age=now-death.at;if(age>=0&&age<8000)value-=Math.max(0,18-Math.hypot(death.position.x-s.position.x,death.position.z-s.position.z))*(1-age/8000)*3;}
    return value;
  };
  return candidates.reduce((best,s)=>score(s)>score(best)?s:best);
}
