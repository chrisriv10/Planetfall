export type BrReviveCommand = { targetId: string; active: boolean };
export const BR_REVIVE_RETRY_MS = 250;

export function brReviveInput(
  activeTargetId: string | null,
  candidateTargetId: string | null,
  held: boolean
): { activeTargetId: string | null; commands: BrReviveCommand[] } {
  const desiredTargetId = held ? candidateTargetId : null;
  if (desiredTargetId === activeTargetId) return { activeTargetId, commands: [] };
  const commands: BrReviveCommand[] = [];
  if (activeTargetId) commands.push({ targetId: activeTargetId, active: false });
  if (desiredTargetId) commands.push({ targetId: desiredTargetId, active: true });
  return { activeTargetId: desiredTargetId, commands };
}

export function brReviveRetryDue(activeTargetId:string|null,confirmedTargetId:string|null,lastRequestAt:number,now:number,confirmedDuringHold=false):boolean {
  return Boolean(activeTargetId&&!confirmedDuringHold&&activeTargetId!==confirmedTargetId&&now-lastRequestAt>=BR_REVIVE_RETRY_MS);
}
