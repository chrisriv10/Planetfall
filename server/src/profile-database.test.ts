import {afterEach,describe,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {ProfileDatabase,type ProfileDatabaseConnection} from "./profile-database.js";
import {PlayerProfiles,type PlayerProgress} from "./player-profiles.js";
import {DEFAULT_COSMETICS} from "@planetfall/shared";
import {GlobalLeaderboard} from "./global-leaderboard.js";
import {migrateProfileSchema} from "./profile-migrations.js";
const engines:PGlite[]=[];
afterEach(async()=>{for(const db of engines.splice(0))await db.close();vi.restoreAllMocks();});
async function connection(migrated=true){const db=new PGlite();engines.push(db);await db.waitReady;const c:ProfileDatabaseConnection={
  query:(sql,values)=>db.query(sql,values),
  transaction:run=>db.transaction(tx=>run((sql,values)=>tx.query(sql,values))),
  end:async()=>{},
};if(migrated)await migrateProfileSchema(c);return {db,c};}
const player=():PlayerProgress=>({fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"]});
describe("PostgreSQL-backed profile ledger (real PostgreSQL WASM engine)",()=>{
 it("uses only read queries at startup and requires an explicit migration",async()=>{
  const {db,c}=await connection(false);
  const query=vi.fn(c.query);
  const transaction=vi.fn(c.transaction);
  const observed={...c,query,transaction};
  await expect(ProfileDatabase.open(observed)).rejects.toThrow("npm run db:migrate");
  expect((await db.query("SELECT to_regclass('planetfall_guest_profiles') AS profiles")).rows).toEqual([{profiles:null}]);
  await migrateProfileSchema(c);
  query.mockClear();
  const {database}=await ProfileDatabase.open(observed);
  expect(await database.accountKeys()).toEqual([]);
  expect(query.mock.calls.map(([sql])=>sql.trim().split(/\s+/)[0])).toEqual(["WITH","SELECT","SELECT"]);
  expect(transaction).not.toHaveBeenCalled();
  await database.close();
 },15000);
 it("migrates the existing ledger and ranks opted-in canonical profiles by lifetime XP",async()=>{
  const {db,c}=await connection(false);
  await db.exec("CREATE TABLE planetfall_guest_profiles (id text PRIMARY KEY, progress jsonb NOT NULL)");
  await migrateProfileSchema(c);
  const {database,document}=await ProfileDatabase.open(c),store=new PlayerProfiles(undefined,document,database);
  let now=0;
  const board=new GlobalLeaderboard(store,()=>now);
  expect(await board.read()).toEqual({entries:[],currentPlayer:null,publicName:null});
  const guests=Array.from({length:13},()=>store.open(undefined));
  const pilots=guests.map(guest=>{const p=player();store.bind(p,guest.key);return p;});
  const duplicate=player();store.bind(duplicate,guests[0].key);
  pilots.forEach((p,i)=>{p.sessionTotalXp=i===12?9000:i<2?500:200-i;});
  pilots[0].sessionTotalXp-=50;duplicate.sessionTotalXp=50;
  store.capture([...pilots,duplicate]);
  for(const [i,guest] of guests.slice(0,12).entries())expect(await board.setVisibility(guest.key,"Pilot "+i)).toEqual({ok:true});
  const tie=guests.slice(0,2).sort((a,b)=>a.key<b.key?-1:1);
  const rank=await board.read(guests[11].key);
  expect(rank.entries).toHaveLength(10);
  expect(rank.entries.slice(0,2)).toEqual(tie.map((guest,i)=>({rank:i+1,name:"Pilot "+guests.indexOf(guest),xp:500,isYou:false})));
  expect(rank.currentPlayer).toEqual({rank:12,name:"Pilot 11",xp:189,isYou:true});
  expect(rank.publicName).toBe("Pilot 11");
  expect(JSON.stringify(rank)).not.toContain(guests[11].key);
  expect((await board.read(guests[12].key)).currentPlayer).toBeNull();
  expect(await board.setVisibility(guests[12].key,{name:"Spoof",xp:50000})).toMatchObject({ok:false});

  // Signing in preserves the same row instead of publishing a guest duplicate.
  expect(await database.accountKeys()).toEqual([]);
  expect(await database.claimProfile("test-issuer","test-user",guests[0].key)).toBe(true);
  store.holdGuest(guests[0].key);
  expect((await board.read(guests[0].key)).entries.filter(p=>p.isYou)).toHaveLength(1);
  expect(store.guestKey(guests[0].token)).toBeUndefined();
  pilots[11].sessionTotalXp+=400;
  store.capture([pilots[11]]);await database.flush();now+=21_000;
  expect((await board.read(guests[11].key)).entries[0]).toEqual({rank:1,name:"Pilot 11",xp:589,isYou:true});
  expect(await board.setVisibility(guests[11].key,null)).toEqual({ok:true});
  expect((await board.read(guests[11].key)).currentPlayer).toBeNull();
  await store.close();
  const reopened=await ProfileDatabase.open(c),restored=new PlayerProfiles(undefined,reopened.document,reopened.database);
  expect(restored.leaderboardName(guests[0].key)).toBe("Pilot 0");
  expect(restored.leaderboardName(guests[11].key)).toBeNull();
  expect(restored.view(guests[11].key).sessionTotalXp).toBe(589);
  await restored.close();
 },15000);

 it("executes schema/upsert/load SQL and restores purchases after replacing the application store",async()=>{
  const {db,c}=await connection(),first=await ProfileDatabase.open(c),store=new PlayerProfiles(undefined,first.document,first.database),identity=store.open(undefined),p=player();store.bind(p,identity.key);
  p.fallbucks=150;p.sessionTotalXp=115;p.sessionLevel=2;p.sessionXp=15;store.capture([p]);p.fallbucks-=100;p.ownedCosmetics.push("solar-gold");p.equippedCosmetics.suit="solar-gold";store.capture([p]);await store.close();
  const next=await ProfileDatabase.open(c),restarted=new PlayerProfiles(undefined,next.document,next.database),restored=player();const returning=restarted.open(identity.token);restarted.bind(restored,returning.key);
  expect(restored).toMatchObject({fallbucks:100,sessionTotalXp:115,ownedCosmetics:["solar-gold"],equippedCosmetics:{suit:"solar-gold"}});
  expect(restored.unlockedPassRewards).toContain("bucks-50");restarted.capture([restored]);expect(restored.fallbucks).toBe(100);
  const result=await db.query<{id:string}>("SELECT id FROM planetfall_guest_profiles");expect(result.rows).toEqual([{id:identity.key}]);expect(result.rows[0].id).not.toBe(identity.token);await restarted.close();
 },15000);
 it("retains ordered rewards after a failed write and retries without duplicating currency",async()=>{
  const {c}=await connection();let fail=false;const wrapped:ProfileDatabaseConnection={...c,
    transaction:run=>c.transaction(query=>run(async(sql,values)=>{
      if(fail&&sql.startsWith("INSERT INTO planetfall_profile_operations")){fail=false;throw new Error("Simulated database outage");}
      return query(sql,values);
    })),
  };
  const {database,document}=await ProfileDatabase.open(wrapped),store=new PlayerProfiles(undefined,document,database),identity=store.open(undefined),p=player();store.bind(p,identity.key);await database.flush();
  const logged=vi.spyOn(console,"error").mockImplementation(()=>{});fail=true;p.fallbucks=150;store.capture([p]);await expect(database.flush()).rejects.toThrow("Simulated database outage");expect(logged).toHaveBeenCalled();
  expect((await database.readProfile(identity.key))?.progress.fallbucks).toBe(0);
  p.fallbucks-=100;store.capture([p]);await database.flush();const restarted=await ProfileDatabase.open(c);expect(restarted.document.profiles[identity.key].fallbucks).toBe(50);await store.close();await restarted.database.close();
 },15000);
 it("replays an uncertain commit without duplicating rewards or overwriting a later operation",async()=>{
  const {db,c}=await connection();
  let loseCommitResponse=false;
  const uncertain:ProfileDatabaseConnection={...c,async transaction(run){
    const result=await c.transaction(run);
    if(loseCommitResponse){loseCommitResponse=false;throw new Error("Commit response lost");}
    return result;
  }};
  const first=await ProfileDatabase.open(uncertain),a=new PlayerProfiles(undefined,first.document,first.database);
  const identity=a.open(undefined),one=player();
  a.bind(one,identity.key);await first.database.flush();
  const second=await ProfileDatabase.open(c),b=new PlayerProfiles(undefined,second.document,second.database);
  const two=player();
  b.bind(two,identity.key);
  const committed=vi.fn(),failed=vi.fn();
  a.onChange=committed;a.onSaveFailure=failed;
  vi.spyOn(console,"error").mockImplementation(()=>{});
  loseCommitResponse=true;
  one.sessionTotalXp=100;one.fallbucks=20;a.capture([one]);
  await expect(first.database.flush()).rejects.toThrow("Commit response lost");
  expect(committed).not.toHaveBeenCalled();
  expect(failed).toHaveBeenCalledExactlyOnceWith(identity.key);
  expect((await second.database.readProfile(identity.key))?.progress).toMatchObject({sessionTotalXp:100,fallbucks:70});
  two.sessionTotalXp=25;two.fallbucks=30;b.capture([two]);await second.database.flush();
  first.database.retry();await first.database.flush();
  expect(committed).toHaveBeenCalledExactlyOnceWith(identity.key,expect.objectContaining({sessionTotalXp:125,fallbucks:100}));
  expect((await db.query<{count:number}>("SELECT count(*)::int AS count FROM planetfall_profile_operations")).rows).toEqual([{count:2}]);
  await Promise.all([a.close(),b.close()]);
 },15000);
 it("fails initialization instead of silently issuing a fresh zero-balance profile if storage is unavailable",async()=>{
  const end=vi.fn(async()=>{}),unavailable=async()=>{throw new Error("Unavailable");};await expect(ProfileDatabase.open({query:unavailable,transaction:unavailable,end})).rejects.toThrow("Unavailable");expect(end).toHaveBeenCalledOnce();
 });
});
