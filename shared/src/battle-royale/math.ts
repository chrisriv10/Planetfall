import type { Vec3 } from "../index.js";
import type { BrStormState } from "./types.js";

export function brClamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
export function brDistance2d(a: Pick<Vec3, "x" | "z">, b: Pick<Vec3, "x" | "z">): number { return Math.hypot(a.x - b.x, a.z - b.z); }
export function brNormalize(value: Vec3): Vec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  return length > 1e-7 && Number.isFinite(length) ? { x: value.x / length, y: value.y / length, z: value.z / length } : { x: 0, y: 0, z: -1 };
}
export function brAimDirection(yaw: number, pitch: number): Vec3 {
  return brNormalize({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });
}

/** Same bounded muzzle convergence on the client and authority. Reject targets
 * behind the muzzle instead of presenting a shot the server must discard. */
export function brShotDirectionAllowed(direction:Vec3,yaw:number,pitch:number):boolean {
  const length=Math.hypot(direction.x,direction.y,direction.z);
  if(!Number.isFinite(length)||length<1e-5||!Number.isFinite(yaw)||!Number.isFinite(pitch))return false;
  const aim=brAimDirection(yaw,pitch);
  return (direction.x*aim.x+direction.y*aim.y+direction.z*aim.z)/length>=.72;
}
export function brMuzzlePosition(position: Vec3, yaw: number, pitch: number): Vec3 {
  const aim = brAimDirection(yaw, pitch);
  return { x: position.x + aim.x * .88, y: position.y + .72 + aim.y * .2, z: position.z + aim.z * .88 };
}
export function brMoveTowards(current: number, target: number, maxDelta: number): number {
  return Math.abs(target - current) <= maxDelta ? target : current + Math.sign(target - current) * maxDelta;
}
export function applyBrDamage(hp: number, shield: number, damage: number, storm = false): { hp: number; shield: number; hpDamage: number; shieldDamage: number; shieldBroken: boolean } {
  const safeDamage = Math.max(0, Number.isFinite(damage) ? damage : 0);
  if (storm) {
    const nextHp = Math.max(0, hp - safeDamage);
    return { hp: nextHp, shield, hpDamage: hp - nextHp, shieldDamage: 0, shieldBroken: false };
  }
  const shieldDamage = Math.min(shield, safeDamage);
  const nextShield = shield - shieldDamage;
  const hpDamage = Math.min(hp, safeDamage - shieldDamage);
  return { hp: hp - hpDamage, shield: nextShield, hpDamage, shieldDamage, shieldBroken: shield > 0 && nextShield === 0 };
}
export function stormContains(storm: BrStormState, position: Vec3): boolean {
  return Math.hypot(position.x - storm.center.x, position.z - storm.center.z) <= storm.radius;
}
export function raySphereDistance(origin: Vec3, direction: Vec3, center: Vec3, radius: number): number | null {
  const ox = origin.x - center.x; const oy = origin.y - center.y; const oz = origin.z - center.z;
  const b = ox * direction.x + oy * direction.y + oz * direction.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const near = -b - Math.sqrt(discriminant);
  const far = -b + Math.sqrt(discriminant);
  return near >= 0 ? near : far >= 0 ? far : null;
}

export function brPlayerHitDistance(origin: Vec3, direction: Vec3, feet: Vec3, crouched = false, downed = false): { distance: number; headshot: boolean } | null {
  // Match the canonical helmet center (1.46m) plus the existing BR rig lift:
  // .26m standing / .05m crouched. The old centers sat in the visible torso.
  const headY = downed ? .55 : crouched ? 1.51 : 1.72;
  // A modestly wider, taller torso covers the suit continuously from feet
  // through shoulders. Movement collision and the precision head stay intact.
  const bodyHeight = crouched ? .78 : 1.1;
  const lowerBody = downed
    ? raySphereDistance(origin, direction, { x: feet.x, y: feet.y + .32, z: feet.z }, .52)
    : rayEllipsoidDistance(origin, direction, { x: feet.x, y: feet.y + bodyHeight / 2, z: feet.z }, { x: .5, y: bodyHeight / 2, z: .5 });
  // Preserve the modest lower-body width and connect the actual upper suit to
  // its helmet with a narrower chest region, rather than enlarging everything.
  const upperBody=downed?null:rayEllipsoidDistance(origin,direction,{x:feet.x,y:feet.y+headY-.52,z:feet.z},{x:.45,y:.35,z:.45});
  const body=lowerBody===null?upperBody:upperBody===null?lowerBody:Math.min(lowerBody,upperBody);
  const head = raySphereDistance(origin, direction, { x: feet.x, y: feet.y + headY, z: feet.z }, downed ? .25 : .3);
  if (head !== null && (body === null || head <= body)) return { distance: head, headshot: !downed };
  return body === null ? null : { distance: body, headshot: false };
}

function rayEllipsoidDistance(origin: Vec3, direction: Vec3, center: Vec3, radii: Vec3): number | null {
  const transformed = { x: direction.x / radii.x, y: direction.y / radii.y, z: direction.z / radii.z };
  const length = Math.hypot(transformed.x, transformed.y, transformed.z);
  if (length < 1e-8) return null;
  const distance = raySphereDistance(
    { x: (origin.x - center.x) / radii.x, y: (origin.y - center.y) / radii.y, z: (origin.z - center.z) / radii.z },
    { x: transformed.x / length, y: transformed.y / length, z: transformed.z / length },
    { x: 0, y: 0, z: 0 }, 1
  );
  return distance === null ? null : distance / length;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
