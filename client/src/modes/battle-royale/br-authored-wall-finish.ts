import * as THREE from "three";
import { BR_ELEVATION_REGIONS, BR_POIS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES, BR_TERRACES, type BrMapBlock, type BrStructure } from "@planetfall/shared";
import { brDistrictPalette } from "./br-district-palette";

export type BrAuthoredWallFinishKind="room-wall"|"retaining-wall"|"district-slab"|"interior-slab"|"unchanged";
export interface BrAuthoredWallFinish {
  kind:BrAuthoredWallFinishKind;
  family:ReturnType<typeof brDistrictPalette>["id"];
  sourceColor:string;
  wallTint:THREE.Color;
  slab:{top:THREE.Color;side:THREE.Color;underside:THREE.Color};
}
const districts=[...BR_POIS,...BR_SECONDARY_LOCATIONS];
const terraceIds=new Set(BR_TERRACES.flatMap(t=>[`${t.id}-platform`,`${t.id}-ramp`]));
const retainingIds=new Set(BR_ELEVATION_REGIONS.filter(r=>r.height<0).flatMap(r=>["north","south","east","west"].map(side=>`${r.id}-retaining-${side}`)));

/** Medium matte partition paint: a warm neutral body with a restrained district
 * cast. Fresh colors prevent callers from mutating a shared palette value. */
export function brAuthoredRoomTint(color:THREE.ColorRepresentation):THREE.Color {
  return new THREE.Color("#92978f").lerp(brDistrictPalette(color).facade,.18);
}

/** Select finish only; never infer new solids, floors, or opening geometry.
 * Explicit terrace/basin catalog IDs distinguish exposed retaining masses from
 * structure-owned floor/roof/stair slabs. Unknown slabs preserve their current
 * readable interior treatment. Slab colors are linear THREE.Color values for
 * the existing unit-box's local top/side/underside normals, before rotation.
 * Eight district color sets plus one interior set suffice for all slabs. */
export function brAuthoredWallFinish(
  block:BrMapBlock,
  structures:readonly BrStructure[]=BR_STRUCTURES,
  districtColors:readonly {id:string;color:string}[]=districts,
):BrAuthoredWallFinish {
  // A literal terrace can share a building prefix (astra-lab-court). Catalog
  // ownership outranks prefix inference for both classification and palette.
  const owner=terraceIds.has(block.id)?undefined:structures.filter(s=>block.id.startsWith(`${s.id}-`)).sort((a,b)=>b.id.length-a.id.length)[0];
  const sourceColor=owner?.color??districtColors.find(d=>d.id===block.districtId)?.color??block.color;
  const palette=brDistrictPalette(sourceColor);
  let kind:BrAuthoredWallFinishKind="unchanged";
  if(block.kind==="wall"&&owner&&block.id.startsWith(`${owner.id}-room-`))kind="room-wall";
  else if(block.kind==="wall"&&retainingIds.has(block.id))kind="retaining-wall";
  else if(block.kind==="platform"||block.kind==="ramp")kind=!owner&&terraceIds.has(block.id)?"district-slab":"interior-slab";
  const side=kind==="district-slab"?palette.facade.clone().lerp(new THREE.Color("#74818a"),.18):new THREE.Color("#b7c6cb");
  return {kind,family:palette.id,sourceColor,wallTint:kind==="room-wall"?brAuthoredRoomTint(sourceColor):palette.shell.clone(),
    slab:{top:new THREE.Color("#263548"),side,underside:kind==="district-slab"?side.clone().multiplyScalar(.8):side.clone()}};
}
