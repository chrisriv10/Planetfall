import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {createAstronautVisual} from "./astronaut";
import {createAstronautMotion,anchorAstronautHeldItem} from "./astronaut-motion";
import {brHeldWeaponTransform} from "./modes/battle-royale/br-item-presentation";
import {buildBrWeaponModel} from "./modes/battle-royale/br-weapons";

function setup(){const rig=createAstronautVisual({identityColor:'#70f5ff',suitAccent:'#ffd84d',isBot:false});return {rig,motion:createAstronautMotion(rig)};}
function advance(m:ReturnType<typeof createAstronautMotion>,seconds:number,rate=60){for(let i=0;i<seconds*rate;i++){m.input.dt=1/rate;m.input.timeSeconds+=1/rate;m.update();}}
describe('coordinated astronaut presentation',()=>{
 it('keeps the bind geometry, materials, mesh transforms and dimensions through the identity hierarchy',()=>{
  const {rig}=setup();rig.group.updateMatrixWorld(true);
  const meshes:THREE.Mesh[]=[];rig.group.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
  const bound=new THREE.Box3().setFromObject(rig.group),matrices=meshes.map(m=>m.matrixWorld.clone());
  const geometry=new Set(meshes.map(m=>m.geometry)),materials=new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]));
  // Reconstruct the original flat parenting without touching canonical mesh data.
  for(const child of [...rig.upperBody.children])rig.group.add(child);
  rig.group.updateMatrixWorld(true);meshes.forEach((m,i)=>expect(m.matrixWorld.elements).toEqual(matrices[i].elements));
  expect(new THREE.Box3().setFromObject(rig.group)).toEqual(bound);
  expect(new Set(meshes.map(m=>m.geometry))).toEqual(geometry);expect(new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]))).toEqual(materials);
 });
 it('uses continuous opposite arm/leg rhythm, and responds to acceleration, stop and reversal',()=>{
  const {rig,motion}=setup();advance(motion,.3);motion.input.forwardSpeed=7;advance(motion,.2);
  expect(motion.state.acceleration).toBeGreaterThan(0);expect(rig.upperBody.rotation.x).toBeGreaterThan(0);
  expect(rig.leftArm.rotation.x*rig.leftLeg.rotation.x).toBeLessThan(0);expect(rig.rightArm.rotation.x*rig.rightLeg.rotation.x).toBeLessThan(0);
  const phase=motion.state.phase;motion.input.forwardSpeed=3;motion.input.dt=1/60;motion.update();
  expect((motion.state.phase-phase+Math.PI*2)%(Math.PI*2)).toBeLessThan(.35);
  motion.input.forwardSpeed=0;advance(motion,.15);expect(motion.state.acceleration).toBeLessThan(0);
  advance(motion,1);expect(motion.state.speed).toBeLessThan(.001);expect(Math.abs(rig.leftLeg.rotation.x)).toBeLessThan(.001);
  motion.input.forwardSpeed=-5;advance(motion,.2);expect(motion.state.acceleration).toBeLessThan(0);expect(rig.upperBody.rotation.x).toBeLessThan(0);
 });
 it('has comparable gait and lean at 30/60/120Hz without snaps on speed changes',()=>{
  const controllers=[30,60,120].map(rate=>{const {motion}=setup();motion.input.forwardSpeed=7;motion.input.turnRate=1;advance(motion,2,rate);return motion;});
  for(const m of controllers){expect(m.state.phase).toBeCloseTo(controllers[1].state.phase,4);expect(m.state.turn).toBeCloseTo(1,5);expect(Number.isFinite(m.state.acceleration)).toBe(true);}
 });
 it('reduces upper-body motion during ADS while retaining lower-body movement',()=>{
  const {rig,motion}=setup();motion.input.forwardSpeed=6;motion.input.turnRate=2;motion.input.item='two-hand';advance(motion,1);
  const unAimed=Math.abs(rig.upperBody.rotation.x)+Math.abs(rig.upperBody.rotation.z);
  motion.input.aiming=true;advance(motion,1);
  expect(Math.abs(rig.upperBody.rotation.x)+Math.abs(rig.upperBody.rotation.z)).toBeLessThan(unAimed*.1);
  expect(Math.abs(rig.leftLeg.rotation.x)).toBeGreaterThan(.05);
 });
 it('yields secondary transforms to special poses, and resets derivatives on LOD reentry',()=>{
  const {rig,motion}=setup();motion.input.forwardSpeed=7;advance(motion,.5);rig.leftArm.rotation.x=-1.8;
  motion.input.special=true;advance(motion,.1);expect(rig.leftArm.rotation.x).toBe(-1.8);expect(rig.upperBody.rotation.x).toBe(0);
  motion.input.special=false;motion.input.detail='skip';advance(motion,.1);motion.input.detail='near';motion.input.forwardSpeed=-20;advance(motion,1/60);
  expect(motion.state.acceleration).toBe(0);expect(Number.isFinite(rig.upperBody.rotation.x)).toBe(true);
 });
 it('suspends grounded gait in air and absorbs landing without duplicating existing impact feedback',()=>{
  const {rig,motion}=setup();motion.input.forwardSpeed=6;advance(motion,.5);const phase=motion.state.phase;
  motion.input.grounded=false;motion.input.verticalSpeed=5;advance(motion,.5);expect(motion.state.phase).toBe(phase);
  expect(Math.abs(rig.leftLeg.rotation.x)).toBeLessThan(.25);
  motion.input.grounded=true;motion.input.forwardSpeed=0;advance(motion,1/60);expect(motion.state.landing).toBeGreaterThan(.5);
  const dip=rig.upperBody.position.y;motion.input.landingPulse=1;motion.update();expect(rig.upperBody.position.y).toBeGreaterThan(dip);
 });
 it('anchors every canonical held item to the final glove after reload/carry changes',()=>{
  const {rig}=setup();const item=new THREE.Group();rig.upperBody.add(item);rig.upperBody.rotation.set(.08,.07,-.06);
  const pose={position:[.05,.11,-.13] as const,rotation:[0,Math.PI,0] as const,scale:.4};
  for(const x of [-.78,-1.2,-.35]){rig.rightArm.rotation.set(x,0,-.5);anchorAstronautHeldItem(item,rig.rightArm,pose);rig.group.updateMatrixWorld(true);
   const glove=new THREE.Vector3(0,-.61,0).applyMatrix4(rig.rightArm.matrixWorld);
   const expected=glove.add(new THREE.Vector3(...pose.position).applyMatrix3(new THREE.Matrix3().setFromMatrix4(rig.upperBody.matrixWorld)));
   expect(item.getWorldPosition(new THREE.Vector3()).distanceTo(expected)).toBeLessThan(1e-8);
  }
 });
 it('keeps forty actors finite and reuses geometry/material resources through repeated updates',()=>{
  const actors=Array.from({length:40},setup);const resources=actors.map(a=>{const r=new Set<unknown>();a.rig.group.traverse(o=>{if(o instanceof THREE.Mesh){r.add(o.geometry);r.add(o.material);}});return r;});
  actors.forEach(({motion},i)=>{motion.input.forwardSpeed=i%12;motion.input.lateralSpeed=i%3;motion.input.turnRate=i%4;motion.input.item=i%2?'heavy':'utility';advance(motion,2);});
  actors.forEach(({rig,motion},i)=>{expect(Object.values(motion.state).filter(v=>typeof v==='number').every(Number.isFinite)).toBe(true);const r=new Set<unknown>();rig.group.traverse(o=>{if(o instanceof THREE.Mesh){r.add(o.geometry);r.add(o.material);}});expect(r).toEqual(resources[i]);});
 });
 it('keeps rifle carry gloves and magazine ahead of the chest instead of collapsing into its center',()=>{
  const {rig,motion}=setup();motion.input.item='two-hand';advance(motion,1);
  const weapon=new THREE.Group();rig.upperBody.add(weapon);buildBrWeaponModel(weapon,'pulse-rifle',0xffffff);
  anchorAstronautHeldItem(weapon,rig.rightArm,brHeldWeaponTransform('pulse-rifle'));
  rig.group.updateMatrixWorld(true);
  for(const arm of [rig.leftArm,rig.rightArm]){const glove=new THREE.Vector3(0,-.61,0).applyMatrix4(arm.matrixWorld);expect(glove.z).toBeGreaterThan(.47);}
  const box=new THREE.Box3().setFromObject(weapon);expect(box.max.z).toBeGreaterThan(.95);expect(box.max.x).toBeGreaterThan(.35);
 });
 it('has restrained idle weight shift, supported airborne arms and simpler distant secondary motion',()=>{
  const {rig,motion}=setup();advance(motion,1);expect(Math.abs(rig.upperBody.rotation.z)).toBeGreaterThan(.001);expect(Math.abs(rig.upperBody.rotation.z)).toBeLessThan(.005);
  motion.input.grounded=false;advance(motion,.5);expect(rig.rightArm.rotation.x).toBeLessThan(-.18);
  motion.input.detail='far';advance(motion,.1);expect(rig.upperBody.rotation.toArray().slice(0,3)).toEqual([0,0,0]);
 });
 it('keeps the existing boots level and above support during a fully blended crouch',()=>{
  const {rig,motion}=setup();rig.group.position.y=.085;motion.input.floorOffset=.085;motion.input.crouched=true;motion.input.forwardSpeed=3;advance(motion,2);
  for(let i=0;i<180;i++){
   advance(motion,1/60);rig.group.updateMatrixWorld(true);
   for(const foot of [rig.leftFoot,rig.rightFoot]){
    const bounds=new THREE.Box3().setFromObject(foot,true);
    expect(bounds.min.y).toBeGreaterThanOrEqual(0);
    const up=new THREE.Vector3(0,1,0).transformDirection(foot.matrixWorld);expect(up.y).toBeGreaterThan(.999);
   }
  }
 });
});
