import type {PgPlayer} from "@planetfall/shared";

const PERIPHERAL_COSINE=Math.cos(70*Math.PI/180);
/** Awareness is distinct from line of sight: every candidate must still pass world occlusion. */
export function pgBotAware(observer:PgPlayer,target:PgPlayer,now:number):boolean {
 const dx=target.position.x-observer.position.x,dz=target.position.z-observer.position.z,range=Math.hypot(dx,dz);
 // Actual recent incoming damage permits a turn toward the attacker, not knowledge
 // of every opponent behind the pilot. Spawn timestamps alone confer no awareness.
 if(observer.lastAttacker===target.id&&now>=observer.lastDamageAt&&now-observer.lastDamageAt<=1500)return true;
 if(range<1)return true;
 // Nearby running can be heard. Quiet/crouched opponents retain a useful flank.
 if(range<=6&&!target.crouched&&Math.hypot(target.velocity?.x??0,target.velocity?.z??0)>1)return true;
 return (-Math.sin(observer.yaw)*dx-Math.cos(observer.yaw)*dz)/range>=PERIPHERAL_COSINE;
}
