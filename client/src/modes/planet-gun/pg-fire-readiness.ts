import type {PgGunState, PgMotion, PgSnapshotPlayer} from "@planetfall/shared";

/** A short press may bridge sprint/switch latency, never an entire reload or reconnect. */
export function pgFirePressValid(now:number, expiresAt:number, gun:PgGunState):boolean {
 return now<expiresAt&&gun.magazine>0&&!gun.reloadUntil;
}

/** Prediction can exit sprint before the server has started its firing delay.
 * Keep a queued press until the exit command itself is acknowledged. An older
 * ground snapshot can predate the sprint entry and does not prove readiness. */
export function pgFireReady(at:number, predictedMode:PgMotion["mode"], authority:Pick<PgSnapshotPlayer,"mode"|"guns"|"slot"|"fireReadyAt"|"lastInputSequence">, predictedReadyAt:number, exitSequence=-1):boolean {
 const gun=authority.guns[authority.slot];
 return authority.lastInputSequence>=exitSequence&&predictedMode!=="sprint"&&predictedMode!=="mantle"&&authority.mode!=="sprint"&&authority.mode!=="mantle"&&gun.magazine>0&&!gun.reloadUntil&&at>=Math.max(authority.fireReadyAt,predictedReadyAt,gun.nextFireAt,gun.overheatedUntil??0);
}
