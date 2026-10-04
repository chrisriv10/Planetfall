import {BR_BALANCE} from "./balance.js";
import {brClamp} from "./math.js";
import type {Vec3} from "../index.js";
import type {BrVehicleState} from "./types.js";

export interface BrVehicleSpawn {id:string;position:Vec3;yaw:number;}

/** Fixed parking/service bays. Physical placement is authored and identical
 * every match; these are transit infrastructure, not random loot. */
export const BR_VEHICLE_SPAWNS:readonly BrVehicleSpawn[]=[
  {id:"nova-transit",position:{x:-111,y:.44,z:-196},yaw:0},
  {id:"dock-freight",position:{x:152,y:.44,z:-226},yaw:Math.PI/2},
  {id:"south-terminal",position:{x:2,y:3.94,z:-386},yaw:Math.PI},
  {id:"academy-link",position:{x:-232,y:.44,z:196},yaw:Math.PI/2},
  {id:"mall-arrivals",position:{x:-141,y:.8,z:312},yaw:0},
  {id:"farm-service",position:{x:280,y:.44,z:366},yaw:Math.PI},
  {id:"helios-service",position:{x:320,y:.44,z:142},yaw:-Math.PI/2},
  {id:"thruster-gate",position:{x:382,y:.44,z:-144},yaw:Math.PI}
] as const;

export interface BrVehicleInput {moveX:number;moveY:number;}

/** Kinematic authority step. Collision/floor resolution is supplied by the
 * room after this deterministic drive intent is calculated. */
export function stepBrVehicle(vehicle:BrVehicleState,input:BrVehicleInput,rawDt:number):BrVehicleState {
  const dt=brClamp(Number.isFinite(rawDt)?rawDt:0,0,.1);
  const steer=brClamp(Number(input.moveX)||0,-1,1),throttle=brClamp(Number(input.moveY)||0,-1,1);
  const forward={x:Math.sin(vehicle.yaw),z:-Math.cos(vehicle.yaw)};
  const speed=vehicle.velocity.x*forward.x+vehicle.velocity.z*forward.z;
  const target=throttle>=0?throttle*BR_BALANCE.vehicle.maxSpeed:throttle*BR_BALANCE.vehicle.reverseSpeed;
  const rate=Math.abs(target)<Math.abs(speed)?BR_BALANCE.vehicle.braking:BR_BALANCE.vehicle.acceleration;
  const nextSpeed=Math.abs(target-speed)<=rate*dt?target:speed+Math.sign(target-speed)*rate*dt;
  const speedRatio=Math.min(1,Math.abs(nextSpeed)/BR_BALANCE.vehicle.maxSpeed);
  const direction=nextSpeed<-.05?-1:1;
  const yaw=vehicle.yaw+steer*BR_BALANCE.vehicle.turnRate*(.28+speedRatio*.72)*dt*direction;
  const nextForward={x:Math.sin(yaw),z:-Math.cos(yaw)};
  const velocity={x:nextForward.x*nextSpeed,y:0,z:nextForward.z*nextSpeed};
  return{...vehicle,yaw,velocity,position:{x:vehicle.position.x+velocity.x*dt,y:vehicle.position.y,z:vehicle.position.z+velocity.z*dt}};
}
