import type * as THREE from "three";

export interface BrDeploymentPoseRig {
  rig: THREE.Group;
  limbs: readonly THREE.Object3D[];
  wings: THREE.Group;
}

/** Call after locomotion posing/lean, before vehicle overrides. The canonical
 * astronaut faces +Z locally (the BR rig has yaw PI), so positive local pitch
 * leans the head toward travel. No position, yaw, or simulation state changes. */
export function applyBrDeploymentPose(visual: BrDeploymentPoseRig, deployment: string, now: number, dt: number): void {
  const gliding = deployment === "chute";
  visual.wings.visible = gliding;
  if (!gliding) { visual.wings.rotation.set(0, 0, 0); visual.wings.scale.set(1, 1, 1); return; }
  const blend = 1 - Math.exp(-9 * Math.max(0, dt));
  visual.rig.rotation.x += (.38 - visual.rig.rotation.x) * blend;
  const flutter = Math.sin(now * .0025) * .025;
  for (let i = 0; i < 4; i++) {
    const limb = visual.limbs[i];
    if (!limb) continue;
    limb.rotation.x = i < 2 ? .22 + flutter : -.18;
    limb.rotation.y = 0;
    limb.rotation.z = (i % 2 ? -1 : 1) * (i < 2 ? .32 : .065);
  }
  // Tilt the existing energy surfaces back from the shoulders. The original
  // wing geometry/material ownership and 3.9m span remain unchanged.
  visual.wings.rotation.set(-.28, 0, flutter * .4);
  visual.wings.scale.set(1 + Math.sin(now * .003) * .012, 1, 1);
}
