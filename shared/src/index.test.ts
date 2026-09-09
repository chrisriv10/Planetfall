import { describe, expect, it } from "vitest";
import {
  BALANCE,
  CHAOS_MODIFIERS,
  FREE_EMOTES,
  PLANET_PASS_REWARDS,
  SESSION_PROGRESSION,
  SHOP_CATALOG,
  WEAPON_ORDER,
  applyBurstVelocity,
  applyGrappleVelocity,
  applyShoveVelocity,
  ballisticPosition,
  canExecuteBufferedJump,
  cannonPosition,
  createMatchRules,
  createMatchStats,
  damageStage,
  distance,
  dot,
  explosionFalloff,
  fallbucksReward,
  isShoveTarget,
  launchGravityAcceleration,
  launchPadPosition,
  launchVelocity,
  length,
  normalize,
  projectOnPlane,
  reconciliationStrength,
  repairPosition,
  sanitizeName,
  segmentSphereHit,
  selectChaosModifier,
  selectGravityPlanetId,
  selectMatchAwards,
  sessionLevelForXp,
  sessionMatchXp,
  sessionXpInLevel,
  planetPassRewardsBetween,
  stepTangentVelocity,
  sub,
  updateGroundedState
} from "./index.js";

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

  it("keeps grounded state stable and accepts buffered or coyote jumps once", () => {
    expect(updateGroundedState(false, BALANCE.ground.enterAltitude + .01)).toBe(false);
    expect(updateGroundedState(false, BALANCE.ground.enterAltitude - .01)).toBe(true);
    expect(updateGroundedState(false, BALANCE.ground.enterAltitude - .1, 2)).toBe(false);
    expect(updateGroundedState(true, BALANCE.ground.exitAltitude - .01)).toBe(true);
    expect(updateGroundedState(true, BALANCE.ground.exitAltitude + .01)).toBe(false);
    expect(canExecuteBufferedJump(1_000, 1_050, 880, false)).toBe(true);
    expect(canExecuteBufferedJump(1_000, 999, 990, true)).toBe(false);
    expect(canExecuteBufferedJump(1_000, 1_050, 800, false)).toBe(false);
  });

  it("separates acceleration, braking, turning, and analog target speed", () => {
    const accelerated = stepTangentVelocity({ x: 0, y: 0, z: 0 }, { x: 6.5, y: 0, z: 0 }, true, true, .1);
    const analog = stepTangentVelocity({ x: 0, y: 0, z: 0 }, { x: 3.25, y: 0, z: 0 }, true, true, .1);
    const braked = stepTangentVelocity({ x: 6.5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, false, true, .1);
    const turned = stepTangentVelocity({ x: 6.5, y: 0, z: 0 }, { x: -6.5, y: 0, z: 0 }, true, true, .1);
    expect(length(accelerated)).toBeCloseTo(3.2);
    expect(length(analog)).toBeCloseTo(3.2);
    expect(length(braked)).toBeCloseTo(3.8);
    expect(turned.x).toBeCloseTo(2.5);
  });

  it("uses hysteresis for gravity ownership and blends launch gravity", () => {
    const planets = [
      { id: "a", position: { x: 0, y: 0, z: 0 }, alive: true },
      { id: "b", position: { x: 10, y: 0, z: 0 }, alive: true }
    ];
    expect(selectGravityPlanetId({ x: 5.2, y: 0, z: 0 }, planets, "a")).toBe("a");
    expect(selectGravityPlanetId({ x: 6, y: 0, z: 0 }, planets, "a")).toBe("b");
    expect(selectGravityPlanetId({ x: 5.2, y: 0, z: 0 }, planets, "a", "b")).toBe("b");
    const nearSource = launchGravityAcceleration({ x: 1, y: 0, z: 0 }, planets[0], planets[1], BALANCE.gravity);
    const nearTarget = launchGravityAcceleration({ x: 9, y: 0, z: 0 }, planets[0], planets[1], BALANCE.gravity);
    expect(nearSource.x).toBeLessThan(0);
    expect(nearTarget.x).toBeGreaterThan(0);
  });

  it("preserves swing momentum while applying bounded grapple tension", () => {
    const slack = applyGrappleVelocity({ x: 0, y: 5, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, 7, .1);
    expect(slack).toEqual({ x: 0, y: 5, z: 0 });
    const tensioned = applyGrappleVelocity({ x: 0, y: 5, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 7, .1);
    expect(tensioned.x).toBeGreaterThan(0);
    expect(tensioned.y).toBeCloseTo(5);
    expect(length(applyGrappleVelocity({ x: 0, y: 100, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 7, .1))).toBeCloseTo(BALANCE.grapple.speedCap);
  });

  it("shapes burst, shove, and explosion impulses without replacing all momentum", () => {
    expect(isShoveTarget(
      { x: 0, y: 9, z: 0 }, { x: 1.5, y: 9, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }
    )).toBe(true);
    expect(isShoveTarget(
      { x: 0, y: 9, z: 0 }, { x: -1.5, y: 9, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }
    )).toBe(false);
    const burst = applyBurstVelocity({ x: 12, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, true);
    expect(length(burst)).toBeLessThanOrEqual(BALANCE.burstSpeedCap + 2.01);
    const shoved = applyShoveVelocity({ x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, BALANCE.shove.force);
    expect(shoved.x).toBeGreaterThan(9);
    expect(shoved.y).toBeCloseTo(BALANCE.shove.lift);
    expect(shoved.z).toBeGreaterThan(1);
    expect(explosionFalloff(0, 10)).toBe(1);
    expect(explosionFalloff(7.5, 10)).toBeCloseTo(.5);
    expect(explosionFalloff(10, 10)).toBe(0);
  });

  it("detects swept projectile impacts between simulation ticks", () => {
    expect(segmentSphereHit({ x: -5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1)).toBeCloseTo(.4);
    expect(segmentSphereHit({ x: -5, y: 2, z: 0 }, { x: 5, y: 2, z: 0 }, { x: 0, y: 0, z: 0 }, 1)).toBeNull();
    expect(segmentSphereHit({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1)).toBe(0);
    expect([.02, .2, 1, 5].map(reconciliationStrength)).toEqual([0, .1, .22, 1]);
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
    expect(rules["scrap-rush"]).toMatchObject({ scrapSpawnMs: 4000, scrapMaxPerPlanet: 8 });
    expect(rules["fragile-worlds"].maxIntegrity).toBe(70);
    expect(rules["launch-party"].launchCooldownMs).toBe(2250);
    expect(rules["super-shove"]).toMatchObject({ shoveForce: 14, shoveCooldownMs: 900 });
  });

  it("selects one Chaos modifier without immediately repeating", () => {
    expect(selectChaosModifier(null, () => 0)).toBe("low-gravity");
    expect(selectChaosModifier("low-gravity", () => 0)).toBe("scrap-rush");
    for (const previous of CHAOS_MODIFIERS) expect(selectChaosModifier(previous, () => .999)).not.toBe(previous);
  });

  it("defines four distinct weapons and a bounded session-only cosmetic catalog", () => {
    expect(WEAPON_ORDER).toEqual(["rocket", "asteroid", "cluster", "gravity-bomb"]);
    expect(BALANCE.weapons.cluster.fragmentCount).toBe(5);
    expect(BALANCE.weapons.cluster.damage * BALANCE.weapons.cluster.fragmentCount).toBeLessThanOrEqual(BALANCE.weapons.asteroid.damage);
    expect(BALANCE.weapons["gravity-bomb"].damage).toBeLessThan(BALANCE.weapons.rocket.damage);
    expect(SHOP_CATALOG.filter((item) => !item.passLevel)).toHaveLength(14);
    expect(SHOP_CATALOG.filter((item) => item.passLevel)).toHaveLength(4);
    expect(new Set(SHOP_CATALOG.map((item) => item.id)).size).toBe(SHOP_CATALOG.length);
    expect(SHOP_CATALOG.filter((item) => !item.passLevel).every((item) => item.price >= 100 && item.price <= 300)).toBe(true);
    expect(SHOP_CATALOG.filter((item) => item.passLevel).every((item) => item.price === 0)).toBe(true);
    expect(FREE_EMOTES).toEqual(["wave", "point", "celebrate"]);
  });

  it("awards Fallbucks by placement without introducing another match resource", () => {
    expect([1, 2, 3, 4, 6].map(fallbucksReward)).toEqual([100, 50, 25, 10, 10]);
  });

  it("awards bounded session XP and deterministic Planet Pass levels", () => {
    expect(SESSION_PROGRESSION).toEqual({ xpPerLevel: 100, maxLevel: 10 });
    expect(sessionMatchXp(1, 8, 8)).toBe(135);
    expect(sessionMatchXp(2, 0, 0)).toBe(80);
    expect(sessionMatchXp(6, 0, 0)).toBe(40);
    expect(sessionLevelForXp(0)).toBe(1);
    expect(sessionLevelForXp(99)).toBe(1);
    expect(sessionLevelForXp(100)).toBe(2);
    expect(sessionLevelForXp(99999)).toBe(10);
    expect(sessionXpInLevel(245)).toBe(45);
    expect(sessionXpInLevel(900)).toBe(100);
    expect(planetPassRewardsBetween(1, 4).map((reward) => reward.level)).toEqual([2, 3, 4]);
    expect(PLANET_PASS_REWARDS).toHaveLength(10);
  });
});
