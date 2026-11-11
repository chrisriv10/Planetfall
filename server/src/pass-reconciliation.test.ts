import {describe,expect,it} from "vitest";
import {DEFAULT_COSMETICS,PLANET_PASS_REWARDS,sessionLevelForXp,sessionXpInLevel,type GuestProfile,type PlanetPassReward} from "@planetfall/shared";
import {passFallbucksAlreadyGranted,reconcilePassRewards} from "./pass-reconciliation.js";

const profile=():GuestProfile&{lobbyBadge?:string}=>({fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"]});
const clone=(p:GuestProfile):GuestProfile=>structuredClone(p);

describe("canonical pass reward reconciliation",()=>{
 it("migrates existing IDs without paying twice and repairs their cosmetic/badge entitlements",()=>{
  const p=profile();p.sessionTotalXp=900;p.fallbucks=17;p.unlockedPassRewards=PLANET_PASS_REWARDS.slice(0,10).map(reward=>reward.id);
  expect(reconcilePassRewards(p).map(reward=>reward.id)).not.toContain("ace-pilot");
  expect(p.fallbucks).toBe(17);expect(p.ownedCosmetics).toEqual(expect.arrayContaining(["ion-blue","solar-visor","warp-spark","ace"]));
  expect(p.lobbyBadge).toBe("ACE PILOT");expect(reconcilePassRewards(p)).toEqual([]);expect(p.fallbucks).toBe(17);
 });

 it("uses IDs rather than ledger order and retains unknown IDs and existing purchases",()=>{
  const p=profile();p.sessionTotalXp=300;p.unlockedPassRewards=["retired-unlock","bucks-75","default"];
  p.ownedCosmetics=["shop-purchase"];
  expect(reconcilePassRewards(p).map(reward=>reward.id)).toEqual(["bucks-50","ion-blue"]);
  expect(p.fallbucks).toBe(50);expect(p.unlockedPassRewards).toEqual(["retired-unlock","bucks-75","default","bucks-50","ion-blue"]);
  expect(p.ownedCosmetics).toEqual(["shop-purchase","ion-blue"]);
 });

 it("grants rewards crossed only by combined XP from separate rooms and preserves uncapped XP",()=>{
  const p=profile();p.sessionTotalXp=90;
  p.sessionTotalXp+=6;expect(reconcilePassRewards(p)).toEqual([]);
  p.sessionTotalXp+=6;expect(reconcilePassRewards(p).map(reward=>reward.id)).toEqual(["bucks-50"]);expect(p.fallbucks).toBe(50);
  p.sessionTotalXp=123456;reconcilePassRewards(p);
  expect(p.sessionTotalXp).toBe(123456);expect(p.sessionLevel).toBe(sessionLevelForXp(123456));expect(p.sessionXp).toBe(sessionXpInLevel(123456));
 });

 it("keeps spending and ordinary earnings when removing room reward precredits",()=>{
  const baseline=profile();baseline.fallbucks=100;baseline.sessionTotalXp=90;
  const current=clone(baseline);current.fallbucks+=50+20-80;current.unlockedPassRewards.push("bucks-50");current.sessionTotalXp+=20;
  const canonical=clone(baseline);
  canonical.fallbucks+=current.fallbucks-baseline.fallbucks-passFallbucksAlreadyGranted(baseline.unlockedPassRewards,current.unlockedPassRewards);
  canonical.sessionTotalXp+=current.sessionTotalXp-baseline.sessionTotalXp;
  reconcilePassRewards(canonical);
  expect(canonical.fallbucks).toBe(90);expect(canonical.sessionTotalXp).toBe(110);
  expect(passFallbucksAlreadyGranted(["default"],["default","unknown"])).toBe(0);
  expect(passFallbucksAlreadyGranted(["bucks-50","default"],["default","bucks-50","bucks-50"])).toBe(0);
 });

 it("pays one canonical reward when two stale room representations precredit the same tier",()=>{
  const baseline=profile();baseline.fallbucks=100;baseline.sessionTotalXp=90;
  const canonical=clone(baseline),rooms=[clone(baseline),clone(baseline)];
  for(const room of rooms){room.sessionTotalXp+=20;room.fallbucks+=10+50;room.unlockedPassRewards.push("bucks-50");}
  const granted:string[]=[];
  for(const room of rooms){
   canonical.fallbucks+=room.fallbucks-baseline.fallbucks-passFallbucksAlreadyGranted(baseline.unlockedPassRewards,room.unlockedPassRewards);
   canonical.sessionTotalXp+=room.sessionTotalXp-baseline.sessionTotalXp;
   granted.push(...reconcilePassRewards(canonical).map(reward=>reward.id));
  }
  expect(canonical.fallbucks).toBe(170);expect(canonical.sessionTotalXp).toBe(130);expect(granted).toEqual(["bucks-50"]);
  expect(canonical.unlockedPassRewards.filter(id=>id==="bucks-50")).toHaveLength(1);
 });

 it("allows the room's newly credited reward to be spent before capture without recrediting it",()=>{
  const baseline=profile();baseline.sessionTotalXp=90;
  const current=clone(baseline);current.sessionTotalXp+=20;current.unlockedPassRewards.push("bucks-50");
  current.fallbucks+=50;current.fallbucks-=50;
  const canonical=clone(baseline);canonical.sessionTotalXp+=current.sessionTotalXp-baseline.sessionTotalXp;
  reconcilePassRewards(canonical);
  canonical.fallbucks=Math.max(0,canonical.fallbucks+current.fallbucks-baseline.fallbucks-passFallbucksAlreadyGranted(baseline.unlockedPassRewards,current.unlockedPassRewards));
  expect(canonical.fallbucks).toBe(0);expect(reconcilePassRewards(canonical)).toEqual([]);
 });

 it("supports an injected 50-tier catalog while honoring the canonical level helper",()=>{
  const rewards:PlanetPassReward[]=[...PLANET_PASS_REWARDS.slice(0,10),...Array.from({length:40},(_,index)=>({id:`fixture-${index+11}`,level:index+11,label:`Tier ${index+11}`,fallbucks:10}))];
  const p=profile();p.sessionTotalXp=100000;
  const eligible=rewards.filter(reward=>reward.level<=sessionLevelForXp(p.sessionTotalXp));
  expect(reconcilePassRewards(p,rewards)).toEqual(eligible.filter(reward=>reward.id!=="default"));
  expect(p.fallbucks).toBe(eligible.reduce((sum,reward)=>sum+(reward.fallbucks??0),0));
  expect(p.sessionTotalXp).toBe(100000);expect(reconcilePassRewards(p,rewards)).toEqual([]);
  expect(rewards.slice(0,10).map(reward=>[reward.id,reward.fallbucks??0])).toEqual([
   ["default",0],["bucks-50",50],["ion-blue",0],["bucks-75",75],["solar-visor",0],["bucks-100",100],["warp-spark",0],["bucks-125",125],["ace",0],["ace-pilot",200],
  ]);
 });

 it("sorts injected rewards by eligibility level for the highest badge without modifying their catalog",()=>{
  const p=profile();p.sessionTotalXp=900;
  const rewards:PlanetPassReward[]=[{id:"high",level:10,label:"High",badge:"HIGH"},{id:"low",level:2,label:"Low",badge:"LOW"}];
  expect(reconcilePassRewards(p,rewards).map(reward=>reward.id)).toEqual(["low","high"]);expect(p.lobbyBadge).toBe("HIGH");
  expect(rewards.map(reward=>reward.id)).toEqual(["high","low"]);
 });

 it("preserves custom badges and already earned higher pass badges when XP is lower",()=>{
  const rewards:PlanetPassReward[]=[{id:"low",level:2,label:"Low",badge:"LOW"},{id:"high",level:10,label:"High",badge:"HIGH"}];
  for(const badge of ["CUSTOM","HIGH"]){
   const p=profile();p.sessionTotalXp=100;p.lobbyBadge=badge;p.unlockedPassRewards.push("high");
   reconcilePassRewards(p,rewards);expect(p.lobbyBadge).toBe(badge);expect(p.unlockedPassRewards).toContain("high");
  }
 });

 it.each([-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])("rejects invalid economy amount %s without mutations",value=>{
  for(const key of ["fallbucks","crowns","sessionTotalXp"] as const){
   const p=profile();p[key]=value;const before=structuredClone(p);
   expect(()=>reconcilePassRewards(p)).toThrow(RangeError);expect(p).toEqual(before);
  }
 });

 it("rejects overflow atomically before recording reward IDs or derived levels",()=>{
  const p=profile();p.sessionTotalXp=100;p.fallbucks=Number.MAX_SAFE_INTEGER;const before=clone(p);
  expect(()=>reconcilePassRewards(p)).toThrow(RangeError);expect(p).toEqual(before);
 });

 it.each([-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])("rejects malformed catalog currency %s atomically",fallbucks=>{
  const p=profile(),before=clone(p),rewards=[{id:"invalid",level:1,label:"Invalid",fallbucks}];
  expect(()=>reconcilePassRewards(p,rewards)).toThrow(TypeError);expect(p).toEqual(before);
  expect(()=>passFallbucksAlreadyGranted([],["invalid"],rewards)).toThrow(TypeError);
 });

 it("counts each new known ID once and guards aggregate precredit overflow",()=>{
  expect(passFallbucksAlreadyGranted(["default"],["bucks-75","bucks-50","default","bucks-50","unknown"])).toBe(125);
  const rewards=[{id:"a",level:1,label:"A",fallbucks:Number.MAX_SAFE_INTEGER},{id:"b",level:2,label:"B",fallbucks:1}];
  expect(()=>passFallbucksAlreadyGranted([],["a","b"],rewards)).toThrow(RangeError);
 });

 it("validates the entire catalog before mutating any earlier eligible reward",()=>{
  const p=profile(),before=clone(p);
  const rewards=[{id:"valid",level:1,label:"Valid",fallbucks:5},{id:"invalid",level:0,label:"Invalid",fallbucks:10}];
  expect(()=>reconcilePassRewards(p,rewards)).toThrow(TypeError);expect(p).toEqual(before);
  rewards[1]={...rewards[0]};
  expect(()=>reconcilePassRewards(p,rewards)).toThrow(TypeError);expect(p).toEqual(before);
 });
});
