import type {PgZombiePilot} from "@planetfall/shared";

/** Translate mode-owned survival into HUD values; HP remains the ordinary-mode input. */
export function pgVitalPresentation(hp:number,maxHp:number,zombie?:Pick<PgZombiePilot,"hitCount"|"hitCapacity"|"life">){
 if(zombie&&Number.isFinite(zombie.hitCount)&&Number.isFinite(zombie.hitCapacity)&&zombie.hitCapacity>0){
  const remaining=Math.max(0,zombie.hitCapacity-zombie.hitCount),fraction=remaining/zombie.hitCapacity;
  return {value:remaining,label:zombie.life==="downed"?"DOWNED":"HITS LEFT",fraction,critical:remaining<=1,downed:zombie.life==="downed"};
 }
 const fraction=Math.max(0,Math.min(1,hp/Math.max(1,maxHp)));
 return {value:Math.ceil(hp),label:"HP",fraction,critical:fraction<=.3,downed:false};
}
