import { BR_TERRACES, type Vec3 } from "@planetfall/shared";
import type { GraphicsQuality } from "../../settings";
import type { BrDistrictPropPart } from "./br-authored-district-props";

export interface BrShipworksStreetPocket {
  id: string;
  center: Vec3;
  radius: number;
  parts: BrDistrictPropPart[];
}
const POCKETS = [
  ["north-shift-stop",199,-371,"rest"],
  ["inspection-shoulder",181,-387,"inspection"],
  ["south-service",182,-408,"service"],
] as const;

/** Authored South Shipworks shoulder composition for `maintenance-south`.
 * Unlike the island-level maintenance strips this sits on the real raised deck;
 * all returned positions are WORLD SPACE, already including its current height.
 * Compatible with authored district prop batching: unitBox, get(finish), no
 * owned GPU resources. cameraCollision=false, no physics/lights/frame updates.
 * Keep low-tier lamps/furniture visible; medium adds service details, high adds
 * small trim. No procedural site placement, opaque crates, barriers or walls. */
export function buildBrShipworksStreetscape(quality:GraphicsQuality):BrShipworksStreetPocket[]{
  const deck=BR_TERRACES.find(t=>t.id==="south-shipworks-deck");
  if(!deck||!Number.isFinite(deck.height))return [];
  return POCKETS.map(([id,x,z,theme])=>{
    const parts:BrDistrictPropPart[]=[];
    const add=(finish:BrDistrictPropPart["finish"],dx:number,y:number,dz:number,sx:number,sy:number,sz:number)=>parts.push({
      geometry:"box",finish,position:{x:x+dx,y:deck.height+y,z:z+dz},scale:{x:sx,y:sy,z:sz},rotationY:0,surface:false,
    });
    // Solid-backed warm downlights, not floating emissive blocks or spotlights.
    add("structuralDark",1.05,1.8,.6,.1,3.6,.1);
    add("brushedMetal",.79,3.61,.6,.65,.12,.24);
    add("windowLit",.77,3.542,.6,.4,.018,.14);
    if(theme==="rest"){
      for(const dz of [-.22,0,.22])add("brushedMetal",-.25,.48,dz,1.7,.08,.15);
      for(const dx of [-.85,.35])add("structuralDark",dx,.22,0,.1,.44,.56);
    }else{
      // Empty low cradles suggest maintenance workflow, never hard cover.
      for(const dx of [-.7,.7])add("paintedMetal",dx,.13,-.25,.1,.2,1.8);
      for(const dz of [-1.05,.55])add("brushedMetal",0,.11,dz,1.5,.16,.1);
      if(theme==="inspection"){
        // An open freestanding inspection rig at the edge of the pocket, not
        // over the road. No broad geometry at player height or hanging signs.
        for(const dx of [-.8,.8])add("brushedMetal",dx,1.9,-1.2,.1,3.8,.1);
        add("structuralDark",0,3.84,-1.2,1.8,.12,.14);
        add("windowLit",0,3.77,-1.2,.75,.016,.1);
      }
    }
    if(quality!=="low"){
      add("paintedMetal",-.7,.68,1.1,.09,1.36,.09);
      add("industrialOrange",-.7,1.37,1.1,.13,.06,.13);
      add("brushedMetal",-.7,.12,1.1,.35,.12,.38);
    }
    if(quality==="high"){
      add("industrialOrange",1.05,.85,.537,.115,.12,.016);
      add("brushedMetal",1.05,1.01,.537,.115,.04,.016);
    }
    return {id:`shipworks-street-${id}`,center:{x,y:deck.height,z},radius:2.1,parts};
  });
}
