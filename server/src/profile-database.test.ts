import {afterEach,describe,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {ProfileDatabase,type ProfileDatabaseConnection} from "./profile-database.js";
import {PlayerProfiles,type PlayerProgress} from "./player-profiles.js";
import {DEFAULT_COSMETICS} from "@planetfall/shared";
const engines:PGlite[]=[];
afterEach(async()=>{for(const db of engines.splice(0))await db.close();vi.restoreAllMocks();});
async function connection(){const db=new PGlite();engines.push(db);await db.waitReady;const c:ProfileDatabaseConnection={query:async(sql,values)=>({rows:(await db.query<Record<string,unknown>>(sql,values)).rows}),end:async()=>{}};return {db,c};}
const player=():PlayerProgress=>({fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"]});
describe("PostgreSQL-backed profile ledger (real PostgreSQL WASM engine)",()=>{
 it("executes schema/upsert/load SQL and restores purchases after replacing the application store",async()=>{
  const {db,c}=await connection(),first=await ProfileDatabase.open(c),store=new PlayerProfiles(undefined,first.document,first.database),identity=store.open(undefined),p=player();store.bind(p,identity.key);
  p.fallbucks=150;p.sessionTotalXp=115;p.sessionLevel=2;p.sessionXp=15;store.capture([p]);p.fallbucks-=100;p.ownedCosmetics.push("solar-gold");p.equippedCosmetics.suit="solar-gold";store.capture([p]);await store.close();
  const next=await ProfileDatabase.open(c),restarted=new PlayerProfiles(undefined,next.document,next.database),restored=player();const returning=restarted.open(identity.token);restarted.bind(restored,returning.key);
  expect(restored).toMatchObject({fallbucks:50,sessionTotalXp:115,ownedCosmetics:["solar-gold"],equippedCosmetics:{suit:"solar-gold"}});
  const result=await db.query<{id:string}>("SELECT id FROM planetfall_guest_profiles");expect(result.rows).toEqual([{id:identity.key}]);expect(result.rows[0].id).not.toBe(identity.token);await restarted.close();
 },15000);
 it("retains the latest reward snapshot after a failed write and retries without duplicating currency",async()=>{
  const {c}=await connection();let fail=false;const wrapped:ProfileDatabaseConnection={...c,query:async(sql,values)=>{if(fail&&sql.startsWith("INSERT")){fail=false;throw new Error("Simulated database outage");}return c.query(sql,values);}};
  const {database,document}=await ProfileDatabase.open(wrapped),store=new PlayerProfiles(undefined,document,database),identity=store.open(undefined),p=player();store.bind(p,identity.key);await database.flush();
  const logged=vi.spyOn(console,"error").mockImplementation(()=>{});fail=true;p.fallbucks=150;store.capture([p]);await expect(database.flush()).rejects.toThrow("Simulated database outage");expect(logged).toHaveBeenCalled();
  p.fallbucks-=100;store.capture([p]);await database.flush();const restarted=await ProfileDatabase.open(c);expect(restarted.document.profiles[identity.key].fallbucks).toBe(50);await store.close();await restarted.database.close();
 },15000);
 it("fails initialization instead of silently issuing a fresh zero-balance profile if storage is unavailable",async()=>{
  const end=vi.fn(async()=>{});await expect(ProfileDatabase.open({query:async()=>{throw new Error("Unavailable");},end})).rejects.toThrow("Unavailable");expect(end).toHaveBeenCalledOnce();
 });
});
