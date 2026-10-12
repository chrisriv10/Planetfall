import { expect, it } from "vitest";
import { brFloorHeightAt, stepBrMovement, type BrMotionState } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics";

it.each([60, 30, 20])("keeps supported Nova grade descent grounded at %i Hz on authority and prediction", frequency => {
  const authority = new BrPhysicsWorld(), prediction = new BrPredictionPhysics();
  try {
    const initial = { x: -82, y: brFloorHeightAt({ x: -82, y: 5, z: -214 }, 5) + .035, z: -214 };
    let state: BrMotionState = { position: initial, velocity: { x: 7.4, y: 0, z: 0 }, yaw: Math.PI / 2,
      grounded: true, crouched: false, deployment: "grounded", downed: false, lastJumpSignal: false,
      lastCrouchSignal: false, slideEndsAt: 0, traversalCooldownUntil: 0 };
    let predicted = structuredClone(state);
    for (let frame = 0; frame < frequency * 3 && state.position.x < -67; frame++) {
      const input = { moveX: 0, moveY: 1, yaw: Math.PI / 2, jump: false, sprint: false, crouch: false };
      state = stepBrMovement(state, input, 1 / frequency, 1000 + frame * 1000 / frequency,
        (p, d, o) => authority.move("pilot", p, d, o.jumping, o.crouched));
      predicted = stepBrMovement(predicted, input, 1 / frequency, 1000 + frame * 1000 / frequency,
        (p, d, o) => prediction.move(p, d, o.jumping, o.crouched));
      expect(state.grounded, `frame ${frame}, ${JSON.stringify(state.position)}`).toBe(true);
      expect(predicted.grounded).toBe(true);
      expect(Math.hypot(state.position.x - predicted.position.x, state.position.y - predicted.position.y,
        state.position.z - predicted.position.z)).toBeLessThan(.001);
      expect(state.position.y).toBeCloseTo(brFloorHeightAt(state.position, state.position.y + .2) + .035, 3);
    }
    expect(state.position.x).toBeGreaterThan(-67);
    expect(state.position.y).toBeCloseTo(.035, 3);
  } finally { authority.dispose(); prediction.dispose(); }
});
