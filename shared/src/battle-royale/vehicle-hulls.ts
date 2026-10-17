import type {BrVehicleState,BrVehicleKind} from "./types.js";
import type {Vec3} from "../index.js";

export const BR_SKIMMER_HULL_OUTLINE:readonly (readonly [number,number])[]=[[-.7,-2.2],[.7,-2.2],[1.03,-1.55],[1.1,.85],[.62,2.2],[-.62,2.2],[-1.1,.85],[-1.03,-1.55]];
export const BR_SKIMMER_UNDERBODY_OUTLINE:readonly (readonly [number,number])[]=[[-.7,-1.72],[.7,-1.72],[.88,-.9],[.76,1.48],[-.76,1.48],[-.88,-.9]];
function prism(outline:readonly (readonly [number,number])[],bottom:number,top:number):Float32Array {
  return new Float32Array([bottom,top].flatMap(y=>outline.flatMap(([x,z])=>[x,y,z])));
}
function box(x:number,y:number,z:number,sx:number,sy:number,sz:number):Float32Array {
  return prism([[x-sx/2,z-sz/2],[x+sx/2,z-sz/2],[x+sx/2,z+sz/2],[x-sx/2,z+sz/2]],y-sy/2,y+sy/2);
}
/** Local +Z faces forward, matching the visible skimmer. Vertices already
 * include each part's local height; only vehicle translation/yaw is dynamic. */
export const BR_SKIMMER_COLLISION_HULLS:readonly Float32Array[]=[
  prism(BR_SKIMMER_HULL_OUTLINE,.59,1.07),prism(BR_SKIMMER_UNDERBODY_OUTLINE,.50,.72),
  box(0,1.18,-.08,1.02,.20,.82),box(0,1.48,-.66,.98,.70,.18),
  box(0,1.63,.70,.88,.48,.40),
];
const TEAM_HULLS:Record<Exclude<BrVehicleKind,"hover-skimmer">,readonly Float32Array[]>={
  "relay-rover":[box(0,.88,0,3,.48,5.6),box(0,.55,0,2.6,.3,4.8)],
  "ion-shuttle":[box(0,.825,0,2.4,.75,4.8),box(0,.85,0,6.8,.2,1)],
};
export function brVehicleCollisionHulls(kind:BrVehicleKind):readonly Float32Array[]{return kind==="hover-skimmer"?BR_SKIMMER_COLLISION_HULLS:TEAM_HULLS[kind];}
export function brNearVehicleHull(feet:Vec3,movement:Vec3,vehicles:readonly BrVehicleState[]):boolean {
  const reach=4.4+Math.hypot(movement.x,movement.z);
  return vehicles.some(vehicle=>Math.abs(feet.y-vehicle.position.y)<4&&(feet.x-vehicle.position.x)**2+(feet.z-vehicle.position.z)**2<reach*reach);
}
