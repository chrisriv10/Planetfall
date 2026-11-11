import {describe,expect,it} from "vitest";
import {PLANET_PASS_REWARDS,SHOP_CATALOG} from "./index.js";
import {WEAPON_FINISHES} from "./weapon-finishes.js";
import {EXPANDED_PASS_REWARDS,EXPANDED_SHOP_CATALOG} from "./cosmetic-expansion.js";

describe("expanded cosmetic and Planet Pass content",()=>{
 it("adds exactly 33 distinct items without colliding with legacy shop IDs",()=>{
  expect(EXPANDED_SHOP_CATALOG).toHaveLength(33);
  const ids=[...SHOP_CATALOG.slice(0,19),...EXPANDED_SHOP_CATALOG].map(item=>item.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(Object.fromEntries(["suit","trail","emote","victory","planet","weapon-skin","calling-card","emblem"].map(category=>[category,EXPANDED_SHOP_CATALOG.filter(item=>item.category===category).length]))).toEqual({suit:3,trail:3,emote:3,victory:3,planet:3,"weapon-skin":6,"calling-card":6,emblem:6});
 });

 it("authors every tier from 11 through 50 once with unique reward IDs",()=>{
  expect(EXPANDED_PASS_REWARDS.map(reward=>reward.level)).toEqual(Array.from({length:40},(_,index)=>index+11));
  const ids=[...PLANET_PASS_REWARDS.slice(0,10),...EXPANDED_PASS_REWARDS].map(reward=>reward.id);
  expect(new Set(ids).size).toBe(50);
  expect(EXPANDED_PASS_REWARDS.map(reward=>reward.cosmeticId??reward.fallbucks)).toEqual([
   125,"pressure-white","plasma-helix","salute","finish-solar-alloy",150,"orbit-salute","tidal-haven","emblem-solar-vanguard","finish-nebula-drift",
   175,"circuit-courier","solar-petals","shuffle","finish-ion-frost",200,"zero-g-bow","cinder-moon","card-solar-vanguard","verdant-ring",
   225,"emblem-void-explorer","card-void-explorer","emblem-orbital-engineer","finish-copper-circuit",250,"card-orbital-engineer","midnight-salvage","emblem-crown-collector","card-crown-collector",
   "emblem-ion-runner","card-ion-runner","void-wake","flex","finish-voidglass",300,"champion","emblem-shatter-champion","card-shatter-champion","finish-orbital-champion",
  ]);
 });

 it("grants each authored cosmetic exactly once, referencing a real item",()=>{
  const references=EXPANDED_PASS_REWARDS.flatMap(reward=>reward.cosmeticId?[reward.cosmeticId]:[]);
  expect(new Set(references).size).toBe(33);
  expect([...references].sort()).toEqual(EXPANDED_SHOP_CATALOG.map(item=>item.id).sort());
  expect(EXPANDED_PASS_REWARDS.reduce((sum,reward)=>sum+(reward.fallbucks??0),0)).toBe(1925);
 });

 it("keeps normal additions purchasable for 200–900 and the tier-50 finish exclusive",()=>{
  for(const item of EXPANDED_SHOP_CATALOG){
   expect(Number.isSafeInteger(item.price)).toBe(true);
   if(item.id==="finish-orbital-champion")expect(item).toMatchObject({price:0,passLevel:50,category:"weapon-skin"});
   else {expect(item.price).toBeGreaterThanOrEqual(200);expect(item.price).toBeLessThanOrEqual(900);expect(item.passLevel).toBeUndefined();}
  }
  expect(EXPANDED_PASS_REWARDS.at(-1)).toMatchObject({level:50,cosmeticId:"finish-orbital-champion",fallbucks:500,badge:"ORBITAL CHAMPION"});
  expect(EXPANDED_PASS_REWARDS.filter(reward=>reward.badge).map(reward=>reward.level)).toEqual([20,30,40,50]);
 });

 it("limits family compatibility to implemented presentation surfaces",()=>{
  for(const item of EXPANDED_SHOP_CATALOG){
   const families=item.category==="planet"?["planetfall"]:item.category==="weapon-skin"?["planet-gun"]:item.category==="trail"?["planetfall","battle-royale","planet-run"]:["planetfall","battle-royale","planet-run","planet-gun"];
   expect(item.families).toEqual(families);
  }
 });

 it("uses the real authored weapon finishes, identity themes, suit and planet styles",()=>{
  expect(EXPANDED_SHOP_CATALOG.filter(item=>item.category==="weapon-skin").map(item=>item.id)).toEqual(WEAPON_FINISHES.map(finish=>finish.id));
  const themes=["solar-vanguard","void-explorer","orbital-engineer","crown-collector","ion-runner","shatter-champion"];
  expect(EXPANDED_SHOP_CATALOG.filter(item=>item.category==="calling-card").map(item=>item.id)).toEqual(themes.map(theme=>`card-${theme}`));
  expect(EXPANDED_SHOP_CATALOG.filter(item=>item.category==="emblem").map(item=>item.id)).toEqual(themes.map(theme=>`emblem-${theme}`));
  expect(EXPANDED_SHOP_CATALOG.filter(item=>item.category==="suit").map(item=>[item.id,item.suitStyle])).toEqual([["pressure-white","pressure"],["circuit-courier","courier"],["midnight-salvage","salvage"]]);
  expect(EXPANDED_SHOP_CATALOG.filter(item=>item.category==="planet").map(item=>[item.id,item.planetStyle])).toEqual([["tidal-haven","ocean"],["cinder-moon","cinder"],["verdant-ring","garden"]]);
  expect(EXPANDED_SHOP_CATALOG.filter(item=>item.category==="emote").map(item=>item.emote)).toEqual(["salute","shuffle","flex"]);
 });

 it("preserves the first ten reward IDs, amounts, cosmetic references and badge",()=>{
  expect(PLANET_PASS_REWARDS.slice(0,10).map(reward=>[reward.id,reward.level,reward.fallbucks??0,reward.cosmeticId??null,reward.badge??null])).toEqual([
   ["default",1,0,null,null],["bucks-50",2,50,null,null],["ion-blue",3,0,"ion-blue",null],["bucks-75",4,75,null,null],["solar-visor",5,0,"solar-visor",null],
   ["bucks-100",6,100,null,null],["warp-spark",7,0,"warp-spark",null],["bucks-125",8,125,null,null],["ace",9,0,"ace",null],["ace-pilot",10,200,null,"ACE PILOT"],
  ]);
 });
});
