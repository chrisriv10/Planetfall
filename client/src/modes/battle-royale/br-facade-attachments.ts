import type { BrStructure } from "@planetfall/shared";
import { buildFacadeParts, type FacadePart } from "./br-facades";

/** Door hardware remains outside the authoritative 4.8m entrance. The awning
 * starts beyond the glazing skin, with short brackets on the solid jambs. */
export function buildBrDoorwayParts(s:BrStructure):FacadePart[]{
  if(!s.enterable)return [];
  const face=s.entrance,ns=face==="north"||face==="south",sign=face==="north"||face==="east"?1:-1;
  const span=ns?s.size.x:s.size.z,normal=(ns?s.size.z:s.size.x)/2;
  const shop=s.archetype==="shop"||s.archetype==="transit",projection=shop?2.4:1.8;
  const parts:FacadePart[]=[];
  const add=(lateral:number,y:number,w:number,h:number,offset:number,thickness:number)=>parts.push({finish:"frame",face,
    position:{x:s.position.x+(ns?lateral:sign*(normal+offset)),y,z:s.position.z+(ns?sign*(normal+offset):lateral)},
    scale:{x:ns?w:thickness,y:h,z:ns?thickness:w}});
  for(const side of [-1,1]){
    add(side*2.47,2.1,.12,4.2,.48,.5);
    add(side*2.47,4.32,.12,.25,.565,.47);
  }
  add(0,4.05,5.1,.38,.48,.55);
  add(0,4.45,shop?Math.max(7.4,span*.72):7.4,.22,.8+projection/2,projection);
  return parts;
}

/** Freight portal braces terminate in solid wall below the clerestory. */
export function buildBrFreightPilasters(s:BrStructure):FacadePart[]{
  if(!["warehouse","hangar"].includes(s.archetype)||["crash-fuselage","thruster-foundry"].includes(s.id))return [];
  const face=s.entrance,ns=face==="north"||face==="south",sign=face==="north"||face==="east"?1:-1;
  const span=ns?s.size.x:s.size.z,normal=(ns?s.size.z:s.size.x)/2;
  const panes=buildFacadeParts(s).filter(p=>p.face===face&&(p.finish==="glass"||p.finish==="lit"));
  const bottom=s.size.y*.06,top=Math.min(s.size.y*.98,...panes.map(p=>p.position.y-p.scale.y/2-.15));
  if(top<=bottom)return [];
  return [-1,1].map(side=>({finish:"panel",face,
    position:{x:s.position.x+(ns?side*span*.39:sign*(normal+.34)),y:(bottom+top)/2,z:s.position.z+(ns?sign*(normal+.34):side*span*.39)},
    scale:{x:ns?1.15:1.25,y:top-bottom,z:ns?1.25:1.15}}));
}
