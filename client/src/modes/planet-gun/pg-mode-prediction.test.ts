import {describe,it,expect} from "vitest";
import {PG_MAP,PG_TACTICAL_MOVEMENT_RULES,pgSpawnMotion,pgStepMovement} from "@planetfall/shared";
import {pgReconcileMotion} from "./pg-prediction";
describe("mode replay policy",()=>{
 it("replays tactical commands using the same grounded capabilities as authority",()=>{
  const p=pgSpawnMotion({x:-40,y:0,z:30}),q=structuredClone(p),pending=[];
  for(let i=1;i<=120;i++){const input={sequence:i,moveX:1,moveZ:0,yaw:0,pitch:0,jump:true,crouch:false,sprint:true,ads:false};pending.push({input,at:i*1000/60});pgStepMovement(q,input,1/60,i*1000/60,PG_MAP,PG_TACTICAL_MOVEMENT_RULES);}
  const replay=pgReconcileMotion(p,0,pending.slice(0,60),0,PG_MAP,PG_TACTICAL_MOVEMENT_RULES);const half=structuredClone(p);for(const x of pending.slice(0,60))pgStepMovement(half,x.input,1/60,x.at,PG_MAP,PG_TACTICAL_MOVEMENT_RULES);
  expect(replay.motion.position.x).toBeCloseTo(half.position.x,8);expect(replay.motion.position.y).toBeCloseTo(half.position.y,8);expect(q.ion).toBe(100);expect(q.mode).not.toBe("wall-run");expect(Math.hypot(q.velocity.x,q.velocity.z)).toBeLessThanOrEqual(6.00001);
 });
});
