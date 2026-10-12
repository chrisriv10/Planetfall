import { BR_MAP_BLOCKS, BR_STRUCTURES, type BrStructure } from "@planetfall/shared";
import { buildFacadeParts, buildExteriorServiceParts } from "./br-facades";
import { buildNovaStorefrontParts } from "./br-storefronts";
import { buildBrSolarServiceFrontage, type SolarServiceFacadePart, type SolarServiceFrontage } from "./br-solar-service-frontage";
import { buildBrDoorwayParts, buildBrFreightPilasters } from "./br-facade-attachments";
import { buildBrEntranceHeaderFinish } from "./br-entrance-header-finish";
import { buildBrFacadeSign, getBrFacadeSignText } from "./br-facade-signs";
import { brIdentityBounds, selectBrFacadeIdentityReplacements } from "./br-facade-identity";

export type BrFacadeSkinPart = SolarServiceFacadePart & { identityLed?: true };

/** The production skin composition is shared with the overlap audit. Heights
 * are local to the building's base; the renderer applies elevation once. */
export function buildBrFacadeSkin(
  structure:BrStructure, solar:SolarServiceFrontage=buildBrSolarServiceFrontage(structure)
):BrFacadeSkinPart[]{
  const parts:BrFacadeSkinPart[] = [
    ...buildFacadeParts(structure).filter(part=>!solar.replaceGenericFacadePanels||part.finish!=="panel"),
    ...buildExteriorServiceParts(structure),
    ...buildNovaStorefrontParts(structure),
    ...solar.facadeParts,
  ];
  // Render callers normalize Y to zero; recover the actual base for literal
  // shared wall bounds while every presentation descriptor remains local-Y.
  const source=BR_STRUCTURES.find(s=>s.id===structure.id);
  if(!source)return parts;
  const local=(p:{position:{x:number;y:number;z:number};scale:{x:number;y:number;z:number}})=>brIdentityBounds({
    ...p,finish:"frame",face:structure.entrance,position:{...p.position,y:p.position.y-source.position.y}});
  const walls=BR_MAP_BLOCKS.filter(b=>b.id===`${structure.id}-door-left`||b.id===`${structure.id}-door-right`)
    .map(b=>local({position:b.position,scale:b.size}));
  const doorway=buildBrDoorwayParts(structure),posts=doorway.filter(p=>p.scale.y>=4&&p.position.y-p.scale.y/2<=.01);
  const forbidden=[...parts.filter(p=>["frame","metal","foliage"].includes(p.finish)),...doorway,...buildBrFreightPilasters(structure)].map(brIdentityBounds);
  forbidden.push(...buildBrEntranceHeaderFinish(source).map(local));
  const text=getBrFacadeSignText(source),sign=text?buildBrFacadeSign(source,text):null;
  if(sign){
    forbidden.push(...sign.parts.map(local));
    const ns=structure.entrance==="north"||structure.entrance==="south";
    forbidden.push(local({position:sign.label.position,scale:{x:ns?sign.label.width:.02,y:sign.label.height,z:ns?.02:sign.label.width}}));
  }
  for(const replacement of selectBrFacadeIdentityReplacements(structure,parts,posts,walls,forbidden)){
    parts[replacement.index]={...parts[replacement.index],position:{...replacement.part.position},scale:{...replacement.part.scale},identityLed:true};
  }
  return parts;
}
