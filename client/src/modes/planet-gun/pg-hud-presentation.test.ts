import {describe,it,expect} from 'vitest';
import {pgReticlePresentation} from './pg-hud-presentation';

describe('PlanetGun HUD aim presentation',()=>{
  it('keeps the hip reference until the optic is nearly aligned, then crossfades without losing the center',()=>{
    for(const ads of [0,.5,.86])expect(pgReticlePresentation('rail',ads,.07).opticOpacity).toBe(0);
    const transition=pgReticlePresentation('rail',.93,.02);
    expect(transition.opticOpacity).toBeCloseTo(.5);
    expect(transition.hipOpacity+transition.opticOpacity).toBe(1);
    expect(pgReticlePresentation('rail',1,.0005).opticOpacity).toBe(1);
  });
  it('responds to spread while bounding obstruction and invalid presentation inputs',()=>{
    expect(pgReticlePresentation('pulse',0,.01).gap).toBeLessThan(pgReticlePresentation('pulse',0,.04).gap);
    expect(pgReticlePresentation('photon',0,100).gap).toBe(24);
    expect(pgReticlePresentation('pulse',NaN,NaN)).toMatchObject({gap:3,hipOpacity:1,opticOpacity:0});
    expect(pgReticlePresentation('pulse',-4,-1).gap).toBe(3);
  });
  it('distinguishes weapon-category hip references without changing weapon stats',()=>{
    expect(pgReticlePresentation('photon',0,0).category).toBe('scatter');
    expect(pgReticlePresentation('comet',0,0).category).toBe('sidearm');
    expect(pgReticlePresentation('rail',0,0).category).toBe('precision');
    expect(pgReticlePresentation('nova',0,0).category).toBe('automatic');
  });
});
