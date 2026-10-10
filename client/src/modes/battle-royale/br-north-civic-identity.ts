import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, type BrMapBlock, type BrStructure, type Vec3 } from "@planetfall/shared";
import type { BrAuthoredSecondaryPart } from "./br-authored-secondary-dressing";

export interface BrNorthCivicIdentityPart extends BrAuthoredSecondaryPart {
  finish:"structuralDark"|"interiorWall"|"windowDark"|"brushedMetal"|"energyCyan"|"energyPurple"|"industrialOrange"|"windowLit";
  wallId:string;
  floorId:string;
  attachment:"wall"|"floor"|"ceiling";
  supportId:string;
}
const intersects=(a:Vec3,s:Vec3,b:Vec3,t:Vec3,pad=0)=>
  Math.abs(a.x-b.x)<(s.x+t.x)/2+pad&&Math.abs(a.y-b.y)<(s.y+t.y)/2+pad&&Math.abs(a.z-b.z)<(s.z+t.z)/2+pad;
const projected=(b:BrMapBlock):Vec3=>{
  let {x,y,z}=b.size;
  for(const [axis,angle] of Object.entries(b.rotation??{})){
    const c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
    if(axis==="x")[y,z]=[c*y+s*z,s*y+c*z];
    if(axis==="y")[x,z]=[c*x+s*z,s*x+c*z];
    if(axis==="z")[x,y]=[c*x+s*y,s*x+c*y];
  }
  return{x,y,z};
};

/** Shallow identity mounted to real interior partitions only. X/Z are world
 * coordinates; Y is structure-local, matching existing interior batches.
 * Replace generic dressing on returned wallIds, rather than layering it.
 * No resources, floor furniture, glazing treatment or authoritative changes. */
export function buildBrNorthCivicIdentity(
  structure:BrStructure,
  blocks:readonly BrMapBlock[]=BR_MAP_BLOCKS,
  loot:readonly (typeof BR_LOOT_SOCKETS)[number][]=BR_LOOT_SOCKETS,
):{supported:boolean;parts:BrNorthCivicIdentityPart[]}{
  const archive=structure.id==="north-civic-archive",exchange=structure.id==="north-civic-exchange";
  if(!structure.enterable||!archive&&!exchange||structure.entrance!==(archive?"east":"west")||structure.floors!==(archive?2:1))return{supported:false,parts:[]};
  const own=blocks.filter(b=>b.id.startsWith(`${structure.id}-`));
  const floors=own.filter(b=>b.kind==="platform"&&!b.rotation&&!b.id.endsWith("-roof"));
  const result:BrNorthCivicIdentityPart[]=[];
  for(const wall of own.filter(b=>b.kind==="wall"&&b.id.startsWith(`${structure.id}-room-`))){
    if(wall.rotation||wall.size.x>.65||wall.size.z<5||wall.size.y<3.3)continue;
    const sign=Math.sign(structure.position.x-wall.position.x);if(!sign)continue;
    const bottom=wall.position.y-wall.size.y/2;
    const width=Math.min(6.6,wall.size.z-1.2),face=wall.position.x+sign*wall.size.x/2;
    const floor=floors.find(f=>{
      const top=f.position.y+f.size.y/2;
      return top>=bottom-.01&&top<=bottom+.5
        &&Math.abs(face+sign*.1-f.position.x)+.1<f.size.x/2
        &&Math.abs(wall.position.z-f.position.z)+width/2<f.size.z/2;
    });
    if(!floor)continue;
    const floorTop=floor.position.y+floor.size.y/2;
    if(floorTop+3.1>wall.position.y+wall.size.y/2-.15)continue;
    const parts:BrNorthCivicIdentityPart[]=[];
    const add=(name:string,finish:BrNorthCivicIdentityPart["finish"],z:number,y:number,w:number,h:number,depth:number,offset:number)=>parts.push({
      name:`${wall.id}-${name}`,wallId:wall.id,floorId:floor.id,attachment:"wall",supportId:wall.id,geometry:"box",finish,rotationY:0,surface:false,
      position:{x:face+sign*offset,y:floorTop+y-structure.position.y,z:wall.position.z+z},scale:{x:depth,y:h,z:w},
    });
    add(archive?"archive-backing":"retail-backing","structuralDark",0,1.8,width,2.5,.06,.035);
    for(const [index,side] of [-1,0,1].entries()){
      const lateral=side*width/3;
      add(archive?`archive-bay-${index}`:`retail-display-${index}`,archive?"interiorWall":"windowDark",lateral,1.8,width/3-.14,2.2,.035,.0825);
      add(archive?`index-${index}`:`price-strip-${index}`,archive?"energyCyan":"brushedMetal",lateral,archive?2.65:.9,
        archive?.065:width/3-.35,archive?.38:.08,.014,.109);
      if(archive){
        // Recess-like cartridge faces give each catalogue bay three readable
        // rows, without projecting a shelf or box into the player aisle.
        for(const [row,y] of [.98,1.7,2.28].entries())
          add(`cartridge-${index}-${row}`,"structuralDark",lateral,y,width/3-.56,.22,.012,.108);
        add(`cartridge-core-${index}`,floorTop>structure.position.y+1?"industrialOrange":"energyCyan",
          lateral+width/6-.42,1.7,.05,.065,.009,.122);
      }
    }
    if(archive){
      for(const [index,y] of [1.35,2.05].entries())add(`catalogue-rail-${index}`,"brushedMetal",0,y,width-.16,.055,.018,.113);
    }else add("display-baseline","brushedMetal",0,.64,width-.12,.065,.025,.11);
    // Upper archive bands mark the landing level; lower cyan identifies entry.
    add(archive?"level-directory":"retail-header",archive?(floorTop>structure.position.y+1?"industrialOrange":"energyCyan"):"energyPurple",
      0,3,width-.25,.09,.014,.109);
    const ceiling=own.filter(b=>b.kind==="platform"&&!b.rotation&&b.position.y-b.size.y/2>floorTop+3.2
      &&Math.abs(face+sign*.3-b.position.x)+.1<b.size.x/2
      &&Math.abs(wall.position.z-b.position.z)+width/2<b.size.z/2)
      .sort((a,b)=>a.position.y-b.position.y)[0];
    if(!ceiling)continue;
    for(const attachment of ["floor","ceiling"] as const){
      const support=attachment==="floor"?floor:ceiling;
      const y=attachment==="floor"?floorTop+.012:ceiling.position.y-ceiling.size.y/2-.02;
      parts.push({name:`${wall.id}-${attachment}-guide`,wallId:wall.id,floorId:floor.id,supportId:support.id,attachment,
        geometry:"box",finish:attachment==="ceiling"?"windowLit":archive?(floorTop>structure.position.y+1?"industrialOrange":"energyCyan"):"energyPurple",
        rotationY:0,position:{x:face+sign*.3,y:y-structure.position.y,z:wall.position.z},scale:{x:.08,y:.012,z:width*.8},surface:attachment==="floor"});
    }
    const unsafe=parts.some(p=>{
      const world={...p.position,y:p.position.y+structure.position.y};
      if(loot.some(l=>l.structureId===structure.id&&intersects(world,p.scale,l.position,{x:1.2,y:1.6,z:1.2},.25)))return true;
      return own.some(b=>b.id!==wall.id&&b.kind!=="platform"&&intersects(world,p.scale,b.position,projected(b),.08));
    });
    if(!unsafe)result.push(...parts);
  }
  const supported=new Set(result.map(p=>p.wallId)).size===(archive?4:2);
  return{supported,parts:supported?result:[]};
}
