import type { EmoteType } from "@planetfall/shared";
import type { Object3D } from "three";

export type CosmeticPoseRig = Record<"leftArm" | "rightArm" | "torso", Pick<Object3D, "rotation" | "position">>;

/** Applies the production emote offsets after the caller restores its base pose. */
export function applyCosmeticEmotePose(rig: CosmeticPoseRig, emote: EmoteType, now: number): void {
  const phase = now * .012;
  if (emote === "wave") { rig.rightArm.rotation.x = -2.25; rig.rightArm.rotation.z = -.45 + Math.sin(phase * 1.8) * .45; }
  else if (emote === "laugh") { rig.leftArm.rotation.x = -1.3; rig.leftArm.rotation.z = .62; rig.torso.rotation.z = Math.sin(phase * 2.3) * .1; }
  else if (emote === "point") { rig.rightArm.rotation.x = -1.55; rig.rightArm.rotation.z = -.08; }
  else if (emote === "panic") {
    rig.leftArm.rotation.x = -1.7 + Math.sin(phase * 2.4) * .55; rig.rightArm.rotation.x = -1.7 - Math.sin(phase * 2.4) * .55;
    rig.leftArm.rotation.z = .72; rig.rightArm.rotation.z = -.72;
  } else if (emote === "taunt") { rig.leftArm.rotation.x = -1.1; rig.rightArm.rotation.x = -1.1; rig.torso.rotation.z = Math.sin(phase) * .13; }
  else {
    rig.leftArm.rotation.x = -2.45; rig.rightArm.rotation.x = -2.45; rig.leftArm.rotation.z = .45; rig.rightArm.rotation.z = -.45;
    rig.torso.position.y += Math.max(0, Math.sin(phase)) * .08;
  }
}

/** Returns spin yaw so the caller retains ownership of its world orientation. */
export function applyCosmeticVictoryPose(rig: CosmeticPoseRig, id: string, seconds: number): number {
  if (id === "hero") rig.leftArm.rotation.x = rig.rightArm.rotation.x = -2.25;
  if (id === "double-pump") {
    const pump = Math.sin(seconds * 9) * .28;
    rig.leftArm.rotation.x = -2.1 + pump; rig.rightArm.rotation.x = -2.1 - pump;
  }
  // Ace currently retains the canonical idle stance in gameplay.
  return id === "spin" ? seconds * 4.2 : 0;
}
