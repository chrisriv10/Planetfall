import {afterEach,describe,expect,it} from "vitest";
import {mkdtempSync,rmSync,rmdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {io,type Socket} from "socket.io-client";
import {BR_BALANCE,type ClientToServerEvents,type ServerToClientEvents,type JoinResult,type BrJoinResult} from "@planetfall/shared";
import {createPlanetfallServer} from "./app.js";
import {GameRoom} from "./game-room.js";
import {BattleRoyaleRoom} from "./modes/battle-royale/br-room.js";
type Client=Socket<ServerToClientEvents,ClientToServerEvents>;
const clients:Client[]=[],servers:Awaited<ReturnType<typeof createPlanetfallServer>>[]=[],directories:string[]=[];
afterEach(async()=>{for(const client of clients.splice(0))client.disconnect();for(const server of servers.splice(0))await server.close();for(const directory of directories.splice(0)){rmSync(join(directory,"profiles.json"),{force:true});rmSync(join(directory,"profiles.json.tmp"),{force:true});rmdirSync(directory);}});
async function connect(url:string,token?:string){
 const client:Client=io(url,{transports:["websocket"],forceNew:true,reconnection:false,extraHeaders:{Origin:"http://test.local"},auth:{profile:true,profileToken:token,fallbucks:999999}});clients.push(client);
 const identity=await new Promise<{token:string}>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Profile handshake timed out")),3000);client.once("profile:ready",p=>{clearTimeout(timer);resolve(p);});client.once("connect_error",reject);});return {client,token:identity.token};
}
async function enter(client:Client,family:"classic"|"br"){
 const result=await new Promise<JoinResult|BrJoinResult>(resolve=>{if(family==="classic")client.emit("room:create",{name:"Same pilot name"},resolve);else client.emit("br:room:create",{name:"Same pilot name"},resolve);});if(!result.ok)throw new Error(result.error);return result;
}
describe("earned Fallbucks beyond the room lifecycle",()=>{
 for(const family of ["classic","br"] as const)it(`keeps ${family} match rewards and shop purchases through leave, another family and server restart`,async()=>{
  const directory=mkdtempSync(join(tmpdir(),"planetfall-profile-flow-"));directories.push(directory);const profileFile=join(directory,"profiles.json");
  const boot=async()=>{const server=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"test",clientOrigins:["http://test.local"],profileFile});servers.push(server);return {server,...await server.listen()};};
  const first=await boot(),pilot=await connect(first.url),joined=await enter(pilot.client,family),room=first.server.manager.rooms.get(joined.room.code)!;
  const p=room.players.get(joined.playerId)!;expect(p.fallbucks).toBe(0);
  if(room instanceof GameRoom){room.addBot(p.id);room.setReady(p.id,true);room.start(p.id);expect(room.phase).toBe("countdown");(room as unknown as {end(winner:string,reason:"timer"):void}).end(p.id,"timer");}
  else {room.configure(p.id,{targetPlayers:10,fillBots:true});room.setReady(p.id,true);const now=Date.now();room.start(p.id,now);room.phase="combat";room.update(1/30,now+BR_BALANCE.matchTimeoutMs+1);}
  expect(room.phase).toBe("results");const earned=p.fallbucks;expect(earned).toBeGreaterThanOrEqual(100);const xp=p.sessionTotalXp;
  expect(room.buyShopItem(p.id,"solar-gold").ok).toBe(true);expect(room.equipShopItem(p.id,"solar-gold").ok).toBe(true);const balance=p.fallbucks;expect(balance).toBe(earned-100);
  const left=await new Promise<{ok:boolean}>(resolve=>pilot.client.emit("room:leave",{code:room.code},resolve));expect(left.ok).toBe(true);
  const next=await enter(pilot.client,family==="classic"?"br":"classic"),restored=next.room.players.find(p=>p.id===next.playerId)!;expect(restored).toMatchObject({fallbucks:balance,sessionTotalXp:xp,ownedCosmetics:["solar-gold"],equippedCosmetics:{suit:"solar-gold"}});
  pilot.client.disconnect();await first.server.close();servers.splice(servers.indexOf(first.server),1);
  const second=await boot(),returning=await connect(second.url,pilot.token),fresh=await enter(returning.client,family);expect(returning.token).toBe(pilot.token);expect(fresh.room.players.find(p=>p.id===fresh.playerId)).toMatchObject({fallbucks:balance,sessionTotalXp:xp,ownedCosmetics:["solar-gold"]});
  const stranger=await connect(second.url),other=await enter(stranger.client,family);expect(other.room.players.find(p=>p.id===other.playerId)?.fallbucks).toBe(0);
 });
});
