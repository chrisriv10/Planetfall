import {PG_BALANCE,PG_MAP,pgStepMovement,type PgInput,type PgMotion,type PgMap} from "@planetfall/shared";
export interface PgPendingInput {input:PgInput;at:number;}
/** A queued RAF or a one-way snapshot offset must not run timed movement backward. */
export function pgPredictedStepTime(desired:number,previous:number):number{return Math.max(desired,previous+1000/PG_BALANCE.tickRate);}
/** Reapply only commands newer than the authoritative acknowledgement. */
export function pgReconcileMotion(authority:PgMotion,acknowledged:number,pending:readonly PgPendingInput[],authorityAt?:number,map:PgMap=PG_MAP):{motion:PgMotion;pending:PgPendingInput[];at:number} {
 const motion=structuredClone(authority),remaining=pending.filter(p=>p.input.sequence>acknowledged).slice(-60);
 let at=authorityAt??0;
 for(let i=0;i<remaining.length;i++){const p=remaining[i];at=authorityAt===undefined?p.at:pgPredictedStepTime(p.at,at);pgStepMovement(motion,p.input,1/PG_BALANCE.tickRate,at,map);}
 return {motion,pending:remaining,at};
}
