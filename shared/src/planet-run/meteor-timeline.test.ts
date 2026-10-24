import {describe,it,expect} from 'vitest';
import {PR_ROUNDS,prMeteorTimeline,prObstacleTransform} from './index.js';

describe('meteor presentation uses the unchanged authoritative schedule',()=>{
 it('matches legacy warning/impact boundaries across authored meteors and seeds',()=>{
  for(const obstacle of PR_ROUNDS.flatMap(r=>r.obstacles).filter(o=>o.kind==='meteor'))for(const seed of [0,1,42,173,996,997,91273]){
   const period=Math.max(.25,obstacle.period),duration=period*1000;
   const first=2500+(((obstacle.phase+(seed%997)/997)%1+1)%1)*period*1000;
   const times=[0,1000,70000];
   for(let cycle=0;cycle<4;cycle++)for(const edge of [-1500,0,period*170,duration-1500,duration])for(const delta of [-.001,0,.001])times.push(first+cycle*duration+edge+delta);
   for(const elapsed of times){
    const age=elapsed-first,phase=age<0?age:age%duration;
    const expected={yaw:0,active:age>=0&&phase<period*170,warning:age<0?age>=-1500:phase>=duration-1500};
    expect(prObstacleTransform(obstacle,elapsed,seed)).toEqual(expected);
    const timeline=prMeteorTimeline(obstacle,elapsed,seed);
    expect(timeline.active).toBe(expected.active);expect(timeline.warning).toBe(expected.warning);
    expect(timeline.warningProgress).toBeGreaterThanOrEqual(0);expect(timeline.warningProgress).toBeLessThanOrEqual(1);
    expect(timeline.impactAgeMs).toBe(expected.active?phase:null);
   }
  }
 });
});
