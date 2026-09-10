import type { Vec3 } from "../index.js";
import type { BrStormState } from "./types.js";

export function brClamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
export function brDistance2d(a: Pick<Vec3, "x" | "z">, b: Pick<Vec3, "x" | "z">): number { return Math.hypot(a.x - b.x, a.z - b.z); }
export function brNormalize(value: Vec3): Vec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  return length > 1e-7 && Number.isFinite(length) ? { x: value.x / length, y: value.y / length, z: value.z / length } : { x: 0, y: 0, z: -1 };
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

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
