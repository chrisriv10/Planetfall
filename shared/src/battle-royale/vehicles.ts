import {BR_BALANCE} from "./balance.js";
import {brClamp} from "./math.js";
import {brFloorHeightAt} from "./movement.js";
import {brAuthoredDeckHeight} from "./orbital-isle-elevation.js";
import type {Vec3} from "../index.js";
import type {BrVehicleState,BrVehicleKind} from "./types.js";

export interface BrVehicleSpawn {id:string;position:Vec3;yaw:number;kind?:BrVehicleKind;}
export const BR_VEHICLE_DEFINITIONS={
  "hover-skimmer":{name:"HOVER SKIMMER",seats:[{x:0,y:1.04,z:-.08}],maxSpeed:25,reverseSpeed:8,acceleration:20,braking:28,turnRate:1.85,collisionRadius:2.45,hoverHeight:.44,entryRange:3.2,exitOffset:2.35,flight:false,liftSpeed:0,maxClearance:0},
  "relay-rover":{name:"RELAY ROVER",seats:[{x:-.63,y:.88,z:.55},{x:.63,y:.88,z:.55},{x:-.63,y:.88,z:-.95},{x:.63,y:.88,z:-.95}],maxSpeed:21,reverseSpeed:7,acceleration:15,braking:25,turnRate:1.4,collisionRadius:3.1,hoverHeight:.38,entryRange:4.2,exitOffset:3.1,flight:false,liftSpeed:0,maxClearance:0},
  "ion-shuttle":{name:"ION SHUTTLE",seats:[{x:-.55,y:1,z:-.15},{x:.55,y:1,z:-.15}],maxSpeed:32,reverseSpeed:9,acceleration:14,braking:18,turnRate:1.2,collisionRadius:3.6,hoverHeight:.8,entryRange:4.4,exitOffset:4.1,flight:true,liftSpeed:10,maxClearance:85},
} satisfies Record<BrVehicleKind,{name:string;seats:Vec3[];maxSpeed:number;reverseSpeed:number;acceleration:number;braking:number;turnRate:number;collisionRadius:number;hoverHeight:number;entryRange:number;exitOffset:number;flight:boolean;liftSpeed:number;maxClearance:number}>;

export function brVehicleSeatIndex(vehicle:BrVehicleState,playerId:string):number {
  if(vehicle.driverId===playerId)return 0;
  const passenger=vehicle.passengerIds?.indexOf(playerId)??-1;
  return passenger<0?-1:passenger+1;
}
export function brBoardVehicle(vehicle:BrVehicleState,playerId:string):number {
  const existing=brVehicleSeatIndex(vehicle,playerId);if(existing>=0)return existing;
  if(!vehicle.driverId){vehicle.driverId=playerId;return 0;}
  const capacity=BR_VEHICLE_DEFINITIONS[vehicle.kind].seats.length-1;
  vehicle.passengerIds??=Array.from({length:capacity},()=>null);
  for(let index=0;index<capacity;index++)if(!vehicle.passengerIds[index]){vehicle.passengerIds[index]=playerId;return index+1;}
  return -1;
}
export function brLeaveVehicle(vehicle:BrVehicleState,playerId:string):void {
  if(vehicle.driverId===playerId){vehicle.driverId=null;vehicle.velocity={x:0,y:0,z:0};}
  const index=vehicle.passengerIds?.indexOf(playerId)??-1;
  if(index>=0)vehicle.passengerIds![index]=null;
}
export function brVehicleSeatPosition(vehicle:BrVehicleState,seatIndex:number):Vec3 {
  // Preserve the existing skimmer's authoritative pilot origin. Its visual
  // rig uses the established driver anchor independently.
  if(vehicle.kind==="hover-skimmer")return {...vehicle.position,y:vehicle.position.y+.62};
  const seat=BR_VEHICLE_DEFINITIONS[vehicle.kind].seats[seatIndex]??BR_VEHICLE_DEFINITIONS[vehicle.kind].seats[0],angle=Math.PI-vehicle.yaw,c=Math.cos(angle),s=Math.sin(angle);
  return {x:vehicle.position.x+seat.x*c+seat.z*s,y:vehicle.position.y+seat.y,z:vehicle.position.z-seat.x*s+seat.z*c};
}

/** Fixed parking/service bays. Physical placement is authored and identical
 * every match; these are transit infrastructure, not random loot. */
const vehicleBays:readonly BrVehicleSpawn[]=[
  {id:"nova-transit",position:{x:-111,y:.44,z:-196},yaw:0},
  {id:"dock-freight",position:{x:152,y:.44,z:-226},yaw:Math.PI/2},
  {id:"south-terminal",position:{x:2,y:3.94,z:-386},yaw:Math.PI},
  {id:"academy-link",position:{x:-232,y:.44,z:196},yaw:Math.PI/2},
  {id:"mall-arrivals",position:{x:-141,y:.8,z:312},yaw:0},
  {id:"farm-service",position:{x:280,y:.44,z:366},yaw:Math.PI},
  {id:"helios-service",position:{x:320,y:.44,z:142},yaw:-Math.PI/2},
  {id:"thruster-gate",position:{x:382,y:.44,z:-144},yaw:Math.PI}
] as const;

// Query from the authored district deck rather than the old parked height:
// a buried bay cannot discover a raised platform with a downward floor query.
// Keep the probe below upper floors/roofs at covered ground-level bays.
export const BR_VEHICLE_SPAWNS:readonly BrVehicleSpawn[]=[...vehicleBays.map(spawn=>({
  ...spawn,
  position:{...spawn.position,y:brFloorHeightAt(spawn.position,Math.max(spawn.position.y,brAuthoredDeckHeight(spawn.position))+.5)+BR_BALANCE.vehicle.hoverHeight}
}))];
/** Fixed additional team-transport bays; static map geometry remains unchanged. */
export const BR_TEAM_VEHICLE_SPAWNS:readonly BrVehicleSpawn[]=[{id:"nova-relay-rover",kind:"relay-rover",position:{x:-111,y:5.38,z:-180},yaw:0},
{id:"dock-ion-shuttle",kind:"ion-shuttle",position:{x:137,y:.8,z:-226},yaw:Math.PI/2},
{id:"farm-ion-shuttle",kind:"ion-shuttle",position:{x:264,y:3.8,z:366},yaw:Math.PI}].map(spawn=>({...spawn,kind:spawn.kind as BrVehicleKind,position:{...spawn.position,y:brFloorHeightAt(spawn.position,spawn.position.y+2)+BR_VEHICLE_DEFINITIONS[spawn.kind as BrVehicleKind].hoverHeight}}));

export interface BrVehicleInput {moveX:number;moveY:number;lift?:number;}

/** Flight envelope stays over the fixed island. A swept hull collision query
 * is supplied by authority/prediction before accepting the resulting pose. */
export function brVehicleFlightHeight(vehicle:BrVehicleState,proposedY:number,floor:number):number {
  const definition=BR_VEHICLE_DEFINITIONS[vehicle.kind];
  return definition.flight?brClamp(proposedY,floor+definition.hoverHeight,BR_BALANCE.shipHeight-25):floor+definition.hoverHeight;
}

/** Kinematic authority step. Collision/floor resolution is supplied by the
 * room after this deterministic drive intent is calculated. */
export function stepBrVehicle(vehicle:BrVehicleState,input:BrVehicleInput,rawDt:number):BrVehicleState {
  const definition=BR_VEHICLE_DEFINITIONS[vehicle.kind];
  const dt=brClamp(Number.isFinite(rawDt)?rawDt:0,0,.1);
  const steer=brClamp(Number(input.moveX)||0,-1,1),throttle=brClamp(Number(input.moveY)||0,-1,1);
  const forward={x:Math.sin(vehicle.yaw),z:-Math.cos(vehicle.yaw)};
  const speed=vehicle.velocity.x*forward.x+vehicle.velocity.z*forward.z;
  const target=throttle>=0?throttle*definition.maxSpeed:throttle*definition.reverseSpeed;
  const rate=Math.abs(target)<Math.abs(speed)?definition.braking:definition.acceleration;
  const nextSpeed=Math.abs(target-speed)<=rate*dt?target:speed+Math.sign(target-speed)*rate*dt;
  const speedRatio=Math.min(1,Math.abs(nextSpeed)/definition.maxSpeed);
  const direction=nextSpeed<-.05?-1:1;
  const yaw=vehicle.yaw+steer*definition.turnRate*(.28+speedRatio*.72)*dt*direction;
  const nextForward={x:Math.sin(yaw),z:-Math.cos(yaw)};
  const liftTarget=definition.flight?brClamp(Number(input.lift)||0,-1,1)*definition.liftSpeed:0;
  const liftDelta=liftTarget-vehicle.velocity.y,liftRate=definition.flight?16*dt:Infinity;
  const velocity={x:nextForward.x*nextSpeed,y:vehicle.velocity.y+brClamp(liftDelta,-liftRate,liftRate),z:nextForward.z*nextSpeed};
  return{...vehicle,yaw,velocity,position:{x:vehicle.position.x+velocity.x*dt,y:vehicle.position.y+velocity.y*dt,z:vehicle.position.z+velocity.z*dt}};
}
