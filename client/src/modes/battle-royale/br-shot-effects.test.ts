import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { BrShotEffects } from "./br-shot-effects";

describe("BR shot presentation pool",()=>{
  const origin={x:3,y:2,z:1};
  it("moves only the flash to the visual muzzle while retaining authoritative tracer endpoints",()=>{
    const effects=new BrShotEffects(1);
    const children=[...effects.root.children];
    const geometries=children.map(child=>(child as THREE.Mesh).geometry);
    const materials=children.map(child=>(child as THREE.Mesh).material);
    const [flash,tracer]=children as [THREE.Mesh,THREE.Line];
    for(let i=0;i<100;i++){
      effects.fire("rail-laser",origin,{x:4,y:0,z:0},12,i,{x:-5,y:8,z:9});
      expect(flash.position.toArray()).toEqual([-5+1.65*.35,8,9]);
      expect([...tracer.geometry.getAttribute("position").array]).toEqual([3,2,1,15,2,1]);
    }
    expect(effects.root.children).toEqual(children);
    expect(children.map(child=>(child as THREE.Mesh).geometry)).toEqual(geometries);
    expect(children.map(child=>(child as THREE.Mesh).material)).toEqual(materials);
    effects.dispose();
  });
  it("rejects invalid optional muzzle positions without consuming or corrupting a slot",()=>{
    const effects=new BrShotEffects(2);
    effects.fire("rail-laser",origin,{x:1,y:0,z:0},12,0);
    const first=effects.root.children[0] as THREE.Mesh;
    const position=first.position.clone();
    for(const value of [NaN,Infinity,-Infinity])for(const axis of ["x","y","z"] as const){
      const muzzle={x:1,y:2,z:3};muzzle[axis]=value;
      effects.fire("pulse-rifle",origin,{x:0,y:1,z:0},20,1,muzzle);
    }
    expect(first.position).toEqual(position);
    expect(effects.root.children[2].visible).toBe(false);
    effects.fire("pulse-rifle",origin,{x:0,y:1,z:0},20,2);
    expect(effects.root.children[2].visible).toBe(true);
    expect(first.position).toEqual(position);
    effects.dispose();
  });
  it("aligns the rail flash and tracer with the shot instead of world-up",()=>{
    const effects=new BrShotEffects(1);
    effects.fire("rail-laser",origin,{x:4,y:0,z:0},12,10);
    const [flash,tracer]=effects.root.children as [THREE.Mesh,THREE.Line];
    expect(new THREE.Vector3(0,0,1).applyQuaternion(flash.quaternion).x).toBeCloseTo(1);
    expect([...tracer.geometry.getAttribute("position").array]).toEqual([3,2,1,15,2,1]);
    expect(flash.position.x).toBeGreaterThan(origin.x);
    effects.dispose();
  });
  it("stays bounded under a forty-player burst without adding lights or new resources",()=>{
    const effects=new BrShotEffects(8);
    const children=[...effects.root.children];const geometries=children.map(c=>(c as THREE.Mesh).geometry);
    for(let i=0;i<400;i++)effects.fire("nova-smg",origin,{x:0,y:0,z:-1},18,i);
    expect(effects.root.children).toEqual(children);
    expect(children.map(c=>(c as THREE.Mesh).geometry)).toEqual(geometries);
    expect(children.some(c=>c instanceof THREE.Light)).toBe(false);
    effects.update(1000);expect(children.every(c=>!c.visible)).toBe(true);
    effects.dispose();
  });
  it("does not invent a hitscan beam for projectiles, melee, or blocked zero-length shots",()=>{
    const effects=new BrShotEffects(1);
    effects.fire("plasma-launcher",origin,{x:0,y:0,z:1},null,0);
    expect(effects.root.children[1].visible).toBe(false);
    effects.clear();effects.fire("energy-saber",origin,{x:0,y:0,z:1},12,0);
    expect(effects.root.children.every(c=>!c.visible)).toBe(true);
    effects.fire("pulse-rifle",origin,{x:0,y:0,z:1},0,0);
    expect(effects.root.children[1].visible).toBe(false);
    effects.dispose();
  });
  it("clears immediately on mode exit and disposes shared geometry exactly once",()=>{
    const effects=new BrShotEffects(3);
    const geometry=(effects.root.children[0] as THREE.Mesh).geometry;
    const dispose=vi.spyOn(geometry,"dispose");
    effects.fire("photon-shotgun",origin,{x:0,y:1,z:0},20,0);
    effects.clear();expect(effects.root.children.every(c=>!c.visible)).toBe(true);
    effects.dispose();effects.dispose();expect(dispose).toHaveBeenCalledTimes(1);
    expect(effects.root.children).toHaveLength(0);
  });
  it("rejects invalid visual directions without poisoning pooled transforms",()=>{
    const effects=new BrShotEffects(1);
    for(const direction of [{x:0,y:0,z:0},{x:NaN,y:0,z:0}])effects.fire("pulse-rifle",origin,direction,10,0);
    expect(effects.root.children.every(c=>!c.visible)).toBe(true);effects.dispose();
  });
  it("fades tracer energy within its existing lifetime and resets it when the slot is reused",()=>{
    const effects=new BrShotEffects(1);
    const tracer=effects.root.children[1] as THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>;
    effects.fire("rail-laser",origin,{x:0,y:0,z:1},20,0);
    effects.update(20);expect(tracer.material.opacity).toBeCloseTo(.9);
    effects.update(75);expect(tracer.material.opacity).toBeCloseTo(.45);
    expect(tracer.visible).toBe(true);
    effects.update(125);expect(tracer.visible).toBe(false);expect(tracer.material.opacity).toBe(0);
    effects.fire("nova-smg",origin,{x:0,y:0,z:1},12,130);
    expect(tracer.visible).toBe(true);expect(tracer.material.opacity).toBeCloseTo(.6);
    effects.update(175);expect(tracer.visible).toBe(false);
    effects.dispose();
  });
  it("ignores invalid animation timestamps without corrupting active pooled effects",()=>{
    const effects=new BrShotEffects(1);
    effects.fire("pulse-rifle",origin,{x:0,y:0,z:1},20,0);
    const flash=effects.root.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
    const tracer=effects.root.children[1] as THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>;
    const scale=flash.scale.clone();
    for(const time of [NaN,Infinity,-Infinity])effects.update(time);
    expect(flash.visible).toBe(true);expect(tracer.visible).toBe(true);
    expect(flash.scale).toEqual(scale);
    expect(flash.material.opacity).toBe(.9);expect(tracer.material.opacity).toBe(.6);
    effects.update(100);expect(flash.visible).toBe(false);expect(tracer.visible).toBe(false);
    effects.dispose();
  });
});
