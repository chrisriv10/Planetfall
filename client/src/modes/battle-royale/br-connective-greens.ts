import { BR_GREENWAY_TREES, type Vec3 } from "@planetfall/shared";
import type { GraphicsQuality } from "../../settings";

export interface BrGreenwayPart {
  geometry:"box"|"cylinder"|"octahedron";
  finish:"canopy"|"soil"|"energyCyan"|"energyPurple"|"grass";
  position:Vec3; scale:Vec3; rotationY:number;
}
/** Crowns and flush planting insets use authoritative tree placements. Real
 * trunk solids render separately at every quality. No relocation or scatter,
 * lights, texture ownership, physics, animation, or per-tree draw calls. */
export function buildBrConnectiveGreens(quality:GraphicsQuality):BrGreenwayPart[]{
  const parts:BrGreenwayPart[]=[];
  for(const [index,tree] of BR_GREENWAY_TREES.entries()){
    const {position:p,height:h,radius:r}=tree,yaw=(index%5)*.47;
    parts.push({geometry:"octahedron",finish:"canopy",position:{...p,y:p.y+h*.72},scale:{x:r,y:h*.32,z:r*.85},rotationY:yaw});
    if(quality!=="low"){
      parts.push({geometry:"octahedron",finish:"canopy",position:{x:p.x+r*.28,y:p.y+h*.56,z:p.z-r*.17},scale:{x:r*.72,y:h*.24,z:r*.68},rotationY:yaw+.7});
      parts.push({geometry:"octahedron",finish:"canopy",position:{x:p.x-r*.32,y:p.y+h*.84,z:p.z+r*.12},scale:{x:r*.63,y:h*.23,z:r*.64},rotationY:yaw-.4});
    }
    parts.push({geometry:"cylinder",finish:"soil",position:{...p,y:p.y+.014},scale:{x:r*.6,y:.012,z:r*.6},rotationY:yaw});
    // Small planting-edge inlays tie the greenways into the colony's light
    // language. They remain flush and cannot look like usable barriers.
    const finish=tree.color==="violet"?"energyPurple":tree.color==="mint"?"grass":"energyCyan";
    for(const side of [-1,1])parts.push({geometry:"box",finish,position:{x:p.x+side*r*.63,y:p.y+.026,z:p.z},scale:{x:.075,y:.018,z:r*.9},rotationY:0});
  }
  return parts;
}
