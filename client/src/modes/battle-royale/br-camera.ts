import type { Vec3 } from "@planetfall/shared";

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

const PRESETS: Record<BrCameraMode, BrCameraPreset> = {
  grounded: { boom: 6.15, height: 2.05, focusHeight: 1.02, shoulder: .68, fov: 70 },
  aiming: { boom: 5.65, height: 2, focusHeight: 1.04, shoulder: .8, fov: 62 },
  freefall: { boom: 10.2, height: 3.15, focusHeight: 1.05, shoulder: .22, fov: 76 },
  chute: { boom: 9.1, height: 2.8, focusHeight: 1.05, shoulder: .25, fov: 73 },
  downed: { boom: 5.45, height: 1.22, focusHeight: .48, shoulder: .28, fov: 68 },
  spectator: { boom: 7.15, height: 2.4, focusHeight: 1.02, shoulder: .28, fov: 70 }
};

export function brCameraMode(deployment: string, downed: boolean, aiming: boolean, spectator: boolean): BrCameraMode {
  if (spectator) return "spectator";
  if (deployment === "freefall" || deployment === "attached") return "freefall";
  if (deployment === "chute") return "chute";
  if (downed) return "downed";
  return aiming ? "aiming" : "grounded";
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
