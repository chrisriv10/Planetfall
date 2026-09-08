import { performance } from "node:perf_hooks";
import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BALANCE,
  add,
  cannonPosition,
  createMatchRules,
  distance,
  launchPadNormal,
  launchPadPosition,
  length,
  normalize,
  repairPosition,
  scale,
  type ChaosModifier,
  type Vec3
} from "@planetfall/shared";
import { GameRoom } from "./game-room.js";
import { BotBrain } from "./bot.js";

type EventCounts = Record<string, number>;
type InternalRoom = GameRoom & {
  matchStartedAt: number;
  botBrains: Map<string, { mode: string }>;
  resetMatch(): void;
};

interface SimulationMetric {
  participants: number;
  modifier: ChaosModifier | "classic";
  simulatedSeconds: number;
  averageTickMs: number;
  p95TickMs: number;
  worstTickMs: number;
  heapGrowthMb: number;
  maximumSpeed: number;
  maximumProjectiles: number;
  maximumScrap: number;
  maximumAirborneSeconds: number;
  launches: number;
  sabotages: number;
  shoves: number;
  grapplesObserved: number;
}

const rooms: GameRoom[] = [];

beforeAll(async () => { await RAPIER.init(); });
afterEach(() => {
  vi.restoreAllMocks();
  for (const room of rooms.splice(0)) room.dispose();
});

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ state >>> 15, 1 | state);
    state ^= state + Math.imul(state ^ state >>> 7, 61 | state);
    return ((state ^ state >>> 14) >>> 0) / 4294967296;
  };
}

function makeRoom(participants: number, modifier: ChaosModifier | null = null): { room: InternalRoom; humanId: string; events: EventCounts } {
  const events: EventCounts = {};
  const io = {
    to: () => ({ emit: (event: string) => { events[event] = (events[event] ?? 0) + 1; } })
  };
  const room = new GameRoom(`SOAK${participants}`, io as never) as InternalRoom;
  rooms.push(room);
  const socket = { id: `human-${participants}`, data: {}, join: () => undefined };
  const joined = room.join(socket as never, "Pilot");
  if (!joined.ok) throw new Error(joined.error);
  for (let index = 1; index < participants; index++) room.addBot(joined.playerId, false);
  let botIndex = 0;
  for (const player of room.players.values()) {
    if (player.isBot) room.botBrains.set(player.id, new BotBrain(`soak-bot-${participants}-${botIndex++}`));
  }
  room.activeModifier = modifier;
  room.rules = createMatchRules(modifier);
  room.resetMatch();
  room.phase = "playing";
  return { room, humanId: joined.playerId, events };
}

function placePlayer(player: GameRoom["players"] extends Map<string, infer T> ? T : never, position: Vec3, surfacePlanetId: string | null): void {
  player.position = { ...position };
  player.velocity = { x: 0, y: 0, z: 0 };
  player.surfacePlanetId = surfacePlanetId;
  player.gravityPlanetId = surfacePlanetId;
  player.grounded = Boolean(surfacePlanetId);
  player.body.setTranslation(position, true);
  player.body.setNextKinematicTranslation(position);
}

function percentile(values: number[], ratio: number): number {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)] ?? 0;
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runSimulation(
  participantCount: number,
  durationMs: number,
  modifier: ChaosModifier | null,
  seed: number
): SimulationMetric {
  vi.spyOn(Math, "random").mockImplementation(seededRandom(seed));
  const { room, humanId, events } = makeRoom(participantCount, modifier);
  const human = room.players.get(humanId)!;
  const ownPlanet = room.planets.get(human.planetId)!;
  const enemyPlanet = [...room.planets.values()].find((planet) => planet.ownerId !== humanId)!;
  const start = Date.now();
  room.matchStartedAt = start;
  room.matchEndsAt = start + durationMs + 60_000;
  room.lastScrapSpawn = start;

  placePlayer(human, repairPosition(enemyPlanet), enemyPlanet.id);
  ensure(room.sabotage(human.id, enemyPlanet.id, "repair", true, start), "stress sabotage did not start");

  const dt = 1 / BALANCE.serverRate;
  const tickTimes: number[] = [];
  const airborneSince = new Map<string, number>();
  const botProgress = new Map<string, { mode: string; changedAt: number; movedAt: number; position: Vec3 }>();
  let maximumSpeed = 0;
  let maximumProjectiles = 0;
  let maximumScrap = 0;
  let maximumAirborneMs = 0;
  let grapplesObserved = 0;
  let inputSequence = 0;
  const heapStart = process.memoryUsage().heapUsed;
  const totalSteps = Math.ceil(durationMs / 1000 * BALANCE.serverRate);

  for (let step = 0; step < totalSteps; step++) {
    const now = start + step * (1000 / BALANCE.serverRate);
    if (step === 45) {
      const defender = [...room.players.values()].find((player) => player.id !== human.id)!;
      const surface = add(enemyPlanet.position, { x: 0, y: BALANCE.planetRadius + .95, z: 0 });
      placePlayer(human, surface, enemyPlanet.id);
      placePlayer(defender, add(surface, { x: 1.5, y: 0, z: 0 }), enemyPlanet.id);
      human.lastInputAt = 0;
      room.setInput(human.id, {
        sequence: ++inputSequence, dt: 1 / BALANCE.inputRate, moveX: 0, moveY: 0,
        cameraForward: { x: 1, y: 0, z: 0 }, jump: false, burst: false, grapple: false
      }, now);
      ensure(room.shove(human.id, defender.id, now), "stress shove did not apply");
    }
    if (step === 60) {
      const normal = launchPadNormal(enemyPlanet);
      placePlayer(human, add(enemyPlanet.position, scale(normal, BALANCE.planetRadius + .95)), enemyPlanet.id);
      ensure(room.launch(human.id, ownPlanet.id, now), "stress launch did not start");
    }
    if (step >= 75 && step % 2 === 0) {
      const gravityPlanet = room.planets.get(human.gravityPlanetId ?? "") ?? ownPlanet;
      const anchor = cannonPosition(gravityPlanet);
      const grapple = step % 420 >= 180 && step % 420 < 240;
      human.lastInputAt = 0;
      room.setInput(human.id, {
        sequence: ++inputSequence,
        dt: 1 / BALANCE.inputRate,
        moveX: Math.sin(step * .013) * .65,
        moveY: .75,
        cameraForward: { x: 0, y: 0, z: 1 },
        jump: step % 360 === 0,
        burst: step % 510 === 0,
        grapple,
        grapplePoint: grapple ? anchor : undefined
      }, now);
    }
    if (step % 300 === 0) {
      const weapon = step % 600 === 0 ? "asteroid" : "rocket";
      room.projectiles.set(`stress-${step}`, {
        id: `stress-${step}`, ownerId: human.id, weapon,
        position: { x: 0, y: 48, z: -25 }, velocity: { x: 0, y: 0, z: BALANCE.weapons[weapon].speed }, spawnedAt: now
      });
    }

    const tickStart = performance.now();
    room.update(dt, now);
    tickTimes.push(performance.now() - tickStart);

    // This is a durability soak rather than a winner test. Prevent accumulated bot
    // damage from ending the simulation while still exercising projectile impacts.
    for (const planet of room.planets.values()) {
      if (!planet.alive) continue;
      planet.integrity = room.rules.maxIntegrity;
      planet.damageStage = modifier === "fragile-worlds" ? 1 : 0;
    }

    const alivePlanets = [...room.planets.values()].filter((planet) => planet.alive);
    const scrapIds = new Set<string>();
    const scrapCounts = new Map<string, number>();
    for (const scrap of room.scraps.values()) {
      ensure(!scrapIds.has(scrap.id), `duplicate scrap ${scrap.id}`);
      scrapIds.add(scrap.id);
      scrapCounts.set(scrap.planetId, (scrapCounts.get(scrap.planetId) ?? 0) + 1);
    }
    for (const [planetId, count] of scrapCounts) {
      ensure(room.planets.has(planetId), `scrap references missing planet ${planetId}`);
      ensure(count <= room.rules.scrapMaxPerPlanet, `scrap cap exceeded on ${planetId}: ${count}`);
    }
    maximumScrap = Math.max(maximumScrap, room.scraps.size);
    maximumProjectiles = Math.max(maximumProjectiles, room.projectiles.size);

    for (const planet of room.planets.values()) {
      ensure(Number.isFinite(planet.integrity), `non-finite integrity on ${planet.id}`);
      ensure(planet.integrity >= 0 && planet.integrity <= room.rules.maxIntegrity, `invalid integrity on ${planet.id}: ${planet.integrity}`);
      ensure(room.players.has(planet.ownerId), `planet ${planet.id} has no owner`);
    }
    for (const player of room.players.values()) {
      ensure([player.position.x, player.position.y, player.position.z, player.velocity.x, player.velocity.y, player.velocity.z].every(Number.isFinite), `non-finite player state for ${player.id}`);
      const speed = length(player.velocity);
      maximumSpeed = Math.max(maximumSpeed, speed);
      ensure(speed <= BALANCE.maxPlayerSpeed + 1e-6, `speed cap exceeded by ${player.id}: ${speed}`);
      ensure(length(player.position) <= 180, `player escaped sane arena bounds: ${player.id}`);
      ensure(player.scrap >= 0 && Number.isFinite(player.scrap), `invalid scrap for ${player.id}: ${player.scrap}`);
      if (player.alive && player.gravityPlanetId) ensure(room.planets.get(player.gravityPlanetId)?.alive, `invalid gravity owner for ${player.id}`);
      if (player.alive && player.surfacePlanetId) ensure(room.planets.get(player.surfacePlanetId)?.alive, `invalid surface owner for ${player.id}`);
      ensure(Boolean(player.launchSourcePlanetId) === Boolean(player.launchTargetPlanetId), `partial launch state for ${player.id}`);
      ensure(player.launchAssistUntil === 0 || now < player.launchAssistUntil, `expired launch state for ${player.id}`);
      for (const planet of alivePlanets) {
        ensure(distance(player.position, planet.position) >= BALANCE.planetRadius + .95 - 1e-5, `${player.id} entered collision shell ${planet.id}`);
      }
      if (player.alive && !player.surfacePlanetId) {
        const airborneStart = airborneSince.get(player.id) ?? now;
        airborneSince.set(player.id, airborneStart);
        maximumAirborneMs = Math.max(maximumAirborneMs, now - airborneStart);
        ensure(now - airborneStart < 180_000, `${player.id} remained airborne for 180 seconds`);
      } else airborneSince.delete(player.id);
      if (player.grappleAnchor) {
        grapplesObserved += 1;
        ensure(room.planets.size > 0 && length(player.velocity) <= BALANCE.grapple.speedCap + 1e-6, `grapple speed invalid for ${player.id}`);
        ensure(distance(player.position, player.grappleAnchor) <= BALANCE.grappleRange + BALANCE.maxPlayerSpeed / BALANCE.serverRate + 1e-6, `grapple range invalid for ${player.id}`);
        ensure([...room.planets.values()].some((planet) => planet.alive && Math.abs(distance(player.grappleAnchor!, planet.position) - BALANCE.planetRadius) < 2.5), `grapple anchor lost its planet for ${player.id}`);
      }
    }
    for (const projectile of room.projectiles.values()) {
      ensure(now - projectile.spawnedAt <= 12_000 + 1000 / BALANCE.serverRate, `expired projectile survived: ${projectile.id}`);
      ensure([projectile.position.x, projectile.position.y, projectile.position.z].every(Number.isFinite), `non-finite projectile ${projectile.id}`);
    }
    for (const [botId, brain] of room.botBrains) {
      const bot = room.players.get(botId)!;
      const botGravity = bot.gravityPlanetId ? room.planets.get(bot.gravityPlanetId) : undefined;
      const state = botProgress.get(botId);
      if (!state) {
        botProgress.set(botId, { mode: brain.mode, changedAt: now, movedAt: now, position: { ...bot.position } });
        continue;
      }
      if (brain.mode !== state.mode) { state.mode = brain.mode; state.changedAt = now; state.movedAt = now; }
      if (distance(bot.position, state.position) > .25) { state.position = { ...bot.position }; state.movedAt = now; }
      ensure(
        brain.mode === "Idle" || now - state.changedAt < 90_000 || now - state.movedAt < 30_000,
        `${botId} stuck in ${brain.mode}; surface=${bot.surfacePlanetId ?? "none"}; gravity=${bot.gravityPlanetId ?? "none"}; altitude=${botGravity ? (distance(bot.position, botGravity.position) - BALANCE.planetRadius).toFixed(2) : "none"}; speed=${length(bot.velocity).toFixed(3)}; launch=${bot.launchSourcePlanetId ?? "none"}->${bot.launchTargetPlanetId ?? "none"}; grapple=${bot.grappleAnchor ? distance(bot.position, bot.grappleAnchor).toFixed(2) : "none"}; position=${bot.position.x.toFixed(2)},${bot.position.y.toFixed(2)},${bot.position.z.toFixed(2)}`
      );
    }
  }

  const heapGrowthMb = (process.memoryUsage().heapUsed - heapStart) / 1024 / 1024;
  const metric: SimulationMetric = {
    participants: participantCount,
    modifier: modifier ?? "classic",
    simulatedSeconds: durationMs / 1000,
    averageTickMs: tickTimes.reduce((sum, value) => sum + value, 0) / tickTimes.length,
    p95TickMs: percentile(tickTimes, .95),
    worstTickMs: Math.max(...tickTimes),
    heapGrowthMb,
    maximumSpeed,
    maximumProjectiles,
    maximumScrap,
    maximumAirborneSeconds: maximumAirborneMs / 1000,
    launches: events["player:launched"] ?? 0,
    sabotages: events["structure:sabotaged"] ?? 0,
    shoves: events["player:shoved"] ?? 0,
    grapplesObserved
  };
  console.info("HARDENING_METRIC", JSON.stringify(metric));
  ensure(metric.averageTickMs < 2, `average tick regression: ${metric.averageTickMs.toFixed(3)} ms`);
  ensure(metric.p95TickMs < 3, `p95 tick regression: ${metric.p95TickMs.toFixed(3)} ms`);
  ensure(metric.worstTickMs < 1000, `severe tick stall: ${metric.worstTickMs.toFixed(3)} ms`);
  ensure(heapGrowthMb < 128, `excessive heap growth: ${heapGrowthMb.toFixed(1)} MB`);
  ensure(metric.launches > 0 && metric.sabotages > 0 && metric.shoves > 0, "raid actions were not exercised");
  ensure(metric.maximumProjectiles > 0 && metric.maximumScrap > 0, "projectile or scrap paths were not exercised");
  return metric;
}

describe("long-running authoritative mechanics", () => {
  it("holds invariants for 2, 4, and 6 participants over ten simulated minutes", () => {
    const results = [2, 4, 6].map((participants) => runSimulation(participants, 10 * 60_000, null, 100 + participants));
    expect(results.map((result) => result.participants)).toEqual([2, 4, 6]);
    expect(results.every((result) => result.simulatedSeconds === 600)).toBe(true);
  }, 90_000);

  it("holds invariants under every Chaos modifier for ten simulated minutes", () => {
    const modifiers: ChaosModifier[] = ["low-gravity", "scrap-rush", "fragile-worlds", "launch-party", "super-shove"];
    const results = modifiers.map((modifier, index) => runSimulation(4, 10 * 60_000, modifier, 300 + index));
    expect(results.map((result) => result.modifier)).toEqual(modifiers);
    expect(results.find((result) => result.modifier === "low-gravity")!.grapplesObserved).toBeGreaterThan(0);
    expect(results.find((result) => result.modifier === "launch-party")!.maximumSpeed).toBeLessThanOrEqual(BALANCE.maxPlayerSpeed);
    expect(results.find((result) => result.modifier === "super-shove")!.maximumSpeed).toBeLessThanOrEqual(BALANCE.maxPlayerSpeed);
    expect(results.find((result) => result.modifier === "scrap-rush")!.maximumScrap).toBeLessThanOrEqual(4 * createMatchRules("scrap-rush").scrapMaxPerPlanet);
  }, 150_000);

  it("completes and resets three solo rounds in one room", () => {
    vi.spyOn(Math, "random").mockImplementation(seededRandom(900));
    const { room, humanId } = makeRoom(4);
    const host = room.players.get(humanId)!;
    let now = Date.now();
    let simulatedSeconds = 0;
    for (let round = 1; round <= 3; round++) {
      if (room.phase === "lobby") {
        room.start(humanId);
        room.countdownStartsAt = now;
        room.update(1 / BALANCE.serverRate, now);
      }
      expect(room.phase).toBe("playing");
      room.matchStartedAt = now;
      room.matchEndsAt = now + BALANCE.matchMs;
      const hostPlanet = room.planets.get(host.planetId)!;
      let completed = false;
      const totalSteps = Math.ceil(BALANCE.matchMs / 1000 * BALANCE.serverRate) + 2;
      for (let step = 1; step <= totalSteps; step++) {
        hostPlanet.integrity = room.rules.maxIntegrity;
        for (const planet of room.planets.values()) if (planet.ownerId !== humanId && planet.alive) planet.integrity = room.rules.maxIntegrity - 1;
        room.update(1 / BALANCE.serverRate, now + step * (1000 / BALANCE.serverRate));
        if (room.phase === "results") {
          simulatedSeconds += step / BALANCE.serverRate;
          completed = true;
          break;
        }
      }
      expect(completed).toBe(true);
      expect(room.phase).toBe("results");
      expect(room.winnerId).toBe(humanId);
      expect(host.crowns).toBe(round);

      host.jumpQueuedUntil = now + 100;
      host.grappleAnchor = { ...hostPlanet.position };
      host.grappleRestLength = 4;
      host.launchSourcePlanetId = hostPlanet.id;
      host.launchTargetPlanetId = [...room.planets.values()].find((planet) => planet.id !== hostPlanet.id)!.id;
      host.launchAssistUntil = now + 100;
      host.shoveCooldownUntil = now + 100;
      host.sabotage = { planetId: host.launchTargetPlanetId, structure: "repair", startedAt: now };
      room.projectiles.set(`round-${round}`, { id: `round-${round}`, ownerId: humanId, weapon: "rocket", position: { x: 0, y: 50, z: 0 }, velocity: { x: 0, y: 0, z: 1 }, spawnedAt: now });

      room.voteRematch(humanId);
      expect(room.phase).toBe("lobby");
      expect(room.projectiles.size).toBe(0);
      expect(host).toMatchObject({
        surfacePlanetId: host.planetId, gravityPlanetId: host.planetId,
        grounded: true, jumpQueuedUntil: 0, jumpSignalActive: false, grappleAnchor: null, grappleRestLength: 0,
        launchSourcePlanetId: null, launchTargetPlanetId: null, launchAssistUntil: 0,
        launchCooldownUntil: 0, shoveCooldownUntil: 0, lastBurstAt: 0, lastFireAt: 0,
        lastRepairAt: 0, input: null, sabotage: null
      });
      expect(host.lastGroundedAt).toBeGreaterThan(0);
      expect(room.view().matchStats.every((stats) => Object.entries(stats).every(([key, value]) => key === "playerId" || value === 0))).toBe(true);
      now += BALANCE.matchMs + 100_000;
    }
    console.info("LIFECYCLE_METRIC", JSON.stringify({ participants: 4, rounds: 3, simulatedSeconds }));
    expect(simulatedSeconds).toBeGreaterThanOrEqual(BALANCE.matchMs / 1000 * 3);
  }, 30_000);
});
