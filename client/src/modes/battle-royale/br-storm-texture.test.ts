import {describe,expect,it} from "vitest";
import * as THREE from "three";
import {brStormField,createBrStormTexture} from "./br-storm-texture";

describe("cosmic storm texture",()=>{
  it("closes both seams while its warped bands vary along both axes",()=>{
    for(const u of [0,.13,.47,.81])for(const v of [0,.19,.63,.92]) {
      const sample=brStormField(u,v);
      for(let i=0;i<2;i++) {
        expect(brStormField(u+1,v)[i]).toBeCloseTo(sample[i],10);
        expect(brStormField(u,v+1)[i]).toBeCloseTo(sample[i],10);
      }
    }
    expect(brStormField(.2,.4)).not.toEqual(brStormField(.2,.7));
    expect(brStormField(.2,.4)).not.toEqual(brStormField(.5,.4));
  });
  it("bakes bounded translucent violet clouds and cyan filaments once",()=>{
    const texture=createBrStormTexture(),pixels=texture.image.data!;
    let violet=0,cyan=0,minAlpha=255,maxAlpha=0;
    for(let i=0;i<pixels.length;i+=4) {
      if(pixels[i]>pixels[i+1])violet++;
      if(pixels[i+1]>pixels[i])cyan++;
      minAlpha=Math.min(minAlpha,pixels[i+3]);maxAlpha=Math.max(maxAlpha,pixels[i+3]);
    }
    expect(violet).toBeGreaterThan(cyan);
    expect(cyan).toBeGreaterThan(100);
    expect(minAlpha).toBeLessThan(30);
    expect(maxAlpha).toBeLessThan(165);
    expect(maxAlpha-minAlpha).toBeGreaterThan(100);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    texture.dispose();
  });
  it("breaks and bends vertical filaments rather than painting uniform columns",()=>{
    for(const u of [.08,.4,.73]) {
      const strengths=Array.from({length:32},(_,i)=>brStormField(u,i/32)[1]);
      expect(Math.max(...strengths)-Math.min(...strengths)).toBeGreaterThan(.1);
    }
  });
});
