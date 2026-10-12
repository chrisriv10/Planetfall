import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyBrDeploymentPose } from "./br-deployment-pose";

describe("Ion Wings deployment pose", () => {
  it("leans toward canonical forward, leaves world position/yaw untouched, and overrides running limbs", () => {
    const rig = new THREE.Group(), wings = new THREE.Group(), limbs = Array.from({ length: 4 }, () => new THREE.Group());
    rig.rotation.y = Math.PI; rig.position.set(20, 14, 60); limbs.forEach(limb => limb.rotation.set(1, .2, .5));
    for (let i = 0; i < 100; i++) applyBrDeploymentPose({ rig, wings, limbs }, "chute", i * 16, .016);
    expect(rig.rotation.x).toBeGreaterThan(.35); expect(rig.rotation.x).toBeLessThan(.4);
    expect(rig.position.toArray()).toEqual([20, 14, 60]); expect(rig.rotation.y).toBe(Math.PI);
    expect(wings.visible).toBe(true); expect(wings.rotation.x).toBeLessThan(0);
    expect(limbs[0].rotation.x).toBeGreaterThan(0); expect(limbs[2].rotation.x).toBeLessThan(0);
    expect(limbs[0].rotation.z).toBe(-limbs[1].rotation.z);
  });
  it("resets only wing presentation outside glide and preserves grounded posing", () => {
    const rig = new THREE.Group(), wings = new THREE.Group(), limbs = Array.from({ length: 4 }, () => new THREE.Group());
    applyBrDeploymentPose({ rig, wings, limbs }, "chute", 900, .016);
    const pitch = rig.rotation.x, arm = limbs[0].rotation.x;
    applyBrDeploymentPose({ rig, wings, limbs }, "grounded", 950, .016);
    expect(wings.visible).toBe(false); expect(wings.scale.toArray()).toEqual([1, 1, 1]);
    expect(wings.rotation.x).toBe(0); expect(rig.rotation.x).toBe(pitch); expect(limbs[0].rotation.x).toBe(arm);
  });
});
