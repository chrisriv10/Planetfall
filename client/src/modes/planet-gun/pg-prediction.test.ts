import {describe,it,expect} from "vitest";
import {pgSpawnMotion,pgStepMovement,type PgInput} from "@planetfall/shared";
import {pgReconcileMotion,type PgPendingInput} from "./pg-prediction";
describe("PlanetGun delayed input acknowledgements",()=>{
 for(const delay of [3,6,11])it(`reconciles sprint, slide and thrust with ${delay} ticks of jitter and command loss`,()=>{
  let predicted=pgSpawnMotion({x:40,y:0,z:0},Math.PI/2);const authority=structuredClone(predicted),pending:PgPendingInput[]=[],snapshots:{at:number;motion:typeof authority;ack:number}[]=[];
  let input:PgInput={sequence:0,moveX:0,moveZ:0,yaw:Math.PI/2,pitch:0,jump:false,sprint:false,crouch:false,ads:false};
  for(let tick=1;tick<=180;tick++){
   const command:PgInput={sequence:tick,moveX:0,moveZ:tick<125?-1:0,yaw:Math.PI/2,pitch:0,sprint:tick<125,crouch:tick>45&&tick<65,jump:tick>90&&tick<115,ads:false};
   const at=1000+tick*1000/60;pending.push({input:command,at});pgStepMovement(predicted,command,1/60,at);
   // A dropped command leaves the previous input active; newer sequences supersede it.
   if(tick%13!==0)input=command;pgStepMovement(authority,input,1/60,at);
   if(tick%3===0)snapshots.push({at:tick+delay+(tick%2),motion:structuredClone(authority),ack:input.sequence});
   const snapshot=snapshots.find(s=>s.at===tick);if(snapshot){const result=pgReconcileMotion(snapshot.motion,snapshot.ack,pending);predicted=result.motion;pending.splice(0,pending.length,...result.pending);}
   expect(Number.isFinite(predicted.position.y)).toBe(true);expect(Math.hypot(predicted.position.x-authority.position.x,predicted.position.z-authority.position.z)).toBeLessThan(3);
  }
  const settled=pgReconcileMotion(authority,input.sequence,[]);expect(settled.motion).toEqual(authority);expect(settled.pending).toHaveLength(0);
 });
});
