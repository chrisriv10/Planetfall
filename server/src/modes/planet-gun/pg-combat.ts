import {PG_BALANCE as B,PG_MAP,pgGunProfile,pgUpdateGunHeat,pgDamage,pgFinishReload,pgPilotHit,pgRayBox,pgShotAim,pgSpread,type PgFireRequest,type PgPlayer,type PgShot} from "@planetfall/shared";
import {PgHistory} from "./pg-history.js";

/** No client origin, damage, target or ammunition is trusted. */
export class PgCombat {
  readonly history=new PgHistory();
  private sequences=new Map<string,number>();
  private shotId=0;
  fire(shooter:PgPlayer,raw:PgFireRequest,players:Iterable<PgPlayer>,now:number):PgShot[] {
    if(!raw||!Number.isSafeInteger(raw.sequence)||raw.sequence<0||raw.sequence<=(this.sequences.get(shooter.id)??-1)||!Number.isFinite(raw.clientTime)||raw.clientTime<now-B.rewindMs||raw.clientTime>now+50||!Number.isFinite(raw.yaw)||!Number.isFinite(raw.pitch)||Math.abs(raw.pitch)>1.45)return [];
    // Consume valid sequence numbers even on rejected cooldown packets; replay cannot become a later shot.
    this.sequences.set(shooter.id,raw.sequence);
    const gun=shooter.guns[shooter.slot],w=pgGunProfile(gun);
    pgFinishReload(gun,now);pgUpdateGunHeat(gun,now);
    const yawError=Math.atan2(Math.sin(raw.yaw-shooter.yaw),Math.cos(raw.yaw-shooter.yaw));
    if(shooter.hp<=0||!shooter.connected&&!shooter.isBot||raw.weapon!==gun.id||gun.reloadUntil||gun.magazine<=0||now<gun.nextFireAt||now<(gun.overheatedUntil??0)||now<shooter.fireReadyAt||shooter.mode==="sprint"||shooter.mode==="mantle"||Math.abs(yawError)>.25||Math.abs(raw.pitch-shooter.pitch)>.25)return [];
    gun.magazine--;gun.nextFireAt=now+w.intervalMs;gun.shots++;gun.recoil+=w.recoil;shooter.protectedUntil=0;
    if(w.burstShots){gun.burstRemaining=(gun.burstRemaining||w.burstShots)-1;if(!gun.burstRemaining)gun.nextFireAt=now+(w.burstRecoveryMs??w.intervalMs);}
    if(w.heatPerShot){gun.heat=Math.min(1,(gun.heat??0)+w.heatPerShot);gun.heatUpdatedAt=now;if(gun.heat>=1-1e-9){gun.heat=1;gun.overheatedUntil=now+(w.overheatMs??900);}}
    const origin={...shooter.position,y:shooter.position.y+(shooter.crouched?B.crouchEye:B.eye)};
    const ads=shooter.adsSince>0?Math.min(1,(now-shooter.adsSince)/w.adsMs):0;
    const spread=pgSpread(gun.id,ads,Math.hypot(shooter.velocity.x,shooter.velocity.z)>1,!shooter.grounded,gun.modules);
    const all=[...players],shots:PgShot[]=[];
    for(let pellet=0;pellet<w.pellets;pellet++){
      const direction=pgShotAim(raw.yaw,raw.pitch,spread,gun.shots*31+pellet);
      let nearest=w.range,target:PgPlayer|null=null,headshot=false;
      for(const solid of PG_MAP.solids){const t=pgRayBox(origin,direction,solid);if(t!==null&&t<nearest)nearest=t;}
      for(const p of all){
        if(p.id===shooter.id||p.hp<=0)continue;
        const historical=this.history.sample(p.id,p.lifeId,Math.min(now,raw.clientTime));
        // New lives cannot be targeted at an older timestamp using their current pose.
        if(!historical)continue;
        const hit=pgPilotHit(origin,direction,historical.position,historical.crouched);
        if(hit&&hit.distance<nearest){nearest=hit.distance;target=p;headshot=hit.headshot;}
      }
      let damage=0;
      // Friendly bodies occlude fire, but never receive damage.
      if(target&&target.team!==shooter.team&&now>=target.protectedUntil){
        damage=Math.min(target.hp,pgDamage(gun.id,nearest,headshot));target.hp-=damage;target.lastDamageAt=now;target.lastAttacker=shooter.id;
      }
      shots.push({id:++this.shotId,at:now,shooterId:shooter.id,weapon:gun.id,origin:{...origin},end:{x:origin.x+direction.x*nearest,y:origin.y+direction.y*nearest,z:origin.z+direction.z*nearest},targetId:damage?target!.id:null,damage,headshot:damage>0&&headshot});
    }
    return shots;
  }
  forget(id:string):void{this.sequences.delete(id);}
  clear():void{this.sequences.clear();this.history.clear();}
}
