import type {PgGunState} from "./types.js";
import type {PgCombatModifiers} from "./modes.js";
export const PG_CINDER_HEAT=Object.freeze({heatPerShot:.035,heatCoolingPerSecond:.3,overheatMs:900});
/** A resolved hero profile, separate from the immutable canonical weapon profiles. */
export function pgCoolModeGun(gun:PgGunState,modifiers:PgCombatModifiers,now:number):void{
 if(!modifiers.heatPerShot||!modifiers.heatCoolingPerSecond)return;
 const elapsed=Math.max(0,now-(gun.heatUpdatedAt??now))/1000;gun.heat=Math.max(0,(gun.heat??0)-elapsed*modifiers.heatCoolingPerSecond*(modifiers.coolingMultiplier??1));gun.heatUpdatedAt=now;
}
export function pgHeatModeGun(gun:PgGunState,modifiers:PgCombatModifiers,now:number):void{
 if(!modifiers.heatPerShot)return;gun.heat=Math.min(1,(gun.heat??0)+modifiers.heatPerShot);gun.heatUpdatedAt=now;if(gun.heat>=1-1e-9)gun.overheatedUntil=now+(modifiers.overheatMs??900);
}
