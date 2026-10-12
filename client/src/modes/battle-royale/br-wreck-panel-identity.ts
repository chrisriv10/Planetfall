import type { BrStructure } from "@planetfall/shared";
import type { WreckInteriorPart } from "./br-wreck";

/** Replace only the canonical low service-locker faces. World X/Z, building-
 * local Y, exactly like buildWreckInterior. Existing backing boxes, vents and
 * ceiling details remain identical. Five existing face/rail/light descriptors
 * become five maintenance-cassette descriptors, with no new resource or volume.
 * Unknown or changed source groups are retained, never guessed into place. */
export function buildBrWreckPanelIdentity(structure:BrStructure,source:readonly WreckInteriorPart[]):WreckInteriorPart[]{
 const output=[...source];if(structure.id!=="crash-fuselage")return output;
 const near=(a:number,b:number)=>Math.abs(a-b)<1e-6;
 for(let i=1;i+4<source.length;i++){
  const face=source[i],back=source[i-1];
  if(face.finish!=="panel"||!near(face.scale.x,4.2)||!near(face.scale.y,2.36)||!near(face.scale.z,.08)||!near(face.position.y,1.8))continue;
  const side=Math.sign(face.position.z-structure.position.z);if(!side)continue;
  if(back.finish!=="frame"||!near(back.position.x,face.position.x)||!near(back.scale.x,4.6)||!near(back.scale.y,2.8)||!near(back.scale.z,.55)||!near(back.position.z-face.position.z,side*.3))continue;
  const a=source[i+1],b=source[i+2],c=source[i+3],d=source[i+4];
  if(a.finish!=="frame"||c.finish!=="frame"||b.finish!=="light"||d.finish!=="light"||
   !near(a.position.x,face.position.x-1.35)||!near(c.position.x,face.position.x+1.35)||
   !near(b.position.x,face.position.x-.8)||!near(d.position.x,face.position.x+.8)||
   ![a,b,c,d].every(p=>near(p.position.z,face.position.z-side*.06)))continue;
  output[i]={...face,finish:"frame"};
  // Two shallow cartridge drawers and small attached status cores occupy the
  // old face dressing layer; backing remains visible between and around them.
  for(const [railIndex,lightIndex,row] of [[i+1,i+2,-1],[i+3,i+4,1]] as const){
   output[railIndex]={finish:"panel",position:{x:face.position.x-.1,y:1.8+row*.46,z:face.position.z-side*.06},scale:{x:2.85,y:.37,z:.04}};
   output[lightIndex]={finish:"light",position:{x:face.position.x+1.64,y:1.8+row*.46,z:face.position.z-side*.06},scale:{x:.08,y:.17,z:.04}};
  }
 }
 return output;
}
