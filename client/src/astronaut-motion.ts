import type { Group, Object3D } from "three";
import type { AstronautVisual } from "./astronaut";

export interface AstronautMotionInput {
  dt: number; timeSeconds: number;
  /** Signed velocity in the rendered astronaut's local +Z-forward frame. */
  forwardSpeed: number; lateralSpeed: number; verticalSpeed: number; turnRate: number;
  grounded: boolean; walkSpeed: number; runSpeed: number;
  aiming: boolean; crouched: boolean;
  item: "none" | "one-hand" | "two-hand" | "heavy" | "melee" | "utility";
  detail: "near" | "far" | "skip"; special: boolean;
  /** Existing landing feedback: when nonzero, suppress the additional landing dip. */
  landingPulse: number;
  /** Presentation root lift above its grounded foot point; no simulation writes. */
  floorOffset: number;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const finite = (n: number) => Number.isFinite(n) ? n : 0;
const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));

/** One cached controller per astronaut; update performs scalar math and transform writes only. */
export function createAstronautMotion(rig: AstronautVisual) {
  const footRest=rig.leftFoot.quaternion.clone();
  const input: AstronautMotionInput = { dt: 0, timeSeconds: 0, forwardSpeed: 0, lateralSpeed: 0,
    verticalSpeed: 0, turnRate: 0, grounded: true, walkSpeed: 3, runSpeed: 7,
    aiming: false, crouched: false, item: "none", detail: "near", special: false, landingPulse: 0, floorOffset: .295 };
  const state = { phase: 0, speed: 0, forward: 0, lateral: 0, acceleration: 0, turn: 0,
    aim: 0, crouch: 0, air: 0, landing: 0, wasGrounded: true, yielded: false, initialized: false };
  const secondaryRest = () => {
    rig.upperBody.position.set(0, 0, 0); rig.upperBody.rotation.set(0, 0, 0);
    rig.helmet.position.y = 1.46; rig.helmet.rotation.set(0, 0, 0);
    rig.backpack.rotation.set(0, 0, 0);
    rig.leftFoot.rotation.set(0,0,0);rig.rightFoot.rotation.set(0,0,0);
    rig.leftLeg.position.y=rig.rightLeg.position.y=.48;
  };
  const limbRest = () => {
    rig.leftArm.rotation.set(0, 0, .17); rig.rightArm.rotation.set(0, 0, -.17);
    rig.leftLeg.rotation.set(0, 0, 0); rig.rightLeg.rotation.set(0, 0, 0);
  };
  const reset = () => {
    state.phase = state.speed = state.forward = state.lateral = state.acceleration = state.turn = 0;
    state.aim = state.crouch = state.air = state.landing = 0;
    state.wasGrounded = input.grounded; state.yielded = false; state.initialized = false;
    secondaryRest(); limbRest();
  };
  const update = () => {
    if (input.special || input.detail === "skip") {
      secondaryRest(); state.yielded = true; state.initialized = false;
      return;
    }
    if (state.yielded) { reset(); }
    const dt = clamp(finite(input.dt), 0, .05);
    if (!dt) return;
    const forward = clamp(finite(input.forwardSpeed), -40, 40), lateral = clamp(finite(input.lateralSpeed), -40, 40);
    const speed = Math.hypot(forward, lateral);
    if (!state.initialized) {
      state.wasGrounded = input.grounded; state.initialized = true;
      state.forward = forward; state.lateral = lateral; state.speed = speed;
    }
    const previousForward = state.forward;
    state.speed = damp(state.speed, speed, 10, dt);
    state.forward = damp(state.forward, forward, 9, dt); state.lateral = damp(state.lateral, lateral, 9, dt);
    state.acceleration = damp(state.acceleration, clamp((state.forward - previousForward) / dt, -12, 12), 7, dt);
    state.turn = damp(state.turn, clamp(finite(input.turnRate), -5, 5), 9, dt);
    state.aim = damp(state.aim, input.aiming ? 1 : 0, 14, dt);
    state.crouch = damp(state.crouch, input.crouched ? 1 : 0, 12, dt);
    state.air = damp(state.air, input.grounded ? 0 : 1, 15, dt);
    if (input.grounded && !state.wasGrounded) state.landing = 1;
    state.wasGrounded = input.grounded;
    state.landing = damp(state.landing, 0, 12, dt);
    const runSpeed = Math.max(1, finite(input.runSpeed)), walkSpeed = clamp(finite(input.walkSpeed), .5, runSpeed);
    const activity = clamp(state.speed / walkSpeed, 0, 1), running = clamp((state.speed - walkSpeed) / Math.max(1, runSpeed - walkSpeed), 0, 1);
    // Distance-based phase cannot jump when velocity changes, and pauses in the air.
    if (input.grounded) state.phase = (state.phase + state.speed * dt * (2.6 - running * .3)) % (Math.PI * 2);
    const wave = Math.sin(state.phase), gait = wave * activity * (.32 + running * .24) * (1 - state.air) * (1 - state.crouch * .55);
    const direction = state.speed > .05 ? state.forward / Math.max(.05, state.speed) : 1;
    const side = state.speed > .05 ? state.lateral / Math.max(.05, state.speed) : 0;
    const airLeg = (finite(input.verticalSpeed) > 0 ? .22 : .12) * state.air;
    rig.leftLeg.rotation.set(gait * direction - state.crouch * .68 + airLeg, 0, -gait * side * .55);
    rig.rightLeg.rotation.set(-gait * direction - state.crouch * .68 - airLeg * .6, 0, gait * side * .55);
    const footStability=(1-state.air)*(.75+state.crouch*.25);
    rig.leftFoot.quaternion.copy(rig.leftLeg.quaternion).invert().slerp(footRest,1-footStability);
    rig.rightFoot.quaternion.copy(rig.rightLeg.quaternion).invert().slerp(footRest,1-footStability);
    const plant=state.crouch*(1-state.air);
    const floorOffset=clamp(finite(input.floorOffset),0,.5);
    // The flat sole bottom is .19m below the ankle. Compensate the lowered
    // crouch root with scalar hip offsets; no contacts, raycasts or IK solve.
    const leftAnkle=.48-.58*Math.cos(rig.leftLeg.rotation.x)*Math.cos(rig.leftLeg.rotation.z)-.13*Math.sin(rig.leftLeg.rotation.x);
    const rightAnkle=.48-.58*Math.cos(rig.rightLeg.rotation.x)*Math.cos(rig.rightLeg.rotation.z)-.13*Math.sin(rig.rightLeg.rotation.x);
    rig.leftLeg.position.y=.48+plant*(.20-floorOffset-leftAnkle+Math.max(0,wave)*activity*.025);
    rig.rightLeg.position.y=.48+plant*(.20-floorOffset-rightAnkle+Math.max(0,-wave)*activity*.025);
    const armSwing = gait * .65 * (1 - state.aim * .92);
    let lx = -armSwing - state.air * .25, rx = armSwing - state.air * .22,
      lz = .17 + state.air * .09, rz = -.17 - state.air * .09;
    const tuck = running * (1 - state.aim) * .12;
    if (input.item === "two-hand" || input.item === "heavy") {
      const weight = input.item === "heavy" ? .45 : .7;
      lx = -1.25 + armSwing * .08 * weight + tuck; rx = -1.25 + armSwing * .12 * weight + tuck;
      // These arms have no elbow joints: keep the gloves ahead of the chest
      // rather than forcing them together inside the torso.
      lz = .55; rz = -.55;
    } else if (input.item === "one-hand") {
      // A compact sidearm stays on the right glove. The free arm counter-swings
      // at the side; ADS steadies it without pretending there is an elbow joint.
      rx = -1.02 - state.aim * .27 + running * (1-state.aim) * .28 + armSwing * .08;
      rz = -.28 + state.aim * .07;
      lx = -.18 - armSwing * .65 - state.aim * .22;
      lz = .19 + state.aim * .07;
    } else if (input.item === "utility") {
      lx = -.9 + armSwing * .08; rx = -1 + armSwing * .08; lz = .55; rz = -.32;
    } else if (input.item === "melee") {
      rx = -1.05 + armSwing * .28 + tuck; rz = -.22;
    }
    const armBlend = 1 - Math.exp(-14 * dt);
    rig.leftArm.rotation.x += (lx - rig.leftArm.rotation.x) * armBlend;
    rig.rightArm.rotation.x += (rx - rig.rightArm.rotation.x) * armBlend;
    rig.leftArm.rotation.y = rig.rightArm.rotation.y = 0;
    rig.leftArm.rotation.z += (lz - rig.leftArm.rotation.z) * armBlend;
    rig.rightArm.rotation.z += (rz - rig.rightArm.rotation.z) * armBlend;
    if (input.detail === "far") {
      // Keep inexpensive foot contact, omitting upper-body secondary layers.
      rig.upperBody.position.set(0,0,0);rig.upperBody.rotation.set(0,0,0);
      rig.helmet.position.y=1.46;rig.helmet.rotation.set(0,0,0);rig.backpack.rotation.set(0,0,0);
      return;
    }
    const stability = 1 - state.aim * .94;
    const idle = Math.sin(finite(input.timeSeconds) * 1.7) * .006 * (1 - activity);
    const bob = (1 - Math.cos(state.phase * 2)) * .011 * activity * (1 - state.air);
    const landing = finite(input.landingPulse) > 0 ? 0 : state.landing * .045;
    const pitch = clamp(state.forward * .008 + state.acceleration * .004, -.09, .12) * stability;
    const idleShift = Math.sin(finite(input.timeSeconds) * .85) * .004 * (1 - activity) * (1 - state.air);
    const roll = (clamp(-state.lateral * .009 - state.turn * state.speed * .003, -.11, .11) + idleShift) * stability;
    const twist = (-wave * activity * .045 + state.turn * .012 + idleShift * .4) * stability * (1 - state.air);
    rig.upperBody.rotation.set(pitch, twist, roll);
    // Rotate around the belt height while leaving the canonical bind hierarchy at identity.
    rig.upperBody.position.set(roll * .45, (idle + bob - landing) * stability, -pitch * .45);
    rig.helmet.rotation.set(-pitch * .82, -twist * .65, -roll * .85);
    rig.helmet.position.y = 1.46 - bob * .55 * stability;
    rig.backpack.rotation.set(-pitch * .16, -twist * .12, -roll * .12);
  };
  return { input, state, update, reset };
}

/** Both nodes must share the upper-body parent. Run after all action arm posing. */
export function anchorAstronautHeldItem(item: Object3D, arm: Group, pose: {
  position: readonly [number, number, number]; rotation: readonly [number, number, number]; scale: number;
}, recoil = 0): void {
  arm.updateMatrix();
  const m = arm.matrix.elements;
  item.position.set(m[12] - .61 * m[4] + pose.position[0], m[13] - .61 * m[5] + pose.position[1], m[14] - .61 * m[6] + pose.position[2] - finite(recoil) * .1);
  item.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
  item.scale.setScalar(pose.scale);
}
