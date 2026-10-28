import {describe,expect,it} from 'vitest';
import {createPrShowcasePose,samplePrShowcasePose,PR_SHOWCASE_DURATION} from './pr-showcase-timeline';

describe('solar hero action',()=>{
 it('stays planted and reuses storage through complete loops',()=>{
  const out=createPrShowcasePose();
  for(let frame=0;frame<960;frame++){
   expect(samplePrShowcasePose(frame/60,false,out)).toBe(out);
   expect(out.x).toBe(2.35);expect(out.z).toBe(0);expect(out.speed).toBe(0);
   expect(out.motif).toBe(0);expect(out.opacity).toBe(1);
   expect(out.y).toBeGreaterThanOrEqual(0);expect(out.y).toBeLessThanOrEqual(.95);
   for(const value of Object.values(out))expect(Number.isFinite(value)).toBe(true);
  }
 });
 it('clears the one-sided arm while it passes the pilot',()=>{
  const out=createPrShowcasePose();
  for(let t=3.7;t<4.31;t+=.01){
   samplePrShowcasePose(t,false,out);
   // Feet clear the .575m arm top throughout the footprint crossing.
   if(Math.abs(Math.sin(out.sweeperYaw)*out.x)<.38)expect(out.y).toBeGreaterThan(.575);
  }
  samplePrShowcasePose(4,false,out);expect(out.y).toBeCloseTo(.95);expect(out.sweeperYaw).toBe(0);
  samplePrShowcasePose(4.6,false,out);expect(out.y).toBe(0);
 });
 it('is seamless and truly static with reduced motion',()=>{
  const out=createPrShowcasePose();const start={...samplePrShowcasePose(0,false,out)};
  expect(samplePrShowcasePose(PR_SHOWCASE_DURATION,false,out)).toEqual(start);
  const hero={...samplePrShowcasePose(0,true,out)};
  for(const time of [1,5,30,100,NaN,Infinity])expect(samplePrShowcasePose(time,true,out)).toEqual(hero);
  expect(hero.y).toBe(0);expect(hero.verticalSpeed).toBe(0);
 });
});
