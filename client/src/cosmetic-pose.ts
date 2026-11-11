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
  else if (emote === "salute") {
    rig.rightArm.rotation.set(-2.58, -.12, -.48);
    rig.leftArm.rotation.set(-.10, 0, -.04);
    rig.torso.rotation.y = -.07;
  } else if (emote === "shuffle") {
    const beat = Math.sin(phase * .83);
    rig.torso.rotation.z = beat * .14;
    rig.torso.position.x += beat * .055;
    rig.torso.position.y += Math.abs(Math.cos(phase * .83)) * .035;
    rig.leftArm.rotation.set(-.72 + beat * .52, 0, -.32);
    rig.rightArm.rotation.set(-.72 - beat * .52, 0, .32);
  } else if (emote === "flex") {
    const hold = Math.cos(phase * .35) * .045;
    rig.leftArm.rotation.set(-2.0 + hold, -.35, -1.02);
    rig.rightArm.rotation.set(-2.0 + hold, .35, 1.02);
    rig.torso.rotation.x = -.08;
  } else {
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
  if (id === "orbit-salute") {
    applyCosmeticEmotePose(rig, "salute", seconds * 1000);
    return .16 * Math.sin(seconds * .8);
  }
  if (id === "zero-g-bow") {
    const bow = .5 - .5 * Math.cos(seconds * 2);
    rig.torso.rotation.x = .14 + bow * .59;
    rig.leftArm.rotation.set(-1.04, .16, .72);
    rig.rightArm.rotation.set(.25 + bow * .3, 0, .47);
    rig.torso.position.y -= bow * .055;
  }
  if (id === "champion") {
    rig.rightArm.rotation.set(-2.86 + Math.sin(seconds * 4) * .07, -.06, .40);
    rig.leftArm.rotation.set(-.76, .12, -.63);
    rig.torso.rotation.z = -.10;
  }
  // Ace currently retains the canonical idle stance in gameplay.
  return id === "spin" ? seconds * 4.2 : 0;
}
