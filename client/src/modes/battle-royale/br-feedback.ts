import type { BrPhase, BrRoomView } from "@planetfall/shared";

/** Do not present an expired storm countdown while pilots are still dropping. */
export function brStormReadout(phase:BrPhase,storm:Pick<BrRoomView["storm"],"stage"|"stageEndsAt">,now:number) {
  if(phase!=="combat")return {label:phase==="ship"?"DROP PHASE":phase==="results"?"ROUND COMPLETE":"PREPARING",time:"—"};
  const seconds=storm.stageEndsAt?Math.max(0,Math.ceil((storm.stageEndsAt-now)/1000)):0;
  return {label:storm.stage==="closing"?"VOID CLOSING":"VOID STORM",time:`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`};
}

/** Damage events carry the impulse direction (attacker -> victim). The HUD
 * points back toward the attacker, relative to the current camera yaw. */
export function brDamageBearing(direction: {x:number;z:number}, yaw:number): number | null {
  if (Math.hypot(direction.x,direction.z)<.001) return null;
  return Math.atan2(-direction.x,direction.z)-yaw;
}

/** Convert an authoritative wall-clock deadline into the local monotonic clock.
 * A short grace keeps an in-flight request's anticipation from flickering off
 * on the snapshot that preceded it; confirmed cancellation clears immediately. */
export function brActionTimer(deadline:number, serverTime:number, now:number, startedAt:number, endsAt:number, duration:number, confirmed:boolean) {
  if (deadline>serverTime) {
    const remaining=Math.min(duration,deadline-serverTime);
    return {startedAt:now+remaining-duration,endsAt:now+remaining,confirmed:true};
  }
  if (!confirmed && endsAt>now && now-startedAt<450) return {startedAt,endsAt,confirmed:false};
  return {startedAt:0,endsAt:0,confirmed:false};
}

export function brRecoilAfter(recoil:number,dt:number):number { return recoil*Math.exp(-18*Math.max(0,dt)); }

/** Client anticipation may be later than authority, but must never schedule a
 * request earlier than the authoritative weapon interval. Advancing the local
 * clock on an early rejected request otherwise halves steady held-fire cadence. */
export function brFireRequestDue(now:number,lastRequestAt:number,fireIntervalMs:number):boolean {
  return Number.isFinite(now)&&Number.isFinite(lastRequestAt)&&Number.isFinite(fireIntervalMs)
    &&fireIntervalMs>0&&now-lastRequestAt>=fireIntervalMs;
}

export function brSmoothFacing(current:number,target:number,dt:number):number {
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+delta*(1-Math.exp(-10*Math.max(0,dt)));
}
