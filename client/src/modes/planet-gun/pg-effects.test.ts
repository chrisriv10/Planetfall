import {describe,it,expect} from "vitest";
import * as THREE from "three";
import type {PgShot} from "@planetfall/shared";
import {PgEffects} from "./pg-effects";
const shot:PgShot={id:1,at:0,shooterId:"pilot",weapon:"pulse",origin:{x:0,y:1,z:0},end:{x:10,y:1,z:0},targetId:"other",damage:25,headshot:false};
describe("PlanetGun effect pool",()=>{
  it("keeps fixed geometry and object counts under sustained fire and expires every visual",()=>{
    const fx=new PgEffects(),objects=[...fx.root.children],geometries=objects.filter(o=>o instanceof THREE.Line).map(o=>(o as THREE.Line).geometry);
    for(let i=0;i<500;i++)fx.shot({...shot,id:i},false,i);
    expect(fx.root.children).toEqual(objects);expect(fx.root.children.filter(o=>o instanceof THREE.Line).map(o=>(o as THREE.Line).geometry)).toEqual(geometries);
    expect(fx.root.children.filter(o=>o instanceof THREE.Line&&o.visible)).toHaveLength(32);
    fx.update(700);expect(fx.root.children.some(o=>o.visible)).toBe(false);fx.dispose();fx.dispose();
  });
  it("rejects malformed/stretched effects and clips a local eye-origin tracer",()=>{
    const fx=new PgEffects();fx.shot({...shot,end:{x:Infinity,y:1,z:0}},false,0);fx.shot({...shot,end:{x:300,y:1,z:0}},false,0);
    expect(fx.root.children.some(o=>o.visible)).toBe(false);
    fx.shot(shot,true,0);const line=fx.root.children.find(o=>o instanceof THREE.Line&&o.visible)as THREE.Line;
    expect(fx.muzzleRoot.children[0].visible).toBe(true);
    expect(line.geometry.getAttribute("position").getX(0)).toBeCloseTo(.9);fx.update(66);expect(line.visible).toBe(false);expect(fx.muzzleRoot.children[0].visible).toBe(false);fx.dispose();expect(fx.muzzleRoot.children).toHaveLength(0);
  });
});

it("places local flash at the caller-owned muzzle anchor and preserves its short lifetime",()=>{
  const fx=new PgEffects();fx.muzzleRoot.position.set(.07,-.18,-1.1);fx.shot(shot,true,100);
  const flash=fx.muzzleRoot.children[0];expect(flash.position.toArray()).toEqual([0,0,0]);
  fx.muzzleRoot.updateMatrixWorld(true);expect(flash.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([.07,-.18,-1.1]);
  fx.muzzleRoot.position.set(-.04,-.12,-1.3);fx.muzzleRoot.updateMatrixWorld(true);
  expect(flash.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([-.04,-.12,-1.3]);
  fx.update(127);expect(flash.visible).toBe(true);fx.update(128);expect(flash.visible).toBe(false);fx.dispose();
});
