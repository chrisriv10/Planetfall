import {describe,it,expect} from "vitest";
import {BR_WEAPONS,type BrProjectileWeaponId} from "@planetfall/shared";
import {brProjectileStyle} from "./br-projectile-style";

describe("canonical projectile presentation",()=>{
  it("preserves Plasma and Arc while distinguishing the restrained Vortex orb",()=>{
    expect(brProjectileStyle("plasma-launcher")).toEqual({color:0xff5fd7,radius:.42,detail:1,trailOpacity:.7});
    expect(brProjectileStyle("arc-blaster")).toEqual({color:0x70f5ff,radius:.24,detail:1,trailOpacity:.7});
    expect(brProjectileStyle("vortex-cannon")).toEqual({color:0xd4b3ff,radius:.32,detail:1,trailOpacity:.45});
  });
  it("covers every canonical projectile with immutable bounded reused data",()=>{
    const ids=Object.values(BR_WEAPONS).filter(w=>w.model==="projectile").map(w=>w.id as BrProjectileWeaponId);
    const colors=new Set<number>();
    for(const id of ids){
      const style=brProjectileStyle(id);expect(style).toBe(brProjectileStyle(id));expect(Object.isFrozen(style)).toBe(true);
      expect(Number.isInteger(style.color)).toBe(true);expect(style.color).toBeGreaterThanOrEqual(0);expect(style.color).toBeLessThanOrEqual(0xffffff);
      expect(style.radius).toBeGreaterThan(0);expect(style.radius).toBeLessThanOrEqual(.42);
      expect(style.trailOpacity).toBeGreaterThan(0);expect(style.trailOpacity).toBeLessThanOrEqual(.7);expect(style.detail).toBe(1);colors.add(style.color);
    }
    expect(colors.size).toBe(ids.length);
  });
});
