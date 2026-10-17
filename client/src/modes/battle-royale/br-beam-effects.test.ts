import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {BrBeamEffects} from "./br-beam-effects";
const beam={id:"one",origin:{x:3,y:8,z:2},end:{x:-7,y:2,z:14},expiresAt:1000};
describe("authoritative Prism beam pool",()=>{
  it("places cylinder endpoints exactly at supplied origin/end in all directions",()=>{
    const fx=new BrBeamEffects();
    for(const end of [beam.end,{x:3,y:-8,z:2},{x:3,y:18,z:2}]){
      fx.update([{...beam,end}],100,"high");const core=fx.root.children[0];core.updateMatrixWorld();
      const a=new THREE.Vector3(0,-.5,0).applyMatrix4(core.matrixWorld);
      const b=new THREE.Vector3(0,.5,0).applyMatrix4(core.matrixWorld);
      expect(a.distanceTo(new THREE.Vector3(3,8,2))).toBeLessThan(1e-8);
      expect(b.distanceTo(new THREE.Vector3(end.x,end.y,end.z))).toBeLessThan(1e-8);
    }
    fx.dispose();
  });
  it("bounds resources and keeps real beams on Low without glow or lights",()=>{
    const fx=new BrBeamEffects(99);const children=[...fx.root.children];
    const geometry=(children[0] as THREE.Mesh).geometry;
    for(let i=0;i<100;i++)fx.update(Array(60).fill(beam),100,"low");
    expect(children.filter(c=>c.visible)).toHaveLength(40);
    expect(fx.root.children).toEqual(children);
    for(const child of children){
      const mesh=child as THREE.Mesh;expect(mesh.geometry).toBe(geometry);
      expect((mesh.material as THREE.Material).depthTest).toBe(true);
      expect(child).not.toBeInstanceOf(THREE.Light);
    }
    fx.update([beam],1000);expect(children.every(c=>!c.visible)).toBe(true);
    fx.update([{...beam,end:beam.origin},{...beam,end:{x:NaN,y:0,z:0}}],10);
    expect(children.every(c=>!c.visible)).toBe(true);
    const resources=[geometry,...new Set(children.map(c=>(c as THREE.Mesh).material as THREE.Material))];
    const spies=resources.map(r=>vi.spyOn(r,"dispose"));fx.dispose();fx.dispose();
    for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);
  });
});
