import {describe,it,expect} from "vitest";
import {brCrateContents,seededRandom,BR_WEAPONS,isBrWeapon,isBrUtility,BR_UTILITIES,brPickupDisposition,brItemName,brItemDescription} from "./index.js";
describe("purposeful crate contents",()=>{
  it("is seeded, guarantees a weapon and never yields redundant heal-only crates",()=>{
    const a=seededRandom(92),b=seededRandom(92);
    for(let i=0;i<2000;i++){
      const drops=brCrateContents(a);expect(drops).toEqual(brCrateContents(b));expect(drops).toHaveLength(3);
      expect(isBrWeapon(drops[0].itemId!)).toBe(true);
      expect(Boolean(drops[1].ammoType)||isBrUtility(drops[1].itemId!)).toBe(true);
      if(drops[1].ammoType)expect(drops[1].ammoType).toBe(BR_WEAPONS[drops[0].itemId as keyof typeof BR_WEAPONS].ammo);
      expect(drops.some(drop=>drop.rarity==="singularity")).toBe(false);
    }
  });
  it("restricts Vortex to high-value sources with bounded rare frequency",()=>{
    const random=seededRandom(171);let vortex=0,prism=0;
    for(let i=0;i<20000;i++){
      const weapon=brCrateContents(random,true)[0];
      if(weapon.itemId==="vortex-cannon"){vortex++;expect(weapon.rarity).toBe("singularity");}
      if(weapon.itemId==="prism-beam"){prism++;expect(weapon.rarity).toBe("prototype");}
    }
    expect(vortex).toBeGreaterThan(50);expect(vortex).toBeLessThan(150);
    expect(prism).toBeGreaterThan(500);expect(prism).toBeLessThan(900);
  });
  it("describes and stacks utilities independently from heals",()=>{
    for(const itemId of Object.keys(BR_UTILITIES) as Array<keyof typeof BR_UTILITIES>){
      expect(brItemName(itemId)).toBe(BR_UTILITIES[itemId].name);
      expect(brItemDescription(itemId,BR_UTILITIES[itemId].rarity)).toBe(BR_UTILITIES[itemId].role);
      const inventory=Array.from({length:5},(_,i)=>({instanceId:String(i),itemId,rarity:BR_UTILITIES[itemId].rarity,count:i===0?1:2,magazine:0}));
      expect(brPickupDisposition(inventory,{light:0,heavy:0,plasma:0},{id:"loot",itemId,rarity:BR_UTILITIES[itemId].rarity,count:1,position:{x:0,y:0,z:0}})).toBe("collect");
    }
  });
});
