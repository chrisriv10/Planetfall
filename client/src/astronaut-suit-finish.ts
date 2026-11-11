import type {Color} from "three";
import type {AstronautVisual} from "./astronaut";

export type AstronautSuitStyle = "pressure" | "courier" | "salvage";

const finishes = {
  pressure: {color:0xd1e5f2, roughness:.34, metalness:.06, accentRoughness:.28, accentMetalness:.16},
  courier:  {color:0x33494c, roughness:.51, metalness:.22, accentRoughness:.37, accentMetalness:.25},
  salvage:  {color:0x826c60, roughness:.72, metalness:.49, accentRoughness:.62, accentMetalness:.36},
} as const;

interface OriginalFinish {
  style:AstronautSuitStyle;
  color:Color;
  roughness:number;
  metalness:number;
  accentRoughness:number;
  accentMetalness:number;
}
const originalFinishes=new WeakMap<AstronautVisual,OriginalFinish>();

/** The caller sets the equipped accent color. Only the housing color and panel finish vary here. */
export function applyAstronautSuitFinish(rig:AstronautVisual, style:AstronautSuitStyle|null):void {
  const original=originalFinishes.get(rig);
  if(original?.style===style || (!style && !original))return;
  const body=rig.torso.material,accent=rig.suitMaterial;
  if(!style){
    if(original){
      body.color.copy(original.color);
      body.roughness=original.roughness;body.metalness=original.metalness;
      accent.roughness=original.accentRoughness;accent.metalness=original.accentMetalness;
      originalFinishes.delete(rig);
    }
    return;
  }
  if(original)original.style=style;
  else originalFinishes.set(rig,{
    style,color:body.color.clone(),roughness:body.roughness,metalness:body.metalness,
    accentRoughness:accent.roughness,accentMetalness:accent.metalness,
  });
  const finish=finishes[style];
  body.color.setHex(finish.color);
  body.roughness=finish.roughness;body.metalness=finish.metalness;
  accent.roughness=finish.accentRoughness;accent.metalness=finish.accentMetalness;
}
