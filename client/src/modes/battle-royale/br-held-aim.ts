import * as THREE from "three";
import type {Vec3} from "@planetfall/shared";

/** Converts an existing world shot direction into the animated upper-body
 * frame. Presentation only: it never changes the supplied shot or parent.
 * Callers must reject unsupported poses rather than clamp away aim error. */
export function createBrHeldAim(){
  const inverse=new THREE.Matrix4(),direction=new THREE.Vector3();
  const state={valid:false,pitch:0,yaw:0};
  return {
    state,
    resolve(worldDirection:Vec3,parentWorld:THREE.Matrix4):boolean {
      state.valid=false;
      if(!Number.isFinite(worldDirection.x)||!Number.isFinite(worldDirection.y)||!Number.isFinite(worldDirection.z))return false;
      for(const value of parentWorld.elements)if(!Number.isFinite(value))return false;
      const determinant=parentWorld.determinant();
      if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-12)return false;
      direction.set(worldDirection.x,worldDirection.y,worldDirection.z);
      const lengthSq=direction.lengthSq();
      if(!Number.isFinite(lengthSq)||lengthSq<1e-12)return false;
      inverse.copy(parentWorld).invert();direction.transformDirection(inverse);
      if(!Number.isFinite(direction.lengthSq())||direction.lengthSq()<1e-12)return false;
      state.pitch=Math.atan2(-direction.y,Math.hypot(direction.x,direction.z));
      state.yaw=Math.atan2(direction.x,direction.z);
      state.valid=Number.isFinite(state.pitch)&&Number.isFinite(state.yaw);
      return state.valid;
    },
  };
}
