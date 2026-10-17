import type { BrProjectileWeaponId } from "@planetfall/shared";

export interface BrProjectileStyle {
  readonly color:number;
  readonly radius:number;
  readonly detail:1;
  readonly trailOpacity:number;
}

const STYLES = Object.freeze({
  "plasma-launcher":Object.freeze({color:0xff5fd7,radius:.42,detail:1,trailOpacity:.7}),
  "arc-blaster":Object.freeze({color:0x70f5ff,radius:.24,detail:1,trailOpacity:.7}),
  "vortex-cannon":Object.freeze({color:0xd4b3ff,radius:.32,detail:1,trailOpacity:.45}),
} satisfies Record<BrProjectileWeaponId,BrProjectileStyle>);

/** Presentation dimensions only; authoritative projectile collision is unchanged. */
export function brProjectileStyle(id:BrProjectileWeaponId):BrProjectileStyle {
  return STYLES[id];
}
