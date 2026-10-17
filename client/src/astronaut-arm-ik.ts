import * as THREE from "three";

export const ASTRONAUT_ARM_LENGTH=.61;
export const ASTRONAUT_ARM_SEGMENT_LENGTH=.305;
export const ASTRONAUT_GLOVE_RADIUS=.18;

/** Analytic two-bone solve; outputs are caller-owned and remain unchanged on an
 * unreachable target. Pole is a point selecting the elbow plane, not a joint.
 * No clamping to a fake reachable target, stretching, or per-call allocation. */
export function createAstronautArmIk(){
  const axis=new THREE.Vector3(),bend=new THREE.Vector3(),offset=new THREE.Vector3();
  return (shoulder:THREE.Vector3,target:THREE.Vector3,pole:THREE.Vector3,elbowOut:THREE.Vector3,wristOut:THREE.Vector3):boolean=>{
    axis.subVectors(target,shoulder);
    const distance=axis.length();
    if(!Number.isFinite(distance)||distance<1e-6||distance>ASTRONAUT_ARM_LENGTH)return false;
    axis.multiplyScalar(1/distance);
    bend.subVectors(pole,shoulder).addScaledVector(axis,-offset.subVectors(pole,shoulder).dot(axis));
    const bendLength=bend.length();
    if(!Number.isFinite(bendLength)||bendLength<1e-6)return false;
    bend.multiplyScalar(1/bendLength);
    const midpoint=distance*.5;
    const height=Math.sqrt(Math.max(0,ASTRONAUT_ARM_SEGMENT_LENGTH**2-midpoint**2));
    elbowOut.copy(shoulder).addScaledVector(axis,midpoint).addScaledVector(bend,height);
    wristOut.copy(target);
    return true;
  };
}

/** Conservative glove clearance gate in the unchanged upper-body bind frame.
 * Torso uses an enclosing capsule (largest radial scale); helmet an enclosing
 * sphere. Rejecting this test is not proof that actual faceted meshes intersect. */
export function astronautGloveHasBodyClearance(point:THREE.Vector3):boolean {
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z))return false;
  const dx=Math.max(0,Math.abs(point.x)-.31);
  const dy=Math.max(.64-point.y,0,point.y-1);
  const dz=Math.max(.37-point.z,0,point.z-.49);
  if(Math.hypot(dx,dy,dz)<ASTRONAUT_GLOVE_RADIUS)return false;
  const torsoDy=Math.max(.46-point.y,0,point.y-.98);
  if(Math.hypot(point.x,torsoDy,point.z)<.48*1.06+ASTRONAUT_GLOVE_RADIUS)return false;
  return Math.hypot(point.x,point.y-1.46,point.z)>=.56*1.02+ASTRONAUT_GLOVE_RADIUS;
}
