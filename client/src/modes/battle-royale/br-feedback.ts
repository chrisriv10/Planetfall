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

export function brSmoothFacing(current:number,target:number,dt:number):number {
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+delta*(1-Math.exp(-10*Math.max(0,dt)));
}
