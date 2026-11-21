import {afterEach,describe,expect,it,vi} from "vitest";
import {io as connect,type Socket} from "socket.io-client";
import {PG_BALANCE,type ClientToServerEvents,type ServerToClientEvents,type PgFireRequest,type PgInput,type PgJoinResult,type PgShot} from "@planetfall/shared";
import {createPlanetfallServer} from "../../app.js";
import {PlanetGunRoom} from "./pg-room.js";
const servers:Awaited<ReturnType<typeof createPlanetfallServer>>[]=[],clients:Socket<ServerToClientEvents,ClientToServerEvents>[]=[];
afterEach(async()=>{for(const c of clients.splice(0))c.disconnect();for(const s of servers.splice(0))await s.close();vi.unstubAllEnvs();});
async function setup(){const server=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"test",clientOrigins:["http://test.local"]});servers.push(server);const {url}=await server.listen();server.manager.stop();return {server,url};}
async function client(url:string){const c=connect(url,{transports:["websocket"],forceNew:true,extraHeaders:{Origin:"http://test.local"}});clients.push(c);await new Promise<void>((resolve,reject)=>{c.once("connect",resolve);c.once("connect_error",reject);});return c;}
async function create(){const {server,url}=await setup(),c=await client(url);const joined=await new Promise<PgJoinResult>(r=>c.emit("pg:room:create",{name:"Pilot"},r));if(!joined.ok)throw new Error(joined.error);return {server,url,c,joined,room:server.manager.rooms.get(joined.room.code) as PlanetGunRoom};}
const start=(room:PlanetGunRoom,id:string)=>{room.configure(id,{targetPlayers:4});room.setReady(id,true);const now=Date.now();expect(room.start(id,now)).toBe(true);room.update(0,now+PG_BALANCE.countdownMs);return now+PG_BALANCE.countdownMs;};

async function firingRoom(){
  const {room,joined,url,c}=await create();
  const guest=await client(url);
  const second=await new Promise<PgJoinResult>(resolve=>guest.emit("pg:room:join",{code:room.code,name:"Wing"},resolve));
  if(!second.ok)throw new Error(second.error);
  room.configure(joined.playerId,{fillBots:false});
  room.setReady(joined.playerId,true);
  room.setReady(second.playerId,true);
  const liveAt=Date.now()-250;
  expect(room.start(joined.playerId,liveAt-PG_BALANCE.countdownMs)).toBe(true);
  room.update(0,liveAt);
  const pilot=room.players.get(joined.playerId)!;
  const gun=pilot.guns[pilot.slot];
  const shots:PgShot[]=[];
  c.on("pg:combat:shot",shot=>shots.push(shot));
  const flush=()=>new Promise<void>((resolve,reject)=>{
    c.timeout(1000).emit("pg:clock",error=>error?reject(error):resolve());
  });
  const aim=(sequence:number,yaw:number,pitch:number)=>({sequence,yaw,pitch,moveX:0,moveZ:0,jump:false,sprint:false,crouch:false,ads:false} satisfies PgInput);
  const request=(sequence:number,yaw:number,pitch:number,clientTime=Date.now()):PgFireRequest=>({sequence,yaw,pitch,clientTime,weapon:gun.id});
  return {room,pilot,gun,shots,aim,request,flush,
    async input(input:PgInput){c.emit("pg:player:input",input);await flush();},
    async fire(shot:PgFireRequest){c.emit("pg:weapon:fire",shot);await flush();}
  };
}

describe("PlanetGun input and fire ordering",()=>{
  it.each([
    [-1,false,0], [1,false,85], [-1,true,85], [1,true,0]
  ] as const)("accepts a flick in direction %i with aim already stepped: %s, shot age: %i ms",async(direction,stepped,age)=>{
    const f=await firingRoom();
    const {yaw:oldYaw,pitch:oldPitch,lastInputSequence:oldAck}=f.pilot;
    const yaw=oldYaw+direction*.484,pitch=oldPitch+direction*.3;
    const magazine=f.gun.magazine;
    await f.input(f.aim(10,yaw,pitch));
    if(stepped)f.room.update(1/PG_BALANCE.tickRate,Date.now());
    await f.fire(f.request(1,yaw,pitch,Date.now()-age));
    expect(f.shots).toHaveLength(1);
    expect(f.gun.shots).toBe(1);
    expect(f.gun.magazine).toBe(magazine-1);
    expect(f.pilot.yaw).toBe(stepped?yaw:oldYaw);
    expect(f.pilot.pitch).toBe(stepped?pitch:oldPitch);
    expect(f.pilot.lastInputSequence).toBe(stepped?10:oldAck);
  });

  it("uses only the latest accepted aim and maintains aim and shot-time validation",async()=>{
    const f=await firingRoom();
    const yaw=f.pilot.yaw,pitch=f.pilot.pitch;
    const magazine=f.gun.magazine;
    await f.input(f.aim(10,yaw+.5,pitch));
    await f.input(f.aim(9,yaw-.5,pitch)); // Arrived out of order.
    await f.input(f.aim(11,yaw,NaN));
    await f.fire(f.request(1,yaw-.5,pitch));
    await f.fire(f.request(2,yaw,pitch));
    await f.fire(f.request(3,yaw+.5,pitch+.4));
    await f.fire(f.request(4,yaw+.5,pitch,Date.now()-PG_BALANCE.rewindMs-100));
    await f.fire(f.request(5,yaw+.5,pitch,Date.now()+100));
    expect(f.shots).toHaveLength(0);
    expect(f.gun.magazine).toBe(magazine);
    await f.fire(f.request(6,yaw+.5,pitch));
    expect(f.shots).toHaveLength(1);
    expect(f.gun.magazine).toBe(magazine-1);
  });

  it("does not validate a flick against expired queued input",async()=>{
    const f=await firingRoom();
    const {yaw,pitch}=f.pilot;
    await f.input(f.aim(10,yaw+.5,pitch));
    const now=f.pilot.lastInputAt+401;
    f.room.fire(f.pilot.id,f.request(1,yaw+.5,pitch,now),now);
    await f.flush();
    expect(f.shots).toHaveLength(0);
    f.room.fire(f.pilot.id,f.request(2,yaw,pitch,now),now);
    await f.flush();
    expect(f.shots).toHaveLength(1);
  });

  it("accepts steady aim once and retains shot sequencing, cooldown and ammunition limits",async()=>{
    const f=await firingRoom();
    const {yaw,pitch}=f.pilot;
    const magazine=f.gun.magazine;
    await f.fire(f.request(3,yaw,pitch));
    await f.fire(f.request(3,yaw,pitch));
    await f.fire(f.request(2,yaw,pitch));
    await f.fire(f.request(4,yaw,pitch));
    expect(f.shots).toHaveLength(1);
    expect(f.gun.magazine).toBe(magazine-1);
    const readyAt=f.gun.nextFireAt+1;
    f.room.fire(f.pilot.id,f.request(4,yaw,pitch,readyAt),readyAt);
    expect(f.gun.magazine).toBe(magazine-1);
    f.gun.magazine=0;
    f.room.fire(f.pilot.id,f.request(5,yaw,pitch,readyAt),readyAt);
    await f.flush();
    expect(f.shots).toHaveLength(1);
    expect(f.gun.magazine).toBe(0);
  });
});

describe("PlanetGun rooms",()=>{
 it("isolates family codes and cleans up generic leave",async()=>{const {room,c,server,url}=await create(),other=await client(url);const result=await new Promise<any>(r=>other.emit("room:join",{code:room.code,name:"wrong"},r));expect(result.ok).toBe(false);expect(result.error).toContain("PlanetGun");await new Promise(r=>c.emit("room:leave",{code:room.code},r));expect(server.manager.rooms.has(room.code)).toBe(false);});
 it("balances bots, starts only for ready host, and advances shared movement",async()=>{const {room,joined}=await create();expect(room.start("intruder")).toBe(false);expect(room.start(joined.playerId)).toBe(false);const now=start(room,joined.playerId);expect(room.phase).toBe("playing");const players=[...room.players.values()];expect(players.filter(p=>p.team==="solar")).toHaveLength(2);expect(players.filter(p=>p.team==="void")).toHaveLength(2);const bot=players.find(p=>p.isBot)!,before={...bot.position};for(let i=1;i<180;i++)room.update(1/60,now+i*1000/60);expect(Math.hypot(bot.position.x-before.x,bot.position.z-before.z)).toBeGreaterThan(1);expect(bot.lastInputSequence).toBeGreaterThan(0);});
 it("preserves session identity on reconnect and migrates the host",async()=>{const {room,joined,url}=await create(),other=await client(url);const second=await new Promise<PgJoinResult>(r=>other.emit("pg:room:join",{code:room.code,name:"Second"},r));if(!second.ok)throw Error(second.error);room.disconnect(joined.playerId);expect(room.hostId).toBe(second.playerId);const returning=await client(url),result=await new Promise<PgJoinResult>(r=>returning.emit("pg:room:join",{code:room.code,name:"Return",sessionToken:joined.sessionToken},r));expect(result.ok&&result.playerId).toBe(joined.playerId);expect(JSON.stringify(room.view())).not.toContain(joined.sessionToken);});
 it("rejects invalid loadouts and ignores stale input sequences",async()=>{const {room,joined}=await create();room.setLoadout(joined.playerId,{primary:"rail",secondary:"comet"});expect(room.players.get(joined.playerId)!.guns[0].id).toBe("rail");room.setLoadout(joined.playerId,{primary:"bogus",secondary:"comet"} as any);expect(room.players.get(joined.playerId)!.loadout.primary).toBe("rail");start(room,joined.playerId);const p=room.players.get(joined.playerId)!;room.setInput(p.id,{sequence:2,moveX:0,moveZ:-1,yaw:p.yaw,pitch:0,jump:false,sprint:false,crouch:false,ads:false});room.setInput(p.id,{...p.input,sequence:1});expect(p.input.sequence).toBe(2);});
 it("respawns fallen pilots without awarding a team kill",async()=>{const {room,joined}=await create(),now=start(room,joined.playerId),p=room.players.get(joined.playerId)!;const life=p.lifeId;p.position.y=-10;room.update(1/60,now+20);expect(p.hp).toBe(0);expect(p.deaths).toBe(1);expect(room.snapshot(now).scores).toEqual({solar:0,void:0});room.update(1/60,now+PG_BALANCE.respawnMs+40);expect(p.hp).toBe(100);expect(p.lifeId).toBe(life+1);expect(p.position.y).toBeGreaterThan(-1);});
 it("finishes an ordinary bot match and returns through the host lobby flow",async()=>{const {room,joined}=await create();room.configure(joined.playerId,{scoreLimit:25,botDifficulty:"hard"});const now=start(room,joined.playerId);room.players.get(joined.playerId)!.isBot=true;for(let i=1;i<=14401&&room.phase!=="results";i++)room.update(1/30,now+i*1000/30);expect(room.phase).toBe("results");expect(room.snapshot(now).winner).not.toBeNull();room.players.get(joined.playerId)!.isBot=false;room.returnToLobby(joined.playerId);expect(room.phase).toBe("lobby");expect(room.players.size).toBe(1);});
 it("shares earned currency and purchased suits with Classic after leaving PlanetGun",async()=>{
  const {server,url}=await setup(),c=connect(url,{transports:["websocket"],forceNew:true,auth:{profile:true},extraHeaders:{Origin:"http://test.local"}});clients.push(c);
  await new Promise<void>((resolve,reject)=>{c.once("profile:ready",()=>resolve());c.once("connect_error",reject);});
  const joined=await new Promise<PgJoinResult>(r=>c.emit("pg:room:create",{name:"Wallet Pilot"},r));if(!joined.ok)throw Error(joined.error);
  const room=server.manager.rooms.get(joined.room.code)as PlanetGunRoom,p=room.players.get(joined.playerId)!;p.fallbucks=150;room.setReady(p.id,true);
  const bought=await new Promise<any>(r=>c.emit("pg:shop:buy",{itemId:"solar-gold"},r));expect(bought.ok).toBe(true);
  const spent=p.fallbucks;expect(spent).toBeLessThan(150);await new Promise(r=>c.emit("room:leave",{code:room.code},r));
  const classic=await new Promise<any>(r=>c.emit("room:create",{name:"Classic Wallet"},r));expect(classic.ok).toBe(true);
  const returned=classic.room.players.find((entry:any)=>entry.id===classic.playerId);expect(returned.fallbucks).toBe(spent);expect(returned.ownedCosmetics).toContain("solar-gold");
 });
});
