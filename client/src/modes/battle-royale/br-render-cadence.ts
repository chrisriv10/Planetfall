/** The full tactical map covers gameplay, but does not pause the match.
 * Bound only WebGL draws behind it; never gate input, prediction, snapshots,
 * camera updates, storm timers or HUD. Normal play renders every frame.
 */
export function brWorldDrawDue(now:number,lastDrawAt:number,mapVisible:boolean):boolean{
  return !mapVisible||now-lastDrawAt>=125;
}
