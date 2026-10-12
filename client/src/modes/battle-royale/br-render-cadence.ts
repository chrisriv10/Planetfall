/** The full tactical map covers gameplay, but does not pause the match.
 * Bound only WebGL draws behind it; never gate input, prediction, snapshots,
 * camera updates, storm timers or HUD. Normal play renders every frame.
 */
export function brWorldDrawDue(now:number,lastDrawAt:number,mapVisible:boolean):boolean{
  return !mapVisible||now-lastDrawAt>=125;
}

/** Lobby/results scenery has no gameplay simulation. Keep UI input on every
 * RAF while bounding expensive background animation/rendering to twenty Hz. */
export function brLobbyPresentationDue(now:number,lastAt:number,phase:string|undefined):boolean{
  return phase!=="lobby"&&phase!=="results"||now-lastAt>=50-.001;
}

/** High retains its full shadow resolution/casters, updating at thirty Hz.
 * Half-millisecond tolerance avoids dropping to twenty Hz on rounded 60Hz RAFs.
 * Gameplay, camera and the main color pass still run every frame. */
export function brShadowDrawDue(now:number,lastAt:number):boolean{
  return now-lastAt>=1000/30-.5;
}

/** Shared renderer ownership is scoped to the synchronous BR draw. Preserve
 * explicit invalidation and restore automatic updates even if rendering throws. */
export function withBrShadowRefresh(
  shadowMap:{autoUpdate:boolean;needsUpdate:boolean},refresh:boolean,draw:()=>void,
):void{
  const automatic=shadowMap.autoUpdate;
  shadowMap.autoUpdate=false;
  shadowMap.needsUpdate ||= refresh;
  try{draw();}finally{shadowMap.autoUpdate=automatic;}
}
