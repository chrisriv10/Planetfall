import {afterEach,beforeAll,describe,expect,it,vi} from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import {emptyCareer,type GameFamily} from "@planetfall/shared";
import {GameRoom} from "./game-room.js";
import {BattleRoyaleRoom} from "./modes/battle-royale/br-room.js";
import {PlanetRunRoom} from "./modes/planet-run/pr-room.js";
import {PlanetGunRoom} from "./modes/planet-gun/pg-room.js";
import type {CareerEntry} from "./player-profiles.js";
import type {PgMatch} from "./modes/planet-gun/pg-match.js";
import {PlayerProfiles} from "./player-profiles.js";
import {ProfileDatabase} from "./profile-database.js";
import {profileTestDatabase,withProfilePostgres} from "../test/profile-postgres-fixture.js";
import {randomUUID} from "node:crypto";

type Room=GameRoom|BattleRoyaleRoom|PlanetRunRoom|PlanetGunRoom;
const rooms:Room[]=[];
beforeAll(async()=>{await RAPIER.init();});
afterEach(()=>{for(const room of rooms.splice(0))room.dispose();});
const socket=(id:string)=>({id,join:vi.fn(),data:{}} as unknown as Parameters<GameRoom["join"]>[0]);
function fixture<T extends Room>(construct:(io:ConstructorParameters<typeof GameRoom>[1])=>T){
 const emit=vi.fn(),io={to:()=>({emit})} as unknown as ConstructorParameters<typeof GameRoom>[1];
 const room=construct(io);rooms.push(room);
 const a=room.join(socket("career-pilot-a"),"Pilot A"),b=room.join(socket("career-pilot-b"),"Pilot B");
 if(!a.ok||!b.ok)throw new Error("Isolated room join failed");
 const first=room.players.get(a.playerId)!,second=room.players.get(b.playerId)!;
 for(const p of [first,second])p.career=emptyCareer("2026-11-21T00:00:00.000Z");
 const settled=vi.fn((family:GameFamily,id:string,entries:Iterable<CareerEntry>)=>({family,id,entries:[...entries]}));
 room.onCareer=settled;
 const ready=()=>{room.setReady(first.id,true);room.setReady(second.id,true);};
 const privacy=()=>{
  expect(JSON.stringify(room.view())).not.toContain('"career"');
  for(const [event,payload] of emit.mock.calls)if(String(event).includes("snapshot")||String(event).includes("room:state")){
   expect(JSON.stringify(payload)).not.toContain('"career"');expect(JSON.stringify(payload)).not.toContain('"trackedSince"');
  }
 };
 const result=(index:number,family:GameFamily,winnerId:string)=>{
  const outcome=settled.mock.results[index].value;
  expect(outcome.family).toBe(family);expect(outcome.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  expect(outcome.entries).toHaveLength(2);expect(outcome.entries.every(e=>!('isBot' in e.player)||!e.player.isBot)).toBe(true);
  expect(outcome.entries.find(e=>e.player.id===winnerId)?.won).toBe(true);
  expect(outcome.entries.find(e=>e.player.id!==winnerId)?.won).toBe(false);
  if(index>0)expect(outcome.id).not.toBe(settled.mock.results[index-1].value.id);
  return outcome;
 };
 return {room,first,second,emit,settled,ready,privacy,result};
}

// These fixtures simulate elapsed time and terminal gameplay state. They exercise
// real room start/result/rematch methods, not genuine browser-completed matches.
describe("Career room settlement hooks (simulated authoritative terminal states)",()=>{
 it("settles Classic once with the real winner and issues a new settlement after rematch without exposing Career",()=>{
  const f=fixture(io=>new GameRoom("CAREER-CLASSIC",io)),internal=f.room as unknown as {matchStartedAt:number;end(id:string,reason:"timer",now:number):void};
  for(let match=0;match<2;match++){
   const now=Date.now()+match*100000;f.ready();f.room.start(f.first.id);expect(f.room.phase).toBe("countdown");f.room.update(.1,now+4000);
   const winner=match===0?f.first:f.second;internal.end(winner.id,"timer",internal.matchStartedAt+30001);
   expect(f.room.matchResult!.winnerId).toBe(winner.id);internal.end(winner.id,"timer",internal.matchStartedAt+30002);
   expect(f.settled).toHaveBeenCalledTimes(match+1);f.result(match,"planetfall",winner.id);f.privacy();
   if(match===0){f.room.voteRematch(f.first.id);f.room.voteRematch(f.second.id);expect(f.room.phase).toBe("lobby");}
  }
  expect(f.emit.mock.calls.some(([event])=>event==="match:snapshot")).toBe(true);
 });
 it("settles Battle Royale once from the surviving team, refreshes its UUID after rematch and hides Career from local/remote snapshots",()=>{
  const f=fixture(io=>new BattleRoyaleRoom("CAREER-BR",io,42)),internal=f.room as unknown as {checkWinner(now:number):void;emitSnapshots(now:number):void};
  f.room.configure(f.first.id,{teamMode:"solo",targetPlayers:10,fillBots:true});
  for(let match=0;match<2;match++){
   const now=Date.now()+match*100000;f.ready();expect(f.room.start(f.first.id,now)).toBe(true);f.room.phase="combat";
   const winner=match===0?f.first:f.second;
   for(const player of f.room.players.values()){player.alive=player.id===winner.id;player.downed=false;}
   winner.kills=2;internal.emitSnapshots(now+61000);internal.checkWinner(now+61000);internal.checkWinner(now+62000);
   expect(f.room.matchResult!.winningTeamId).toBe(winner.teamId);expect(f.settled).toHaveBeenCalledTimes(match+1);
   const result=f.result(match,"battle-royale",winner.id);expect(result.entries.find(e=>e.player.id===winner.id)?.eliminations).toBe(2);f.privacy();
   if(match===0){f.room.returnToLobby(f.first.id);f.room.returnToLobby(f.second.id);expect(f.room.phase).toBe("lobby");}
  }
  expect(f.emit.mock.calls.some(([event])=>event==="br:match:snapshot")).toBe(true);
 });
 it("settles Planet Run's final result once with qualifications and a fresh rematch UUID, keeping Career out of full snapshots",()=>{
  const f=fixture(io=>new PlanetRunRoom("CAREER-PR",io)),internal=f.room as unknown as {finish(winner:string,now:number):void;snapshot(now:number,full:boolean):unknown};
  f.room.configure(f.first.id,{targetPlayers:10,fillBots:true});
  for(let match=0;match<2;match++){
   const now=Date.now()+match*100000;f.ready();expect(f.room.start(f.first.id,now)).toBe(true);const winner=match===0?f.first:f.second;winner.qualifiedRounds=2;
   internal.finish(winner.id,now+61000);internal.finish(winner.id,now+62000);f.room.update(0,now+63000);
   expect(f.room.winnerId).toBe(winner.id);expect(f.settled).toHaveBeenCalledTimes(match+1);
   const result=f.result(match,"planet-run",winner.id);expect(result.entries.find(e=>e.player.id===winner.id)?.qualifications).toBe(2);
   expect(JSON.stringify(internal.snapshot(now+63000,true))).not.toContain('"career"');f.privacy();
   if(match===0){f.room.returnToLobby(f.first.id);expect(f.room.phase).toBe("lobby");}
  }
  expect(f.emit.mock.calls.some(([event])=>event==="pr:match:snapshot")).toBe(true);
 });
 it("settles Planet Gun once on the actual match result team and changes UUID after rematch without publishing Career",()=>{
  const f=fixture(io=>new PlanetGunRoom("CAREER-PG",io)),internal=f.room as unknown as {match:PgMatch};
  f.room.configure(f.first.id,{targetPlayers:6,fillBots:true});
  for(let match=0;match<2;match++){
   const now=Date.now()+match*100000;f.ready();expect(f.room.start(f.first.id,now)).toBe(true);const winner=match===0?f.first:f.second;winner.kills=3;
   internal.match.finish(winner.team);f.room.update(0,now+61000);f.room.update(0,now+62000);
   expect(f.room.snapshot(now+62000).winner).toBe(winner.team);expect(f.settled).toHaveBeenCalledTimes(match+1);
   const result=f.result(match,"planet-gun",winner.id);expect(result.entries.find(e=>e.player.id===winner.id)?.eliminations).toBe(3);f.privacy();
   if(match===0){f.room.returnToLobby(f.first.id);expect(f.room.phase).toBe("lobby");}
  }
  expect(f.emit.mock.calls.some(([event])=>event==="pg:match:snapshot")).toBe(true);
 });
 it.each(["planetwatch","planetzombies"]as const)("keeps %s result recognition aligned with authoritative outcomes",mode=>{
  const f=fixture(io=>new PlanetGunRoom(`CAREER-${mode}`,io)),internal=f.room as unknown as {match:PgMatch};
  f.room.configure(f.first.id,{mode,targetPlayers:mode==="planetzombies"?4:6,fillBots:true});
  const now=Date.now();f.ready();expect(f.room.start(f.first.id,now)).toBe(true);
  f.first.kills=2;internal.match.finish(mode==="planetzombies"?null:f.first.team);f.room.update(0,now+61000);
  expect(f.settled).toHaveBeenCalledTimes(1);
  const result=f.settled.mock.results[0].value;
  expect(result.family).toBe("planet-gun");expect(result.entries).toHaveLength(2);
  for(const entry of result.entries)expect(entry.won).toBe(entry.player.team===internal.match.winner);
  expect(result.entries.find(e=>e.player.id===f.first.id)?.eliminations).toBe(2);f.privacy();
  f.room.update(0,now+62000);expect(f.settled).toHaveBeenCalledTimes(1);
 });
});

it.skipIf(!profileTestDatabase)("persists Career once across concurrent native PostgreSQL connections and account linking (isolated local schema)",async()=>{
 await withProfilePostgres(async({runtimeUrl,owner,migrate,grantRuntime})=>{
  await migrate();await grantRuntime();
  const first=await ProfileDatabase.connect(runtimeUrl),a=new PlayerProfiles(undefined,first.document,first.database);
  const identity=await a.connectGuest(undefined),pilot={...a.view(identity.key)};a.bind(pilot,identity.key);
  const second=await ProfileDatabase.connect(runtimeUrl),b=new PlayerProfiles(undefined,second.document,second.database),other={...b.view(identity.key)};b.bind(other,identity.key);
  try{
   const id=randomUUID();a.recordCareer("planet-gun",id,[{player:pilot,won:true,eliminations:3}]);b.recordCareer("planet-gun",id,[{player:other,won:true,eliminations:3}]);
   await Promise.all([first.database.flush(),second.database.flush()]);
   expect(await first.database.claimProfile("career-test","local-account",identity.key)).toBe(true);
   other.fallbucks+=20;b.capture([other]);b.recordCareer("planet-run",randomUUID(),[{player:other,won:false,qualifications:1}]);await second.database.flush();await a.refresh(identity.key);
   expect(pilot.career!.families["planet-gun"]).toMatchObject({completions:1,wins:1,eliminations:3});
   expect(pilot.career!.families["planet-run"]).toMatchObject({completions:1,wins:0,qualifications:1});expect(pilot.fallbucks).toBe(20);
   expect((await owner.query("SELECT count(*)::int AS count FROM planetfall_profile_operations")).rows[0].count).toBe(3);
   expect(await first.database.accountLink("career-test","local-account")).toBe(identity.key);
  }finally{await Promise.all([a.close(),b.close()]);}
 });
},15000);
