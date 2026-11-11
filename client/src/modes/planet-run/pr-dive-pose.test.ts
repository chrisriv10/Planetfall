import {describe,expect,it} from "vitest";
import * as THREE from "three";
import {createAstronautVisual} from "../../astronaut";
import {applyPrDivePose} from "./pr-dive-pose";

const make=()=>createAstronautVisual({identityColor:"#ffcf81",suitAccent:"#78deaa",isBot:false});
describe("Planet Run dive posture",()=>{
  it("tips the complete skeleton forward at every heading and reaches both gloves down-course",()=>{
    for(const yaw of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
      const rig=make();rig.group.rotation.y=yaw;
      const heading=new THREE.Vector3(0,0,1).applyQuaternion(rig.group.quaternion);
      applyPrDivePose(rig,1);rig.group.updateMatrixWorld(true);
      const upright=new THREE.Vector3(0,1,0).applyQuaternion(rig.group.quaternion);
      expect(upright.dot(heading)).toBeCloseTo(Math.sin(1.12),6);expect(upright.y).toBeCloseTo(Math.cos(1.12),6);
      for(const arm of [rig.leftArm,rig.rightArm]){
        const shoulder=arm.getWorldPosition(new THREE.Vector3()),hand=arm.localToWorld(new THREE.Vector3(0,-.61,0));
        expect(hand.sub(shoulder).dot(heading)).toBeGreaterThan(.56);
      }
      const head=rig.helmet.getWorldPosition(new THREE.Vector3()),foot=rig.leftFoot.getWorldPosition(new THREE.Vector3());
      expect(head.sub(foot).dot(heading)).toBeGreaterThan(1);
      const dims=new THREE.Box3().setFromObject(rig.group,true).getSize(new THREE.Vector3());
      expect(dims.length()).toBeLessThan(3.7);expect(dims.toArray().every(Number.isFinite)).toBe(true);
    }
  });
  it("blends safely, leaves invalid or zero weights neutral, and retains all transforms outside pose rotations",()=>{
    const rig=make();rig.group.position.set(8,2,-6);rig.group.scale.setScalar(.84);
    rig.group.rotation.y=.8;rig.leftArm.rotation.set(.5,-.1,.16);
    const origin=rig.group.position.clone(),scale=rig.group.scale.clone(),base=rig.group.quaternion.clone(),rest=rig.leftArm.rotation.clone();
    const bones=[rig.helmet,rig.backpack,rig.upperBody,rig.leftArm,rig.rightArm,rig.leftLeg,rig.rightLeg];
    const parents=bones.map(b=>b.parent),positions=bones.map(b=>b.position.clone()),material=rig.torso.material;
    for(const amount of [0,-.1,Infinity,NaN])applyPrDivePose(rig,amount);
    expect(rig.group.quaternion.equals(base)).toBe(true);expect(rig.leftArm.rotation.equals(rest)).toBe(true);
    applyPrDivePose(rig,.5);expect(rig.group.quaternion.angleTo(base)).toBeCloseTo(.56);expect(rig.leftArm.rotation.x).toBeCloseTo((.5-2.63)/2);
    expect(rig.group.position.equals(origin)).toBe(true);expect(rig.group.scale.equals(scale)).toBe(true);expect(rig.torso.material).toBe(material);
    bones.forEach((b,i)=>{expect(b.parent).toBe(parents[i]);expect(b.position.equals(positions[i])).toBe(true);});
    const capped=make();applyPrDivePose(capped,8);expect(capped.group.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(1.12);
  });
});
