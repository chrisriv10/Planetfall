import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {createAstronautArmIk,ASTRONAUT_ARM_LENGTH,ASTRONAUT_ARM_SEGMENT_LENGTH,astronautGloveHasBodyClearance} from "./astronaut-arm-ik";
describe("presentation arm feasibility",()=>{
  it("solves both fixed-length segments without changing the requested wrist",()=>{
    const solve=createAstronautArmIk(),elbow=new THREE.Vector3(),wrist=new THREE.Vector3();
    for(const side of [-1,1])for(const distance of [.1,.3,.5,.61]){
      const shoulder=new THREE.Vector3(side*.57,1.02,0),target=shoulder.clone().add(new THREE.Vector3(0,0,distance));
      const pole=shoulder.clone().add(new THREE.Vector3(side,-.4,0));
      expect(solve(shoulder,target,pole,elbow,wrist)).toBe(true);
      expect(elbow.distanceTo(shoulder)).toBeCloseTo(ASTRONAUT_ARM_SEGMENT_LENGTH,10);
      expect(wrist.distanceTo(elbow)).toBeCloseTo(ASTRONAUT_ARM_SEGMENT_LENGTH,10);
      expect(wrist.toArray()).toEqual(target.toArray());
    }
  });
  it("rejects impossible reach without silently moving or stretching the hand",()=>{
    const solve=createAstronautArmIk(),elbow=new THREE.Vector3(7,8,9),wrist=new THREE.Vector3(4,5,6);
    for(const z of [ASTRONAUT_ARM_LENGTH+.001,1.007,NaN,0]){
      expect(solve(new THREE.Vector3(),new THREE.Vector3(0,0,z),new THREE.Vector3(1,0,0),elbow,wrist)).toBe(false);
      expect(elbow.toArray()).toEqual([7,8,9]);expect(wrist.toArray()).toEqual([4,5,6]);
    }
  });
  it("rejects prior inward glove penetration and retains conservative clear cases",()=>{
    expect(astronautGloveHasBodyClearance(new THREE.Vector3(.057,.916,.313))).toBe(false);
    expect(astronautGloveHasBodyClearance(new THREE.Vector3(0,1.46,.1))).toBe(false);
    expect(astronautGloveHasBodyClearance(new THREE.Vector3(.35,.9,.7))).toBe(true);
  });
});
