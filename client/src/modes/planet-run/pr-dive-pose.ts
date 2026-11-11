import type {AstronautVisual} from "../../astronaut";

const blend=(current:number,target:number,weight:number)=>current+(target-current)*weight;

/** Apply once after restoring this frame's canonical visual root and locomotion pose. */
export function applyPrDivePose(rig:AstronautVisual,amount:number):void {
  if(!Number.isFinite(amount)||amount<=0)return;
  const weight=Math.min(1,amount);
  // Local +Z is the direction the visor faces. Pitch the full skeleton about
  // its local X axis so heading and the relationship between ribs and hips hold.
  rig.group.rotateX(1.12*weight);
  rig.upperBody.rotation.x=blend(rig.upperBody.rotation.x,.035,weight);
  rig.upperBody.rotation.y=blend(rig.upperBody.rotation.y,0,weight);
  rig.upperBody.rotation.z=blend(rig.upperBody.rotation.z,0,weight);
  rig.helmet.rotation.x=blend(rig.helmet.rotation.x,-.27,weight);
  rig.leftArm.rotation.set(blend(rig.leftArm.rotation.x,-2.63,weight),blend(rig.leftArm.rotation.y,0,weight),blend(rig.leftArm.rotation.z,-.12,weight));
  rig.rightArm.rotation.set(blend(rig.rightArm.rotation.x,-2.57,weight),blend(rig.rightArm.rotation.y,0,weight),blend(rig.rightArm.rotation.z,.12,weight));
  rig.leftLeg.rotation.set(blend(rig.leftLeg.rotation.x,.075,weight),blend(rig.leftLeg.rotation.y,0,weight),blend(rig.leftLeg.rotation.z,-.045,weight));
  rig.rightLeg.rotation.set(blend(rig.rightLeg.rotation.x,.14,weight),blend(rig.rightLeg.rotation.y,0,weight),blend(rig.rightLeg.rotation.z,.045,weight));
}
