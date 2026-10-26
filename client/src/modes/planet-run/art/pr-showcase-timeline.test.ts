import {describe,expect,it} from 'vitest';
import {createPrShowcasePose,samplePrShowcasePose} from './pr-showcase-timeline';

describe('home showcase signature actions',()=>{
  it('reuses storage, remains bounded, and grounds every action at its endpoints',()=>{
    const out=createPrShowcasePose();
    for(let motif=0;motif<6;motif++)for(let step=0;step<100;step++){
      const t=step*.05;
      expect(samplePrShowcasePose(motif*5+t,false,out)).toBe(out);
      expect(out.motif).toBe(motif);
      for(const value of Object.values(out))if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(out.x)).toBeLessThan(3.1);expect(Math.abs(out.z)).toBeLessThan(2.3);
      expect(out.y).toBeGreaterThanOrEqual(0);expect(out.y).toBeLessThanOrEqual(1.81);
      if(t===0||t>4.5){expect(out.y).toBeCloseTo(0);expect(out.speed).toBe(0);}
    }
  });
  it('times the single solar jump over the arm crossing instead of running in circles',()=>{
    const out=samplePrShowcasePose(7.2,false,createPrShowcasePose());
    expect(out.sweeperYaw).toBeCloseTo(0);expect(out.y).toBeCloseTo(.85);
    expect(out.x).toBe(2.3);expect(out.z).toBe(0);expect(out.speed).toBe(0);
  });
  it('moves away from the meteor target before impact and opens the gate before crossing',()=>{
    const out=createPrShowcasePose();
    samplePrShowcasePose(12.65,false,out);expect(out.x).toBeCloseTo(-.8);expect(out.meteorY).toBe(0);
    samplePrShowcasePose(21.75,false,out);expect(out.gateOpen).toBe(1);expect(out.z).toBe(1.8);
    samplePrShowcasePose(23.65,false,out);expect(out.z).toBeCloseTo(-2.2);
  });
  it('crosses the shatter cells before the first collapses',()=>{
    const out=samplePrShowcasePose(27.5,false,createPrShowcasePose());
    expect(out.x).toBeGreaterThan(0);expect(out.collapse).toBe(0);
    samplePrShowcasePose(28.6,false,out);expect(out.collapse).toBe(1);expect(out.x).toBeGreaterThan(1.4);
  });
  it('hides motif changes at the transition and provides a truly static reduced-motion hero',()=>{
    const out=createPrShowcasePose();samplePrShowcasePose(5,false,out);expect(out.opacity).toBe(0);
    const hero={...samplePrShowcasePose(0,true,out)};
    for(const time of [1,5,30,100,NaN,Infinity])expect(samplePrShowcasePose(time,true,out)).toEqual(hero);
    expect(hero.opacity).toBe(1);expect(hero.speed).toBe(0);
  });
});
