import {afterEach,describe,expect,it} from "vitest";
import {io as connect,type Socket} from "socket.io-client";
import {PG_BALANCE,type ClientToServerEvents,type ServerToClientEvents,type PgJoinResult,type PgSidePreference} from "@planetfall/shared";
import {createPlanetfallServer} from "../../app.js";
import {PlanetGunRoom} from "./pg-room.js";
const servers:Awaited<ReturnType<typeof createPlanetfallServer>>[]=[],clients:Socket<ServerToClientEvents,ClientToServerEvents>[]=[];
afterEach(async()=>{for(const c of clients.splice(0))c.disconnect();for(const s of servers.splice(0))await s.close();});
async function peer(url:string){const c=connect(url,{transports:["websocket"],forceNew:true,extraHeaders:{Origin:"http://test.local"}});clients.push(c);await new Promise<void>((resolve,reject)=>{c.once("connect",resolve);c.once("connect_error",reject);});return c;}
async function setup(){
 const server=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"test",clientOrigins:["http://test.local"]});servers.push(server);const {url}=await server.listen();server.manager.stop();
 const a=await peer(url),joined=await new Promise<PgJoinResult>(r=>a.emit("pg:room:create",{name:"A"},r));if(!joined.ok)throw Error(joined.error);
 const room=server.manager.rooms.get(joined.room.code) as PlanetGunRoom;room.configure(joined.playerId,{mode:"planetstrike",targetPlayers:4});
 const b=await peer(url),second=await new Promise<PgJoinResult>(r=>b.emit("pg:room:join",{code:room.code,name:"B"},r));if(!second.ok)throw Error(second.error);
 return {room,a,b,joined,second,url};
}
const side=(c:Socket<ServerToClientEvents,ClientToServerEvents>,value:PgSidePreference)=>new Promise<{ok:boolean;error?:string}>(r=>c.emit("pg:room:side",{side:value},r));
describe("PlanetStrike starting sides",()=>{
 it("lets two peers choose the same starting role, fills the other side with bots, and only unreadies the changing pilot",async()=>{
  const {room,a,b,joined,second}=await setup();room.setReady(joined.playerId,true);room.setReady(second.playerId,true);
  expect(await side(a,"attack")).toEqual({ok:true});expect(room.players.get(joined.playerId)!.ready).toBe(false);expect(room.players.get(second.playerId)!.ready).toBe(true);
  expect(await side(b,"attack")).toEqual({ok:true});room.setReady(joined.playerId,true);room.setReady(second.playerId,true);
  expect(await side(a,"attack")).toEqual({ok:true});expect(room.players.get(joined.playerId)!.ready).toBe(true);
  const now=Date.now();expect(room.start(joined.playerId,now)).toBe(true);room.update(0,now+PG_BALANCE.countdownMs);
  expect([...room.players.values()].filter(p=>!p.isBot).map(p=>p.team)).toEqual(["solar","solar"]);expect([...room.players.values()].filter(p=>p.isBot).map(p=>p.team)).toEqual(["void","void"]);
  expect(room.snapshot(now,joined.playerId).mode).toMatchObject({id:"planetstrike",attackTeam:"solar"});
  const before=room.view();expect((await side(a,"defend")).ok).toBe(false);expect(room.view()).toEqual(before);
 });
 it("enforces side capacity and balances Auto without moving another human",async()=>{
  const {room,a,b,joined,second,url}=await setup();expect((await side(a,"defend")).ok).toBe(true);expect((await side(b,"defend")).ok).toBe(true);
  const c=await peer(url),third=await new Promise<PgJoinResult>(r=>c.emit("pg:room:join",{code:room.code,name:"C"},r));if(!third.ok)throw Error(third.error);
  expect((await side(c,"defend")).error).toContain("full");expect(room.players.get(third.playerId)!.team).toBe("solar");
  expect((await side(a,"auto")).ok).toBe(true);expect(room.players.get(joined.playerId)!.team).toBe("solar");expect(room.players.get(second.playerId)!.team).toBe("void");
  const d=await peer(url);expect((await new Promise<PgJoinResult>(r=>d.emit("pg:room:join",{code:room.code,name:"D"},r))).ok).toBe(true);
  const e=await peer(url);expect((await new Promise<PgJoinResult>(r=>e.emit("pg:room:join",{code:room.code,name:"E"},r))).ok).toBe(false);
 });
 it("rejects unbalanced choices without fill and rejects disabling fill or shrinking around existing choices atomically",async()=>{
  const {room,a,b,joined,url}=await setup();room.configure(joined.playerId,{fillBots:false});expect((await side(b,"attack")).error).toContain("balanced");
  room.configure(joined.playerId,{targetPlayers:8,fillBots:true});expect((await side(b,"attack")).ok).toBe(true);
  const third=await peer(url),j=await new Promise<PgJoinResult>(r=>third.emit("pg:room:join",{code:room.code,name:"C"},r));if(!j.ok)throw Error(j.error);
  expect((await side(third,"attack")).ok).toBe(true);const before=room.view();room.configure(joined.playerId,{targetPlayers:4,fillBots:false});expect(room.view()).toEqual(before);
  room.configure(joined.playerId,{fillBots:false});expect(room.view()).toEqual(before);expect((await side(a,"defend")).ok).toBe(true);room.configure(joined.playerId,{targetPlayers:4,fillBots:false});expect(room.configuration).toMatchObject({targetPlayers:4,fillBots:false});
 });
 it("rejects malformed requests and requests outside a Strike lobby without changing phase or state",async()=>{
  const {room,a,b,joined,url}=await setup();const before=room.view();
  for(const raw of [null,[],{},"attack",{side:"bogus"},{side:[]},{side:"attack",playerId:joined.playerId}])expect(await new Promise<any>(r=>(a.emit as any)("pg:room:side",raw,r))).toMatchObject({ok:false});
  expect(room.view()).toEqual(before);const outsider=await peer(url);expect(await side(outsider,"attack")).toMatchObject({ok:false,error:"Not in PlanetGun."});
  expect((await side(b,"defend")).ok).toBe(true);room.configure(joined.playerId,{mode:"deathmatch"});const deathmatch=room.view();expect((await side(a,"attack")).ok).toBe(false);expect(room.view()).toEqual(deathmatch);
 });
 it("preserves the preference through mode changes and the active side through token reconnect",async()=>{
  const {room,a,b,joined,second,url}=await setup();expect((await side(a,"defend")).ok).toBe(true);
  room.configure(joined.playerId,{mode:"planetwatch"});room.configure(joined.playerId,{mode:"planetstrike",targetPlayers:4});expect(room.players.get(joined.playerId)!.team).toBe("void");
  room.setReady(joined.playerId,true);room.setReady(second.playerId,true);const now=Date.now();expect(room.start(joined.playerId,now)).toBe(true);room.update(0,now+PG_BALANCE.countdownMs);
  const original=room.players.get(joined.playerId)!;room.disconnect(joined.playerId);const returning=await peer(url),result=await new Promise<PgJoinResult>(r=>returning.emit("pg:room:join",{code:room.code,name:"Return",sessionToken:joined.sessionToken},r));
  expect(result.ok&&result.playerId).toBe(joined.playerId);expect(room.players.get(joined.playerId)).toBe(original);expect(original).toMatchObject({team:"void",preferredSide:"defend"});expect(JSON.stringify(room.view())).not.toContain(joined.sessionToken);
  expect((await side(b,"attack")).ok).toBe(false);
 });
});
