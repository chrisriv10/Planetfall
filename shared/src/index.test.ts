import { describe, expect, it } from "vitest";
import { BALANCE, CHAOS_MODIFIERS, ballisticPosition, cannonPosition, createMatchRules, createMatchStats, damageStage, distance, dot, launchPadPosition, launchVelocity, normalize, projectOnPlane, repairPosition, sanitizeName, selectChaosModifier, selectMatchAwards, sub } from "./index.js";

describe("shared gameplay math", () => {
  it("projects movement onto a spherical tangent", () => {
    const normal = normalize({ x: 1, y: 2, z: -1 });
    const tangent = projectOnPlane({ x: 4, y: -3, z: 2 }, normal);
    expect(Math.abs(dot(tangent, normal))).toBeLessThan(1e-10);
  });

  it("advances event-synchronized projectiles deterministically", () => {
    expect(ballisticPosition({ x: 1, y: 2, z: 3 }, { x: 10, y: -2, z: 4 }, 0.5)).toEqual({ x: 6, y: 1, z: 5 });
  });

  it("uses the specified destruction thresholds", () => {
    expect([100, 75, 50, 25, 0].map(damageStage)).toEqual([0, 1, 2, 3, 3]);
  });

  it("sanitizes player-facing names", () => {
    expect(sanitizeName("  Nova<script>  ")).toBe("Novascript");
    expect(sanitizeName("x".repeat(30))).toHaveLength(18);
  });

  it("places launch pads deterministically away from existing infrastructure", () => {
    for (let index = 0; index < BALANCE.maxPlayers; index++) {
      const angle = index / BALANCE.maxPlayers * Math.PI * 2;
      const planet = { position: { x: Math.cos(angle) * BALANCE.arenaRadius, y: 0, z: Math.sin(angle) * BALANCE.arenaRadius } };
      const pad = launchPadPosition(planet);
      expect(launchPadPosition(planet)).toEqual(pad);
      expect(distance(pad, cannonPosition(planet))).toBeGreaterThan(4);
      expect(distance(pad, repairPosition(planet))).toBeGreaterThan(3);
    }
  });

  it("creates a fixed-speed launch that clears the source surface", () => {
    const source = { position: { x: 30, y: 0, z: 0 } };
    const target = { position: { x: -30, y: 0, z: 0 } };
    const pad = launchPadPosition(source);
    const velocity = launchVelocity(pad, source, target);
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(BALANCE.launch.speed);
    expect(dot(normalize(sub(pad, source.position)), normalize(velocity))).toBeGreaterThan(0.3);
  });

  it("initializes match statistics and selects deterministic meaningful awards", () => {
    const nova = createMatchStats("nova");
    const orbit = createMatchStats("orbit");
    expect(nova).toMatchObject({ damageDealt: 0, stolenScrap: 0, sabotagesCompleted: 0, survivalTimeMs: 0 });
    nova.damageDealt = 42;
    nova.successfulShoves = 3;
    orbit.stolenScrap = 15;
    orbit.rocketsFired = 5;
    orbit.shotsHit = 1;
    const awards = selectMatchAwards([orbit, nova], "nova", 12);
    expect(awards.map((award) => `${award.id}:${award.playerId}`)).toEqual([
      "menace:nova", "space-thief:orbit", "bully:nova", "survivor:nova"
    ]);
    expect(selectMatchAwards([createMatchStats("nova")], "nova", 100)).toEqual([]);
  });

  it("builds Classic and all five focused Chaos rule sets", () => {
    expect(createMatchRules()).toEqual({
      gravity: BALANCE.gravity, jumpSpeed: BALANCE.jumpSpeed,
      scrapSpawnMs: BALANCE.scrapSpawnMs, scrapMaxPerPlanet: BALANCE.scrapMaxPerPlanet,
      maxIntegrity: BALANCE.maxIntegrity, launchCooldownMs: BALANCE.launch.cooldownMs,
      shoveForce: BALANCE.shove.force, shoveCooldownMs: BALANCE.shove.cooldownMs
    });
    const rules = Object.fromEntries(CHAOS_MODIFIERS.map((modifier) => [modifier, createMatchRules(modifier)]));
    expect(rules["low-gravity"].gravity).toBeCloseTo(BALANCE.gravity * .65);
    expect(rules["low-gravity"].jumpSpeed).toBeGreaterThan(BALANCE.jumpSpeed);
    expect(rules["scrap-rush"]).toMatchObject({ scrapSpawnMs: 4500, scrapMaxPerPlanet: 8 });
    expect(rules["fragile-worlds"].maxIntegrity).toBe(70);
    expect(rules["launch-party"].launchCooldownMs).toBe(2250);
    expect(rules["super-shove"]).toMatchObject({ shoveForce: 14, shoveCooldownMs: 900 });
  });

  it("selects one Chaos modifier without immediately repeating", () => {
    expect(selectChaosModifier(null, () => 0)).toBe("low-gravity");
    expect(selectChaosModifier("low-gravity", () => 0)).toBe("scrap-rush");
    for (const previous of CHAOS_MODIFIERS) expect(selectChaosModifier(previous, () => .999)).not.toBe(previous);
  });
});
