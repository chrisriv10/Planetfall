import type { Vec3 } from "../index.js";
import { PR_BALANCE } from "./balance.js";
import type { PrObstacle,PrPlatform,PrTile,PrTileDelta } from "./types.js";

export function prPlatformCenter(p:PrPlatform,elapsedMs:number):Vec3 {
  if(!p.motion)return p.center;
  const m=p.motion,offset=Math.sin(elapsedMs/1000*Math.PI*2/m.period+m.phase)*m.distance;
  return {...p.center,[m.axis]:p.center[m.axis]+offset};
}
/** Read-only visual phase derived from the same deterministic meteor schedule. */
export function prMeteorTimeline(o:PrObstacle,elapsedMs:number,seed:number):{active:boolean;warning:boolean;warningProgress:number;impactAgeMs:number|null}{
  const period=Math.max(.25,o.period),duration=period*1000;
  const firstImpact=2500+(((o.phase+(seed%997)/997)%1+1)%1)*period*1000;
  const age=elapsedMs-firstImpact,phase=age<0?age:age%duration;
  const active=age>=0&&phase<period*170,warning=age<0?age>=-1500:phase>=duration-1500;
  return {active,warning,warningProgress:warning?(age<0?(age+1500)/1500:(phase-duration+1500)/1500):0,impactAgeMs:active?phase:null};
}
export function prObstacleTransform(o:PrObstacle,elapsedMs:number,seed:number):{yaw:number;active:boolean;warning:boolean} {
  const period=Math.max(.25,o.period),t=elapsedMs/1000/period+o.phase+(seed%997)/997;
  const cycle=((t%1)+1)%1;
  if(o.kind==="meteor"){
    const phase=prMeteorTimeline(o,elapsedMs,seed);
    return {yaw:0,active:phase.active,warning:phase.warning};
  }
  if(o.kind==="shutter"){
    const lanePhase=cycle*3,openLane=Math.floor(lanePhase);
    return {yaw:0,active:o.lane!==openLane,warning:lanePhase-openLane>=.78};
  }
  if(o.kind==="arc")return {yaw:0,active:cycle>=.3&&cycle<.42,warning:cycle<.3};
  if(o.kind==="barrier")return {yaw:0,active:true,warning:false};
  return {yaw:t*Math.PI*2,active:o.kind==="door"?cycle<.55:true,warning:false};
}
/** Moving collision and renderer share the exact authored lateral sweep. */
export function prObstacleCenter(o:PrObstacle,elapsedMs:number,seed:number):Vec3{
 if(o.kind!=="barrier")return o.center;
 const phase=elapsedMs/1000/Math.max(.25,o.period)*Math.PI*2+o.phase+(seed%997)/997*Math.PI*2;
 return {x:o.center.x+Math.sin(phase)*(o.travel??0),y:o.center.y,z:o.center.z};
}
export function prTileState(triggeredAt:number|undefined,elapsedMs:number):"solid"|"triggered"|"breaking"|"gone" {
  if(triggeredAt===undefined)return "solid";
  const age=elapsedMs-triggeredAt;
  return age>=PR_BALANCE.tileBreakMs?"gone":age>=PR_BALANCE.tileBreakMs-PR_BALANCE.tileBreakingMs?"breaking":"triggered";
}
/** Pointy hex containment, shared by support and visible instanced hex geometry. */
export function prInsideTile(tile:PrTile,x:number,z:number):boolean {
  const dx=Math.abs(x-tile.center.x),dz=Math.abs(z-tile.center.z),r=PR_BALANCE.tileRadius;
  return dx<=Math.sqrt(3)*r/2&&dz<=r&&Math.sqrt(3)*dz+dx<=Math.sqrt(3)*r;
}
export class PrTileState {
  readonly triggered=new Map<number,number>();revision=0;
  constructor(readonly tiles:readonly PrTile[]){}
  contact(id:number,elapsedMs:number):PrTileDelta|null {
    if(!this.tiles.some(t=>t.id===id)||this.triggered.has(id))return null;
    this.triggered.set(id,elapsedMs);this.revision++;return {id,triggeredAt:elapsedMs};
  }
  apply(changes:readonly PrTileDelta[]):void {for(const c of changes)if(!this.triggered.has(c.id))this.triggered.set(c.id,c.triggeredAt);}
  intact(id:number,elapsedMs:number):boolean{return prTileState(this.triggered.get(id),elapsedMs)!=="gone";}
  full():PrTileDelta[]{return [...this.triggered].map(([id,triggeredAt])=>({id,triggeredAt}));}
}
