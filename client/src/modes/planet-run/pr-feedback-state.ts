import {PR_BALANCE as B,type PrMotion} from '@planetfall/shared';

/** Pads and deliberate dives can have identical speeds. Their existing cooldown
 * tails distinguish their presentation without changing movement or the protocol. */
export function prIsBoosting(state:PrMotion,elapsedMs:number):boolean {
 const tail=state.diveReadyAt-state.diveUntil;
 return state.diveUntil>elapsedMs&&tail>=500&&tail<B.diveCooldownMs-B.diveDurationMs-1&&Math.hypot(state.velocity.x,state.velocity.z)>B.runSpeed+2;
}
