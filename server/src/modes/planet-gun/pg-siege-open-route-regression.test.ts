import {mkdirSync,writeFileSync} from "node:fs";
import {describe,it,expect,vi} from "vitest";
import type {Server,Socket} from "socket.io";
import {PG_BALANCE,PG_OBJECTIVES,type ClientToServerEvents,type ServerToClientEvents} from "@planetfall/shared";
import {PlanetGunRoom} from "./pg-room.js";
// These exact anonymous identities reproduced a real six-player approach stall.
// Production identity generation and all combat/movement rules stay unchanged.
const identities=vi.hoisted(()=>({next:0,prefixes:["98926dab-128","6ee1e184-ff9","1ba98bc4-8a6","24604e6c-2b8","c9e808df-673","125d1d58-a41","53124623-ff8","29290dcc-766","5bcf56e1-a36","13fb5e25-c1e","75be98de-fa3","268991fb-c49"]}));
vi.mock("node:crypto",async original=>({...await original<typeof import("node:crypto")>(),randomUUID:()=>identities.prefixes[identities.next++]+"0-4000-8000-000000000000"}));
describe("Siege ordinary open-route regression",()=>{
 it("advances the reproduced clustered roster through a real objective entry",()=>{
  identities.next=0;let shots=0;const io={to:()=>({emit:(event:string)=>{if(event==="pg:combat:shot")shots++;}})}as unknown as Server<ClientToServerEvents,ServerToClientEvents>;
  const room=new PlanetGunRoom("STALLREG",io),socket={id:"stall-host",data:{},join:()=>{}}as unknown as Socket<ClientToServerEvents,ServerToClientEvents>;
  const joined=room.join(socket,"Reproduced approach");if(!joined.ok)throw Error(joined.error);room.configure(joined.playerId,{mode:"planetsiege",targetPlayers:12,fillBots:true,botDifficulty:"hard"});room.setReady(joined.playerId,true);expect(room.start(joined.playerId,1000)).toBe(true);room.players.get(joined.playerId)!.isBot=true;
  const start=1000+PG_BALANCE.countdownMs;room.update(0,start);let entered=false,prepared=false,breached=false,roundWon=false;const activePanels=new Set<string>(),history:unknown[]=[];
  try{
   for(let frame=1;frame<=30*360;frame++){
    const now=start+frame*1000/30;room.update(1/30,now);if(frame%15)continue;const mode=room.snapshot(now).mode;if(mode?.id!=="planetsiege")throw Error("Missing Siege");
    for(const panel of mode.collision.panels){if(panel.active){activePanels.add(panel.id);prepared||=mode.subphase==="prepare";}else if(activePanels.has(panel.id)&&panel.hp<=0)breached=true;}
    const point=PG_OBJECTIVES.uplink[mode.site];entered||=mode.subphase==="action"&&[...room.players.values()].some(p=>p.hp>0&&p.team===mode.attackTeam&&Math.hypot(p.position.x-point.position.x,p.position.y-point.position.y,p.position.z-point.position.z)<=point.radius);roundWon||=mode.roundScores.solar+mode.roundScores.void>0;
    if(frame%150===0){const runtime=(room as any).mode;history.push({seconds:frame/30,round:mode.round,subphase:mode.subphase,site:mode.site,players:[...room.players.values()].map(p=>{const cache=runtime.botSteering.get(p.id);return{id:p.id,team:p.team,hp:p.hp,position:{...p.position},velocity:{...p.velocity},target:p.bot.targetId,path:cache?.path.slice(0,3),goal:cache?.goal,fireLane:p.bot.fireLane?{targetId:p.bot.fireLane.targetId,position:p.bot.fireLane.position,expiresAt:p.bot.fireLane.expiresAt}:null};})});}
    if(prepared&&breached&&entered&&roundWon||room.phase==="results")break;
   }
   mkdirSync(".local-runtime/pg-metrics",{recursive:true});writeFileSync(".local-runtime/pg-metrics/siege-open-route-regression.json",JSON.stringify({prepared,breached,entered,roundWon,shots,history},null,2));
   expect(prepared).toBe(true);expect(breached).toBe(true);expect(shots).toBeGreaterThan(0);expect(entered,"Reproduced roster did not physically enter the objective").toBe(true);expect(roundWon).toBe(true);
  }finally{room.dispose();}
 },60000);
});
