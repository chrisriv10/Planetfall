import type { BrWeaponId, Vec3 } from "@planetfall/shared";

export type BrCameraMode = "grounded" | "aiming" | "freefall" | "chute" | "downed" | "spectator";

export interface BrCameraPreset {
  boom: number;
  height: number;
  focusHeight: number;
  shoulder: number;
  fov: number;
}

export interface BrCameraGeometry extends BrCameraPreset {
  focus: Vec3;
  desired: Vec3;
  aimDirection: Vec3;
  horizontalForward: Vec3;
  right: Vec3;
}

export interface BrShipLookState { yaw: number; initialized: boolean; }
export interface BrShipCameraFrame { focus: Vec3; desired: Vec3; }
export interface BrAimProfile { fov:number; sensitivity:number; scope:"rail"|"pulse"|null; }

/** Mouse deltas and the right-stick X axis are positive toward screen-right.
 * Keep input mapping explicit beside the canonical camera/aim forward basis. */
export function brLookAngles(yaw:number,pitch:number,lookX:number,lookY:number,scale:number,invertY=false):{yaw:number;pitch:number} {
  // Forward=(sin(yaw),0,-cos(yaw)): its yaw derivative IS camera-right.
  return {yaw:yaw+lookX*scale,pitch:Math.max(-.75,Math.min(1.15,pitch-lookY*scale*(invertY?-1:1)))};
}

/** Original Planetfall optics: the precision rail optic is a true scope while
 * the Pulse Rifle gets a lighter reflex zoom. Other weapons retain shoulder ADS. */
export function brAimProfile(weaponId:BrWeaponId|null,aiming:boolean):BrAimProfile {
  if(!aiming)return {fov:70,sensitivity:1,scope:null};
  if(weaponId==="rail-laser")return {fov:36,sensitivity:.42,scope:"rail"};
  if(weaponId==="pulse-rifle")return {fov:52,sensitivity:.68,scope:"pulse"};
  return {fov:62,sensitivity:.82,scope:null};
}

/** Route-facing yaw is only a starting suggestion. Once initialized, the
 * pilot owns the camera and mouse/right-stick look must never be overwritten
 * by the moving transport. */
export function brShipLookState(currentYaw:number,route:{x:number;z:number},initialized:boolean):BrShipLookState {
  if(initialized)return{yaw:currentYaw,initialized:true};
  const length=Math.hypot(route.x,route.z);
  return {yaw:length>.0001?Math.atan2(route.x/length,-route.z/length):currentYaw,initialized:true};
}

const PRESETS: Record<BrCameraMode, BrCameraPreset> = {
  grounded: { boom: 6.15, height: 2.42, focusHeight: 1.22, shoulder: .68, fov: 70 },
  aiming: { boom: 5.65, height: 2.32, focusHeight: 1.2, shoulder: .8, fov: 62 },
  freefall: { boom: 10.2, height: 3.15, focusHeight: 1.05, shoulder: .22, fov: 76 },
  chute: { boom: 9.1, height: 2.8, focusHeight: 1.05, shoulder: .25, fov: 73 },
  downed: { boom: 5.45, height: 1.22, focusHeight: .48, shoulder: .28, fov: 68 },
  spectator: { boom: 7.15, height: 2.4, focusHeight: 1.02, shoulder: .28, fov: 70 }
};

/** The transport uses the SAME yaw/pitch basis as movement and aiming. Route
 * facing is seeded once by brShipLookState; it does not own the boom afterward.
 * Orbiting the ship must move the camera, not merely turn a camera still locked
 * behind the route. Pitch is deliberately part of this large exterior orbit. */
export function brShipCameraFrame(position:Vec3,yaw:number,pitch:number):BrShipCameraFrame {
  const distance=78,cosPitch=Math.cos(pitch);
  const forward={x:Math.sin(yaw)*cosPitch,y:Math.sin(pitch),z:-Math.cos(yaw)*cosPitch};
  return {
    focus:{x:position.x,y:position.y+2,z:position.z},
    desired:{x:position.x-forward.x*distance,y:position.y+2-forward.y*distance,z:position.z-forward.z*distance}
  };
}

export function brCameraMode(deployment: string, downed: boolean, aiming: boolean, spectator: boolean): BrCameraMode {
  if (spectator) return "spectator";
  if (deployment === "freefall" || deployment === "attached") return "freefall";
  if (deployment === "chute") return "chute";
  if (downed) return "downed";
  return aiming ? "aiming" : "grounded";
}

/**
 * Give an untouched ship camera a useful view of the island when the player
 * jumps. Deliberate look input is preserved instead of being snapped away.
 */
export function brDropEntryPitch(currentPitch: number): number {
  return currentPitch >= -.18 && currentPitch <= .18 ? -.3 : currentPitch;
}

/** Forced ejection owns the initial travel direction, unlike a deliberate
 * player jump which must preserve free look. Point the camera along the
 * authoritative safe velocity so an inward launch never appears to throw the
 * astronaut toward empty space. */
export function brForcedDropLookYaw(velocity:Pick<Vec3,"x"|"z">,fallback:number):number {
  const speed=Math.hypot(velocity.x,velocity.z);
  return speed>.001?Math.atan2(velocity.x,-velocity.z):fallback;
}

/** Yaw controls the physical orbit. Pitch controls the aim ray, not boom position. */
export function brCameraGeometry(feet: Vec3, yaw: number, pitch: number, mode: BrCameraMode, speed = 0): BrCameraGeometry {
  const base = PRESETS[mode];
  const sprintFov = mode === "grounded" ? Math.min(2, Math.max(0, speed - 8) * .8) : 0;
  const horizontalForward = { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), y: 0, z: Math.sin(yaw) };
  const cosPitch = Math.cos(pitch);
  const aimDirection = { x: horizontalForward.x * cosPitch, y: Math.sin(pitch), z: horizontalForward.z * cosPitch };
  const focus = { x: feet.x, y: feet.y + base.focusHeight, z: feet.z };
  const desired = {
    x: feet.x - horizontalForward.x * base.boom + right.x * base.shoulder,
    y: feet.y + base.height,
    z: feet.z - horizontalForward.z * base.boom + right.z * base.shoulder
  };
  return { ...base, fov: base.fov + sprintFov, focus, desired, aimDirection, horizontalForward, right };
}
