import type { BrStructure, Vec3 } from "@planetfall/shared";

export type ReactorFloorPart={finish:"channel"|"energy"|"warning";position:Vec3;scale:Vec3};

/** Visual-only power channels set into Helios Core's existing ground slab.
 * The central entry/door lane and the partition doorway stay clear. */
export function buildReactorFloorChannels(structure:BrStructure):ReactorFloorPart[]{
  if(structure.id!=="helios-core"||structure.districtId!=="helios-reactor"||!structure.enterable)return[];
  const parts:ReactorFloorPart[]=[];
  const startZ=structure.position.z-structure.size.z/2+3.1;
  const endZ=structure.position.z+structure.size.z*.18-1.25;
  const length=endZ-startZ,centerZ=(startZ+endZ)/2;
  for(const side of [-1,1])for(const offset of [7.1,12.7]){
    const x=structure.position.x+side*offset;
    parts.push({finish:"channel",position:{x,y:.374,z:centerZ},scale:{x:.3,y:.025,z:length}});
    parts.push({finish:"energy",position:{x,y:.391,z:centerZ},scale:{x:.07,y:.012,z:length-.45}});
    for(const phase of [.22,.58,.84])parts.push({finish:"warning",position:{x:x-side*.24,y:.392,z:startZ+length*phase},scale:{x:.27,y:.012,z:.055}});
  }
  return parts;
}
