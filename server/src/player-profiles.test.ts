import {afterEach,describe,expect,it} from "vitest";
import {mkdtempSync,readFileSync,rmSync,rmdirSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {PlayerProfiles,type PlayerProgress} from "./player-profiles.js";
import {DEFAULT_COSMETICS} from "@planetfall/shared";
const directories:string[]=[];
const file=()=>{const directory=mkdtempSync(join(tmpdir(),"planetfall-profiles-"));directories.push(directory);return join(directory,"profiles.json");};
afterEach(()=>{for(const directory of directories.splice(0)){rmSync(join(directory,"profiles.json"),{force:true});rmSync(join(directory,"profiles.json.tmp"),{force:true});rmdirSync(directory);}});
const player=():PlayerProgress=>({fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"]});
describe("persistent guest economy",()=>{
 it("restores earned currency and purchases after a new store instance without replaying awards",()=>{
  const path=file(),store=new PlayerProfiles(path),identity=store.open(undefined),p=player();store.bind(p,identity.key);
  p.fallbucks+=150;p.sessionTotalXp=115;p.sessionLevel=2;p.sessionXp=15;p.crowns=1;store.capture([p]);
  p.fallbucks-=100;p.ownedCosmetics.push("solar-gold");p.equippedCosmetics.suit="solar-gold";store.capture([p]);store.capture([p]);
  const restarted=new PlayerProfiles(path),returned=restarted.open(identity.token),restored=player();restarted.bind(restored,returned.key);
  expect(returned.token).toBe(identity.token);expect(restored).toMatchObject({fallbucks:100,crowns:1,sessionTotalXp:115,ownedCosmetics:["solar-gold"],equippedCosmetics:{suit:"solar-gold"}});
  expect(restored.unlockedPassRewards).toContain("bucks-50");restarted.capture([restored]);expect(restored.fallbucks).toBe(100);
  expect(readFileSync(path,"utf8")).not.toContain(identity.token);
 });
 it("keeps concurrent room representations in sync and applies simultaneous reward deltas once",()=>{
  const store=new PlayerProfiles(),identity=store.open(undefined),a=player(),b=player();store.bind(a,identity.key);store.bind(b,identity.key);
  a.fallbucks+=150;b.fallbucks+=50;store.capture([a,b]);expect(a.fallbucks).toBe(200);expect(b.fallbucks).toBe(200);
  b.fallbucks-=100;b.ownedCosmetics.push("solar-gold");store.capture([b]);expect(a.fallbucks).toBe(100);expect(a.ownedCosmetics).toContain("solar-gold");store.capture([a,b]);expect(a.fallbucks).toBe(100);
 });
 it("does not adopt unknown tokens or overwrite a malformed save",()=>{
  const store=new PlayerProfiles(),a=store.open(undefined),b=store.open("f".repeat(64));expect(a.key).not.toBe(b.key);expect(b.token).not.toBe("f".repeat(64));
  const path=file();writeFileSync(path,"{broken");expect(()=>new PlayerProfiles(path)).toThrow();expect(readFileSync(path,"utf8")).toBe("{broken");
 });
 it("merges pending XP from both rooms before synchronizing either room, including a combined tier crossing",()=>{
  const store=new PlayerProfiles(),identity=store.open(undefined),a=player(),b=player();store.bind(a,identity.key);
  a.sessionTotalXp=90;store.capture([a]);store.bind(b,identity.key);
  a.sessionTotalXp+=6;b.sessionTotalXp+=6;
  const receipt=store.capture([a]);expect(receipt.get(a)?.map(reward=>reward.id)).toEqual(["bucks-50"]);
  for(const p of [a,b])expect(p).toMatchObject({sessionTotalXp:102,sessionLevel:2,sessionXp:2,fallbucks:50});
  store.capture([b]);expect(a.fallbucks).toBe(50);expect(a.sessionTotalXp).toBe(102);
 });
 it("removes two stale room precredits, grants one canonical reward, and persists it across restart",()=>{
  const path=file(),store=new PlayerProfiles(path),identity=store.open(undefined),a=player(),b=player();store.bind(a,identity.key);
  a.sessionTotalXp=90;store.capture([a]);store.bind(b,identity.key);
  for(const p of [a,b]){p.sessionTotalXp+=20;p.fallbucks+=60;p.unlockedPassRewards.push("bucks-50");}
  const receipt=store.capture([a,b]);expect(receipt.get(a)?.map(reward=>reward.id)).toEqual(["bucks-50"]);expect(receipt.get(b)).toEqual([]);
  expect(a.fallbucks).toBe(70);expect(b.fallbucks).toBe(70);expect(a.sessionTotalXp).toBe(130);
  expect(a.unlockedPassRewards.filter(id=>id==="bucks-50")).toHaveLength(1);
  const restarted=new PlayerProfiles(path),restored=player();restarted.bind(restored,restarted.open(identity.token).key);restarted.capture([restored]);
  expect(restored.fallbucks).toBe(70);expect(restored.sessionTotalXp).toBe(130);
 });
 it("does not repay a room reward already spent before capture",()=>{
  const store=new PlayerProfiles(),identity=store.open(undefined),p=player();store.bind(p,identity.key);p.sessionTotalXp=90;store.capture([p]);
  p.sessionTotalXp+=20;p.fallbucks+=50;p.unlockedPassRewards.push("bucks-50");p.fallbucks-=50;p.ownedCosmetics.push("spent-reward-item");
  store.capture([p]);expect(p.fallbucks).toBe(0);expect(p.sessionTotalXp).toBe(110);expect(p.ownedCosmetics).toContain("spent-reward-item");
  store.capture([p]);expect(p.fallbucks).toBe(0);
 });
 it("migrates old earned-but-missing claims on load while preserving prior grants, unknown IDs and custom badge",()=>{
  const path=file(),store=new PlayerProfiles(path),identity=store.open(undefined),legacy={...player(),sessionTotalXp:900,fallbucks:10,unlockedPassRewards:["unknown-retired","bucks-50","default"],ownedCosmetics:["legacy-purchase"],lobbyBadge:"CUSTOM"};
  writeFileSync(path,JSON.stringify({version:1,profiles:{[identity.key]:legacy}}));
  const migrated=new PlayerProfiles(path),restored=player();migrated.bind(restored,migrated.open(identity.token).key);
  expect(restored.fallbucks).toBe(510);expect(restored.sessionTotalXp).toBe(900);expect(restored.lobbyBadge).toBe("CUSTOM");
  expect(restored.unlockedPassRewards).toContain("unknown-retired");expect(restored.ownedCosmetics).toEqual(expect.arrayContaining(["legacy-purchase","ion-blue","solar-visor","warp-spark","ace"]));
  migrated.flush();const again=new PlayerProfiles(path);expect(again.view(identity.key)).toEqual(restored);
 });
 it("retains uncapped XP and restores pass badges durably without replaying currency",()=>{
  const path=file(),store=new PlayerProfiles(path),identity=store.open(undefined),p=player();store.bind(p,identity.key);
  p.sessionTotalXp=123456;store.capture([p]);const balance=p.fallbucks;
  expect(p.sessionTotalXp).toBe(123456);expect(p.lobbyBadge).toBeDefined();
  p.sessionTotalXp=0;store.capture([p]);expect(p.sessionTotalXp).toBe(123456);expect(p.fallbucks).toBe(balance);
  const restarted=new PlayerProfiles(path);expect(restarted.view(identity.key)).toMatchObject({sessionTotalXp:123456,fallbucks:balance,lobbyBadge:p.lobbyBadge});
 });
 it("rejects malformed deltas atomically without erasing another room's pending progress",()=>{
  const store=new PlayerProfiles(),identity=store.open(undefined),a=player(),b=player();store.bind(a,identity.key);store.bind(b,identity.key);
  a.sessionTotalXp=25;b.fallbucks=NaN;expect(()=>store.capture([a,b])).toThrow(RangeError);expect(store.view(identity.key).sessionTotalXp).toBe(0);
  b.fallbucks=0;store.capture([a]);expect(a.sessionTotalXp).toBe(25);expect(b.sessionTotalXp).toBe(25);
 });
});
