import {expect,it} from "vitest";
import {mkdirSync,writeFileSync} from "node:fs";
import type {Server,Socket} from "socket.io";
import {PG_BALANCE,type ClientToServerEvents,type ServerToClientEvents} from "@planetfall/shared";
import {PlanetGunRoom} from "./pg-room.js";

for(const id of ["planetstrike","planetwatch","planetsiege"] as const)it(`${id} ordinary four-pilot bot match reaches bounded series results`,()=>{
 const io={to:()=>({emit:()=>{}})} as unknown as Server<ClientToServerEvents,ServerToClientEvents>;
 const socket={id:"series-host",data:{},join:()=>{}} as unknown as Socket<ClientToServerEvents,ServerToClientEvents>;
 const room=new PlanetGunRoom("SERIES",io),joined=room.join(socket,"Series Host");if(!joined.ok)throw Error(joined.error);
 room.configure(joined.playerId,{mode:id,targetPlayers:4,fillBots:true,botDifficulty:"hard"});room.setReady(joined.playerId,true);
 expect(room.start(joined.playerId,1000)).toBe(true);room.players.get(joined.playerId)!.isBot=true;
 const start=1000+PG_BALANCE.countdownMs;room.update(0,start);let frame=0;
 const rounds:unknown[]=[];let lastRound=0;
 try{
  for(frame=1;frame<=30*1800&&room.phase!=="results";frame++){
   const now=start+frame*1000/30;room.update(1/30,now);
   if(frame%30===0){const mode=room.snapshot(now).mode;if(mode&&mode.round!==lastRound){lastRound=mode.round;rounds.push({atSeconds:frame/30,round:mode.round,...("roundScores" in mode?{scores:mode.roundScores}:{})});}}
  }
  const final=room.snapshot(start+frame*1000/30);
  mkdirSync(".local-runtime/pg-metrics",{recursive:true});writeFileSync(`.local-runtime/pg-metrics/full-series-${id}.json`,JSON.stringify({scenario:"ordinary four autonomous pilots, no forced damage/positions/resources/deadlines",dt:1/30,seconds:frame/30,rounds,final},null,2));
  expect(room.phase,"Ordinary bots did not finish within thirty simulated minutes").toBe("results");
  expect(final.mode?.subphase).toBe(id==="planetwatch"?"results":id==="planetsiege"?"complete":"finished");
  expect([...room.players.values()].reduce((sum,p)=>sum+p.kills,0)).toBeGreaterThan(0);
  if(final.mode&&"roundScores" in final.mode)expect(final.mode.roundScores.solar+final.mode.roundScores.void).toBeGreaterThanOrEqual(id==="planetwatch"?2:id==="planetsiege"?4:7);
 }finally{room.dispose();}
},120000);
