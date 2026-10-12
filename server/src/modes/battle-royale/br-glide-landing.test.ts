import { expect, it } from "vitest";
import { BR_BALANCE, stepBrMovement, type BrMotionState } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics";

it.each([30, 60])("dissipates wing speed at actual touchdown before coasting off Nova's raised street at %i Hz", frequency => {
  const authority = new BrPhysicsWorld(), prediction = new BrPredictionPhysics();
  try {
    let state: BrMotionState = {
      position: { x: -98.5, y: 5.24, z: -158 }, velocity: { x: 38, y: -8, z: 0 }, yaw: Math.PI / 2,
      grounded: false, crouched: false, deployment: "chute", downed: false,
      lastJumpSignal: false, lastCrouchSignal: false, slideEndsAt: 0, traversalCooldownUntil: 0
    };
    let predicted = structuredClone(state), touchdownX: number | null = null;
    for (let frame = 0; frame < frequency * 2; frame++) {
      const input = { moveX: 0, moveY: 0, yaw: Math.PI / 2, jump: false, sprint: false, crouch: false };
      state = stepBrMovement(state, input, 1 / frequency, 1000 + frame * 1000 / frequency,
        (p, d, o) => authority.move("pilot", p, d, o.jumping, o.crouched));
      predicted = stepBrMovement(predicted, input, 1 / frequency, 1000 + frame * 1000 / frequency,
        (p, d, o) => prediction.move(p, d, o.jumping, o.crouched));
      expect(Math.hypot(state.position.x - predicted.position.x, state.position.y - predicted.position.y,
        state.position.z - predicted.position.z)).toBeLessThan(.001);
      if (state.landed) {
        touchdownX ??= state.position.x;
        expect(Math.hypot(state.velocity.x, state.velocity.z)).toBeLessThanOrEqual(BR_BALANCE.sprintSpeed + 1e-8);
      }
      if (touchdownX !== null) {
        expect(state.grounded).toBe(true);
        expect(state.position.y).toBeCloseTo(5.035, 3);
        expect(state.position.x - touchdownX).toBeLessThan(1.5);
      }
    }
    expect(touchdownX).not.toBeNull();
    expect(Math.hypot(state.velocity.x, state.velocity.z)).toBe(0);
  } finally { authority.dispose(); prediction.dispose(); }
});
