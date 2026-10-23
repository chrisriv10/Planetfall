import {mkdirSync,writeFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import type {Server,Socket} from "socket.io";
import type {ClientToServerEvents,ServerToClientEvents} from "@planetfall/shared";
import {PlanetGunRoom} from "./pg-room.js";
describe("PlanetGun active server simulation",()=>{
 for(const population of [4,8,12]as const)it(`${population} pilots move, fire, respawn and stay within tick/network budgets`,()=>{
  let shotCount=0,maxSnapshot=0;const io={to:()=>({emit:(event:string,p:unknown)=>{if(event==="pg:combat:shot")shotCount++;if(event==="pg:match:snapshot")maxSnapshot=Math.max(maxSnapshot,Buffer.byteLength(JSON.stringify(p)));}})}as unknown as Server<ClientToServerEvents,ServerToClientEvents>;
  const room=new PlanetGunRoom("PGPERF",io),socket={id:"perf",data:{},join:()=>{}}as unknown as Socket<ClientToServerEvents,ServerToClientEvents>;
  const joined=room.join(socket,"Host");if(!joined.ok)throw Error(joined.error);room.configure(joined.playerId,{targetPlayers:population,botDifficulty:"hard",scoreLimit:75});room.setReady(joined.playerId,true);expect(room.start(joined.playerId,1000)).toBe(true);room.players.get(joined.playerId)!.isBot=true;
  const times:number[]=[];let moving=false,kills=0;
  for(let i=0;i<1800;i++){const began=performance.now();room.update(1/30,4000+i*1000/30);times.push(performance.now()-began);moving||=[...room.players.values()].some(p=>Math.hypot(p.velocity.x,p.velocity.z)>2);kills=Math.max(kills,[...room.players.values()].reduce((n,p)=>n+p.kills,0));}
  times.sort((a,b)=>a-b);const average=times.reduce((a,b)=>a+b,0)/times.length,p95=times[Math.floor(times.length*.95)];const metric={mode:"planet-gun",population,averageTickMs:average,p95TickMs:p95,maxTickMs:times.at(-1),maxSnapshotBytes:maxSnapshot,shotCount,kills};mkdirSync(".local-runtime/pg-metrics",{recursive:true});writeFileSync(`.local-runtime/pg-metrics/server-${population}.json`,JSON.stringify(metric,null,2));
  expect(moving).toBe(true);expect(shotCount).toBeGreaterThan(25);expect(kills).toBeGreaterThan(0);expect(average).toBeLessThan(8);expect(p95).toBeLessThan(16);expect(maxSnapshot).toBeLessThan(40000);room.dispose();
 });
});
