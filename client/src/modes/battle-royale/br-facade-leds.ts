import type { BrStructure } from "@planetfall/shared";
import { buildFacadeParts, type FacadePart } from "./br-facades";

/** Four recessed cornice LEDs; avoid display glazing and doorway signage by
 * leaving entrance-center and corner sections open. One existing box batch
 * per district, no lights or collision. */
export function buildBrFacadeLeds(structure:BrStructure):FacadePart[]{
  if(["crash-fuselage","thruster-foundry"].includes(structure.id)||structure.archetype==="greenhouse")return [];
  const facade=buildFacadeParts(structure),parts:FacadePart[]=[];
  for(const face of ["north","south","east","west"] as const){
    const ns=face==="north"||face==="south",sign=face==="north"||face==="east"?1:-1;
    const span=ns?structure.size.x:structure.size.z,normal=ns?structure.size.z:structure.size.x;
    const top=Math.max(.7,...facade.filter(p=>p.face===face&&(p.finish==="glass"||p.finish==="lit")).map(p=>p.position.y+p.scale.y/2));
    const y=(top+structure.size.y-.28)/2;
    if(structure.size.y-.28-top<.2||span<10)continue;
    for(const side of [-1,1]){
      const inner=structure.enterable&&structure.entrance===face?5:1;
      const outer=span/2-2.7,width=outer-inner;if(width<.4)continue;
      const along=side*(inner+outer)/2;
      parts.push({face,finish:"accent",position:{x:structure.position.x+(ns?along:sign*(normal/2+.76)),
        y,z:structure.position.z+(ns?sign*(normal/2+.76):along)},
        scale:{x:ns?width:.06,y:.06,z:ns?.06:width}});
    }
  }
  return parts;
}
