import type {Vec3} from "../index.js";
import {BR_LOOT_SOCKETS} from "./map.js";

function gcd(left:number,right:number):number{let a=Math.abs(left),b=Math.abs(right);while(b){const next=a%b;a=b;b=next;}return a;}

/** Selects a different authored loot socket inside each assigned district.
 * Bots therefore contest districts without stacking on one exact coordinate. */
export function brBotLandingTarget(slot:number,total:number,seed:number):Vec3{
  const safeSlot=Math.max(0,Math.floor(Number.isFinite(slot)?slot:0));
  const count=BR_LOOT_SOCKETS.length;
  if(!count)return{x:0,y:0,z:0};
  // A coprime stride walks every authored loot socket exactly once. The fixed
  // sockets already cover primary and connective districts, so this produces
  // useful contested areas without stacking bots on one POI center.
  let stride=Math.max(1,Math.floor(count/Math.max(2,Math.min(count,Math.floor(total))))*2+1);
  while(gcd(stride,count)!==1)stride+=2;
  const candidate=BR_LOOT_SOCKETS[(Math.abs(seed)%count+safeSlot*stride)%count];
  return{...candidate.position};
}

/** Evenly spaces bot jump opportunities along the safe route window while a
 * tiny deterministic jitter keeps the lineup from looking robotic. */
export function brBotJumpFraction(slot:number,total:number,seed:number):number{
  const count=Math.max(1,Math.floor(total));
  const index=Math.min(count-1,Math.max(0,Math.floor(slot)));
  const hash=((seed^(index*2654435761))>>>0)/0xffffffff;
  const stratum=(index+.5+(hash-.5)*.42)/count;
  return .14+stratum*.64;
}

