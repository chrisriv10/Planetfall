import {afterEach,describe,expect,it} from "vitest";
import {io as connect,type Socket} from "socket.io-client";
import {PG_BALANCE,PG_DEFAULT_MOVEMENT_RULES,PG_HERO_IDS,type ClientToServerEvents,type ServerToClientEvents,type PgJoinResult,type PgModeAction,type PgModeActionResult,type PgModeId} from "@planetfall/shared";
import {createPlanetfallServer} from "../../app.js";
import {PlanetGunRoom} from "./pg-room.js";

type Client=Socket<ServerToClientEvents,ClientToServerEvents>;
const clients:Client[]=[],servers:Awaited<ReturnType<typeof createPlanetfallServer>>[]=[];
afterEach(async()=>{for(const socket of clients.splice(0))socket.disconnect();for(const server of servers.splice(0))await server.close();});
async function client(url:string):Promise<Client>{
 const socket=connect(url,{transports:["websocket"],forceNew:true,extraHeaders:{Origin:"http://test.local"}});clients.push(socket);
 await new Promise<void>((resolve,reject)=>{socket.once("connect",resolve);socket.once("connect_error",reject);});return socket;
}
async function fixture(){
 const server=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"test",clientOrigins:["http://test.local"]});servers.push(server);
 const {url}=await server.listen();server.manager.stop();const socket=await client(url);
 const joined=await new Promise<PgJoinResult>(resolve=>socket.emit("pg:room:create",{name:"Authority Host"},resolve));if(!joined.ok)throw Error(joined.error);
 const room=server.manager.rooms.get(joined.room.code) as PlanetGunRoom;
 const join=async(token?:string)=>{const socket=await client(url),result=await new Promise<PgJoinResult>(resolve=>socket.emit("pg:room:join",{code:room.code,name:"Authority Guest",sessionToken:token},resolve));if(!result.ok)throw Error(result.error);return {socket,result};};
 const start=(mode?:PgModeId,targetPlayers:4|8|12=4)=>{
  room.configure(joined.playerId,{...(mode?{mode}:{}),targetPlayers,fillBots:true});for(const p of room.players.values())if(!p.isBot)room.setReady(p.id,true);
  const at=Date.now();expect(room.start(joined.playerId,at)).toBe(true);room.update(0,at+PG_BALANCE.countdownMs);expect(room.phase).toBe("playing");return at+PG_BALANCE.countdownMs;
 };
 return {server,url,socket,joined,room,join,start};
}
const send=(socket:Client,raw:unknown)=>new Promise<PgModeActionResult>(resolve=>socket.emit("pg:mode:action",raw as PgModeAction,resolve));
function watch(room:PlanetGunRoom,now:number,viewer?:string){const mode=room.snapshot(now,viewer).mode;if(mode?.id!=="planetwatch")throw Error("Expected PlanetWatch snapshot");return mode;}

describe("PlanetGun mode room authority and network boundary",()=>{
 it("retains default deathmatch health, movement, regeneration and automatic respawn",async()=>{
  const f=await fixture(),now=f.start(),p=f.room.players.get(f.joined.playerId)!;expect(f.room.snapshot(now).mode).toBeUndefined();
  expect(p.hp).toBe(100);p.hp=50;p.lastDamageAt=now-PG_BALANCE.regenDelayMs-100;f.room.update(.1,now+100);expect(p.hp).toBeGreaterThan(50);
  p.position.y=-10;f.room.update(.1,now+200);expect(p.hp).toBe(0);const life=p.lifeId;f.room.update(.1,now+200+PG_BALANCE.respawnMs+10);expect(p.lifeId).toBe(life+1);expect(p.hp).toBe(100);
 });
 it.each(["planetstrike","planetwatch","planetsiege","planetzombies"] as const)("starts %s through one room lifecycle and exports resolved controls",async mode=>{
  const f=await fixture(),now=f.start(mode),snapshot=f.room.snapshot(now,f.joined.playerId);expect(snapshot.mode?.id).toBe(mode);expect(f.room.players.size).toBe(4);
  expect(snapshot.mode?.controls?.[f.joined.playerId]).toBeDefined();
  if(mode==="planetwatch"){expect(watch(f.room,now).pilots[f.joined.playerId].maxHp).toBeGreaterThan(100);expect(snapshot.mode?.controls?.[f.joined.playerId].movement).toEqual(PG_DEFAULT_MOVEMENT_RULES);}
  if(mode==="planetzombies")expect(new Set([...f.room.players.values()].map(p=>p.team))).toEqual(new Set(["solar"]));
 });
 it("enforces host-only valid mode changes and refuses over-capacity co-op without removing humans",async()=>{
  const f=await fixture(),guest=await f.join();f.room.configure(guest.result.playerId,{mode:"planetwatch"});expect(f.room.configuration.mode).toBeUndefined();
  f.room.configure(f.joined.playerId,{mode:"malformed-mode" as PgModeId});expect(f.room.configuration.mode).toBeUndefined();
  await f.join();await f.join();await f.join();const ids=[...f.room.players.keys()];
  const error=new Promise<{message:string}>(resolve=>f.socket.once("pg:error",resolve));f.room.configure(f.joined.playerId,{mode:"planetzombies"});
  expect((await error).message).toMatch(/four/i);expect([...f.room.players.keys()]).toEqual(ids);expect(f.room.configuration.mode).toBeUndefined();
 });
 it("reserves concurrent human picks atomically before filling a full distinct-hero roster",async()=>{
  const f=await fixture();await f.join();const teammate=await f.join();f.room.configure(f.joined.playerId,{mode:"planetwatch"});
  const host=f.room.players.get(f.joined.playerId)!,other=f.room.players.get(teammate.result.playerId)!;expect(host.team).toBe(other.team);
  const results=await Promise.all([send(f.socket,{kind:"select",sequence:1,lifeId:host.lifeId,characterId:"solace"}),send(teammate.socket,{kind:"select",sequence:1,lifeId:other.lifeId,characterId:"solace"})]);
  expect(results.filter(r=>r.ok)).toHaveLength(1);const picked=results[0].ok?host:other,now=f.start("planetwatch",12),mode=watch(f.room,now);
  expect(mode.pilots[picked.id].characterId).toBe("solace");expect(picked.team).toBe("solar");
  for(const team of ["solar","void"] as const)expect([...f.room.players.values()].filter(p=>p.team===team).map(p=>mode.pilots[p.id].characterId).sort()).toEqual([...PG_HERO_IDS].sort());
 });
 it("rejects malformed intents, stale lives and duplicate purchases without duplicating credits",async()=>{
  const f=await fixture(),now=f.start("planetstrike"),p=f.room.players.get(f.joined.playerId)!,life=p.lifeId;
  for(const raw of [null,{},"bad",{kind:"buy",sequence:-1,lifeId:life,itemId:"armor"},{kind:"buy",sequence:1,lifeId:life,itemId:{}},{kind:"ability",sequence:2,lifeId:life,slot:0,position:{x:Infinity,y:0,z:0}},{kind:"drone",sequence:3,lifeId:life,control:true,moveX:20,moveZ:0,yaw:0,pitch:0}])expect((await send(f.socket,raw)).ok).toBe(false);
  const purchase={kind:"buy",sequence:10,lifeId:life,itemId:"armor"};expect((await send(f.socket,purchase)).ok).toBe(true);expect((await send(f.socket,purchase)).ok).toBe(false);
  expect((await send(f.socket,{...purchase,sequence:11,lifeId:life-1})).ok).toBe(false);const mode=f.room.snapshot(now,p.id).mode;if(mode?.id!=="planetstrike")throw Error("Expected Strike");
  expect(mode.pilots[p.id].credits).toBe(150);expect(mode.pilots[p.id].armor).toBeGreaterThan(0);
 });
 it.each(["planetstrike","planetzombies"] as const)("locks the initial %s primary against weapon-switch packets",async mode=>{
  const f=await fixture(),now=f.start(mode),p=f.room.players.get(f.joined.playerId)!;expect(p.slot).toBe(1);expect(p.guns[0].magazine).toBe(0);
  f.room.switchWeapon(p.id,0,now+500);expect(p.slot).toBe(1);expect(p.guns[0].reserve).toBe(0);
 });
 it.each(["planetstrike","planetsiege","planetzombies"] as const)("does not apply deathmatch regeneration in %s",async mode=>{
  const f=await fixture(),now=f.start(mode),p=f.room.players.get(f.joined.playerId)!;p.hp=50;p.lastDamageAt=now-PG_BALANCE.regenDelayMs-100;
  f.room.update(.1,now+100);expect(p.hp).toBe(50);
 });
 it("restores the exact active Watch life, hero, cooldown and health on session reconnect",async()=>{
  const f=await fixture();const guest=await f.join();f.room.configure(f.joined.playerId,{mode:"planetwatch"});let p=f.room.players.get(f.joined.playerId)!;
  expect(f.room.modeAction(p.id,{kind:"select",sequence:1,lifeId:p.lifeId,characterId:"cinder"}).ok).toBe(true);const now=f.start("planetwatch");
  p.position={x:-10,y:0,z:32};p.protectedUntil=0;
  expect(f.room.modeAction(p.id,{kind:"ability",sequence:2,lifeId:p.lifeId,slot:0,position:{x:-5,y:0,z:32}},now).ok).toBe(true);p.hp=123;
  const life=p.lifeId,before=watch(f.room,now,p.id).pilots[p.id];f.room.disconnect(p.id);expect(f.room.hostId).toBe(guest.result.playerId);
  const returning=await f.join(f.joined.sessionToken);expect(returning.result.playerId).toBe(p.id);p=f.room.players.get(p.id)!;
  expect(p.lifeId).toBe(life);expect(p.hp).toBe(123);expect(watch(f.room,now,p.id).pilots[p.id]).toEqual(before);expect(p.position.x).toBe(-5);
  expect(JSON.stringify(f.room.view())).not.toContain(f.joined.sessionToken);
 });
 it("resumes private action sequencing after a refresh without replaying purchases",async()=>{
  const f=await fixture(),now=f.start("planetstrike"),p=f.room.players.get(f.joined.playerId)!;
  expect((await send(f.socket,{kind:"buy",sequence:41,lifeId:p.lifeId,itemId:"smoke"})).ok).toBe(true);
  f.room.disconnect(p.id);const returning=await f.join(f.joined.sessionToken);
  expect(returning.result.room.lastActionSequence).toBe(41);
  expect(f.room.view().lastActionSequence).toBeUndefined();
  expect(f.room.snapshot(now,p.id).mode?.controls?.[p.id].lastActionSequence).toBe(41);
  expect((await send(returning.socket,{kind:"buy",sequence:41,lifeId:p.lifeId,itemId:"comet"})).ok).toBe(false);
  expect((await send(returning.socket,{kind:"buy",sequence:42,lifeId:p.lifeId,itemId:"comet"})).ok).toBe(true);
  const mode=f.room.snapshot(now,p.id).mode;if(mode?.id!=="planetstrike")throw Error("Expected Strike");
  expect(mode.pilots[p.id].credits).toBe(0);expect(mode.pilots[p.id].utilities).toEqual([1,0,0]);
 });
 it("preserves legal selected operator equipment separately from saved deathmatch kits",async()=>{
  const f=await fixture(),p=f.room.players.get(f.joined.playerId)!;
  const saved={...p.loadout};f.room.configure(p.id,{mode:"planetsiege"});
  expect(f.room.modeAction(p.id,{kind:"select",sequence:1,lifeId:p.lifeId,characterId:"null",loadout:{primary:"arc",secondary:"orbit",primaryModules:[],secondaryModules:[]}}).ok).toBe(true);
  const now=f.start("planetsiege");expect(p.guns[0].id).toBe("arc");expect(p.guns[1].id).toBe("orbit");
  expect(f.room.snapshot(now,p.id).mode?.pilots[p.id].characterId).toBe("null");
  (f.room as unknown as {match:{finish(winner:null):void}}).match.finish(null);
  f.room.returnToLobby(p.id);f.room.configure(p.id,{mode:"deathmatch"});
  expect(p.loadout).toEqual(saved);
  const newer={primary:"rail",secondary:"orbit",primaryModules:["precision-lens"],secondaryModules:[]} as const;
  f.room.setLoadout(p.id,newer);expect(p.loadout.primary).toBe("rail");
  f.start("planetwatch");
  (f.room as unknown as {match:{finish(winner:null):void}}).match.finish(null);
  f.room.returnToLobby(p.id);expect(p.loadout).toMatchObject(newer);
 });
 it.each(["planetstrike","planetwatch","planetsiege","planetzombies"] as const)("settles bounded %s participation rewards at most once and excludes idle pilots",async mode=>{
  const f=await fixture(),now=f.start(mode),p=f.room.players.get(f.joined.playerId)!;
  const balance=p.fallbucks,xp=p.sessionTotalXp;
  // Economy-unit fixture: a finished eligible run with two earned kills.
  p.kills=2;(f.room as unknown as {match:{finish(winner:null):void}}).match.finish(null);
  f.room.update(0,now+61000);const awarded=p.fallbucks,awardedXp=p.sessionTotalXp;
  expect(awarded-balance).toBe(7);expect(awardedXp-xp).toBe(35);
  f.room.update(0,now+62000);f.room.update(0,now+63000);
  expect(p.fallbucks).toBe(awarded);expect(p.sessionTotalXp).toBe(awardedXp);
  f.room.returnToLobby(p.id);f.room.configure(p.id,{mode});f.room.setReady(p.id,true);
  expect(f.room.start(p.id,now+64000)).toBe(true);f.room.update(0,now+64000+PG_BALANCE.countdownMs);
  expect(p.kills).toBe(0);(f.room as unknown as {match:{finish(winner:null):void}}).match.finish(null);
  f.room.update(0,now+130000);expect(p.fallbucks).toBe(awarded);expect(p.sessionTotalXp).toBe(awardedXp);
 });
 it("projects recon privately through room snapshots with historical positions and expiration",async()=>{
  const f=await fixture();f.room.configure(f.joined.playerId,{mode:"planetwatch"});const p=f.room.players.get(f.joined.playerId)!;
  expect(f.room.modeAction(p.id,{kind:"select",sequence:1,lifeId:p.lifeId,characterId:"parallax"}).ok).toBe(true);const now=f.start("planetwatch"),enemy=[...f.room.players.values()].find(v=>v.team!==p.team)!;
  p.position={x:-10,y:0,z:32};p.yaw=-Math.PI/2;p.protectedUntil=0;enemy.position={x:2,y:0,z:32};enemy.protectedUntil=0;
  expect(f.room.modeAction(p.id,{kind:"ability",sequence:2,lifeId:p.lifeId,slot:0},now).ok).toBe(true);
  expect(watch(f.room,now,p.id).intel.some(i=>i.targetId===enemy.id)).toBe(true);expect(watch(f.room,now,enemy.id).intel).toEqual([]);expect(watch(f.room,now).intel).toEqual([]);
  enemy.position.x=4;expect(watch(f.room,now,p.id).intel.find(i=>i.targetId===enemy.id)?.position.x).toBe(2);
  f.room.update(.1,now+2100);expect(watch(f.room,now+2100,p.id).intel).toEqual([]);
 });
 it("hides enemy Siege selections and private drone state in public room/snapshot views",async()=>{
  const f=await fixture(),other=await f.join();f.room.configure(f.joined.playerId,{mode:"planetsiege"});const p=f.room.players.get(f.joined.playerId)!,enemy=f.room.players.get(other.result.playerId)!;
  expect(f.room.modeAction(p.id,{kind:"select",sequence:1,lifeId:p.lifeId,characterId:"rivet",loadout:{primary:"photon",secondary:"comet"}}).ok).toBe(true);
  const own=f.room.view(p.id);expect(own.selections?.[p.id]).toBe("rivet");expect(f.room.view(enemy.id).selections?.[p.id]).toBeUndefined();expect(f.room.view().selections?.[p.id]).toBeUndefined();
  expect(own.players.find(v=>v.id===p.id)!.loadout.primary).toBe("photon");
  expect(f.room.view(enemy.id).players.find(v=>v.id===p.id)!.loadout).toEqual({primary:"pulse",secondary:"orbit"});
  const now=f.start("planetsiege"),publicMode=f.room.snapshot(now).mode,privateMode=f.room.snapshot(now,p.id).mode;
  if(publicMode?.id!=="planetsiege"||privateMode?.id!=="planetsiege")throw Error("Expected Siege");
  expect(publicMode.intel).toEqual([]);expect(publicMode.drones).toEqual([]);expect(publicMode.pilots[p.id].characterId).toBeNull();expect(privateMode.pilots[p.id].characterId).toBe("rivet");
  const hidden=f.room.snapshot(now).players.find(v=>v.id===p.id)!;
  expect(hidden.loadout).toEqual({primary:"pulse",secondary:"orbit"});expect(hidden.guns.every(g=>g.magazine===0&&g.reserve===0)).toBe(true);
  expect(f.room.snapshot(now,p.id).players.find(v=>v.id===p.id)!.guns[0].id).toBe("photon");
 });
 it("does not disclose hidden operators through maximum or wounded health",async()=>{
  const f=await fixture(),other=await f.join();f.room.configure(f.joined.playerId,{mode:"planetsiege"});const p=f.room.players.get(f.joined.playerId)!,enemy=f.room.players.get(other.result.playerId)!;
  expect(f.room.modeAction(p.id,{kind:"select",sequence:1,lifeId:p.lifeId,characterId:"null"}).ok).toBe(true);
  const now=f.start("planetsiege");expect(p.hp).toBe(105);
  const own=f.room.snapshot(now,p.id).mode;if(own?.id!=="planetsiege")throw Error("Expected Siege");expect(own.pilots[p.id].maxHp).toBe(105);
  for(const hp of [105,64,0]){
   p.hp=hp;
   for(const viewer of [undefined,enemy.id]){
    const snapshot=f.room.snapshot(now,viewer),mode=snapshot.mode;if(mode?.id!=="planetsiege")throw Error("Expected Siege");
    expect(mode.pilots[p.id]).toMatchObject({characterId:null,maxHp:100});
    expect(snapshot.players.find(v=>v.id===p.id)!.hp).toBe(hp>0?100:0);
    expect(f.room.view(viewer).players.find(v=>v.id===p.id)!.hp).toBe(hp>0?100:0);
   }
   expect(f.room.snapshot(now,p.id).players.find(v=>v.id===p.id)!.hp).toBe(hp);expect(f.room.view(p.id).players.find(v=>v.id===p.id)!.hp).toBe(hp);expect(p.hp).toBe(hp);
  }
 });
});
