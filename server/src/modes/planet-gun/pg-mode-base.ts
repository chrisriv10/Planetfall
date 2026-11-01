import {PG_DEFAULT_MOVEMENT_RULES,type PgModePilot,type PgPlayer,type PgTeam,type PgModeActionResult,type Vec3} from "@planetfall/shared";
import type {PgModeContext} from "./pg-mode-runtime.js";
export const pgOtherTeam=(t:PgTeam):PgTeam=>t==="solar"?"void":"solar";
export const pgModeDistance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export const pgModePilot=(p:PgPlayer,maxHp=100):PgModePilot=>({life:"alive",maxHp,shield:0,characterId:null,side:p.team==="solar"?"attack":"defend",credits:0,armor:0,cooldowns:[0,0],charges:[0,0],ultimate:0,contribution:0,interaction:null});
export const pgModeOk=():PgModeActionResult=>({ok:true});
export const pgModeError=(error:string):PgModeActionResult=>({ok:false,error});
export function pgRawModeDamage(p:PgPlayer,state:PgModePilot,amount:number,now:number,attacker:PgPlayer|null):number{
 if(state.life!=="alive"||p.hp<=0||now<p.protectedUntil||!Number.isFinite(amount)||amount<=0||attacker?.team===p.team)return 0;
 const absorbed=Math.min(state.shield,amount);state.shield-=absorbed;amount-=absorbed;
 const armor=Math.min(state.armor,amount*.3);state.armor-=armor;amount-=armor;
 const hp=Math.min(p.hp,amount);p.hp-=hp;p.lastDamageAt=now;p.lastAttacker=attacker?.id??null;state.interaction=null;return hp+absorbed+armor;
}
export function pgModeSpawn(ctx:PgModeContext,p:PgPlayer,now:number,maxHp:number){ctx.respawn(p,now);p.hp=maxHp;p.protectedUntil=now+1000;}
export const pgDefaultRules=PG_DEFAULT_MOVEMENT_RULES;
