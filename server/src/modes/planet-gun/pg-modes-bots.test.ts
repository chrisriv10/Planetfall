import {mkdirSync,writeFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import type {Server,Socket} from "socket.io";
import {PG_BALANCE,PG_HERO_IDS,PG_OBJECTIVES,type ClientToServerEvents,type ServerToClientEvents,type PgModeId,type PgModeSnapshot} from "@planetfall/shared";
import {PlanetGunRoom} from "./pg-room.js";

/** Ordinary fixed-step gameplay: no teleporting, health edits, scripted kills or deadline jumps. */
function game(mode:PgModeId,population:4|12){
 let shots=0;const io={to:()=>({emit:(event:string)=>{if(event==="pg:combat:shot")shots++;}})} as unknown as Server<ClientToServerEvents,ServerToClientEvents>;
 const room=new PlanetGunRoom("PGBOTS",io),socket={id:"bot-host",data:{},join:()=>{}} as unknown as Socket<ClientToServerEvents,ServerToClientEvents>;
 const joined=room.join(socket,"Simulation Host");if(!joined.ok)throw Error(joined.error);
 room.configure(joined.playerId,{mode,targetPlayers:population,fillBots:true,botDifficulty:"hard"});room.setReady(joined.playerId,true);
 expect(room.start(joined.playerId,1000)).toBe(true);room.players.get(joined.playerId)!.isBot=true;
 const start=1000+PG_BALANCE.countdownMs;room.update(0,start);return {room,start,shots:()=>shots};
}
function summarize(mode:PgModeSnapshot|undefined){
 if(!mode)return null;
 const common={id:mode.id,subphase:mode.subphase,round:mode.round,effects:mode.effects.map(e=>({kind:e.kind,hp:e.hp,team:e.team})),panels:mode.collision.panels.map(p=>({id:p.id,active:p.active,hp:p.hp}))};
 if(mode.id==="planetstrike")return {...common,scores:mode.roundScores,charge:mode.charge};
 if(mode.id==="planetwatch")return {...common,scores:mode.roundScores,control:mode.control};
 if(mode.id==="planetsiege")return {...common,scores:mode.roundScores,capture:mode.capture};
 return {...common,wave:mode.wave,remaining:mode.remaining,queued:mode.queued,reason:mode.reason,zombies:mode.zombies.map(z=>({kind:z.kind,hp:z.hp,position:z.position})),survivors:mode.pilots};
}
function evidence(name:string,value:unknown){mkdirSync(".local-runtime/pg-metrics",{recursive:true});writeFileSync(`.local-runtime/pg-metrics/${name}.json`,JSON.stringify(value,null,2));}

describe("new PlanetGun modes with ordinary autonomous bots",()=>{
 it("Strike bots buy, navigate and plant a real charge, rather than only winning eliminations",()=>{
  const f=game("planetstrike",12),history:unknown[]=[];let planted=false,interacted=false,maxRounds=0;
  try{
   for(let frame=1;frame<=30*360;frame++){
    const now=f.start+frame*1000/30;f.room.update(1/30,now);
    if(frame%15===0){const mode=f.room.snapshot(now).mode;if(mode?.id!=="planetstrike")throw Error("Missing Strike state");
     planted||=mode.charge.site!==null;interacted||=Object.values(mode.pilots).some(p=>p.interaction!==null);maxRounds=Math.max(maxRounds,mode.round);
     if(frame%900===0)history.push({seconds:frame/30,mode:summarize(mode),players:[...f.room.players.values()].map(p=>({id:p.id,team:p.team,hp:p.hp,position:{...p.position},kills:p.kills,connected:p.connected,isBot:p.isBot}))});
     if(planted&&maxRounds>=2)break;
    }
    if(f.room.phase==="results")break;
   }
   evidence("bots-planetstrike",{population:12,dt:1/30,planted,interacted,maxRounds,shots:f.shots(),history,final:summarize(f.room.snapshot(f.start+360000).mode)});
   expect(f.shots()).toBeGreaterThan(0);expect(interacted,"No bot held a plant/defuse interaction; inspect bots-planetstrike.json").toBe(true);expect(planted,"No ordinary bot charge plant within six simulated minutes").toBe(true);expect(maxRounds).toBeGreaterThanOrEqual(2);
  }finally{f.room.dispose();}
 },60000);
 it("Watch fields every hero per side and captures/contests relays to a round win",()=>{
  const f=game("planetwatch",12),history:unknown[]=[];let captured=false,contested=false,roundWon=false,abilityKinds=new Set<string>();
  try{
   const initial=f.room.snapshot(f.start).mode;if(initial?.id!=="planetwatch")throw Error("Missing Watch state");
   for(const team of ["solar","void"] as const)expect([...f.room.players.values()].filter(p=>p.team===team).map(p=>initial.pilots[p.id].characterId).sort()).toEqual([...PG_HERO_IDS].sort());
   for(let frame=1;frame<=30*360;frame++){
    const now=f.start+frame*1000/30;f.room.update(1/30,now);
    {const mode=f.room.snapshot(now).mode;if(mode?.id!=="planetwatch")throw Error("Missing Watch state");captured||=mode.control.owner!==null;contested||=mode.control.contested;roundWon||=mode.roundScores.solar+mode.roundScores.void>0;for(const e of mode.effects)abilityKinds.add(e.kind);
     if(frame%900===0)history.push({seconds:frame/30,mode:summarize(mode),players:[...f.room.players.values()].map(p=>({team:p.team,hp:p.hp,position:{...p.position},hero:mode.pilots[p.id].characterId}))});
     if(captured&&contested&&roundWon)break;
    }
    if(f.room.phase==="results")break;
   }
   evidence("bots-planetwatch",{population:12,dt:1/30,captured,contested,roundWon,abilityKinds:[...abilityKinds],shots:f.shots(),history});
   expect(captured,"No relay capture; inspect bots-planetwatch.json").toBe(true);expect(contested).toBe(true);expect(roundWon,"No control round win within six simulated minutes").toBe(true);expect(abilityKinds.size).toBeGreaterThanOrEqual(3);
  }finally{f.room.dispose();}
 },60000);
 it("Siege bots prepare, breach, physically enter the objective and resolve a contested round",()=>{
  const f=game("planetsiege",12),history:unknown[]=[];let prepared=false,breached=false,captured=false,entered=false,roundWon=false,largestCapture=0;const seenActive=new Set<string>();
  try{
   for(let frame=1;frame<=30*360;frame++){
    const now=f.start+frame*1000/30;f.room.update(1/30,now);
    if(frame%15===0){const mode=f.room.snapshot(now).mode;if(mode?.id!=="planetsiege")throw Error("Missing Siege state");
     for(const panel of mode.collision.panels){if(panel.active){seenActive.add(panel.id);if(mode.subphase==="prepare")prepared=true;}else if(seenActive.has(panel.id))breached=true;}
     largestCapture=Math.max(largestCapture,mode.capture);captured||=mode.capture>=1;
     const objective=PG_OBJECTIVES.uplink[mode.site];
     entered||=mode.subphase==="action"&&[...f.room.players.values()].some(p=>p.team===mode.attackTeam&&p.hp>0&&Math.hypot(p.position.x-objective.position.x,p.position.y-objective.position.y,p.position.z-objective.position.z)<=objective.radius);
     roundWon||=mode.roundScores.solar+mode.roundScores.void>0;
     if(frame%900===0)history.push({seconds:frame/30,mode:summarize(mode),players:[...f.room.players.values()].map(p=>({id:p.id,team:p.team,hp:p.hp,position:{...p.position}}))});
     if(prepared&&breached&&entered&&roundWon)break;
    }
    if(f.room.phase==="results")break;
   }
   evidence("bots-planetsiege",{population:12,dt:1/30,prepared,breached,entered,roundWon,captured,largestCapture,shots:f.shots(),history});
   expect(prepared,"No defensive panels prepared; inspect bots-planetsiege.json").toBe(true);expect(breached,"No bot route resulted in a real panel breach").toBe(true);
   // A contested round may correctly end by elimination. A separate ordinary-
   // movement playthrough requires the full timed capture with both teams alive.
   expect(entered,"No living attacker physically entered the objective").toBe(true);expect(roundWon,"No valid contested round resolution within six simulated minutes").toBe(true);
  }finally{f.room.dispose();}
 },60000);
 it("four friendly survivors clear several finite zombie waves through ordinary combat",()=>{
  const f=game("planetzombies",4),history:unknown[]=[];let highestWave=0,maxActive=0,maxPurchases=0,maxRevives=0;
  try{
   for(let frame=1;frame<=30*360;frame++){
    const now=f.start+frame*1000/30;f.room.update(1/30,now);
    if(frame%15===0){const mode=f.room.snapshot(now).mode;if(mode?.id!=="planetzombies")throw Error("Missing Zombies state");highestWave=Math.max(highestWave,mode.wave);maxActive=Math.max(maxActive,mode.zombies.length);maxPurchases=Math.max(maxPurchases,...Object.values(mode.pilots).map(p=>p.purchases));maxRevives=Math.max(maxRevives,...Object.values(mode.pilots).map(p=>p.revives));
     if(frame%900===0)history.push({seconds:frame/30,mode:summarize(mode),players:[...f.room.players.values()].map(p=>({id:p.id,hp:p.hp,position:{...p.position},slot:p.slot,ammo:p.guns.map(g=>({magazine:g.magazine,reserve:g.reserve}))}))});
     if(highestWave>=4)break;
    }
    if(f.room.phase==="results")break;
   }
   evidence("bots-planetzombies",{population:4,dt:1/30,highestWave,maxActive,maxPurchases,maxRevives,shots:f.shots(),history});
   expect(maxActive).toBeGreaterThan(0);expect(highestWave,"Friendly bots did not clear three waves; inspect bots-planetzombies.json").toBeGreaterThanOrEqual(4);expect(maxPurchases).toBeGreaterThan(0);
  }finally{f.room.dispose();}
 },60000);
});
