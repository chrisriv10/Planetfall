import {describe,it,expect} from "vitest";
import {brBotLootPlan,brBotWeaponSlot,brBotWeaponScore} from "./br-bot-loadout.js";
import type {BrInventoryItem,BrWeaponId} from "@planetfall/shared";
const item=(itemId:BrWeaponId,rarity:BrInventoryItem["rarity"]="common"):BrInventoryItem=>({instanceId:itemId,itemId,rarity,count:1,magazine:6});
describe("bot role-aware loadouts",()=>{
  const ammo={light:50,heavy:20,plasma:12};
  it("keeps useful rare rifle coverage instead of blindly favoring a new pistol",()=>{
    expect(brBotWeaponSlot([item("pulse-rifle","rare"),item("comet-hand-cannon")],ammo,40)).toBe(0);
  });
  it("selects a range-appropriate weapon and rejects exhausted ammunition",()=>{
    const rifle=item("quasar-carbine"),shotgun=item("photon-shotgun");
    expect(brBotWeaponSlot([shotgun,rifle],ammo,100)).toBe(1);
    rifle.magazine=0;expect(brBotWeaponScore(rifle,{light:50,heavy:0,plasma:12},100)).toBe(-Infinity);
  });
  it("ignores duplicate downgrades and replaces an existing ordinary weapon with its upgrade",()=>{
    const inventory=[item("pulse-rifle","rare"),null,null,null,null];
    const loot={id:"floor",itemId:"pulse-rifle" as const,rarity:"common" as const,count:1,magazine:28,position:{x:0,y:0,z:0}};
    expect(brBotLootPlan(inventory,ammo,loot)).toBeNull();
    inventory[0]=item("pulse-rifle");
    expect(brBotLootPlan(inventory,ammo,{...loot,rarity:"rare"})).toEqual({replaceSlot:0});
  });
  it("keeps a complementary precision weapon while rejecting a redundant close weapon",()=>{
    const inventory=[item("nova-smg","rare"),item("pulse-rifle","rare"),null,null,null];
    const base={id:"floor",rarity:"common" as const,count:1,magazine:12,position:{x:0,y:0,z:0}};
    expect(brBotLootPlan(inventory,ammo,{...base,itemId:"quasar-carbine"})).toEqual({});
    expect(brBotLootPlan(inventory,ammo,{...base,itemId:"nova-smg"})).toBeNull();
  });
});
