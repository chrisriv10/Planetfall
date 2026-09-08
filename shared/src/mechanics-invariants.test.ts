import { describe, expect, it } from "vitest";
import {
  BALANCE,
  add,
  applyBurstVelocity,
  applyGrappleVelocity,
  applyLaunchGuidance,
  applyShoveVelocity,
  canExecuteBufferedJump,
  createMatchRules,
  distance,
  dot,
  explosionFalloff,
  gravityAcceleration,
  grappleRestLength,
  isShoveTarget,
  launchGravityAcceleration,
  launchPadPosition,
  launchVelocity,
  length,
  limitSpeed,
  normalize,
  scale,
  segmentSphereHit,
  selectGravityPlanetId,
  stepTangentVelocity,
  sub,
  updateGroundedState,
  type Vec3
} from "./index.js";

const finite = (vector: Vec3) => [vector.x, vector.y, vector.z].every(Number.isFinite);

describe("core mechanics invariants", () => {
  it("keeps grounded hysteresis stable without suppressing an intentional jump", () => {
    let grounded = true;
    for (const altitude of [1.17, 1.2, 1.35, 1.47, 1.3, 1.19]) {
      grounded = updateGroundedState(grounded, altitude, 0);
      expect(grounded).toBe(true);
    }
    grounded = updateGroundedState(grounded, 1.49, 0);
    expect(grounded).toBe(false);
    expect(updateGroundedState(false, 1.1, BALANCE.jumpSpeed)).toBe(false);
    expect(canExecuteBufferedJump(1000, 1100, 900, true)).toBe(true);
  });

  it("expires jump buffering and coyote time at their authoritative boundaries", () => {
    expect(canExecuteBufferedJump(1000, 1000, 1000 - BALANCE.ground.coyoteMs, false)).toBe(true);
    expect(canExecuteBufferedJump(1001, 1000, 1000, true)).toBe(false);
    expect(canExecuteBufferedJump(1000, 1100, 999 - BALANCE.ground.coyoteMs, false)).toBe(false);
  });

  it("brakes and reverses within bounded acceleration without overshooting", () => {
    let braking = { x: 6.5, y: 0, z: 0 };
    for (let step = 0; step < 60; step++) {
      const previous = braking.x;
      braking = stepTangentVelocity(braking, { x: 0, y: 0, z: 0 }, false, true, 1 / 60);
      expect(braking.x).toBeGreaterThanOrEqual(0);
      expect(braking.x).toBeLessThanOrEqual(previous);
    }
    expect(braking).toEqual({ x: 0, y: 0, z: 0 });

    const reversed = stepTangentVelocity({ x: 6.5, y: 0, z: 0 }, { x: -6.5, y: 0, z: 0 }, true, true, .1);
    expect(distance(reversed, { x: 6.5, y: 0, z: 0 })).toBeLessThanOrEqual(BALANCE.turnAcceleration * .1 + 1e-9);
    expect(length(reversed)).toBeLessThanOrEqual(BALANCE.moveSpeed);
  });

  it("scales analog movement without ever exceeding top speed", () => {
    for (const magnitude of [0, .05, .25, .5, .9, 1]) {
      let velocity = { x: 0, y: 0, z: 0 };
      const desired = { x: BALANCE.moveSpeed * magnitude, y: 0, z: 0 };
      for (let step = 0; step < 180; step++) velocity = stepTangentVelocity(velocity, desired, magnitude > 0, true, 1 / 60);
      expect(length(velocity)).toBeLessThanOrEqual(BALANCE.moveSpeed * magnitude + 1e-8);
    }
  });

  it("keeps gravity ownership stable until another planet is clearly dominant", () => {
    const planets = [
      { id: "source", position: { x: -20, y: 0, z: 0 }, alive: true },
      { id: "target", position: { x: 20, y: 0, z: 0 }, alive: true }
    ];
    expect(selectGravityPlanetId({ x: 1.9, y: 0, z: 0 }, planets, "source")).toBe("source");
    expect(selectGravityPlanetId({ x: 2.1, y: 0, z: 0 }, planets, "source")).toBe("target");
    expect(selectGravityPlanetId({ x: 19, y: 9, z: 0 }, planets, "target")).toBe("target");
    expect(gravityAcceleration({ x: -20, y: 9, z: 0 }, planets[0], BALANCE.gravity)).toEqual({ x: 0, y: -BALANCE.gravity, z: 0 });
  });

  it("keeps blended launch gravity finite and continuous", () => {
    const source = { position: { x: -30, y: 0, z: 0 } };
    const target = { position: { x: 30, y: 0, z: 0 } };
    let previous: Vec3 | null = null;
    for (let step = 0; step <= 120; step++) {
      const position = { x: -20 + step / 120 * 40, y: 4, z: 0 };
      const gravity = launchGravityAcceleration(position, source, target, BALANCE.gravity);
      expect(finite(gravity)).toBe(true);
      expect(length(gravity)).toBeLessThanOrEqual(BALANCE.gravity + 1e-8);
      if (previous) expect(distance(gravity, previous)).toBeLessThan(1.2);
      previous = gravity;
    }
  });

  it("caps repeated bursts and returns smoothly toward ordinary movement", () => {
    const outward = { x: 0, y: 1, z: 0 };
    let velocity = { x: 0, y: 0, z: 0 };
    for (let burst = 0; burst < 40; burst++) {
      velocity = applyBurstVelocity(velocity, { x: 1, y: 0, z: 0 }, outward, true);
      expect(length(velocity)).toBeLessThanOrEqual(BALANCE.burstSpeedCap + 1e-8);
    }
    let previousSpeed = length(velocity);
    for (let step = 0; step < 90; step++) {
      velocity = stepTangentVelocity(velocity, { x: BALANCE.moveSpeed, y: 0, z: 0 }, true, true, 1 / 60, step < 17);
      expect(length(velocity)).toBeLessThanOrEqual(previousSpeed + 1e-8);
      previousSpeed = length(velocity);
    }
    expect(length(velocity)).toBeCloseTo(BALANCE.moveSpeed, 6);
  });

  it("keeps grapple tension finite and velocity bounded while preserving release momentum", () => {
    const position = { x: 0, y: 0, z: 0 };
    const anchor = { x: 12, y: 0, z: 0 };
    const rest = grappleRestLength(distance(position, anchor));
    let velocity = { x: 0, y: 8, z: 0 };
    for (let step = 0; step < 3600; step++) {
      velocity = applyGrappleVelocity(velocity, position, anchor, rest, 1 / 60);
      expect(finite(velocity)).toBe(true);
      expect(length(velocity)).toBeLessThanOrEqual(BALANCE.grapple.speedCap + 1e-8);
    }
    const tangentBeforeRelease = velocity.y;
    const released = limitSpeed(velocity, BALANCE.maxPlayerSpeed);
    expect(released.y).toBeCloseTo(tangentBeforeRelease);
  });

  it("guides a launch into the target neighborhood with bounded arrival speed", () => {
    const source = { position: { x: -30, y: 0, z: 0 } };
    const target = { position: { x: 30, y: 0, z: 0 } };
    let position = launchPadPosition(source);
    let velocity = launchVelocity(position, source, target);
    let minimumTargetDistance = Infinity;
    for (let step = 0; step < Math.ceil(BALANCE.launch.assistMs / 1000 * 60); step++) {
      const dt = 1 / 60;
      velocity = add(velocity, scale(launchGravityAcceleration(position, source, target, BALANCE.gravity), dt));
      velocity = applyLaunchGuidance(velocity, position, source, target, dt);
      position = add(position, scale(velocity, dt));
      minimumTargetDistance = Math.min(minimumTargetDistance, distance(position, target.position));
      expect(finite(position) && finite(velocity)).toBe(true);
      expect(length(velocity)).toBeLessThanOrEqual(BALANCE.launch.speed * 1.12 + 1e-8);
    }
    expect(minimumTargetDistance).toBeLessThan(BALANCE.planetRadius + BALANCE.ground.exitAltitude);
  });

  it("keeps shove and explosion impulses finite and monotonic", () => {
    const attacker = { x: 0, y: 9, z: 0 };
    const target = { x: 1.5, y: 9, z: 0 };
    expect(isShoveTarget(attacker, target, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(true);
    expect(isShoveTarget(attacker, target, { x: 0, y: 0, z: 0 }, { x: -1, y: 0, z: 0 })).toBe(false);
    expect(isShoveTarget(attacker, { x: 3, y: 9, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(false);
    const classic = applyShoveVelocity({ x: 100, y: 100, z: 100 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, BALANCE.shove.force);
    const superShove = applyShoveVelocity({ x: 100, y: 100, z: 100 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, createMatchRules("super-shove").shoveForce);
    expect(finite(classic) && finite(superShove)).toBe(true);
    expect(length(classic)).toBeLessThanOrEqual(BALANCE.shove.speedCap + 1e-8);
    expect(length(superShove)).toBeLessThanOrEqual(BALANCE.shove.speedCap * 1.2 + 1e-8);
    const falloffs = [0, 2, 4, 6, 8, 10].map((distanceFromImpact) => explosionFalloff(distanceFromImpact, 10));
    expect(falloffs.every(Number.isFinite)).toBe(true);
    expect(falloffs).toEqual([...falloffs].sort((a, b) => b - a));
  });

  it("detects fast projectile crossings without duplicate segment intersections", () => {
    const hit = segmentSphereHit({ x: -100, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 8.35);
    expect(hit).not.toBeNull();
    expect(hit!).toBeGreaterThan(0);
    expect(hit!).toBeLessThan(1);
    expect(segmentSphereHit({ x: 100, y: 20, z: 0 }, { x: -100, y: 20, z: 0 }, { x: 0, y: 0, z: 0 }, 8.35)).toBeNull();
  });
});
