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
  expect(returned.token).toBe(identity.token);expect(restored).toMatchObject({fallbucks:50,crowns:1,sessionTotalXp:115,ownedCosmetics:["solar-gold"],equippedCosmetics:{suit:"solar-gold"}});
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
});
