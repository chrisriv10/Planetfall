/** Stable world-up presentation; architecture never rocks with the clock. */
export const PG_HOME_COMPOSITION=Object.freeze({yaw:-.3,pitch:0,distance:38,referenceRadius:60});
export function pgHomeAmbientTime(timeSeconds:number,reducedMotion:boolean):number {
  return reducedMotion?0:Number.isFinite(timeSeconds)?Math.max(0,timeSeconds)*1000:0;
}
