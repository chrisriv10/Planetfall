import { describe, expect, it } from "vitest";
import { BALANCE, cannonPosition, repairPosition, type PlanetState, type PlayerState } from "@planetfall/shared";
import { BotBrain, createBotProfile } from "./bot.js";

const ownPlanet: PlanetState = { id: "planet-bot", ownerId: "bot", position: { x: 30, y: 0, z: 0 }, integrity: 100, alive: true, palette: 1, damageStage: 0 };
const enemyPlanet: PlanetState = { id: "planet-human", ownerId: "human", position: { x: -30, y: 0, z: 0 }, integrity: 80, alive: true, palette: 0, damageStage: 0 };

function player(position = cannonPosition(ownPlanet)): PlayerState {
  return {
    id: "bot", name: "Nova", isBot: true, color: "#fff", planetId: ownPlanet.id,
    connected: true, ready: true, alive: true, scrap: 20, position,
    velocity: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, lastInputSequence: 0
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
    let decision = brain.update({ now, phase: "playing", player: player(), ownPlanet, planets: [ownPlanet, enemyPlanet], scraps: [] });
    while (!decision.fire && now < 20_000) {
      now += 1_000;
      decision = brain.update({ now, phase: "playing", player: player(), ownPlanet, planets: [ownPlanet, enemyPlanet], scraps: [] });
    }
    expect(decision.fire?.weapon === "rocket" || decision.fire?.weapon === "asteroid").toBe(true);
    expect(decision.fire?.direction).toBeDefined();
  });

  it("walks to a repair station and repairs only after arriving", () => {
    const brain = new BotBrain("repair-seed");
    const damaged = { ...ownPlanet, integrity: 1, damageStage: 3 as const };
    const walking = brain.update({ now: 1_000, phase: "playing", player: player(), ownPlanet: damaged, planets: [damaged, enemyPlanet], scraps: [] });
    expect(walking.mode).toBe("MoveToRepair");
    expect(walking.repair).toBeUndefined();
    const arrivedPlayer = player(repairPosition(damaged));
    let now = 1_400;
    let repairing = brain.update({ now, phase: "playing", player: arrivedPlayer, ownPlanet: damaged, planets: [damaged, enemyPlanet], scraps: [] });
    while (!repairing.repair && now < 5_000) {
      now += 400;
      repairing = brain.update({ now, phase: "playing", player: arrivedPlayer, ownPlanet: damaged, planets: [damaged, enemyPlanet], scraps: [] });
    }
    expect(repairing.repair).toBe(true);
    expect(arrivedPlayer.scrap).toBeGreaterThanOrEqual(BALANCE.repair.cost);
  });
});
