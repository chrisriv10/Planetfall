import {mkdirSync,writeFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {DEFAULT_COSMETICS,PR_BALANCE as B,PrTileState,prRound,prSpawn,prStepMotion,prBump,type PrPlayerState} from "@planetfall/shared";
import {prBotInput,PrCrowdGrid,type PrBotMemory} from "./pr-bots.js";
const round=prRound("capacitor-causeway");
describe("Capacitor Causeway crowd traversal",()=>{
 for(const count of [10,20,30])for(const seed of [0,42,173,996])it(`${count} ordinary bots at seed ${seed} choose lanes and finish without a permanent gate jam`,()=>{
  const pilots:Array<{p:PrPlayerState;m:PrBotMemory}>=Array.from({length:count},(_,i)=>({p:{...prSpawn(round.spawns[i]),id:`circuit-${i}`,name:`Pilot ${i}`,color:"#ffffff",isBot:true,connected:false,ready:true,status:"active",checkpoint:0,place:0,qualifiedRounds:0,lastInputSequence:0,emote:null,emoteStartedAt:-2000,fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],unlockedPassRewards:["default"],equippedCosmetics:{...DEFAULT_COSMETICS}},m:{identitySeed:i*173+42,goal:0,nextDecision:0,sequence:0}}));
  const tiles=new PrTileState([]);let crowd=new PrCrowdGrid(pilots.map(e=>e.p),0),finished=0,falls=0;const lanes=new Set<number>();
  for(let tick=0;tick<90*B.tickRate&&finished<count;tick++){
   const at=tick*1000/B.tickRate;if(tick%3===0)crowd=new PrCrowdGrid(pilots.map(e=>e.p),at);
   for(const {p,m}of pilots){if(p.status!=="active")continue;const input=prBotInput(p,round,tiles,at,seed,"normal",m,crowd);prStepMotion(p,input,1/B.tickRate,at,round,seed,tiles);
    if(p.position.z<-16&&p.position.z>-23)lanes.add(Math.round(p.position.x));
    for(let i=0;i<round.checkpoints.length;i++){const cp=round.checkpoints[i];if(Math.abs(p.position.z-cp.center.z)<cp.half.z&&Math.abs(p.position.x-cp.center.x)<cp.half.x)p.checkpoint=Math.max(p.checkpoint,i);}
    if(p.position.y<round.killY){falls++;Object.assign(p,prSpawn(round.checkpoints[p.checkpoint].spawn));m.nextDecision=0;}
    if(p.position.z<=round.finish!.center.z+round.finish!.half.z&&Math.abs(p.position.x)<round.finish!.half.x){p.status="qualified";finished++;}
   }
   for(let a=0;a<count;a++)for(let b=a+1;b<count;b++)if(pilots[a].p.status==="active"&&pilots[b].p.status==="active")prBump(pilots[a].p,pilots[b].p);
  }
  console.log("Capacitor crowd",JSON.stringify({count,seed,finished,falls,lanes:lanes.size,remaining:pilots.filter(e=>e.p.status==="active").map(e=>({id:e.p.id,x:e.p.position.x,z:e.p.position.z}))}));
  if(process.env.PR_CAPACITOR_REPORT){mkdirSync(process.env.PR_CAPACITOR_REPORT,{recursive:true});writeFileSync(process.env.PR_CAPACITOR_REPORT+`/crowd-${count}-seed-${seed}.json`,JSON.stringify({count,seed,finished,falls,lanes:lanes.size,remaining:pilots.filter(e=>e.p.status==="active").map(e=>({id:e.p.id,x:e.p.position.x,z:e.p.position.z}))},null,2));}
  expect(finished).toBeGreaterThanOrEqual(Math.ceil(count*.8));expect(lanes.size).toBeGreaterThan(5);expect(pilots.every(e=>Number.isFinite(e.p.position.y))).toBe(true);
 });
});
