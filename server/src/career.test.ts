import {afterEach,describe,expect,it,vi} from "vitest";
import {randomUUID} from "node:crypto";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {PGlite} from "@electric-sql/pglite";
import {CAREER_ACHIEVEMENTS,CAREER_FAMILIES,DEFAULT_COSMETICS,SHOP_CATALOG,applyCareerResult,type CareerData} from "@planetfall/shared";
import {PlayerProfiles,type PlayerProgress} from "./player-profiles.js";
import {ProfileDatabase,type ProfileDatabaseConnection} from "./profile-database.js";
import {migrateProfileSchema} from "./profile-migrations.js";
const engines:PGlite[]=[],directories:string[]=[];
afterEach(async()=>{for(const db of engines.splice(0))await db.close();for(const dir of directories.splice(0))rmSync(dir,{recursive:true,force:true});vi.restoreAllMocks();});
const player=():PlayerProgress=>({fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"]});
async function fixture(wrap?:(c:ProfileDatabaseConnection)=>ProfileDatabaseConnection){
 const db=new PGlite();engines.push(db);await db.waitReady;
 const c:ProfileDatabaseConnection={query:(sql,values)=>db.query(sql,values),transaction:run=>db.transaction(tx=>run((sql,values)=>tx.query(sql,values))),end:async()=>{}};
 await migrateProfileSchema(c);const opened=await ProfileDatabase.open(wrap?wrap(c):c),store=new PlayerProfiles(undefined,opened.document,opened.database);
 const identity=store.open(undefined),p=player();store.bind(p,identity.key);await opened.database.flush();return {db,c,store,p,identity,database:opened.database};
}
describe("authoritative Career ledger",()=>{
 it("starts old profiles from zero and makes all 13 recognition achievements attainable without economy rewards",()=>{
  const old={...player(),sessionTotalXp:9000,crowns:20},key="a".repeat(64);
  const store=new PlayerProfiles(undefined,{version:1,profiles:{[key]:old}}),bound=player();store.bind(bound,key);
  expect(bound.career).toBeUndefined();store.recordCareer("planetfall",randomUUID(),[{player:bound,won:false}]);
  expect(bound.career!.families.planetfall).toMatchObject({completions:1,wins:0});
  expect(bound.career!.families["planet-gun"].completions).toBe(0);
  let career:CareerData|undefined;const at="2026-11-21T00:00:00.000Z";
  for(let i=0;i<10;i++)for(const family of CAREER_FAMILIES)career=applyCareerResult(career,family,{
   won:true,...(family==="planetfall"?{scrap:10,repairs:1}:family==="planet-run"?{qualifications:1}:family==="planet-gun"?{eliminations:1}:{}),
  },at);
  expect(CAREER_ACHIEVEMENTS).toHaveLength(13);expect(Object.keys(career!.achievements).sort()).toEqual(CAREER_ACHIEVEMENTS.map(a=>a.id).sort());
  expect(career!.families.planetfall.completions).toBe(10);expect(career!.trackedSince).toBe(at);
  expect(()=>applyCareerResult(career,"planet-gun",{won:true,waves:NaN},at)).toThrow();
 });
 it("requires proven family metrics for varied achievements and preserves the first unlock timestamp",()=>{
  const at="2026-11-21T00:00:00.000Z",later="2026-11-22T00:00:00.000Z";
  let career=applyCareerResult(undefined,"planetfall",{won:false,scrap:99,repairs:4},at);
  expect(career.achievements["scrap-collector"]).toBeUndefined();expect(career.achievements["world-defender"]).toBeUndefined();
  career=applyCareerResult(career,"battle-royale",{won:false,scrap:100,repairs:5,eliminations:2},at);
  expect(career.achievements["scrap-collector"]).toBeUndefined();expect(career.achievements["first-elimination"]).toBeUndefined();
  career=applyCareerResult(career,"planetfall",{won:true,scrap:1,repairs:1},later);
  for(const id of ["scrap-collector","world-defender","last-planet-standing"])expect(career.achievements[id]).toBe(later);
  career=applyCareerResult(career,"planet-run",{won:false,qualifications:1},later);expect(career.achievements["first-qualification"]).toBe(later);expect(career.achievements["perfect-run"]).toBeUndefined();
  career=applyCareerResult(career,"planet-gun",{won:false,eliminations:1},later);expect(career.achievements["first-elimination"]).toBe(later);
  career=applyCareerResult(career,"planetfall",{won:true,scrap:100,repairs:5},"2026-11-23T00:00:00.000Z");expect(career.achievements["scrap-collector"]).toBe(later);
 });
 it("persists local receipt deduplication across restart and isolates profile views",()=>{
  const dir=mkdtempSync(join(tmpdir(),"pf-career-"));directories.push(dir);const file=join(dir,"profiles.json"),store=new PlayerProfiles(file),identity=store.open(undefined),p=player();store.bind(p,identity.key);
  const id=randomUUID();store.recordCareer("planetfall",id,[{player:p,won:false,repairs:4}]);
  const view=store.view(identity.key);view.career!.families.planetfall.completions=999;
  const reopened=new PlayerProfiles(file),again=player();reopened.bind(again,identity.key);reopened.recordCareer("planetfall",id,[{player:again,won:false,repairs:4}]);
  expect(again.career!.families.planetfall).toMatchObject({completions:1,wins:0,repairs:4});expect(again.fallbucks).toBe(0);
 });
 it("deduplicates a settlement by canonical profile and retains it through capture, shop, refresh, link and restart",async()=>{
  const {c,store,p,identity,database}=await fixture(),other=player();store.bind(other,identity.key);
  p.fallbucks=1000;store.capture([p]);await database.flush();
  const id=randomUUID();store.recordCareer("planet-gun",id,[{player:p,won:true,eliminations:3,waves:7},{player:other,won:true,eliminations:3}]);
  store.recordCareer("planet-gun",id,[{player:p,won:true,eliminations:3,waves:7}]);await database.flush();
  const item=SHOP_CATALOG.find(i=>i.passLevel===undefined&&i.price>0&&i.price<1000)!;
  expect(await store.shop(identity.key,true,"buy",item.id,"planet-gun",()=>"lobby")).toEqual({ok:true});
  p.sessionTotalXp+=10;store.capture([p]);await database.flush();await store.refresh(identity.key);
  expect(await database.claimProfile("test","user",identity.key)).toBe(true);store.holdGuest(identity.key);
  store.recordCareer("battle-royale",randomUUID(),[{player:p,won:false,eliminations:2}]);await database.flush();
  const next=await ProfileDatabase.open(c),restarted=new PlayerProfiles(undefined,next.document,next.database),restored=player();restarted.bind(restored,identity.key);
  expect(restored.career!.families["planet-gun"]).toMatchObject({completions:1,wins:1,eliminations:3,waves:7});
  expect(restored.career!.families["battle-royale"]).toMatchObject({completions:1,wins:0,eliminations:2});
  expect(restored.ownedCosmetics).toContain(item.id);expect(restored.fallbucks).toBe(1000-item.price);expect(restored.sessionTotalXp).toBe(10);
  expect(store.guestKey(identity.token)).toBeUndefined();expect(await database.accountLink("test","user")).toBe(identity.key);
 },15000);
 it("serializes concurrent process settlements with economy deltas and refuses room-authored Career replacement",async()=>{
  const {c,store,p,identity,database}=await fixture(),next=await ProfileDatabase.open(c),other=new PlayerProfiles(undefined,next.document,next.database),q=player();other.bind(q,identity.key);
  store.recordCareer("planet-gun",randomUUID(),[{player:p,won:true,eliminations:2}]);
  other.recordCareer("planet-gun",randomUUID(),[{player:q,won:false,eliminations:3}]);
  q.fallbucks+=35;other.capture([q]);await Promise.all([database.flush(),next.database.flush()]);await store.refresh(identity.key);
  expect(p.career!.families["planet-gun"]).toMatchObject({completions:2,wins:1,eliminations:5});expect(p.fallbucks).toBe(35);
  p.career!.families["planet-gun"].wins=999;store.capture([p]);await database.flush();await store.refresh(identity.key);
  expect(p.career!.families["planet-gun"].wins).toBe(1);
 },15000);
 it("retries a lost commit response with the same receipt and preserves another process's later transaction",async()=>{
  let lose=false;
  const {c,store,p,identity,database,db}=await fixture(c=>({...c,async transaction(run){const result=await c.transaction(run);if(lose){lose=false;throw new Error("Lost commit response");}return result;}}));
  const second=await ProfileDatabase.open(c),other=new PlayerProfiles(undefined,second.document,second.database),q=player();other.bind(q,identity.key);
  const changed=vi.fn(),settled=vi.fn();store.onChange=changed;store.onCareerSettled=settled;vi.spyOn(console,"error").mockImplementation(()=>{});
  lose=true;const id=randomUUID();store.recordCareer("planet-run",id,[{player:p,won:true,qualifications:2}]);await expect(database.flush()).rejects.toThrow("Lost commit response");
  expect(changed).not.toHaveBeenCalled();expect(settled).not.toHaveBeenCalled();expect(p.career).toBeUndefined();
  q.fallbucks=20;other.capture([q]);other.recordCareer("planetfall",randomUUID(),[{player:q,won:false}]);await second.database.flush();
  database.retry();await database.flush();await store.refresh(identity.key);
  expect(settled).toHaveBeenCalledExactlyOnceWith(identity.key,"planet-run",id);
  expect(p.career!.families["planet-run"]).toMatchObject({completions:1,wins:1,qualifications:2});expect(p.career!.families.planetfall.completions).toBe(1);expect(p.fallbucks).toBe(20);
  expect((await db.query<{count:number}>("SELECT count(*)::int AS count FROM planetfall_profile_operations")).rows[0].count).toBe(3);
 },15000);
 it("rolls back a failed receipt transaction and rejects unbound or malformed result sources",async()=>{
  let fail=false;
  const {store,p,identity,database}=await fixture(c=>({...c,transaction:run=>c.transaction(query=>run(async(sql,values)=>{if(fail&&sql.startsWith("INSERT INTO planetfall_profile_operations")){fail=false;throw new Error("Receipt unavailable");}return query(sql,values);} ))}));
  vi.spyOn(console,"error").mockImplementation(()=>{});
  store.recordCareer("planetfall",randomUUID(),[{player:player(),won:true}]);await database.flush();expect(p.career).toBeUndefined();
  expect(()=>store.recordCareer("planetfall",randomUUID(),[{player:p,won:true,repairs:-1}])).toThrow();
  fail=true;store.recordCareer("planetfall",randomUUID(),[{player:p,won:false}]);await expect(database.flush()).rejects.toThrow("Receipt unavailable");
  expect((await database.readProfile(identity.key))!.progress.career).toBeUndefined();database.retry();await database.flush();expect(p.career!.families.planetfall.completions).toBe(1);
 },15000);
});
