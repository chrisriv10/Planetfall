import {mkdirSync,writeFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import type {Server,Socket} from "socket.io";
import {PG_BALANCE,PG_MAP,pgCreateGun,pgSpawnMotion,type ClientToServerEvents,type ServerToClientEvents,type PgInput,type PgModeId,type PgPlayer,type PgSnapshot} from "@planetfall/shared";
import {PlanetGunRoom} from "./pg-room.js";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombies} from "./pg-zombies.js";

function record(name:string,value:unknown){mkdirSync(".local-runtime/pg-metrics",{recursive:true});writeFileSync(`.local-runtime/pg-metrics/${name}.json`,JSON.stringify(value,null,2));}
function distribution(samples:number[]){const sorted=[...samples].sort((a,b)=>a-b);return {averageTickMs:sorted.reduce((a,b)=>a+b,0)/sorted.length,p50TickMs:sorted[Math.floor(sorted.length*.5)],p95TickMs:sorted[Math.floor(sorted.length*.95)],maxTickMs:sorted.at(-1)};}
function fixture(mode:PgModeId,population:4|12,onSnapshot?:(snapshot:PgSnapshot)=>void){
 let maxSnapshotBytes=0,shots=0,snapshots=0;
 const io={to:()=>({emit:(event:string,payload:unknown)=>{if(event==="pg:combat:shot")shots++;if(event==="pg:match:snapshot"){snapshots++;maxSnapshotBytes=Math.max(maxSnapshotBytes,Buffer.byteLength(JSON.stringify(payload)));onSnapshot?.(payload as PgSnapshot);}}})} as unknown as Server<ClientToServerEvents,ServerToClientEvents>;
 const room=new PlanetGunRoom("PGMODEPERF",io),socket={id:"metrics-host",data:{},join:()=>{}} as unknown as Socket<ClientToServerEvents,ServerToClientEvents>;
 const joined=room.join(socket,"Metrics Host");if(!joined.ok)throw Error(joined.error);room.configure(joined.playerId,{mode,targetPlayers:population,fillBots:true,botDifficulty:"hard"});room.setReady(joined.playerId,true);
 expect(room.start(joined.playerId,1000)).toBe(true);const start=1000+PG_BALANCE.countdownMs;room.update(0,start);
 return {room,start,host:room.players.get(joined.playerId)!,metrics:()=>({population,maxSnapshotBytes,shots,snapshots})};
}

describe("new PlanetGun server simulation measurements",()=>{
 for(const mode of ["planetstrike","planetwatch","planetsiege","planetzombies"] as const)it(`${mode} full roster preserves the existing 8ms average / 16ms p95 simulation budgets`,()=>{
  const f=fixture(mode,mode==="planetzombies"?4:12),times:number[]=[];f.host.isBot=true;let moving=false;
  try{
   for(let frame=1;frame<=1800&&f.room.phase!=="results";frame++){const started=performance.now();f.room.update(1/30,f.start+frame*1000/30);const elapsed=performance.now()-started;if(frame>150)times.push(elapsed);moving||=[...f.room.players.values()].some(p=>Math.hypot(p.velocity.x,p.velocity.z)>1);}
   const metrics={mode,scenario:"ordinary autonomous full roster, 60 simulated seconds, first 5 seconds warmup",dt:1/30,...distribution(times),...f.metrics(),moving};record(`modes-server-${mode}`,metrics);
   expect(times.length).toBeGreaterThan(300);expect(moving).toBe(true);expect(metrics.snapshots).toBeGreaterThan(0);expect(metrics.maxSnapshotBytes).toBeLessThan(40000);expect(metrics.averageTickMs).toBeLessThan(8);expect(metrics.p95TickMs).toBeLessThan(16);
  }finally{f.room.dispose();}
 },60000);
 for(const rtt of [0,40,80,120])it(`Watch receives ordered intent and collision revisions with ${rtt}ms simulated RTT and bounded jitter`,()=>{
  // An input/snapshot delivery model only: this measures authority under delay, not client rendering or prediction.
  let now=0,revision=0;const incoming:{at:number;revision:number}[]=[],outgoing:{at:number;input:PgInput}[]=[],delays:number[]=[],times:number[]=[];
  const jitter=(frame:number)=>rtt===0?0:Math.sin(frame*1.71)*7;
  const f=fixture("planetwatch",12,snapshot=>{if(snapshot.mode)incoming.push({at:now+rtt/2+jitter(snapshot.players[0]?.lastInputSequence??0),revision:snapshot.mode.collision.topologyRevision??snapshot.mode.collision.revision});});now=f.start;
  // This case measures delivery/revision ordering, not survival in enemy fire.
  // Use an authored protected spawn and normal walking input; keep the ordinary
  // full-roster combat benchmarks above independent of this controlled lane.
  const anchor=PG_MAP.spawns.find(s=>s.team===f.host.team&&s.id.endsWith("-1"))!;
  Object.assign(f.host,pgSpawnMotion(anchor.position,0));const origin={...f.host.position};let delivered=0,maxSpawnDistance=0;
  try{
   for(let frame=1;frame<=600;frame++){
    now=f.start+frame*1000/30;for(let i=incoming.length-1;i>=0;i--)if(incoming[i].at<=now){revision=Math.max(revision,incoming[i].revision);incoming.splice(i,1);}
    const delay=Math.max(0,rtt/2+jitter(frame));outgoing.push({at:now+delay,input:{sequence:frame,moveX:Math.cos(frame*.03)*.22,moveZ:-Math.sin(frame*.03)*.22,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,ads:false,collisionRevision:revision}});delays.push(delay);
    // Sort by delivery deadline to model jitter reordering; sequence validation remains authoritative.
    outgoing.sort((a,b)=>a.at-b.at);while(outgoing.length&&outgoing[0].at<=now){f.room.setInput(f.host.id,outgoing.shift()!.input);delivered++;}
    const started=performance.now();f.room.update(1/30,now);times.push(performance.now()-started);maxSpawnDistance=Math.max(maxSpawnDistance,Math.hypot(f.host.position.x-origin.x,f.host.position.z-origin.z));
   }
   const metrics={mode:"planetwatch",scenario:"simulated delayed inputs and snapshots; walking in an authored protected spawn; no browser/network transport",rttMs:rtt,jitterMs:7,delivered,lastAcceptedSequence:f.host.lastInputSequence,displacement:Math.hypot(f.host.position.x-origin.x,f.host.position.z-origin.z),maxSpawnDistance,meanInputDelayMs:delays.reduce((a,b)=>a+b,0)/delays.length,...distribution(times),...f.metrics()};record(`modes-input-rtt-${rtt}`,metrics);
   expect(f.host.hp).toBeGreaterThan(0);expect(maxSpawnDistance).toBeLessThan(5);
   expect(delivered).toBeGreaterThan(550);expect(f.host.lastInputSequence).toBeGreaterThan(550);expect(metrics.displacement).toBeGreaterThan(1);expect(Object.values(f.host.position).every(Number.isFinite)).toBe(true);expect(metrics.p95TickMs).toBeLessThan(16);
  }finally{f.room.dispose();}
 },60000);
 it("profiles a synthetic late-wave director at 32 active zombies with queued replacements",()=>{
  // Explicit synthetic stress setup: select wave 25 and suppress survivor damage so all 32 enemies remain active.
  // This is not evidence of players surviving to wave 25 or bots completing a late wave.
  const players=new Map<string,PgPlayer>();for(let i=0;i<4;i++){const p={...pgSpawnMotion({x:-28+i,y:0,z:-9}),id:`stress-${i}`,team:"solar",connected:true,isBot:false,hp:100,lifeId:1,loadout:{primary:"pulse",secondary:"orbit"},guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:1,protectedUntil:0,lastDamageAt:0} as PgPlayer;players.set(p.id,p);}
  const world=new PgModeWorld(),mode=new PgZombies({players,world,finish:()=>{},damage:()=>0,respawn:(p,now,loadout,position)=>{Object.assign(p,pgSpawnMotion(position??p.position));p.hp=100;p.protectedUntil=now+1000;if(loadout){p.loadout=loadout;p.guns=[pgCreateGun(loadout.primary),pgCreateGun(loadout.secondary)];}}});mode.start(0);
  (mode as unknown as {wave:number}).wave=24;
  const times:number[]=[];let active=0,maxSnapshotBytes=0;const kinds=new Set<string>();
  for(let frame=1;frame<=1800;frame++){
   const started=performance.now();mode.update(1/30,frame*1000/30);const elapsed=performance.now()-started;
   if(frame%30===0){const snapshot=mode.snapshot();active=Math.max(active,snapshot.zombies.length);for(const z of snapshot.zombies)kinds.add(z.kind);maxSnapshotBytes=Math.max(maxSnapshotBytes,Buffer.byteLength(JSON.stringify(snapshot)));}
   if(mode.snapshot().zombies.length===32)times.push(elapsed);
  }
  const snapshot=mode.snapshot(),metrics={mode:"planetzombies",scenario:"synthetic wave 25, four stationary invulnerable survivors; real navigation and enemy simulation",active,queued:snapshot.queued,archetypes:[...kinds],samplesAtCap:times.length,...distribution(times),maxSnapshotBytes};record("modes-zombies-synthetic-cap",metrics);
  expect(active).toBe(32);expect(snapshot.queued).toBeGreaterThan(0);expect(kinds.size).toBe(3);expect(times.length).toBeGreaterThan(300);expect(metrics.averageTickMs).toBeLessThan(8);expect(metrics.p95TickMs).toBeLessThan(16);expect(maxSnapshotBytes).toBeLessThan(40000);
 },60000);
});
