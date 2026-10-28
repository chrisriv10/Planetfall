import {describe,it,expect} from "vitest";
import {mkdirSync,writeFileSync} from "node:fs";
import {PG_MAP,pgSpawnMotion,pgStepMovement,type PgMap,type PgSolid,type PgInput,type PgMotion} from "@planetfall/shared";
import {pgReconcileMotion,pgPredictedStepTime,type PgPendingInput} from "./pg-prediction";
import {PgRenderCorrection} from "./pg-render-correction";
const step=1000/60,floor:PgSolid={id:"floor",kind:"floor",center:{x:0,y:-.5,z:0},half:{x:100,y:.5,z:100},mantle:false};
const idle=(sequence=0):PgInput=>({sequence,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,ads:false});
const scenarios=["walk","sprint","slide","jump","thrust","wall-run","mantle"] as const;
const metrics:unknown[]=[];
describe("PlanetGun input prediction under symmetric delay and ordered jitter",()=>{
 for(const mode of scenarios)for(const rtt of [0,40,80,120])it(`${mode} at ${rtt}ms RTT keeps local simulation immediate and corrections bounded`,()=>{
  const map:PgMap={...PG_MAP,solids:[floor]},origin=mode==="wall-run"?{x:.73,y:1,z:0}:mode==="mantle"?{x:0,y:.5,z:0}:{x:0,y:0,z:0};
  if(mode==="wall-run")map.solids.push({id:"run",kind:"wall-run",center:{x:0,y:3,z:-15},half:{x:.3,y:3,z:30},mantle:false,wallRunFaces:["x+"]});
  if(mode==="mantle")map.solids.push({id:"ledge",kind:"utility",center:{x:0,y:.8,z:-1.4},half:{x:2,y:.8,z:.7},mantle:true});
  let predicted=pgSpawnMotion(origin),authority=structuredClone(predicted);predicted.grounded=authority.grounded=origin.y===0;
  if(mode==="wall-run"){predicted.velocity.z=authority.velocity.z=-9;}if(mode==="mantle"){predicted.velocity.z=authority.velocity.z=-8;}
  let current=idle(),ack=0,lastUp=0,lastDown=0,maxCorrection=0,maxVertical=0,corrected=0,smoothed=0,simulationAt=1000;const modes=new Set<string>(),pending:PgPendingInput[]=[],uploads:{at:number;input:PgInput}[]=[],downloads:{at:number;motion:PgMotion;ack:number;serverAt:number}[]=[],render=new PgRenderCorrection();
  for(let tick=1;tick<=240;tick++){
   const now=1000+tick*step,jitter=rtt?((tick*13)%9)-4:0;
   const command:PgInput={...idle(tick),moveZ:tick<150?-1:0,sprint:["sprint","slide"].includes(mode)&&tick<150,crouch:mode==="slide"&&tick>=35&&tick<50,jump:mode==="jump"?tick===30:mode==="thrust"?tick>=30&&tick<65:mode==="mantle"&&tick<30};
   const before={...predicted.position};simulationAt=pgPredictedStepTime(now,simulationAt);pgStepMovement(predicted,command,1/60,simulationAt,map);pending.push({input:command,at:simulationAt});render.update(1/60);modes.add(predicted.mode);
   if(tick===1&&mode==="walk"&&rtt>0){expect(predicted.position.z).toBeLessThan(before.z);expect(authority.position.z).toBe(before.z);}
   lastUp=Math.max(lastUp+.001,now+rtt/2+jitter);uploads.push({at:lastUp,input:command});
   while(uploads[0]?.at<=now){current=uploads.shift()!.input;ack=current.sequence;}
   pgStepMovement(authority,current,1/60,now,map);
   if(tick%3===0){lastDown=Math.max(lastDown+.001,now+rtt/2-jitter);downloads.push({at:lastDown,motion:structuredClone(authority),ack,serverAt:now});}
   while(downloads[0]?.at<=now){const snap=downloads.shift()!,old=predicted,result=pgReconcileMotion(snap.motion,snap.ack,pending,snap.serverAt,map);predicted=result.motion;simulationAt=result.at;pending.splice(0,pending.length,...result.pending);
    const error=Math.hypot(old.position.x-predicted.position.x,old.position.y-predicted.position.y,old.position.z-predicted.position.z);maxCorrection=Math.max(maxCorrection,error);maxVertical=Math.max(maxVertical,Math.abs(old.position.y-predicted.position.y));if(error>.001){corrected++;if(render.correct(old.position,predicted.position))smoothed++;}
   }
   expect([predicted.position.x,predicted.position.y,predicted.position.z,render.offset.x,render.offset.y,render.offset.z].every(Number.isFinite)).toBe(true);
  }
  expect(modes.has(mode==="walk"?"ground":mode==="jump"||mode==="thrust"?"air":mode)).toBe(true);
  expect(maxCorrection).toBeLessThan(1.5);expect(pending.length).toBeLessThan(12);
  metrics.push({mode,rtt,jitterMs:rtt?4:0,maxCorrection,maxVertical,corrections:corrected,smoothed,pending:pending.length,modes:[...modes]});
  if(process.env.PG_MOTION_REPORT){mkdirSync(process.env.PG_MOTION_REPORT,{recursive:true});writeFileSync(process.env.PG_MOTION_REPORT+"/simulation-network.json",JSON.stringify(metrics,null,2));}
 });
 it("never replays an old command backward into an authoritative mantle",()=>{
  const p=pgSpawnMotion({x:0,y:.8,z:0});p.mode="mantle";p.mantleFrom={x:0,y:0,z:0};p.mantleTo={x:0,y:1.6,z:-1};p.mantleStart=1000;p.mantleUntil=1240;
  const result=pgReconcileMotion(p,1,[{input:idle(2),at:900}],1100,{...PG_MAP,solids:[floor]});expect(result.motion.position.y).toBeGreaterThan(.7);expect(p.position.y).toBe(.8);expect(result.pending).toHaveLength(1);
  expect(result.at).toBeGreaterThan(1100);expect(pgPredictedStepTime(1050,result.at)).toBeGreaterThan(result.at);
 });
});
