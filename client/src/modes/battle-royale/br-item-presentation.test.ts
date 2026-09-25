import { describe,expect,it } from "vitest";
import { BR_WEAPONS,type BrWeaponId } from "@planetfall/shared";
import { brHeldWeaponTransform,brLootSurfaceOffset,brLootWeaponTransform } from "./br-item-presentation";

describe("BR item presentation transforms",()=>{
  it("defines finite held and loot transforms for every weapon",()=>{
    for(const id of Object.keys(BR_WEAPONS) as BrWeaponId[]){
      for(const transform of [brHeldWeaponTransform(id),brLootWeaponTransform(id)]){
        expect([...transform.position,...transform.rotation,transform.scale].every(Number.isFinite),id).toBe(true);
        expect(transform.scale).toBeGreaterThan(0);
      }
    }
  });
  it("anchors rarity fields to explicit floor and roof support heights",()=>{
    expect(brLootSurfaceOffset({position:{x:0,y:.58,z:0},surfaceY:0})).toBeCloseTo(-.555);
    expect(brLootSurfaceOffset({position:{x:0,y:18.65,z:0},surfaceY:18})).toBeCloseTo(-.625);
    expect(brLootSurfaceOffset({position:{x:0,y:.58,z:0}})).toBeCloseTo(-.555);
  });
});
