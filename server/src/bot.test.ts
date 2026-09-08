import { describe, expect, it } from "vitest";
import { BALANCE, cannonPosition, createMatchRules, distance, launchPadPosition, repairPosition, type PlanetState, type PlayerState } from "@planetfall/shared";
import { BotBrain, createBotProfile } from "./bot.js";

const ownPlanet: PlanetState = { id: "planet-bot", ownerId: "bot", position: { x: 30, y: 0, z: 0 }, integrity: 100, alive: true, palette: 1, damageStage: 0, cannonDisabledUntil: 0, repairDisabledUntil: 0 };
const enemyPlanet: PlanetState = { id: "planet-human", ownerId: "human", position: { x: -30, y: 0, z: 0 }, integrity: 80, alive: true, palette: 0, damageStage: 0, cannonDisabledUntil: 0, repairDisabledUntil: 0 };

function player(position = cannonPosition(ownPlanet)): PlayerState {
  return {
    id: "bot", name: "Nova", isBot: true, color: "#fff", planetId: ownPlanet.id,
    connected: true, ready: true, alive: true, scrap: 20, position,
    velocity: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, lastInputSequence: 0,
    surfacePlanetId: ownPlanet.id, gravityPlanetId: ownPlanet.id, launchCooldownUntil: 0, shoveCooldownUntil: 0, crowns: 0
  };
}

describe("BotBrain", () => {
  it("creates deterministic, intentionally imperfect profiles", () => {
    expect(createBotProfile("Nova")).toEqual(createBotProfile("Nova"));
    const profile = createBotProfile("Orbit");
    expect(profile.aggression).toBeGreaterThanOrEqual(.45);
    expect(profile.aggression).toBeLessThanOrEqual(.75);
    expect(profile.aimErrorRadians).toBeGreaterThan(0);
    expect(profile.reactionMs).toBeGreaterThanOrEqual(850);
  });

  it("waits before firing and spends only an affordable weapon", () => {
    const brain = new BotBrain("attack-seed");
    let now = 1_000;
    let decision = brain.update({ now, phase: "playing", player: player(), ownPlanet, surfacePlanet: ownPlanet, planets: [ownPlanet, enemyPlanet], players: [player()], scraps: [], rules: createMatchRules(), activeModifier: null });
    while (!decision.fire && now < 20_000) {
      now += 1_000;
      decision = brain.update({ now, phase: "playing", player: player(), ownPlanet, surfacePlanet: ownPlanet, planets: [ownPlanet, enemyPlanet], players: [player()], scraps: [], rules: createMatchRules(), activeModifier: null });
    }
    expect(decision.fire?.weapon === "rocket" || decision.fire?.weapon === "asteroid").toBe(true);
    expect(decision.fire?.direction).toBeDefined();
  });

  it("walks to a repair station and repairs only after arriving", () => {
    const brain = new BotBrain("repair-seed");
    const damaged = { ...ownPlanet, integrity: 1, damageStage: 3 as const };
    const walking = brain.update({ now: 1_000, phase: "playing", player: player(), ownPlanet: damaged, surfacePlanet: damaged, planets: [damaged, enemyPlanet], players: [player()], scraps: [], rules: createMatchRules(), activeModifier: null });
    expect(walking.mode).toBe("MoveToRepair");
    expect(walking.repair).toBeUndefined();
    const arrivedPlayer = player(repairPosition(damaged));
    let now = 1_400;
    let repairing = brain.update({ now, phase: "playing", player: arrivedPlayer, ownPlanet: damaged, surfacePlanet: damaged, planets: [damaged, enemyPlanet], players: [arrivedPlayer], scraps: [], rules: createMatchRules(), activeModifier: null });
    while (!repairing.repair && now < 5_000) {
      now += 400;
      repairing = brain.update({ now, phase: "playing", player: arrivedPlayer, ownPlanet: damaged, surfacePlanet: damaged, planets: [damaged, enemyPlanet], players: [arrivedPlayer], scraps: [], rules: createMatchRules(), activeModifier: null });
    }
    expect(repairing.repair).toBe(true);
    expect(arrivedPlayer.scrap).toBeGreaterThanOrEqual(BALANCE.repair.cost);
  });

  it("occasionally raids, seeks enemy scrap, and returns through a launch pad", () => {
    const brain = new BotBrain("raid-seed");
    const raider = player(launchPadPosition(ownPlanet));
    raider.scrap = 0;
    let now = 1_000;
    let decision = brain.update({ now, phase: "playing", player: raider, ownPlanet, surfacePlanet: ownPlanet, planets: [ownPlanet, enemyPlanet], players: [raider], scraps: [], rules: createMatchRules(), activeModifier: null });
    while (!decision.launchTargetId && now < 120_000) {
      now += 1_000;
      decision = brain.update({ now, phase: "playing", player: raider, ownPlanet, surfacePlanet: ownPlanet, planets: [ownPlanet, enemyPlanet], players: [raider], scraps: [], rules: createMatchRules(), activeModifier: null });
    }
    expect(decision.launchTargetId).toBe(enemyPlanet.id);

    const invaded = { ...raider, position: launchPadPosition(enemyPlanet), surfacePlanetId: enemyPlanet.id };
    const enemyScrap = { id: "enemy-scrap", planetId: enemyPlanet.id, position: repairPosition(enemyPlanet) };
    const stealing = brain.update({ now: now + 2_000, phase: "playing", player: invaded, ownPlanet, surfacePlanet: enemyPlanet, planets: [ownPlanet, enemyPlanet], players: [invaded], scraps: [enemyScrap], rules: createMatchRules(), activeModifier: null });
    expect(stealing.mode).toBe("SeekScrap");

    const returning = brain.update({ now: now + 20_000, phase: "playing", player: invaded, ownPlanet, surfacePlanet: enemyPlanet, planets: [ownPlanet, enemyPlanet], players: [invaded], scraps: [], rules: createMatchRules(), activeModifier: null });
    expect(returning.mode).toBe("MoveToLaunch");
  });

  it("recovers toward the authoritative gravity owner instead of fighting it", () => {
    const brain = new BotBrain("recovery-seed");
    const stranded = player({ x: 0, y: 0, z: 0 });
    stranded.surfacePlanetId = null;
    stranded.gravityPlanetId = ownPlanet.id;
    const decision = brain.update({
      now: 10_000, phase: "playing", player: stranded, ownPlanet,
      planets: [enemyPlanet, ownPlanet], players: [stranded], scraps: [],
      rules: createMatchRules(), activeModifier: null
    });
    expect(decision.mode).toBe("Recover");
    expect(decision.input.grapple).toBe(true);
    expect(decision.input.grapplePoint).toBeDefined();
    expect(Math.abs(distance(decision.input.grapplePoint!, ownPlanet.position) - BALANCE.planetRadius)).toBeLessThan(1e-8);
  });
});
