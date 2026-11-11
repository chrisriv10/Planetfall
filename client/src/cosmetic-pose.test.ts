import {describe,expect,it} from "vitest";
import * as THREE from "three";
import {applyCosmeticEmotePose,applyCosmeticVictoryPose} from "./cosmetic-pose";
const rig=()=>({leftArm:new THREE.Group(),rightArm:new THREE.Group(),torso:new THREE.Group()});
const pose=(r:ReturnType<typeof rig>)=>Object.values(r).flatMap(o=>[o.rotation.x,o.rotation.y,o.rotation.z,...o.position.toArray()]);
describe("canonical cosmetic pose vocabulary",()=>{
  it("gives salute, shuffle and flex distinct silhouettes from all six existing emotes",()=>{
    const signatures=new Set<string>();
    for(const id of ["wave","laugh","point","panic","taunt","celebrate","salute","shuffle","flex"] as const){
      const r=rig();applyCosmeticEmotePose(r,id,630);const values=pose(r);
      expect(values.every(Number.isFinite)).toBe(true);signatures.add(values.join(","));
    }
    expect(signatures.size).toBe(9);
    const a=rig(),b=rig();applyCosmeticEmotePose(a,"shuffle",130);applyCosmeticEmotePose(b,"shuffle",440);
    expect(a.leftArm.rotation.x-b.leftArm.rotation.x).toBeCloseTo(-(a.rightArm.rotation.x-b.rightArm.rotation.x));expect(a.torso.position.x).not.toBe(b.torso.position.x);
  });
  it("composes each new victory over the celebration and retains old hero, pump, spin and ace behavior",()=>{
    const signatures=new Set<string>();
    for(const id of ["orbit-salute","zero-g-bow","champion","hero","double-pump","spin","ace"]){
      const r=rig();applyCosmeticEmotePose(r,"celebrate",360);const before=pose(r);
      const yaw=applyCosmeticVictoryPose(r,id,.36);signatures.add([...pose(r),yaw].join(","));
      if(id==="spin")expect(yaw).toBeCloseTo(.36*4.2);
      if(id==="ace")expect(pose(r)).toEqual(before);
    }
    expect(signatures.size).toBe(7);
  });
});
