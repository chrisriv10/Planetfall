import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {BrUtilityEffects,type BrUtilityField} from "./br-utility-effects";
const field=(kind:BrUtilityField["kind"],id=kind):BrUtilityField=>({id,kind,position:{x:3,y:8,z:5},radius:6,createdAt:100,expiresAt:5000});
describe("server-authored utility field presentation",()=>{
  it("keeps warning radius exact and pulse inside the boundary without changing source",()=>{
    const fx=new BrUtilityEffects();const effects=[field("vortex")];const before=JSON.stringify(effects);
    for(const now of [100,400,1200,2300,4999]){
      fx.update(effects,now,"high");const [rim,wave]=fx.root.children as THREE.Mesh[];
      expect(rim.scale.x).toBe(6);expect(rim.scale.z).toBe(6);
      expect(wave.scale.x).toBeLessThanOrEqual(6);expect(wave.scale.x).toBeGreaterThan(0);
      expect(rim.position.y-rim.scale.y/2).toBeCloseTo(8.035);
      expect((rim.material as THREE.MeshBasicMaterial).depthTest).toBe(true);
      expect((rim.material as THREE.MeshBasicMaterial).depthWrite).toBe(false);
    }
    expect(JSON.stringify(effects)).toBe(before);fx.dispose();
  });
  it("caps fields by quality and reserves warning priority without allocating resources",()=>{
    const fx=new BrUtilityEffects(100);const children=[...fx.root.children];
    const geometries=children.map(c=>(c as THREE.Mesh).geometry);
    const effects=Array.from({length:40},()=>field("nano-mist"));effects.push(field("vortex"));
    for(const [quality,count]of [["low",12],["medium",18],["high",24]] as const){
      for(let n=0;n<100;n++)fx.update(effects,100+n,quality);
      expect(children.filter(c=>c.visible)).toHaveLength(count);
      expect(((children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xd4b3ff);
    }
    expect(fx.root.children).toEqual(children);expect(children.map(c=>(c as THREE.Mesh).geometry)).toEqual(geometries);
    expect(children.some(c=>c instanceof THREE.Light)).toBe(false);fx.dispose();
  });
  it("expires, rejects invalid inputs, and disposes every shared resource once",()=>{
    const fx=new BrUtilityEffects(2);const parts=fx.root.children as THREE.Mesh[];
    const resources=new Set([...parts.map(p=>p.geometry),...parts.map(p=>p.material as THREE.Material)]);
    const spies=[...resources].map(r=>vi.spyOn(r,"dispose"));
    for(const now of [0,5000,NaN]){fx.update([field("pulse-scanner")],now,"high");expect(parts.every(p=>!p.visible)).toBe(true);}
    fx.update([{...field("nano-mist"),radius:NaN}],200,"high");expect(parts.every(p=>!p.visible)).toBe(true);
    fx.update([field("nano-mist")],200,"high");expect(parts[0].visible).toBe(true);
    fx.update([],201,"high");expect(parts.every(p=>!p.visible)).toBe(true);
    fx.dispose();fx.dispose();for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);
  });
});
