import type {BrPoi,Vec3} from "@planetfall/shared";

export type NexusPlazaPart={finish:"inset"|"energy"|"warning";position:Vec3;scale:Vec3;rotationY:number};

/** Flat, visual-only containment markings around Zero Point's real tower.
 * The parts remain outside the playable tower footprint and below ankle height. */
export function buildNexusPlaza(poi:BrPoi):NexusPlazaPart[]{
  if(poi.id!=="zero-point"||poi.style!=="nexus")return[];
  const parts:NexusPlazaPart[]=[];
  for(let index=0;index<12;index++){
    const angle=index/12*Math.PI*2,radius=20.5,x=poi.position.x+Math.cos(angle)*radius,z=poi.position.z+Math.sin(angle)*radius;
    parts.push({finish:"inset",position:{x,y:.401,z},scale:{x:2.5,y:.028,z:6.1},rotationY:-angle});
    parts.push({finish:index%3===0?"warning":"energy",position:{x:poi.position.x+Math.cos(angle)*17.55,y:.421,z:poi.position.z+Math.sin(angle)*17.55},scale:{x:index%3===0?.22:.09,y:.014,z:4.8},rotationY:-angle});
  }
  return parts;
}
