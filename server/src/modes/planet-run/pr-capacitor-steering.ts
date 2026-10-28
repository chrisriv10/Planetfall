import {PR_BALANCE,prObstacleCenter,prObstacleTransform,type BotDifficulty,type PrPlayerState,type PrRoundDefinition,type Vec3} from "@planetfall/shared";
import type {PrBotPersonality,PrCrowdPilot} from "./pr-bot-steering.js";
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Authored circuit knowledge chooses inputs only; hazards and boosts still use ordinary physics. */
export function prCapacitorTarget(p:PrPlayerState,r:PrRoundDefinition,time:number,seed:number,person:PrBotPersonality,crowd:readonly PrCrowdPilot[],fallback:Vec3,difficulty:BotDifficulty="normal"):Vec3{
 const ahead=r.obstacles.filter(o=>o.kind!=="boost"&&o.center.z<p.position.z+1.5&&o.center.z>p.position.z-16).sort((a,b)=>b.center.z-a.center.z),nearest=ahead[0];
 const boost=r.obstacles.find(o=>o.kind==="boost"&&o.center.z<p.position.z&&o.center.z>p.position.z-11);
 if(boost&&person.risk>(difficulty==="easy"?.85:difficulty==="hard"?.35:.6)&&!nearest){return {x:boost.center.x+clamp(person.lateral*.12,-.5,.5),y:.6,z:boost.center.z-3};}
 if(!nearest)return fallback;
 const distance=Math.max(0,p.position.z-nearest.center.z),arrival=time+Math.min(1600,distance/PR_BALANCE.runSpeed*1000);
 if(nearest.kind==="shutter"){
  const gates=ahead.filter(o=>o.kind==="shutter"&&o.center.z===nearest.center.z);
  const open=gates.filter(o=>!prObstacleTransform(o,distance<3?time:arrival,seed).active);
  const occupancy=(x:number)=>crowd.reduce((n,c)=>n+(Math.abs(c.position.x-x)<1.5&&Math.abs(c.position.z-nearest.center.z)<5?1:0),0);
  open.sort((a,b)=>Math.abs(a.center.x-p.position.x)*.2+occupancy(a.center.x)-Math.abs(b.center.x-p.position.x)*.2-occupancy(b.center.x));
  const gate=open[0]??gates[0],x=gate.center.x+clamp(person.lateral*.35,-1.55,1.55);
  const aligned=Math.abs(p.position.x-x)<1.35,clear=!prObstacleTransform(gate,time+Math.min(450,distance/PR_BALANCE.runSpeed*1000),seed).active;
  return {x,y:.6,z:aligned&&clear?nearest.center.z-4:nearest.center.z+2.4};
 }
 if(nearest.kind==="arc"){
  const phase=prObstacleTransform(nearest,arrival,seed);
  if(phase.active||phase.warning){const side=nearest.center.x<=0?1:-1;return {x:side*(6.5+clamp(person.lateral*.15,-.5,.5)),y:.6,z:Math.min(fallback.z,nearest.center.z-4)};}
 }
 if(nearest.kind==="barrier"){
  const center=prObstacleCenter(nearest,arrival,seed),candidates=[-1,1].map(side=>center.x+side*(nearest.half.x+1.7)).filter(x=>Math.abs(x)<7.8);
  candidates.sort((a,b)=>Math.abs(a-p.position.x)-Math.abs(b-p.position.x)+(Math.sign(a)===person.passSide?-.6:.6));
  return {x:clamp((candidates[0]??-Math.sign(center.x||1)*6.8)+person.lateral*.1,-7.5,7.5),y:.6,z:Math.min(fallback.z,nearest.center.z-4)};
 }
 return fallback;
}
