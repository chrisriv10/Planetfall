import {BR_ROADS,BR_STRUCTURES,type BrRoadSegment,type BrStructure} from "@planetfall/shared";
import type {BrAuthoredSecondaryDressing,BrAuthoredSecondaryPart} from "./br-authored-secondary-dressing";

export interface BrWestJunctionDressing extends BrAuthoredSecondaryDressing {
  batches:{finish:"concrete"|"sidewalk";parts:BrAuthoredSecondaryPart[]}[];
}
const FRONTAGES=[
  {id:"west-junction-shop",entrance:"south",road:"west-junction-shop-entry"},
  {id:"west-junction-office",entrance:"north",road:"west-junction-office-entry"},
  {id:"west-junction-utility",entrance:"east",road:"west-junction-main"},
] as const;

/** Three broad, flush forecourts with a full-width clear doorway walk and an
 * edge walk beside the actual street. Parts partition the paving area without
 * coplanar overlays. World-space ground heights; never lift by Nova's deck.
 * Batch with cached unitBox and surface(finish,1), cameraCollision=false in the
 * district detail LOD. Pure data: no owned resources, colliders or animation.
 * buildNovaEntrancePaving excludes these IDs, so no existing entrance tiles
 * need suppressing. Pass directly to addAuthoredSecondaryDressing at ground 0.
 */
export function buildBrWestJunctionDressing(input:{structures:readonly BrStructure[];roads:readonly BrRoadSegment[]}=
  {structures:BR_STRUCTURES,roads:BR_ROADS}):BrWestJunctionDressing|undefined{
  const parts:BrAuthoredSecondaryPart[]=[];
  for(const spec of FRONTAGES){
    const s=input.structures.find(s=>s.id===spec.id);
    if(!s||!s.enterable||s.position.y!==0||s.entrance!==spec.entrance)return undefined;
    const ns=s.entrance==="north"||s.entrance==="south",sign=s.entrance==="south"?-1:1;
    const lateral=ns?s.position.x:s.position.z,span=ns?s.size.x:s.size.z;
    const road=input.roads.find(r=>(r.id===spec.road||r.id.startsWith(`${spec.road}-grade-part-`))
      &&lateral>=Math.min(ns?r.from.x:r.from.z,ns?r.to.x:r.to.z)-.001
      &&lateral<=Math.max(ns?r.from.x:r.from.z,ns?r.to.x:r.to.z)+.001);
    if(!road||Math.abs(road.from.y-.1)>.001||Math.abs(road.to.y-.1)>.001)return undefined;
    const facade=(ns?s.position.z:s.position.x)+sign*(ns?s.size.z:s.size.x)/2;
    const start=facade+sign*.375,edge=(ns?road.from.z:road.from.x)-sign*(road.width/2+.15);
    const length=(edge-start)*sign,walk=4.8,sideWidth=(span-walk)/2;
    if(length<1||sideWidth<1)return undefined;
    const add=(name:string,finish:"concrete"|"sidewalk",along:number,normal:number,w:number,d:number)=>
      parts.push({name:`${spec.id}-${name}`,geometry:"box",finish,position:{x:ns?along:normal,y:.02,z:ns?normal:along},
        scale:{x:ns?w:d,y:.016,z:ns?d:w},rotationY:0,surface:true});
    add("door-walk","sidewalk",lateral,(start+edge)/2,walk,length);
    const edgeDepth=Math.min(1.4,length*.35),courtLength=length-edgeDepth;
    for(const side of [-1,1]){
      const at=lateral+side*(walk/2+sideWidth/2);
      add(`forecourt-${side}`,"concrete",at,start+sign*courtLength/2,sideWidth,courtLength);
      add(`edge-walk-${side}`,"sidewalk",at,edge-sign*edgeDepth/2,sideWidth,edgeDepth);
    }
  }
  return {id:"west-junction",family:"commercial",context:"Three ground-level door forecourts and street-edge walks",
    center:{x:-326,y:0,z:-138},radius:49,parts,
    batches:(["concrete","sidewalk"] as const).map(finish=>({finish,parts:parts.filter(p=>p.finish===finish)}))};
}
