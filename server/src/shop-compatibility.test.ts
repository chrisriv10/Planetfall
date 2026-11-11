import {describe,expect,it,vi} from "vitest";
import {DEFAULT_COSMETICS,SHOP_CATALOG,type GameFamily,type GuestProfile} from "@planetfall/shared";
import {GameRoom} from "./game-room.js";
import {BattleRoyaleRoom} from "./modes/battle-royale/br-room.js";
import {PlanetRunRoom} from "./modes/planet-run/pr-room.js";
import {PlanetGunRoom} from "./modes/planet-gun/pg-room.js";

const families=[
 ["planetfall",GameRoom.prototype],
 ["battle-royale",BattleRoyaleRoom.prototype],
 ["planet-run",PlanetRunRoom.prototype],
 ["planet-gun",PlanetGunRoom.prototype],
]as const;
function fixture(prototype:typeof families[number][1]){
 const player:GuestProfile&{isBot:boolean}={fallbucks:100_000,crowns:2,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"],isBot:false};
 const room={phase:"lobby",players:new Map([["pilot",player]]),emitRoom:vi.fn()};
 return {player,room,buy:(itemId:unknown,id="pilot")=>prototype.buyShopItem.call(room as never,id,itemId as never),equip:(itemId:unknown,id="pilot")=>prototype.equipShopItem.call(room as never,id,itemId as never)};
}
describe.each(families)("authoritative cosmetic shop in %s",(family,prototype)=>{
 it("sells the global catalog at canonical prices without auto-equipping or changing stats",()=>{
  for(const item of SHOP_CATALOG){
   const {player,room,buy}=fixture(prototype),before=structuredClone(player),result=buy(item.id);
   if(item.passLevel!==undefined){expect(result.ok,item.id).toBe(false);expect(player).toEqual(before);expect(room.emitRoom).not.toHaveBeenCalled();continue;}
   expect(result,item.id).toEqual({ok:true});expect(player.fallbucks).toBe(before.fallbucks-item.price);expect(player.ownedCosmetics).toEqual([item.id]);
   expect({...player,fallbucks:before.fallbucks,ownedCosmetics:before.ownedCosmetics}).toEqual(before);expect(room.emitRoom).toHaveBeenCalledTimes(1);
   expect(buy(item.id).ok).toBe(false);expect(player.fallbucks).toBe(before.fallbucks-item.price);expect(player.ownedCosmetics).toEqual([item.id]);
  }
 });
 it("enforces the complete category compatibility matrix on owned items",()=>{
  for(const item of SHOP_CATALOG){
   const {player,room,equip}=fixture(prototype);player.ownedCosmetics=[item.id];const before=structuredClone(player);
   // Independent expected product policy; purchasing never implies equip compatibility.
   const allowed:readonly GameFamily[]=item.category==="planet"?["planetfall"]:item.category==="weapon-skin"?["planet-gun"]:item.category==="trail"?["planetfall","battle-royale","planet-run"]:["planetfall","battle-royale","planet-run","planet-gun"];
   const result=equip(item.id);
   if(!allowed.includes(family)){expect(result.ok,item.id).toBe(false);expect(player).toEqual(before);expect(room.emitRoom).not.toHaveBeenCalled();}
   else if(item.category==="emote"){expect(result).toEqual({ok:true});expect(player).toEqual(before);expect(room.emitRoom).not.toHaveBeenCalled();expect(player.equippedCosmetics).not.toHaveProperty("emote");}
   else {expect(result,item.id).toEqual({ok:true});expect(player.equippedCosmetics[item.category]).toBe(item.id);expect(player.fallbucks).toBe(before.fallbucks);expect(player.ownedCosmetics).toEqual([item.id]);expect(room.emitRoom).toHaveBeenCalledTimes(1);}
  }
 });
 it("rejects malformed/unknown IDs, unowned equipment and forged price objects atomically",()=>{
  const {player,room,buy,equip}=fixture(prototype),before=structuredClone(player);
  for(const id of [undefined,null,17,{},[],"unknown-item","__proto__",{itemId:"solar-gold",price:0},{id:"solar-gold",price:-100}]){expect(buy(id).ok).toBe(false);expect(equip(id).ok).toBe(false);}
  expect(equip("solar-gold").ok).toBe(false);expect(buy("solar-gold","missing").ok).toBe(false);expect(equip("solar-gold","missing").ok).toBe(false);
  expect(player).toEqual(before);expect(room.emitRoom).not.toHaveBeenCalled();
 });
 it("permits changes only between matches and refuses bot transactions",()=>{
  const {player,room,buy,equip}=fixture(prototype);player.ownedCosmetics=["ice-blue"];
  for(const phase of ["countdown","playing","overtime","ship","running","round-results"]){room.phase=phase;expect(buy("solar-gold").ok).toBe(false);expect(equip("ice-blue").ok).toBe(false);}
  room.phase="results";expect(buy("solar-gold")).toEqual({ok:true});expect(equip("ice-blue")).toEqual({ok:true});
  player.isBot=true;expect(buy("ember-orange").ok).toBe(false);expect(equip("solar-gold").ok).toBe(false);
 });
 it.each([0,99,-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])("rejects invalid or insufficient balance %s without mutation",balance=>{
  const {player,room,buy}=fixture(prototype);player.fallbucks=balance;const before=structuredClone(player);
  expect(buy("solar-gold").ok).toBe(false);expect(player).toEqual(before);expect(room.emitRoom).not.toHaveBeenCalled();
 });
 it("retains cross-family purchases while refusing incompatible equipment",()=>{
  const {player,buy,equip}=fixture(prototype);const start=player.fallbucks;
  expect(buy("verity")).toEqual({ok:true});expect(player.fallbucks).toBe(start-300);expect(player.ownedCosmetics).toContain("verity");
  expect(equip("verity").ok).toBe(family==="planetfall");
  expect(player.ownedCosmetics).toContain("verity");expect(player.fallbucks).toBe(start-300);
 });
});
