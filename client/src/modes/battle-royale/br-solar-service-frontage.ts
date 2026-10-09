import type { BrStructure, Vec3 } from "@planetfall/shared";
import { buildFacadeParts, type FacadePart } from "./br-facades";

export interface SolarServicePart {
  role: "contact" | "body" | "cap";
  finish: "structuralDark" | "structuralWhite" | "paintedMetal" | "brushedMetal" | "concrete";
  position: Vec3;
  scale: Vec3;
}
export type SolarServiceFacadePart = Omit<FacadePart,"finish"> & {finish:FacadePart["finish"]|"concrete"};
export interface SolarServiceFrontage {
  replaceGenericCorners: boolean;
  replaceGenericShell: boolean;
  replaceGenericFacadePanels: boolean;
  cornerParts: SolarServicePart[];
  shellParts: SolarServicePart[];
  facadeParts: SolarServiceFacadePart[];
}

/** Replacement corner composition for three authored ground-service buildings.
 * X/Z are world-space, Y is structure-base-local (like buildFacadeParts).
 * Sol integration must omit ONLY these buildings' four generic corner columns,
 * batch cornerParts with borrowed unitChamferedBox/materials.get(finish).
 * For replaceGenericShell, omit generic wallSpec and batch shellParts with
 * unitBox. For replaceGenericFacadePanels, omit ONLY buildFacadeParts' panel
 * finish, then append facadeParts; all glazing and other facade layers remain.
 * Route facade finish concrete to a shared unitBox/materials.get("concrete")
 * batch; the remaining facade finishes use their existing mappings.
 * Add the structure's base elevation exactly once through the existing group.
 * This pure builder owns no geometry/materials/textures or cleanup obligations.
 */
export function buildBrSolarServiceFrontage(structure:BrStructure):SolarServiceFrontage{
  const result:SolarServiceFrontage={replaceGenericCorners:false,replaceGenericShell:false,
    replaceGenericFacadePanels:false,cornerParts:[],shellParts:[],facadeParts:[]};
  if(structure.districtId!=="solar-service"||!["solar-service-1","solar-service-2","solar-service-3"].includes(structure.id))return result;
  const {x,z}=structure.position,{x:width,y:height,z:depth}=structure.size;
  if(![x,z,width,height,depth].every(Number.isFinite)||width<12||depth<12||height<5)return result;
  result.replaceGenericCorners=true;
  // Keep the exact original column envelope, including its .55m top/bottom
  // extension. Three adjacent zones partition it; no new corner mass is added.
  const broad=structure.style==="city"||structure.style==="mall"||structure.archetype==="tower"||structure.archetype==="hotel";
  const corner=broad?Math.max(2.1,Math.min(4.2,Math.min(width,depth)*.11)):1.55;
  const utility=structure.id==="solar-service-3";
  // Low-metalness concrete keeps broad utility surfaces readable without
  // environment reflections, against dark contact trim and existing ribs.
  const bodyFinish=utility?"concrete":"structuralDark";
  const contactTop=.7,capBottom=height-.12;
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const cx=x+sx*(width/2-corner*.42),cz=z+sz*(depth/2-corner*.42);
    const add=(role:SolarServicePart["role"],finish:SolarServicePart["finish"],bottom:number,top:number)=>
      result.cornerParts.push({role,finish,position:{x:cx,y:(bottom+top)/2,z:cz},scale:{x:corner,y:top-bottom,z:corner}});
    add("contact","structuralDark",-.55,contactTop);
    add("body",bodyFinish,contactTop,capBottom);
    add("cap","brushedMetal",capBottom,height+.55);
  }

  if(utility){
    result.replaceGenericShell=true;result.replaceGenericFacadePanels=true;
    // The foreground white NE corner is the .65m shell and .12m facade
    // backing, both forward of the old dark corner columns. Replace their
    // materials in place; overlays would enlarge the visual solid footprint.
    const wall=.65,door=4.8;
    const shell=(cx:number,cz:number,sx:number,sz:number)=>{
      for(const [role,finish,bottom,top] of [
        ["contact","structuralDark",0,.8],["body","concrete",.8,height],
      ] as const)result.shellParts.push({role,finish,position:{x:cx,y:(bottom+top)/2,z:cz},scale:{x:sx,y:top-bottom,z:sz}});
    };
    if(!structure.enterable){shell(x,z-depth/2,width,wall);shell(x,z+depth/2,width,wall);shell(x-width/2,z,wall,depth);shell(x+width/2,z,wall,depth);}
    else if(structure.entrance==="north"||structure.entrance==="south"){
      const front=z+(structure.entrance==="north"?1:-1)*depth/2;
      shell(x-width/2,z,wall,depth);shell(x+width/2,z,wall,depth);shell(x,2*z-front,width,wall);
      for(const side of [-1,1])shell(x+side*(width+door)/4,front,(width-door)/2,wall);
    }else{
      const front=x+(structure.entrance==="east"?1:-1)*width/2;
      shell(x,z-depth/2,width,wall);shell(x,z+depth/2,width,wall);shell(2*x-front,z,wall,depth);
      for(const side of [-1,1])shell(front,z+side*(depth+door)/4,wall,(depth-door)/2);
    }
    for(const panel of buildFacadeParts(structure).filter(part=>part.finish==="panel"))
      result.facadeParts.push({...panel,finish:"concrete"});
  }

  // A paired service belt occupies a real solid spandrel. Derive free vertical
  // intervals from the current facade glazing; authored floor counts and
  // clerestory proportions must not leave the band across a window.
  // Both halves stop well outside the 4.8m doorway and before corner columns.
  const face=structure.entrance,ns=face==="north"||face==="south";
  const sign=face==="north"||face==="east"?1:-1;
  const span=ns?width:depth,normal=(ns?depth:width)/2;
  const start=3.1,end=span/2-corner-.15,beltWidth=end-start;
  if(beltWidth<.6)return result;
  const glazing=buildFacadeParts(structure).filter(p=>p.face===face&&(p.finish==="glass"||p.finish==="lit"));
  const occupied=glazing.map(p=>[p.position.y-p.scale.y/2-.4,p.position.y+p.scale.y/2+.2])
    .sort((a,b)=>a[0]-b[0]);
  const candidates:number[]=[];
  let bottom=.85;
  const top=height-.35;
  for(const [low,high] of [...occupied,[top,top]]){
    const gapTop=Math.min(low,top);
    if(gapTop-bottom>=.5)candidates.push((bottom+gapTop)/2);
    bottom=Math.max(bottom,high);
  }
  if(!candidates.length)return result;
  const preferred=utility?height:height/2;
  const beltY=candidates.reduce((best,y)=>Math.abs(y-preferred)<Math.abs(best-preferred)?y:best);
  const add=(finish:FacadePart["finish"],lateral:number,y:number,w:number,h:number,offset:number,thickness:number)=>
    result.facadeParts.push({finish,face,
      position:{x:x+(ns?lateral:sign*(normal+offset)),y,z:z+(ns?sign*(normal+offset):lateral)},
      scale:{x:ns?w:thickness,y:h,z:ns?thickness:w}});
  for(const side of [-1,1]){
    const lateral=side*(start+end)/2;
    add("frame",lateral,beltY,beltWidth,.5,.705,.07);
    add("metal",lateral,beltY+.12,beltWidth-.16,.08,.752,.016);
    // One/two/three quiet metal ticks identify shop/office/utility without a
    // new sign texture, emissive layer or a field of freestanding equipment.
    const ticks=Number(structure.id.at(-1));
    for(let tick=0;tick<ticks;tick++)add("metal",lateral+(tick-(ticks-1)/2)*.22,
      beltY-.08,.09,.12,.752,.016);
  }
  return result;
}
