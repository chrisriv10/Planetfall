import * as THREE from "three";
import { anchorBrHeldWeaponSupport, type BrSupportWeaponId } from "./br-held-weapon-support";
import { SUPPORTED_ARM_MIN_PITCH, SUPPORTED_ARM_MAX_PITCH, SUPPORTED_ARM_MAX_YAW } from "../../astronaut-supported-arms";

const SERVICE = {
  "helix-burst-rifle": { x: .125, z: .02, scale: .46 },
  "quasar-carbine": { x: .12, z: 0, scale: .43 },
  "prism-beam": { x: .175, z: .025, scale: .48 },
  "vortex-cannon": { x: .21, z: .06, scale: .48 },
} as const;
const smooth = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Pass CURRENT desired aim and its supported right wrist every frame, including
 * the return quarter. Outputs use upperBody coordinates. Owns no GPU resources. */
export function createBrHeldReloadPath(id: BrSupportWeaponId) {
  const left = new THREE.Vector3(), right = new THREE.Vector3();
  const support = new THREE.Vector3(), service = new THREE.Vector3(), outward = new THREE.Vector3();
  const frame = new THREE.Object3D();
  const state = { left, right, pitch: 0, yaw: 0 };
  return {
    state,
    update(progress: number, currentRight: THREE.Vector3, pitch: number, yaw: number) {
      if (!Number.isFinite(progress) || progress < 0 || progress > 1
        || !Number.isFinite(pitch) || pitch < SUPPORTED_ARM_MIN_PITCH || pitch > SUPPORTED_ARM_MAX_PITCH
        || !Number.isFinite(yaw) || Math.abs(yaw) > SUPPORTED_ARM_MAX_YAW
        || !Number.isFinite(currentRight.x) || !Number.isFinite(currentRight.y) || !Number.isFinite(currentRight.z)) return false;
      const settle = smooth(Math.min(progress, 1 - progress) / .25);
      state.pitch = pitch * (1 - settle) - .35 * settle;
      state.yaw = yaw * (1 - settle);
      right.copy(currentRight);
      right.x += (.19 - currentRight.x) * settle;
      right.y += (1.15 - currentRight.y) * settle;
      right.z += (.68 - currentRight.z) * settle;
      support.set(right.x - .38 * Math.cos(state.yaw), right.y, right.z + .38 * Math.sin(state.yaw));
      left.copy(support);
      if (progress > .25 && progress < .75) {
        anchorBrHeldWeaponSupport(frame, id, right, -.35, 0);
        frame.updateMatrixWorld(true);
        const s = SERVICE[id];
        service.set(s.x + .18 * .9 / s.scale, 0, s.z + .18 * Math.sqrt(.19) / s.scale).applyMatrix4(frame.matrixWorld);
        outward.copy(support); outward.x -= .23;
        const phase = (progress - .25) / .5;
        const travel = phase < .5 ? phase * 2 : (1 - phase) * 2;
        if (travel < .4) left.lerpVectors(support, outward, smooth(travel / .4));
        else if (travel < .7) left.copy(outward);
        else left.lerpVectors(outward, service, smooth((travel - .7) / .3));
      }
      return true;
    },
  };
}

/** Fold existing support hardware only after the glove has released it.
 * Restore before disposing the held support model. No geometry/material ownership. */
export function createBrHeldReloadBrace(model: THREE.Group) {
  const brace = model.children.find(o => o.name === "weapon-folding-brace" && o.position.x > 0);
  const grip = model.children.find(o => o.name === "weapon-support-grip");
  if (!brace || !grip) throw new Error("Missing supported-weapon parts");
  brace.updateMatrix();
  const pivot = new THREE.Vector3(0, .5, 0).applyMatrix4(brace.matrix);
  const parts = [brace, grip].map(part => ({ part, position: part.position.clone(), quaternion: part.quaternion.clone() }));
  const rotation = new THREE.Quaternion(), axis = new THREE.Vector3(1, 0, 0);
  let disposed = false;
  const restore = () => { for (const p of parts) { p.part.position.copy(p.position); p.part.quaternion.copy(p.quaternion); } };
  return {
    update(progress: number) {
      if (disposed || !Number.isFinite(progress) || progress < 0 || progress > 1) return false;
      rotation.setFromAxisAngle(axis, Math.PI * .65 * smooth((Math.min(progress, 1 - progress) - .35) / .075));
      for (const p of parts) {
        p.part.position.copy(p.position).sub(pivot).applyQuaternion(rotation).add(pivot);
        p.part.quaternion.copy(rotation).multiply(p.quaternion);
      }
      return true;
    },
    restore,
    dispose() { if (!disposed) { restore(); disposed = true; } },
  };
}
