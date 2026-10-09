import { BR_ROADS, type BrRoadSegment, type Vec3 } from "@planetfall/shared";
import type { GraphicsQuality } from "../../settings";
import type { BrMaterialKey } from "./br-materials";

export interface BrTransferBridgePart {
  role: "girder" | "rib" | "lamp" | "lens" | "freight";
  geometry: "box";
  finish: BrMaterialKey;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  rotationZ: number;
  surface: boolean;
}
export const BR_TRANSFER_FREIGHT_CENTER = {x:105,y:0,z:-428} as const;
export const BR_TRANSFER_FREIGHT_RADIUS = 9;

/** Authored bridge fittings, never new roadway/collision. Local X follows the
 * bridge; Z crosses it. Euler order must remain THREE's default XYZ, matching
 * the shared ramp (rotationY heading, rotationZ slope). World-space unit boxes,
 * shared material.get(finish) or surface(finish,6), cameraCollision=false.
 * Retain the low silhouette, add medium/high detail to separate LOD groups.
 * Exclude this road from generic grade dressing to avoid duplicate edge beams.
 * No GPU resources, runtime placement search, point lights or frame updates. */
export function buildBrTransferBridgeDressing(
  quality:GraphicsQuality,
  road:BrRoadSegment|undefined=BR_ROADS.find(r=>r.id==="south-transfer-bridge"),
):BrTransferBridgePart[]{
  // This kit is authored for this exact connection, not a generic road sampler.
  if(!road||road.id!=="south-transfer-bridge"||road.width!==9
    ||road.from.x!==45||road.from.z!==-415||road.to.x!==160||road.to.z!==-400
    ||![road.from.y,road.to.y].every(Number.isFinite)
    ||Math.min(road.from.y,road.to.y)<3.5||Math.max(road.from.y,road.to.y)>4.5)return [];
  const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,dy=road.to.y-road.from.y;
  const horizontal=Math.hypot(dx,dz),length=Math.hypot(horizontal,dy),yaw=-Math.atan2(dz,dx),slope=Math.atan2(dy,horizontal);
  const nx=-dz/horizontal,nz=dx/horizontal,parts:BrTransferBridgePart[]=[];
  const add=(role:BrTransferBridgePart["role"],finish:BrMaterialKey,x:number,y:number,z:number,sx:number,sy:number,sz:number,rotationY=0,rotationZ=0,surface=false)=>{
    parts.push({role,geometry:"box",finish,position:{x,y,z},scale:{x:sx,y:sy,z:sz},rotationY,rotationZ,surface});
  };
  const at=(t:number,offset:number)=>({x:road.from.x+dx*t+nx*offset,y:road.from.y+dy*t,z:road.from.z+dz*t+nz*offset});
  for(const side of [-1,1]){
    const p=at(.5,side*4.8);
    // Stop eight metres before each district join; no ledge protrudes on top.
    add("girder","brushedMetal",p.x,p.y-.53,p.z,length-16,.6,.36,yaw,slope);
  }
  for(const t of quality==="low"?[.25,.5,.75]:[.17,.25,.5,.75,.83]){
    const p=at(t,0);
    // Cross-ribs hang from the road, leaving >2.8m underpass headroom. They
    // never masquerade as collision pillars in the lower freight space.
    add("rib","structuralDark",p.x,p.y-.57,p.z,.22,.22,9.65,yaw,slope);
  }
  for(const [t,side] of [[.22,-1],[.28,1],[.72,-1],[.78,1]] as const){
    const p=at(t,side*5.12);
    add("lamp","structuralDark",p.x,p.y+1.4,p.z,.09,2.8,.09,yaw);
    add("lamp","brushedMetal",p.x,p.y+2.82,p.z,.55,.1,.2,yaw);
    add("lens","windowLit",p.x,p.y+2.758,p.z,.35,.018,.12,yaw);
    if(quality==="high")add("lens","industrialOrange",p.x,p.y+.7,p.z,.105,.11,.105,yaw);
  }
  // Literal island-level loading pocket, separated from the bridge by a broad
  // clear apron. No full pad, stacked crates, raised platform or solid barriers.
  for(const [x,z] of [[99,-424],[111,-424],[99,-432],[111,-432]] as const){
    add("freight","brushedMetal",x,.038,z,1.4,.012,.12,0,0,true);
  }
  for(const x of [101.5,108.5]){
    for(const side of [-1,1])add("freight","paintedMetal",x+side*.85,.13,-428,.12,.2,3.8);
    for(const z of [-429.7,-426.3])add("freight","brushedMetal",x,.1,z,1.8,.14,.1);
  }
  for(const [x,z] of [[98,-433],[112,-433]] as const){
    add("freight","structuralDark",x,1.7,z,.1,3.4,.1);
    add("freight","brushedMetal",x,3.42,z,.62,.12,.24);
    add("freight","windowLit",x,3.352,z,.4,.018,.14);
  }
  if(quality!=="low"){
    for(const x of [101.5,108.5]){
      add("freight","industrialOrange",x,.046,-425.4,1,.008,.12,0,0,true);
      add("freight","brushedMetal",x,.047,-430.6,.65,.008,.4,0,0,true);
    }
  }
  if(quality==="high")for(const x of [98,112])add("freight","industrialOrange",x,.8,-433,.12,.14,.12);
  return parts;
}
