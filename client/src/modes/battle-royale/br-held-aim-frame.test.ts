import {expect,it} from "vitest";
import * as THREE from "three";
import {brHeldAimFacing,createBrHeldAimFrame} from "./br-held-aim-frame";

it("preserves exact world barrel direction through steep aim and squashed rig transforms",()=>{
  const frame=createBrHeldAimFrame(),rig=new THREE.Matrix4(),torso=new THREE.Matrix4();
  for(const yaw of [-Math.PI,-1,0,2.7])for(const pitch of [-Math.PI/2,-1.3,-.75,0,1.15,1.4,Math.PI/2])for(const squash of [.992,1,1.008]){
    const shot=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    const facing=brHeldAimFacing(shot,yaw);
    rig.makeRotationY(Math.PI-facing).scale(new THREE.Vector3(1/Math.sqrt(squash),squash,1/Math.sqrt(squash)));
    const original=rig.clone(),before=shot.clone();
    expect(frame.resolve(shot,rig)).toBe(true);
    const s=frame.state;
    expect(s.pitch).toBeGreaterThanOrEqual(-1.1-1e-10);expect(s.pitch).toBeLessThanOrEqual(.9+1e-10);
    const local=new THREE.Vector3(Math.cos(s.pitch)*Math.sin(s.yaw),-Math.sin(s.pitch),Math.cos(s.pitch)*Math.cos(s.yaw));
    torso.makeRotationX(s.torsoPitch);local.transformDirection(new THREE.Matrix4().multiplyMatrices(rig,torso));
    expect(local.distanceTo(shot)).toBeLessThan(1e-10);
    // Belt pivot is fixed even while the upper body inclines.
    const belt=new THREE.Vector3(0,.45,0).applyMatrix4(torso).add(new THREE.Vector3(0,s.torsoY,s.torsoZ));
    expect(belt.distanceTo(new THREE.Vector3(0,.45,0))).toBeLessThan(1e-10);
    expect(rig).toEqual(original);expect(shot).toEqual(before);
  }
});

it("does not retain valid status after invalid directions, transforms or budgets",()=>{
  const frame=createBrHeldAimFrame(),identity=new THREE.Matrix4(),shot={x:0,y:0,z:1};
  expect(frame.resolve(shot,identity)).toBe(true);
  for(const [direction,matrix,min,max]of [
    [{x:NaN,y:0,z:1},identity,-1.1,.9],
    [shot,new THREE.Matrix4().makeScale(0,1,1),-1.1,.9],
    [shot,identity,1,-1],
    [shot,identity,NaN,.9],
  ] as const){expect(frame.resolve(direction,matrix,min,max)).toBe(false);expect(frame.state.valid).toBe(false);}
  expect(brHeldAimFacing({x:0,y:1,z:0},1.7)).toBe(1.7);
  expect(brHeldAimFacing({x:Infinity,y:0,z:1},1.7)).toBe(1.7);
});
