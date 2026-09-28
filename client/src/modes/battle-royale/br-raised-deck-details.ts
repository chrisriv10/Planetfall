import { BR_ROADS, BR_STRUCTURES, type BrRoadSegment, type BrStructure, type BrTerrace, type Vec3 } from "@planetfall/shared";

export type BrRaisedDeckFinish = "structuralDark" | "brushedMetal" | "windowLit";
export interface BrRaisedDeckPart {
  geometry: "box";
  role: "armor" | "rib" | "light";
  finish: BrRaisedDeckFinish;
  side: "north" | "south" | "east" | "west";
  position: Vec3;
  scale: Vec3;
  rotationY: 0;
}
export const BR_RAISED_DECK_MAX_PARTS = 52;
export const BR_RAISED_DECK_ROAD_CLEARANCE = .85;

function segmentDistance(x:number,z:number,road:BrRoadSegment):number {
  const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((x-road.from.x)*dx+(z-road.from.z)*dz)/length)):0;
  return Math.hypot(x-road.from.x-dx*t,z-road.from.z-dz*t);
}

/** Full box footprint against a capsule around the road, not just its center.
 * Segment/rectangle intersection handles a road crossing the middle of a long
 * armor panel even when all four corners are outside the road. */
function clearOfRoad(part:BrRaisedDeckPart,road:BrRoadSegment):boolean {
  const minX=part.position.x-part.scale.x/2,maxX=part.position.x+part.scale.x/2;
  const minZ=part.position.z-part.scale.z/2,maxZ=part.position.z+part.scale.z/2;
  let enter=0,exit=1;
  for(const [origin,delta,min,max]of [[road.from.x,road.to.x-road.from.x,minX,maxX],[road.from.z,road.to.z-road.from.z,minZ,maxZ]]){
    if(Math.abs(delta)<1e-9){if(origin<min||origin>max){enter=2;break;}continue;}
    const a=(min-origin)/delta,b=(max-origin)/delta;
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
  }
  if(enter<=exit)return false;
  let distance=Infinity;
  for(const end of [road.from,road.to])distance=Math.min(distance,Math.hypot(Math.max(minX-end.x,0,end.x-maxX),Math.max(minZ-end.z,0,end.z-maxZ)));
  for(const x of [minX,maxX])for(const z of [minZ,maxZ])distance=Math.min(distance,segmentDistance(x,z,road));
  return distance>=road.width/2+BR_RAISED_DECK_ROAD_CLEARANCE;
}

/** Exposed side-skin for full raised districts, NOT the smaller court terraces.
 * Replace their generic terrace kit: do not layer a centered 6.4m ramp gap over
 * offset/diagonal 8–10m service roads. Every part is strictly outside the real
 * platform footprint and below its top; no top rail, planter, extra road or
 * collision. Segmented cassettes/ribs give the existing solid deck human scale.
 * Actual road footprints mask whole cassettes at every grade/collector join,
 * including level roads, so accessSide is never treated as a centered opening.
 * World-space unitBox transforms. Batch globally by finish, material.get(finish),
 * cameraCollision=false. No polygon offset needed: nearest skin is 2cm outside
 * the platform collider/render face. No per-frame work or new materials.
 */
export function buildBrRaisedDeckDetails(terrace:BrTerrace,roads:readonly BrRoadSegment[]=BR_ROADS,structures:readonly BrStructure[]=BR_STRUCTURES):BrRaisedDeckPart[]{
  const {position,size,height}=terrace;
  if(!terrace.gradedRoadAccess||![position.x,position.y,position.z,size.x,size.z,height].every(Number.isFinite)
    ||Math.min(size.x,size.z)<30||Math.max(size.x,size.z)>150||height<2.5||height>12)return [];
  const validRoads=roads.filter(road=>[...Object.values(road.from),...Object.values(road.to),road.width].every(Number.isFinite)&&road.width>0);
  const parts:BrRaisedDeckPart[]=[];
  for(const side of ["north","south","east","west"] as const){
    const ns=side==="north"||side==="south",sign=side==="north"||side==="east"?1:-1;
    const span=ns?size.x:size.z,depth=ns?size.z:size.x;
    const count=Math.min(6,Math.max(3,Math.ceil(span/18))),pitch=(span-2)/count;
    const width=Math.min(13,pitch-.8);
    for(let bay=0;bay<count;bay++){
      const along=-span/2+1+pitch*(bay+.5),cassette:BrRaisedDeckPart[]=[];
      const add=(role:BrRaisedDeckPart["role"],finish:BrRaisedDeckFinish,y:number,breadth:number,tall:number,offset:number,thickness:number)=>{
        const normal=sign*(depth/2+offset);
        cassette.push({geometry:"box",role,finish,side,rotationY:0,
          position:{x:position.x+(ns?along:normal),y,z:position.z+(ns?normal:along)},
          scale:{x:ns?breadth:thickness,y:tall,z:ns?thickness:breadth}});
      };
      add("armor","structuralDark",height-.55,width,.74,.1,.16);
      add("rib","brushedMetal",height-1.15,.2,1.95,.205,.09);
      if(bay===Math.floor(count/2))add("light","windowLit",height-.4,.7,.055,.199,.016);
      const clear=cassette.every(part=>validRoads.every(road=>clearOfRoad(part,road))&&structures.every(building=>
        Math.abs(part.position.x-building.position.x)>=(part.scale.x+building.size.x)/2+.15
        ||Math.abs(part.position.z-building.position.z)>=(part.scale.z+building.size.z)/2+.15
        ||part.position.y+part.scale.y/2<=building.position.y-.05
        ||part.position.y-part.scale.y/2>=building.position.y+building.size.y+.05));
      if(clear)parts.push(...cassette);
    }
  }
  return parts;
}
