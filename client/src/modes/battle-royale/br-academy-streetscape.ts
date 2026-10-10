import { BR_TERRACES, type Vec3 } from "@planetfall/shared";
import type { GraphicsQuality } from "../../settings";
import type { BrDistrictPropPart } from "./br-authored-district-props";

export interface BrAcademyStreetPocket {
  id: string;
  center: Vec3;
  radius: number;
  parts: BrDistrictPropPart[];
}

// Three deliberately uneven, fixed points along the actual Commons approach.
// This is not a roadside interval/candidate generator. Keep the road, garden
// combat zone, building entrances and existing specimen pocket separate.
const POCKETS = [
  ["north-arrival", -273, 263, true],
  ["commons-study", -272, 244, false],
  ["south-faculty", -273, 206, true],
] as const;

/** For the `connective-academy` camera's real raised district. World-space Y
 * already includes academy-commons-deck.height. Existing authored-prop batching
 * contract: unitBox/unitCylinder/unitOctahedron, radius-one radial geometry,
 * material registry (canopy uses canopy()), cameraCollision=false, no physics.
 * Low retains the three lamps and benches. Medium/high add narrow trees and
 * shallow planter detail, never putting crowns above the travel corridor.
 * No point lights, owned GPU resources, random placement or frame updates. */
export function buildBrAcademyStreetscape(quality: GraphicsQuality): BrAcademyStreetPocket[] {
  const deck=BR_TERRACES.find(t=>t.id==="academy-commons-deck");
  if(!deck||!Number.isFinite(deck.height))return [];
  return POCKETS.map(([id,x,z,tree])=>{
    const parts:BrDistrictPropPart[]=[];
    const add=(geometry:BrDistrictPropPart["geometry"],finish:BrDistrictPropPart["finish"],
      dx:number,y:number,dz:number,sx:number,sy:number,sz:number)=>parts.push({geometry,finish,
        position:{x:x+dx,y:deck.height+y,z:z+dz},scale:{x:sx,y:sy,z:sz},rotationY:0,surface:false});
    add("box","structuralDark",.9,1.7,.75,.1,3.4,.1);
    add("box","brushedMetal",.65,3.42,.75,.65,.12,.24);
    add("box","windowLit",.62,3.352,.75,.42,.018,.14);
    // A slatted, backless study seat faces the approach. Opaque furniture stays
    // below knee height, with visibly separate feet rather than a solid slab.
    for(const dx of [-.21,0,.21])add("box","brushedMetal",dx,.48,-.4,.15,.08,1.65);
    for(const dz of [-.95,.15])add("box","structuralDark",0,.22,dz,.58,.44,.1);
    if(quality!=="low"){
      add("box","paintedMetal",-.86,.15,.45,.75,.26,1.3);
      add("box","soil",-.86,.284,.45,.61,.016,1.15);
      if(tree){
        add("cylinder","soil",-.86,2.82,.45,.095,5.45,.095);
        add("octahedron","canopy",-.86,6.05,.45,.82,1.85,.8);
        if(quality==="high")add("octahedron","canopy",-.65,7.03,.42,.4,.87,.46);
      }else{
        add("octahedron","canopy",-.86,.54,.17,.28,.23,.3);
        add("octahedron","canopy",-.86,.54,.73,.28,.23,.3);
      }
    }
    if(quality==="high")add("box","paintedMetal",.9,1.58,.68,.26,.3,.035);
    return {id:`academy-street-${id}`,center:{x,y:deck.height,z},radius:2.1,parts};
  });
}
