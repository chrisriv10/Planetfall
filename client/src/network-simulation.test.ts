import { describe, expect, it } from "vitest";
import {
  BALANCE,
  add,
  applyBurstVelocity,
  applyGrappleVelocity,
  applyLaunchGuidance,
  applyShoveVelocity,
  cannonPosition,
  distance,
  dot,
  gravityAcceleration,
  grappleRestLength,
  launchGravityAcceleration,
  launchPadPosition,
  launchVelocity,
  length,
  limitSpeed,
  normalize,
  projectOnPlane,
  reconciliationStrength,
  scale,
  stepTangentVelocity,
  sub,
  updateGroundedState,
  type PlanetState,
  type Vec3
} from "@planetfall/shared";
import { ReconciliationTracker, interpolationAlpha, shouldAcceptSnapshot } from "./reconciliation.js";

interface NetworkCondition { name: string; latencyMs: number; jitterMs: number; inputLoss: number }
interface InputCommand { sequence: number; move: number; reverse: boolean; jump: boolean; burst: boolean; grapple: boolean }
interface SimState {
  position: Vec3;
  velocity: Vec3;
  planet: PlanetState;
  grounded: boolean;
  launchUntil: number;
  launchSource: PlanetState | null;
  launchTarget: PlanetState | null;
  grappleRest: number;
}

const SOURCE: PlanetState = {
  id: "source", ownerId: "one", position: { x: -30, y: 0, z: 0 }, integrity: 100, alive: true, palette: 0, damageStage: 0,
  cannonDisabledUntil: 0, repairDisabledUntil: 0, cannonSabotageImmuneUntil: 0, repairSabotageImmuneUntil: 0
};
const TARGET: PlanetState = { ...SOURCE, id: "target", ownerId: "two", position: { x: 30, y: 0, z: 0 }, palette: 1 };

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = state + 0x6d2b79f5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

class SimulatedLink<T> {
  private queue: { at: number; order: number; payload: T }[] = [];
  private order = 0;
  constructor(private condition: NetworkCondition, private random: () => number, private loss = 0) {}

  send(now: number, payload: T): void {
    if (this.loss > 0 && this.random() < this.loss) return;
    const jitter = (this.random() * 2 - 1) * this.condition.jitterMs;
    this.queue.push({ at: Math.max(now, now + this.condition.latencyMs + jitter), order: this.order++, payload });
  }

  receive(now: number): T[] {
    const ready = this.queue.filter((entry) => entry.at <= now).sort((a, b) => a.at - b.at || a.order - b.order);
    if (ready.length === 0) return [];
    const delivered = new Set(ready);
    this.queue = this.queue.filter((entry) => !delivered.has(entry));
    return ready.map((entry) => entry.payload);
  }
}

function cloneState(state: SimState): SimState {
  return {
    ...state, position: { ...state.position }, velocity: { ...state.velocity }, planet: state.planet,
    launchSource: state.launchSource, launchTarget: state.launchTarget
  };
}

function advance(state: SimState, input: InputCommand, dt: number, now: number): void {
  const activeLaunch = now < state.launchUntil && state.launchSource && state.launchTarget;
  if (activeLaunch) {
    state.velocity = add(state.velocity, scale(launchGravityAcceleration(state.position, state.launchSource!, state.launchTarget!, BALANCE.gravity), dt));
    state.velocity = applyLaunchGuidance(state.velocity, state.position, state.launchSource!, state.launchTarget!, dt);
    state.position = add(state.position, scale(state.velocity, dt));
    if (distance(state.position, state.launchTarget!.position) <= BALANCE.planetRadius + BALANCE.ground.enterAltitude) {
      state.planet = state.launchTarget!;
      const outward = normalize(sub(state.position, state.planet.position));
      state.position = add(state.planet.position, scale(outward, BALANCE.planetRadius + .95));
      state.velocity = projectOnPlane(state.velocity, outward);
      state.grounded = true;
      state.launchUntil = 0;
      state.launchSource = null;
      state.launchTarget = null;
    }
    return;
  }

  const outward = normalize(sub(state.position, state.planet.position));
  const forward = normalize(projectOnPlane({ x: 0, y: 0, z: input.reverse ? -1 : 1 }, outward));
  const desired = scale(forward, BALANCE.moveSpeed * input.move);
  const tangent = stepTangentVelocity(projectOnPlane(state.velocity, outward), desired, input.move > .01, state.grounded, dt);
  let radial = dot(state.velocity, outward);
  if (input.jump && state.grounded) { radial = BALANCE.jumpSpeed; state.grounded = false; }
  else if (state.grounded && radial < .5) radial = Math.min(radial, -BALANCE.ground.adhesionSpeed);
  state.velocity = add(tangent, scale(outward, radial));
  if (!input.jump) state.velocity = add(state.velocity, scale(gravityAcceleration(state.position, state.planet, BALANCE.gravity), dt));
  if (input.burst) state.velocity = applyBurstVelocity(state.velocity, forward, outward, state.grounded);
  if (input.grapple) {
    const anchor = cannonPosition(state.planet);
    if (state.grappleRest === 0) state.grappleRest = grappleRestLength(distance(state.position, anchor));
    state.velocity = applyGrappleVelocity(state.velocity, state.position, anchor, state.grappleRest, dt);
  } else state.grappleRest = 0;
  state.velocity = limitSpeed(state.velocity, BALANCE.maxPlayerSpeed);
  state.position = add(state.position, scale(state.velocity, dt));
  const nextOutward = normalize(sub(state.position, state.planet.position));
  const altitude = distance(state.position, state.planet.position) - BALANCE.planetRadius;
  if (altitude < .95) {
    state.position = add(state.planet.position, scale(nextOutward, BALANCE.planetRadius + .95));
    const inward = dot(state.velocity, nextOutward);
    if (inward < 0) state.velocity = sub(state.velocity, scale(nextOutward, inward));
  }
  state.grounded = updateGroundedState(state.grounded, distance(state.position, state.planet.position) - BALANCE.planetRadius, dot(state.velocity, nextOutward));
}

function beginLaunch(state: SimState, now: number): void {
  state.position = launchPadPosition(SOURCE);
  state.velocity = launchVelocity(state.position, SOURCE, TARGET);
  state.planet = SOURCE;
  state.grounded = false;
  state.launchUntil = now + BALANCE.launch.assistMs;
  state.launchSource = SOURCE;
  state.launchTarget = TARGET;
}

function commandAt(frame: number): InputCommand {
  const second = frame / 60;
  return {
    sequence: Math.floor(frame / 3) + 1,
    move: second % 10 < 8 ? .72 : 0,
    reverse: Math.floor(second / 6) % 2 === 1,
    jump: frame % 420 === 120,
    burst: frame % 600 === 240,
    grapple: second >= 18 && second < 22
  };
}

function runNetworkCondition(condition: NetworkCondition, seed: number) {
  const random = seeded(seed);
  const inputLink = new SimulatedLink<InputCommand>(condition, random, condition.inputLoss);
  const snapshotLink = new SimulatedLink<{ serverTime: number; state: SimState }>(condition, random);
  const eventLink = new SimulatedLink<{ kind: "launch" | "shove" | "explosion"; at: number; state?: SimState; velocity?: Vec3 }>(condition, random);
  const launchRequestLink = new SimulatedLink<true>(condition, random);
  const initial: SimState = {
    position: add(SOURCE.position, { x: 0, y: BALANCE.planetRadius + .95, z: 0 }), velocity: { x: 0, y: 0, z: 0 },
    planet: SOURCE, grounded: true, launchUntil: 0, launchSource: null, launchTarget: null, grappleRest: 0
  };
  const server = cloneState(initial);
  const client = cloneState(initial);
  let serverInput = commandAt(0);
  let clientInput = commandAt(0);
  let lastInputSequence = 0;
  let staleInputs = 0;
  let lastSnapshotTime = Number.NEGATIVE_INFINITY;
  let staleSnapshots = 0;
  let correction = { x: 0, y: 0, z: 0 };
  let remotePosition = { ...initial.position };
  let remoteTarget = { ...initial.position };
  let maximumRemoteStep = 0;
  let maximumError = 0;
  const tracker = new ReconciliationTracker();
  const totalFrames = 60 * 60;

  for (let frame = 0; frame < totalFrames; frame++) {
    const now = frame * (1000 / 60);
    if (frame % 3 === 0) {
      clientInput = commandAt(frame);
      inputLink.send(now, { ...clientInput });
    } else clientInput = { ...clientInput, jump: false, burst: false };

    for (const command of inputLink.receive(now)) {
      if (command.sequence <= lastInputSequence) { staleInputs += 1; continue; }
      lastInputSequence = command.sequence;
      serverInput = { ...command };
    }

    if (frame === 28 * 60) launchRequestLink.send(now, true);
    for (const _request of launchRequestLink.receive(now)) {
      if (server.launchUntil === 0 && server.planet.id === SOURCE.id) {
        beginLaunch(server, now);
        eventLink.send(now, { kind: "launch", at: now, state: cloneState(server) });
      }
    }
    if (frame === 40 * 60) {
      server.velocity = applyShoveVelocity(server.velocity, { x: 1, y: 0, z: 0 }, normalize(sub(server.position, server.planet.position)), BALANCE.shove.force);
      eventLink.send(now, { kind: "shove", at: now, velocity: { ...server.velocity } });
    }
    if (frame === 45 * 60) {
      server.velocity = limitSpeed(add(server.velocity, { x: 7, y: 5, z: 0 }), BALANCE.maxPlayerSpeed);
      eventLink.send(now, { kind: "explosion", at: now, velocity: { ...server.velocity } });
    }

    for (const event of eventLink.receive(now)) {
      if (event.kind === "launch" && event.state) Object.assign(client, cloneState(event.state));
      else if (event.velocity) client.velocity = { ...event.velocity };
    }

    advance(client, clientInput, 1 / 60, now);
    client.position = add(client.position, correction);
    correction = scale(correction, .72);

    if (frame % 2 === 0) {
      advance(server, serverInput, 1 / 30, now);
      serverInput = { ...serverInput, jump: false, burst: false };
    }
    if (frame % 4 === 0) snapshotLink.send(now, { serverTime: now, state: cloneState(server) });
    for (const snapshot of snapshotLink.receive(now)) {
      if (!shouldAcceptSnapshot(lastSnapshotTime, snapshot.serverTime)) { staleSnapshots += 1; continue; }
      lastSnapshotTime = snapshot.serverTime;
      remoteTarget = { ...snapshot.state.position };
      const delta = sub(snapshot.state.position, client.position);
      const error = length(delta);
      maximumError = Math.max(maximumError, error);
      const strength = reconciliationStrength(error);
      if (strength > 0) tracker.record(error, strength >= 1, now);
      if (strength >= 1) { client.position = { ...snapshot.state.position }; correction = { x: 0, y: 0, z: 0 }; }
      else if (strength > 0) correction = scale(delta, strength);
      client.velocity = add(scale(client.velocity, 1 - (.06 + strength * .18)), scale(snapshot.state.velocity, .06 + strength * .18));
    }

    const previousRemote = { ...remotePosition };
    const alpha = interpolationAlpha(1 / 60, 8);
    remotePosition = add(remotePosition, scale(sub(remoteTarget, remotePosition), alpha));
    maximumRemoteStep = Math.max(maximumRemoteStep, distance(previousRemote, remotePosition));
    const up = normalize(sub(remotePosition, server.planet.position));
    expect([client.position, client.velocity, server.position, server.velocity, remotePosition, up].flatMap((value) => [value.x, value.y, value.z]).every(Number.isFinite)).toBe(true);
    expect(length(client.velocity)).toBeLessThanOrEqual(BALANCE.maxPlayerSpeed + 1e-6);
    expect(length(server.velocity)).toBeLessThanOrEqual(BALANCE.maxPlayerSpeed + 1e-6);
  }

  const metrics = tracker.summary(60_000, 60_000);
  const result = {
    condition: condition.name,
    averageCorrection: metrics.averageCorrection,
    p95Correction: metrics.p95Correction,
    maximumCorrection: metrics.maximumCorrection,
    snapCount: metrics.snapCount,
    correctionsPerMinute: metrics.correctionsPerMinute,
    maximumObservedError: maximumError,
    maximumRemoteStep,
    acceptedInputSequence: lastInputSequence,
    staleInputs,
    staleSnapshots
  };
  console.info("NETWORK_METRIC", JSON.stringify(result));
  expect(result.maximumObservedError).toBeLessThan(20);
  expect(result.maximumRemoteStep).toBeLessThan(6);
  expect(result.acceptedInputSequence).toBeGreaterThan(1000);
  expect(Object.values(result).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
  return result;
}

describe("deterministic network and reconciliation simulation", () => {
  it("remains finite and bounded from good Wi-Fi through 200 ms stress", () => {
    const conditions: NetworkCondition[] = [
      { name: "good", latencyMs: 20, jitterMs: 2, inputLoss: 0 },
      { name: "typical-wifi", latencyMs: 60, jitterMs: 20, inputLoss: 0 },
      { name: "poor", latencyMs: 120, jitterMs: 40, inputLoss: .03 },
      { name: "very-poor", latencyMs: 200, jitterMs: 60, inputLoss: .06 }
    ];
    const results = conditions.map((condition, index) => runNetworkCondition(condition, 700 + index));
    expect(results[0].p95Correction).toBeLessThanOrEqual(results.at(-1)!.p95Correction + 1e-8);
    expect(results[0].snapCount).toBeLessThanOrEqual(results.at(-1)!.snapCount);
  }, 30_000);
});
