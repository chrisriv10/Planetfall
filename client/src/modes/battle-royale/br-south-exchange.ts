import { BR_ROAD_ROUTES, BR_STRUCTURES, type BrRoadSegment, type BrStructure, type Vec3 } from "@planetfall/shared";
import type { BrAuthoredSecondaryPart } from "./br-authored-secondary-dressing";
import type { BrTransitCourtSign } from "./br-transit-court";

export interface BrSouthExchangeDressing {
  center:Vec3;
  radius:number;
  parts:BrAuthoredSecondaryPart[];
  signs:BrTransitCourtSign[];
  batches:{geometry:BrAuthoredSecondaryPart["geometry"];finish:BrAuthoredSecondaryPart["finish"];surface:boolean;parts:BrAuthoredSecondaryPart[]}[];
}
const FRONTAGES=[
  ["south-exchange-cafe","EXCHANGE CAFE","COFFEE / SOUTH RING",8],
  ["south-exchange-office","SOUTH EXCHANGE","OFFICES / CONCOURSE",8],
  ["south-exchange-market","RING MARKET","PROVISIONS / DAILY GOODS",-7],
  ["south-exchange-service","EXCHANGE SERVICE","REPAIR / COLLECTION",-7],
] as const;

/** Four authored frontages, world-space transforms. Thin finishes use
 * surface(finish,1), foliage canopy(), other parts get(finish), existing unit
 * boxes/cylinders/octahedra only. Signs face local +Z. Attach to one district
 * LOD group with cameraCollision=false; no colliders/lights/frame updates.
 * Entry paths deliberately finish the floor beneath each clear doorway;
 * all upright furniture stays outside the full six-metre door approach. */
export function buildBrSouthExchangeDressing(input:{structures:readonly BrStructure[];roads:readonly BrRoadSegment[]}={structures:BR_STRUCTURES,roads:BR_ROAD_ROUTES}):BrSouthExchangeDressing|undefined {
  const road=input.roads.find(r=>r.id==="south-exchange-main");
  const buildings=FRONTAGES.map(([id])=>input.structures.find(s=>s.id===id));
  if(!road||buildings.some(s=>!s||!s.enterable||(s.entrance!=="east"&&s.entrance!=="west")))return undefined;
  const parts:BrAuthoredSecondaryPart[]=[],signs:BrTransitCourtSign[]=[];
  const add=(name:string,geometry:BrAuthoredSecondaryPart["geometry"],finish:BrAuthoredSecondaryPart["finish"],x:number,y:number,z:number,sx:number,sy:number,sz:number,surface=false)=>{
    parts.push({name,geometry,finish,position:{x,y,z},scale:{x:sx,y:sy,z:sz},rotationY:0,surface});
  };
  for(let index=0;index<FRONTAGES.length;index++){
    const [id,text,subtitle,treeZ]=FRONTAGES[index],s=buildings[index]!;
    const floor=s.position.y,direction=s.entrance==="east"?1:-1;
    const facade=s.position.x+direction*s.size.x/2;
    const streetEdge=road.from.x-direction*(road.width/2+.5);
    const width=Math.abs(streetEdge-facade),center=(facade+streetEdge)/2;
    const pave=(name:string,finish:BrAuthoredSecondaryPart["finish"],x:number,z:number,w:number,d:number,y=.02)=>
      add(`${id}-${name}`,"box",finish,x,floor+y,z,w,.012,d,true);
    pave("forecourt","concrete",center,s.position.z,width,s.size.z);
    pave("sidewalk","sidewalk",streetEdge-direction*1.15,s.position.z,2.3,s.size.z,.034);
    pave("entry-path","sidewalk",center,s.position.z,width,3.2,.034);
    for(const end of [-1,1])pave(`end-inlay-${end}`,"brushedMetal",center,s.position.z+end*(s.size.z/2-.15),width,.12,.034);
    // Four small crowns mark the outer corners of the two separated blocks.
    // Seats occupy the opposite end of each frontage, never its doorway.
    const furnitureX=facade+direction*4,treeAt=s.position.z+treeZ,seatAt=s.position.z-treeZ;
    pave("tree-bed","soil",furnitureX,treeAt,1.6,1.6,.034);
    add(`${id}-tree-stem`,"cylinder","structuralDark",furnitureX,floor+2.65,treeAt,.105,5.3,.105);
    add(`${id}-tree-crown`,"octahedron","canopy",furnitureX,floor+5.45,treeAt,1.45,1.65,1.45);
    add(`${id}-tree-crown-top`,"octahedron","canopy",furnitureX+.18,floor+6.45,treeAt,1.05,1.2,1.05);
    for(const dx of [-.2,0,.2])add(`${id}-seat-slat-${dx}`,"box","brushedMetal",furnitureX+dx,floor+.46,seatAt,.15,.09,1.8);
    for(const dz of [-.6,.6])add(`${id}-seat-foot-${dz}`,"box","structuralDark",furnitureX,floor+.21,seatAt+dz,.5,.42,.1);
    // Flush to the actual exterior wall (the authoritative wall is .65m thick).
    signs.push({text,subtitle,position:{x:facade+direction*.36,y:floor+3.65,z:s.position.z},rotationY:direction*Math.PI/2,width:4.4,height:.7});
  }
  const batches=new Map<string,BrSouthExchangeDressing["batches"][number]>();
  for(const part of parts){
    const key=`${part.geometry}:${part.finish}:${part.surface}`;
    let batch=batches.get(key);
    if(!batch){batch={geometry:part.geometry,finish:part.finish,surface:part.surface,parts:[]};batches.set(key,batch);}
    batch.parts.push(part);
  }
  return {center:{x:road.from.x,y:buildings[0]!.position.y,z:(road.from.z+road.to.z)/2},radius:50,parts,signs,batches:[...batches.values()]};
}
