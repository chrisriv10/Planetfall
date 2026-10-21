import {afterEach,describe,expect,it,vi} from "vitest";
import {io as connect,type Socket} from "socket.io-client";
import {PR_BALANCE,prRound,PrTileState,type ClientToServerEvents,type ServerToClientEvents,type PrJoinResult} from "@planetfall/shared";
import {createPlanetfallServer} from "../../app.js";
import {PlanetRunRoom} from "./pr-room.js";
const servers:Awaited<ReturnType<typeof createPlanetfallServer>>[]=[],clients:Socket<ServerToClientEvents,ClientToServerEvents>[]=[];
afterEach(async()=>{for(const c of clients.splice(0))c.disconnect();for(const s of servers.splice(0))await s.close();vi.unstubAllEnvs();});
async function setup(){const server=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"test",clientOrigins:["http://test.local"]});servers.push(server);const {url}=await server.listen();server.manager.stop();return {server,url};}
async function client(url:string){const c=connect(url,{transports:["websocket"],forceNew:true,extraHeaders:{Origin:"http://test.local"}});clients.push(c);await new Promise<void>((resolve,reject)=>{c.once("connect",resolve);c.once("connect_error",reject);});return c;}
async function create(){const {server,url}=await setup(),c=await client(url);const joined=await new Promise<PrJoinResult>(r=>c.emit("pr:room:create",{name:"Pilot"},r));if(!joined.ok)throw new Error(joined.error);return {server,url,c,joined,room:server.manager.rooms.get(joined.room.code) as PlanetRunRoom};}
const start=(room:PlanetRunRoom,id:string,pop:10|20|30=10)=>{room.configure(id,{targetPlayers:pop});room.setReady(id,true);const now=Date.now();expect(room.start(id,now)).toBe(true);room.update(0,now+PR_BALANCE.introMs);room.update(0,now+PR_BALANCE.introMs+PR_BALANCE.countdownMs);return now+PR_BALANCE.introMs+PR_BALANCE.countdownMs;};
describe("PlanetRun server isolation and lifecycle",()=>{
  it("rejects developer round controls in production even with the review flag set",async()=>{
    vi.stubEnv("PLANETFALL_PR_REVIEW","1");
    const server=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"production",clientOrigins:["http://test.local"]});servers.push(server);const {url}=await server.listen();server.manager.stop();
    const c=await client(url),joined=await new Promise<PrJoinResult>(r=>c.emit("pr:room:create",{name:"Production"},r));if(!joined.ok)throw new Error(joined.error);
    const room=server.manager.rooms.get(joined.room.code) as PlanetRunRoom;
    c.emit("pr:dev:start",{roundId:"shatterdeck",seed:42,players:30});
    // Ordered generic leave acknowledgement is a protocol barrier, not a sleep.
    await new Promise(resolve=>c.emit("room:leave",{code:room.code},resolve));expect(room.phase).toBe("lobby");expect(room.round).toBeNull();
  });
  it("rejects cross-family codes and uses the generic leave path",async()=>{
    const {room,c,joined,server,url}=await create(),other=await client(url);
    const classic=await new Promise<any>(r=>other.emit("room:join",{code:room.code,name:"Classic"},r));expect(classic.ok).toBe(false);expect(classic.error).toContain("PlanetRun");
    const br=await new Promise<any>(r=>other.emit("br:room:join",{code:room.code,name:"BR"},r));expect(br.error).toContain("PlanetRun");
    const left=await new Promise<any>(r=>c.emit("room:leave",{code:room.code},r));expect(left.ok).toBe(true);expect(server.manager.rooms.has(room.code)).toBe(false);expect(joined.room.gameFamily).toBe("planet-run");
  });
  it("transfers host on leave and resumes a disconnected pilot without leaking tokens",async()=>{
    const {room,joined,url}=await create(),other=await client(url);
    const second=await new Promise<PrJoinResult>(r=>other.emit("pr:room:join",{code:room.code,name:"Second"},r));if(!second.ok)throw new Error(second.error);
    room.disconnect(joined.playerId);expect(room.hostId).toBe(second.playerId);
    expect(JSON.stringify(room.view())).not.toContain(joined.sessionToken);
    const returning=await client(url),result=await new Promise<PrJoinResult>(r=>returning.emit("pr:room:join",{code:room.code,name:"Again",sessionToken:joined.sessionToken},r));expect(result.ok&&result.playerId).toBe(joined.playerId);
    room.leave(second.playerId);expect(room.hostId).toBe(joined.playerId);
    room.leave(joined.playerId);expect(room.isEmpty()).toBe(true);
  });
  it("does not let non-hosts configure or start and ignores invalid movement",async()=>{
    const {room,joined}=await create();room.configure("intruder",{targetPlayers:30});expect(room.configuration.targetPlayers).toBe(20);expect(room.start("intruder")).toBe(false);
    start(room,joined.playerId);const p=room.players.get(joined.playerId)!;
    room.setInput(p.id,{sequence:1,moveX:NaN,moveZ:0,jump:false,dive:false});expect(p.input.sequence).toBe(0);
    room.setInput(p.id,{sequence:2,moveX:0,moveZ:-1,jump:true,dive:false});room.setInput(p.id,{sequence:1,moveX:1,moveZ:0,jump:false,dive:false});expect(p.input.sequence).toBe(2);
  });
  it("validates cosmetic emotes and rate limits their presentation",async()=>{
    const {room,joined}=await create(),now=start(room,joined.playerId),p=room.players.get(joined.playerId)!;
    p.grounded=true;p.velocity={x:0,y:0,z:0};room.playEmote(p.id,"laugh",now+100);expect(p.emote).toBeNull();
    room.playEmote(p.id,"wave",now+100);expect(p.emote).toBe("wave");const at=p.emoteStartedAt;
    room.playEmote(p.id,"celebrate",now+200);expect(p.emoteStartedAt).toBe(at);expect(p.emote).toBe("wave");
    p.ownedCosmetics.push("laugh");room.playEmote(p.id,"laugh",now+2000);expect(p.emote).toBe("laugh");
  });
  it("respawns races at an authored checkpoint and qualifies only finish crossings",async()=>{
    const {room,joined}=await create(),now=start(room,joined.playerId),p=room.players.get(joined.playerId)!;
    p.position={x:0,y:-20,z:-40};p.checkpoint=1;room.update(1/30,now+34);expect(p.respawnAt).toBeGreaterThan(now);
    room.update(1/30,now+800);expect(p.position.z).toBeCloseTo(room.round!.checkpoints[1].spawn.z,0);
    p.checkpoint=room.round!.checkpoints.length-1;p.position={...room.round!.finish!.center};p.position.y=.6;
    room.update(1/30,now+834);expect(p.status).toBe("qualified");expect(p.place).toBe(1);
    room.update(0,room.phaseEndsAt+1);expect(room.phase).toBe("results");expect(room.winnerId).toBe(p.id);
  });
  it("breaks support once, eliminates bottom falls and picks one final survivor",async()=>{
    const {room,joined}=await create(),now=start(room,joined.playerId);
    room.round=prRound("shatterdeck");room.tiles=new PrTileState(room.round.tiles);room.phaseEndsAt=now+120000;room.qualificationTarget=1;
    for(const p of room.players.values())p.status="eliminated";
    const p=room.players.get(joined.playerId)!,bot=[...room.players.values()].find(p=>p.isBot)!;p.status=bot.status="active";
    const t=room.round.tiles.find(t=>t.deck===0&&t.column===0&&t.row===0)!;p.position={...t.center};bot.position={x:100,y:18,z:100};
    room.update(1/30,now+34);expect(room.tiles.triggered.has(t.id)).toBe(true);const triggered=room.tiles.triggered.get(t.id);
    room.update(1/30,now+68);expect(room.tiles.triggered.get(t.id)).toBe(triggered);
    bot.position.y=-20;room.update(1/30,now+102);expect(bot.status).toBe("eliminated");expect(room.winnerId).toBe(p.id);
    room.returnToLobby(p.id);expect(room.phase).toBe("lobby");expect(room.players.size).toBe(1);expect(room.players.get(p.id)?.ready).toBe(false);
  });
  it("awards persistent-compatible progress once and never rewards bots",async()=>{
    const {room,joined}=await create(),now=start(room,joined.playerId),p=room.players.get(joined.playerId)!;
    room.round=prRound("shatterdeck");room.tiles=new PrTileState(room.round.tiles);room.qualificationTarget=1;room.phaseEndsAt=now+120000;
    for(const b of room.players.values())if(b.isBot)b.status="eliminated";
    p.position={...room.round.spawns[0]};room.update(0,now+65000);expect(p.fallbucks).toBeGreaterThan(0);expect(p.crowns).toBe(1);const balance=p.fallbucks;
    room.update(0,now+66000);expect(p.fallbucks).toBe(balance);expect([...room.players.values()].filter(p=>p.isBot).every(p=>p.fallbucks===0&&p.sessionTotalXp===0)).toBe(true);
  });
  it("keeps PlanetRun rewards and cosmetics in the same guest profile across all families",async()=>{
    const {server,url}=await setup();
    const c=connect(url,{autoConnect:false,transports:["websocket"],forceNew:true,extraHeaders:{Origin:"http://test.local"},auth:{profile:true}});clients.push(c);
    const ready=new Promise<{token:string}>((resolve)=>c.once("profile:ready",resolve));c.connect();await ready;
    const joined=await new Promise<PrJoinResult>(resolve=>c.emit("pr:room:create",{name:"Shared profile"},resolve));if(!joined.ok)throw new Error(joined.error);
    const room=server.manager.rooms.get(joined.room.code) as PlanetRunRoom,now=start(room,joined.playerId),p=room.players.get(joined.playerId)!;
    room.round=prRound("shatterdeck");room.tiles=new PrTileState(room.round.tiles);room.qualificationTarget=1;room.phaseEndsAt=now+120000;
    for(const b of room.players.values())if(b.isBot)b.status="eliminated";
    p.position={...room.round.spawns[0]};room.update(0,now+65000);const expected={fallbucks:p.fallbucks,xp:p.sessionTotalXp,crowns:p.crowns};expect(expected.fallbucks).toBeGreaterThan(0);
    expect((await new Promise<any>(resolve=>c.emit("room:leave",{code:room.code},resolve))).ok).toBe(true);
    const br=await new Promise<any>(resolve=>c.emit("br:room:create",{name:"Shared profile"},resolve));expect(br.ok).toBe(true);
    const brPlayer=br.room.players.find((p:any)=>p.id===br.playerId);expect(brPlayer.fallbucks).toBe(expected.fallbucks);expect(brPlayer.sessionTotalXp).toBe(expected.xp);expect(brPlayer.crowns).toBe(expected.crowns);
    await new Promise(resolve=>c.emit("room:leave",{code:br.room.code},resolve));
    const classic=await new Promise<any>(resolve=>c.emit("room:create",{name:"Shared profile"},resolve));const classicPlayer=classic.room.players.find((p:any)=>p.id===classic.playerId);
    expect(classicPlayer.fallbucks).toBe(expected.fallbucks);expect(classicPlayer.sessionTotalXp).toBe(expected.xp);expect(classicPlayer.crowns).toBe(expected.crowns);
  });
  it("qualifies every living pilot when a survival timer expires",async()=>{
    const {room,joined}=await create(),now=start(room,joined.playerId);
    room.round=prRound("solar-sweep");room.tiles=new PrTileState([]);room.qualificationTarget=7;room.phaseEndsAt=now+1000;
    const pilots=[...room.players.values()];pilots[0].status="eliminated";
    room.update(0,now+1001);
    expect(room.phase).toBe("round-results");expect(pilots[0].status).toBe("eliminated");
    expect(pilots.slice(1).every(p=>p.status==="qualified")).toBe(true);
    expect(pilots.slice(1).every(p=>p.qualifiedRounds===1)).toBe(true);
  });
  it("resolves simultaneous final falls deterministically within the current finalists",async()=>{
    const {room,joined}=await create(),now=start(room,joined.playerId);
    room.round=prRound("shatterdeck");room.tiles=new PrTileState(room.round.tiles);room.qualificationTarget=1;room.phaseEndsAt=now+120000;
    const all=[...room.players.values()],finalists=all.slice(0,2),earlier=all[2];
    (room as unknown as {roundParticipants:Set<string>}).roundParticipants=new Set(finalists.map(p=>p.id));
    for(const p of all){p.status="eliminated";p.eliminatedAt=100000;}
    for(const p of finalists){p.status="active";p.position={x:0,y:-20,z:0};}
    room.update(1/30,now+3400);
    expect(room.winnerId).toBe(finalists.map(p=>p.id).sort()[0]);expect(room.winnerId).not.toBe(earlier.id);
  });
  it.each([10,20,30] as const)("simulates a %i-pilot normal tournament with bounded update time",async population=>{
    const {room,joined}=await create();let now=start(room,joined.playerId,population),max=0,steps=0;
    // Full ordinary bot routes, not injected finish positions. The idle human
    // is allowed to lose. This also detects a stalled race/final state machine.
    while(room.phase!=="results"&&steps<18000){now+=1000/30;const before=performance.now();room.update(1/30,now);max=Math.max(max,performance.now()-before);steps++;}
    expect(room.phase).toBe("results");expect(steps).toBeLessThan(18000);expect(room.roundIndex).toBeGreaterThanOrEqual(1);expect(room.winnerId).not.toBeNull();expect(max).toBeLessThan(50);
    expect([...room.players.values()].every(p=>Number.isFinite(p.position.y))).toBe(true);
  });
  it.each([10,20,30] as const)("keeps %i-pilot Shatterdeck active/breaking updates within a tick",async population=>{
    const {room,joined}=await create();const now=Date.now();
    expect(room.startReview(joined.playerId,"shatterdeck",42,population,now)).toBe(true);
    room.update(0,now+PR_BALANCE.introMs);room.update(0,now+PR_BALANCE.introMs+PR_BALANCE.countdownMs);
    const samples:number[]=[],round=room.round!;
    for(let i=0;i<90;i++){
      // Re-seed support for stress only, not tournament/playability evidence.
      let index=0;for(const p of room.players.values()){p.status="active";p.position={...round.spawns[index++]};p.velocity={x:0,y:0,z:0};}
      const at=now+PR_BALANCE.introMs+PR_BALANCE.countdownMs+i*1000/30;
      if(i===15)for(const t of round.tiles)room.tiles.contact(t.id,i*1000/30);
      const begin=performance.now();room.update(1/30,at);samples.push(performance.now()-begin);
    }
    samples.sort((a,b)=>a-b);expect(samples[Math.floor(samples.length*.95)]).toBeLessThan(1000/30);
    expect(room.tiles.triggered.size).toBe(round.tiles.length);
  });
});
