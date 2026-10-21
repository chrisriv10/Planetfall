import * as THREE from "three";
import type {Vec3} from "@planetfall/shared";
import {createBrHeldAim} from "./br-held-aim";

/** Presentation facing only. Near-vertical shots retain the last planar facing. */
export function brHeldAimFacing(direction:Vec3,fallback:number):number {
  if(!Number.isFinite(direction.x)||!Number.isFinite(direction.y)||!Number.isFinite(direction.z))return fallback;
  return Math.hypot(direction.x,direction.z)>1e-8?Math.atan2(direction.x,-direction.z):fallback;
}

/** Splits exact world aim between torso inclination and an arm pose budget.
 * This never edits the shot, physics, camera, or supplied rig matrix. The caller
 * applies the torso rotation before using the returned local arm angles. */
export function createBrHeldAimFrame(){
  const aim=createBrHeldAim(),torso=new THREE.Matrix4(),parent=new THREE.Matrix4();
  const state={valid:false,pitch:0,yaw:0,torsoPitch:0,torsoY:0,torsoZ:0};
  return {
    state,
    resolve(direction:Vec3,rigWorld:THREE.Matrix4,minPitch=-1.1,maxPitch=.9):boolean {
      state.valid=false;
      if(!Number.isFinite(minPitch)||!Number.isFinite(maxPitch)||minPitch>maxPitch||minPitch< -Math.PI/2||maxPitch>Math.PI/2)return false;
      if(!aim.resolve(direction,rigWorld))return false;
      // Bound the arms, not world aim: the torso carries the remaining angle.
      const raw=aim.state.pitch;
      state.torsoPitch=raw-THREE.MathUtils.clamp(raw,minPitch,maxPitch);
      torso.makeRotationX(state.torsoPitch);parent.multiplyMatrices(rigWorld,torso);
      if(!aim.resolve(direction,parent))return false;
      state.pitch=aim.state.pitch;state.yaw=aim.state.yaw;
      state.torsoY=.45*(1-Math.cos(state.torsoPitch));
      state.torsoZ=-.45*Math.sin(state.torsoPitch);
      state.valid=true;
      return true;
    }
  };
}
