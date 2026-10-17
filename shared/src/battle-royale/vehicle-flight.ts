import type {Vec3} from "../index.js";
import {BR_VEHICLE_DEFINITIONS,brVehicleFlightHeight} from "./vehicles.js";
import {isInsideBrIsland} from "./map.js";
import type {BrVehicleState} from "./types.js";

export type BrVehicleRay=(origin:Vec3,direction:Vec3,maximum:number)=>number;
/** Conservative swept cabin/wing probes, shared by authority and prediction.
 * Moving from A to B tests the whole segment, not just the final location. */
export function brResolveFlight(vehicle:BrVehicleState,intent:BrVehicleState,floor:number,ray:BrVehicleRay):BrVehicleState {
  const definition=BR_VEHICLE_DEFINITIONS[vehicle.kind];
  const proposed={...intent.position,y:brVehicleFlightHeight(vehicle,intent.position.y,floor)};
  if(!isInsideBrIsland(proposed,definition.collisionRadius+3))return {...vehicle,velocity:{x:0,y:0,z:0}};
  const dx=proposed.x-vehicle.position.x,dy=proposed.y-vehicle.position.y,dz=proposed.z-vehicle.position.z;
  const turn=Math.atan2(Math.sin(intent.yaw-vehicle.yaw),Math.cos(intent.yaw-vehicle.yaw));
  const angle=Math.PI-vehicle.yaw,c=Math.cos(angle),s=Math.sin(angle),endAngle=angle-turn,ec=Math.cos(endAngle),es=Math.sin(endAngle);
  // Each wing tip and the cabin corners protect against side walls and roofs.
  const probes=[[-3.4,.85,0],[3.4,.85,0],[-1.2,.5,-2.4],[1.2,.5,-2.4],[-1.2,1.8,2.4],[1.2,1.8,2.4],[0,.45,0],[0,2,0],[-.55,2.8,-.15],[.55,2.8,-.15]];
  let fraction=1;
  for(const [x,y,z]of probes){
    const origin={x:vehicle.position.x+x*c+z*s,y:vehicle.position.y+y,z:vehicle.position.z-x*s+z*c};
    // Sweep each point from its old orientation, including rotation at rest.
    const px=dx+x*ec+z*es-(x*c+z*s),pz=dz-x*es+z*ec-(-x*s+z*c),length=Math.hypot(px,dy,pz);
    if(length<1e-6)continue;
    const direction={x:px/length,y:dy/length,z:pz/length};
    fraction=Math.min(fraction,Math.max(0,ray(origin,direction,length+.08)-.08)/length);
  }
  return {...intent,yaw:vehicle.yaw+turn*fraction,position:{x:vehicle.position.x+dx*fraction,y:vehicle.position.y+dy*fraction,z:vehicle.position.z+dz*fraction},velocity:fraction<1?{x:0,y:0,z:0}:intent.velocity};
}
