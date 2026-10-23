import {PG_BALANCE,pgStepMovement,type PgInput,type PgMotion} from "@planetfall/shared";
export interface PgPendingInput {input:PgInput;at:number;}
/** Reapply only commands newer than the authoritative acknowledgement. */
export function pgReconcileMotion(authority:PgMotion,acknowledged:number,pending:readonly PgPendingInput[]):{motion:PgMotion;pending:PgPendingInput[]} {
 const motion=structuredClone(authority),remaining=pending.filter(p=>p.input.sequence>acknowledged).slice(-60);
 for(const p of remaining)pgStepMovement(motion,p.input,1/PG_BALANCE.tickRate,p.at);
 return {motion,pending:remaining};
}
