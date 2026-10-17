import {describe,expect,it} from "vitest";
import {BR_RARITIES,BR_ORDINARY_RARITIES,BR_CONSUMABLE_RARITIES,BR_GROUND_RARITIES,BR_CRATE_RARITIES,brWeightedChoice,brWeaponStats,seededRandom} from "./index.js";
describe("canonical rarity profiles and source rules",()=>{
  it("provides seven unique colors and restrained monotonic ordinary refinement",()=>{
    expect(Object.keys(BR_RARITIES)).toHaveLength(7);expect(new Set(Object.values(BR_RARITIES).map(p=>p.color)).size).toBe(7);
    let damage=0,reload=Infinity,spread=Infinity;
    for(const rarity of BR_ORDINARY_RARITIES){const profile=BR_RARITIES[rarity];expect(profile.damage).toBeGreaterThanOrEqual(damage);expect(profile.damage).toBeLessThanOrEqual(1.1);expect(profile.reload).toBeLessThanOrEqual(reload);expect(profile.spread).toBeLessThanOrEqual(spread);damage=profile.damage;reload=profile.reload;spread=profile.spread;}
    expect(BR_RARITIES.prototype.damage).toBe(1);expect(BR_RARITIES.singularity.damage).toBe(1);
    expect(brWeaponStats("pulse-rifle","legendary").reloadMs).toBeLessThan(brWeaponStats("pulse-rifle","common").reloadMs);
  });
  it("never rolls special tiers from ordinary sources and gives consumables fixed identity",()=>{
    for(const table of [BR_GROUND_RARITIES,BR_CRATE_RARITIES]){const random=seededRandom(42);for(let i=0;i<10000;i++)expect(BR_RARITIES[brWeightedChoice(table,random)].category).toBe("ordinary");}
    expect(BR_CONSUMABLE_RARITIES).toEqual({"med-patch":"common","shield-cell":"uncommon","med-kit":"rare","shield-battery":"rare"});
    const a=seededRandom(51),b=seededRandom(51);for(let i=0;i<100;i++)expect(brWeightedChoice(BR_GROUND_RARITIES,a)).toBe(brWeightedChoice(BR_GROUND_RARITIES,b));
  });
});
