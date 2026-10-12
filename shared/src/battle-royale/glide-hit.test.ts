import { describe, expect, it } from "vitest";
import { BR_BALANCE } from "./balance.js";
import { brPlayerHitDistance } from "./math.js";
import { stepBrMovement, type BrCollisionResolver, type BrMotionState } from "./movement.js";

const flight = (overrides: Partial<BrMotionState> = {}): BrMotionState => ({
  position: { x: 0, y: 190, z: 0 }, velocity: { x: 0, y: -5, z: 0 }, yaw: 0,
  grounded: false, crouched: false, deployment: "freefall", downed: false,
  lastJumpSignal: false, lastCrouchSignal: false, slideEndsAt: 0, traversalCooldownUntil: 0, ...overrides
});
const input = (yaw = 0, moveY = 1) => ({ moveX: 0, moveY, yaw, jump: false, sprint: false, crouch: false });
const floor: BrCollisionResolver = (position, movement) => ({
  movement: { ...movement, y: Math.max(-position.y, movement.y) }, grounded: position.y + movement.y <= 0, ceiling: false
});

function route(legacy: boolean, early: boolean, turn = false, rate = 60) {
  let motion = flight({ deployment: early ? "chute" : "freefall" });
  let elapsed = 0, distance = 0;
  const dt = 1 / rate;
  while (motion.position.y > 0 && elapsed < 40) {
    const yaw = turn && elapsed >= 6 ? Math.PI / 2 : 0;
    const previous = motion.position;
    if (legacy) {
      const chute = motion.deployment === "chute" || motion.position.y <= 95;
      const airSpeed = chute ? 32 : 21.5;
      const blend = Math.min(1, dt * 6.5);
      const velocity = {
        x: motion.velocity.x + (Math.sin(yaw) * airSpeed - motion.velocity.x) * blend,
        y: Math.max(-(chute ? 8.5 : 32), motion.velocity.y - 24 * dt),
        z: motion.velocity.z + (-Math.cos(yaw) * airSpeed - motion.velocity.z) * blend
      };
      motion = { ...motion, deployment: chute ? "chute" : "freefall", velocity,
        position: { x: previous.x + velocity.x * dt, y: Math.max(0, previous.y + velocity.y * dt), z: previous.z + velocity.z * dt } };
    } else motion = stepBrMovement(motion, input(yaw), dt, elapsed * 1000, floor);
    distance += Math.hypot(motion.position.x - previous.x, motion.position.z - previous.z);
    elapsed += dt;
  }
  return { seconds: elapsed, path: distance, range: Math.hypot(motion.position.x, motion.position.z), x: motion.position.x, z: motion.position.z };
}

describe("Ion Wing glide", () => {
  it("transfers fast flight into bounded running momentum only on real ground contact", () => {
    for (const deployment of ["chute", "freefall"] as const) {
      const incoming = flight({ deployment, position: { x: 0, y: .01, z: 0 }, velocity: { x: 24, y: -8, z: -30 } });
      const landed = stepBrMovement(incoming, input(0, 0), 1 / 60, 1000, floor);
      expect(landed.grounded).toBe(true);
      expect(landed.deployment).toBe("grounded");
      expect(Math.hypot(landed.velocity.x, landed.velocity.z)).toBeCloseTo(BR_BALANCE.sprintSpeed);
      const airborne = stepBrMovement({ ...incoming, position: { x: 0, y: 70, z: 0 } }, input(0, 0), 1 / 60, 1000, floor);
      expect(airborne.grounded).toBe(false);
      expect(Math.hypot(airborne.velocity.x, airborne.velocity.z)).toBeGreaterThan(BR_BALANCE.sprintSpeed * 2);
    }
    const slow = stepBrMovement(flight({ deployment: "chute", position: { x: 0, y: .01, z: 0 }, velocity: { x: 3, y: -8, z: -4 } }), input(0, 0), 1 / 60, 1000, floor);
    expect(slow.velocity.x).toBeCloseTo(3); expect(slow.velocity.z).toBeCloseTo(-4);
  });
  it("brakes deployment vertically without an instantaneous velocity jump or terminal overshoot", () => {
    let state = flight({ position: { x: 0, y: 95, z: 0 }, velocity: { x: 20, y: -32, z: 0 } });
    for (let tick = 0; tick < 60; tick++) {
      const next = stepBrMovement(state, input(), 1 / 60, tick * 1000 / 60, floor);
      expect(next.velocity.y - state.velocity.y).toBeLessThanOrEqual(BR_BALANCE.chuteVerticalBraking / 60 + 1e-8);
      expect(next.velocity.y).toBeGreaterThanOrEqual(state.velocity.y);
      expect(next.velocity.y).toBeLessThanOrEqual(-BR_BALANCE.chuteSpeed);
      state = next;
    }
    expect(state.velocity.y).toBe(-BR_BALANCE.chuteSpeed);
  });

  it("banks into a ninety-degree turn and carries speed when controls are released", () => {
    const initial = flight({ deployment: "chute", velocity: { x: 0, y: -8, z: -38 } });
    let state = stepBrMovement(initial, input(Math.PI / 2), 1 / 30, 0, floor);
    expect(Math.atan2(state.velocity.x, -state.velocity.z)).toBeCloseTo(BR_BALANCE.chuteTurnRate / 30);
    expect(Math.hypot(state.velocity.x, state.velocity.z)).toBeCloseTo(38);
    for (let tick = 1; tick < 30; tick++) state = stepBrMovement(state, input(Math.PI / 2), 1 / 30, tick * 1000 / 30, floor);
    expect(state.velocity.x).toBeCloseTo(38); expect(state.velocity.z).toBeCloseTo(0);
    const released = stepBrMovement(state, input(-Math.PI / 2, 0), .1, 1100, floor);
    expect(released.velocity.x).toBeCloseTo(38); expect(released.velocity.z).toBeCloseTo(0);
  });

  it("bounds acceleration from rest and keeps freefall steering unchanged", () => {
    const next = stepBrMovement(flight({ deployment: "chute" }), input(), .1, 0, floor);
    expect(Math.hypot(next.velocity.x, next.velocity.z)).toBeCloseTo(BR_BALANCE.chuteAcceleration * .1);
    const falling = stepBrMovement(flight(), input(), .1, 0, floor);
    expect(falling.velocity.z).toBeCloseTo(-21.5 * .65);
    expect(falling.velocity.y).toBeCloseTo(-7.4);
  });

  it("preserves released momentum without adding uncommanded glide acceleration",()=>{
    for(const speed of [0,6,24,38]){
      let state=flight({deployment:"chute",velocity:{x:speed,y:-8,z:0}});
      for(let tick=0;tick<60;tick++)state=stepBrMovement(state,input(Math.PI,0),1/60,tick*1000/60,floor);
      expect(state.velocity.x).toBeCloseTo(speed);
      expect(state.velocity.z).toBeCloseTo(0);
    }
  });

  it("extends automatic and early deployment routes without stretching automatic landing time", () => {
    const metrics = [false, true].flatMap(early => [false, true].map(turn => ({
      scenario: `${early ? "early" : "auto"}${turn ? " 90-degree turn at 6s" : " straight"}`,
      old: route(true, early, turn), current: route(false, early, turn)
    })));
    for (const metric of metrics) {
      expect(metric.current.path).toBeGreaterThan(metric.old.path);
      if (!metric.scenario.startsWith("early")) expect(metric.current.seconds).toBeLessThan(16);
    }
    expect(route(false, true).range - route(false, false).range).toBeGreaterThan(300);
    const thirty = route(false, false, true, 30), sixty = route(false, false, true, 60);
    expect(Math.abs(thirty.range - sixty.range)).toBeLessThan(4);
    expect(Math.abs(thirty.seconds - sixty.seconds)).toBeLessThan(.1);
  });
});

describe("forgiving suit hit coverage", () => {
  const direction = { x: 0, y: 0, z: -1 }, feet = { x: 0, y: 0, z: 0 };
  const hit = (x: number, y: number, crouched = false, downed = false) => brPlayerHitDistance({ x, y, z: 10 }, direction, feet, crouched, downed);
  it("adds sixteen percent torso width while keeping shots beyond the suit a miss", () => {
    expect(hit(.49, .55)?.headshot).toBe(false);
    expect(hit(.501, .55)).toBeNull();
    expect(hit(0, .02)?.headshot).toBe(false);
    expect(hit(0, .96)?.headshot).toBe(false);
    expect(hit(0, -.01)).toBeNull();
    expect(hit(0, 1.3)?.headshot).toBe(false);
    expect(hit(0, 2.021)).toBeNull();
  });
  it("preserves head precision and posture-specific silhouettes", () => {
    expect(hit(0, 1.72)?.headshot).toBe(true);
    expect(hit(.299, 1.72)?.headshot).toBe(true);
    expect(hit(.301, 1.72)).toBeNull();
    expect(hit(0, 1.51, true)?.headshot).toBe(true);
    expect(hit(.49, .39, true)?.headshot).toBe(false);
    expect(hit(0, 1.811, true)).toBeNull();
    expect(hit(0, .55, false, true)?.headshot).toBe(false);
    expect(BR_BALANCE.playerRadius).toBe(.45);
    expect(BR_BALANCE.playerHeight).toBe(1.4);
  });
  it("returns actual world-ray distance for sloped shots and translated targets", () => {
    const translated = brPlayerHitDistance({ x: 5, y: 3.55, z: 20 }, direction, { x: 5, y: 3, z: 10 });
    expect(translated?.distance).toBeCloseTo(9.5);
    const d = { x: 0, y: -.1 / Math.hypot(1, .1), z: -1 / Math.hypot(1, .1) };
    const angled = brPlayerHitDistance({ x: 0, y: 1.55, z: 10 }, d, feet);
    expect(angled?.headshot).toBe(false);
    expect(angled!.distance).toBeGreaterThan(9.5); expect(angled!.distance).toBeLessThan(10.1);
  });
});
