import { describe, expect, it } from "vitest";
import {
  BR_BALANCE, BR_BOT_DIFFICULTY, BR_MAP, BR_MAP_BLOCKS, BR_POIS, BR_STORM_PHASES, BR_WEAPONS, applyBrDamage, brRarityDamage, brShipPath,
  createEmptyBrInventory, raySphereDistance, reloadBrItem, stepBrMovement, stormContains, type BrInventoryItem, type BrMotionState
} from "./index.js";

describe("Battle Royale shared rules", () => {
  it("applies combat damage to Shield before HP and storm damage directly to HP", () => {
    expect(applyBrDamage(100, 25, 50)).toEqual({ hp: 75, shield: 0, hpDamage: 25, shieldDamage: 25, shieldBroken: true });
    expect(applyBrDamage(100, 25, 50, true)).toEqual({ hp: 50, shield: 25, hpDamage: 50, shieldDamage: 0, shieldBroken: false });
  });

  it("keeps rarity scaling bounded and every weapon mechanically defined", () => {
    for (const weapon of Object.values(BR_WEAPONS)) {
      expect(weapon.damage).toBeGreaterThan(0);
      expect(weapon.fireIntervalMs).toBeGreaterThan(0);
      expect(brRarityDamage(weapon.id, "legendary") / brRarityDamage(weapon.id, "common")).toBeCloseTo(1.18);
    }
  });

  it("reloads only the available ammunition into a magazine", () => {
    const item: BrInventoryItem = { instanceId: "x", itemId: "pulse-rifle", rarity: "common", count: 1, magazine: 24 };
    const ammo = { light: 4, heavy: 0, plasma: 0 };
    expect(reloadBrItem(item, ammo)).toBe(4);
    expect(item.magazine).toBe(28);
    expect(ammo.light).toBe(0);
    expect(createEmptyBrInventory()).toEqual([null, null, null, null, null]);
  });

  it("generates a ship route crossing the playable island", () => {
    for (const seed of [1, 42, 99_123]) {
      const route = brShipPath(seed);
      expect(Math.hypot(route.start.x, route.start.z)).toBeGreaterThan(BR_MAP.radius);
      expect(Math.hypot(route.end.x, route.end.z)).toBeGreaterThan(BR_MAP.radius);
      const midpoint = { x: (route.start.x + route.end.x) / 2, z: (route.start.z + route.end.z) / 2 };
      expect(Math.hypot(midpoint.x, midpoint.z)).toBeLessThan(BR_MAP.radius);
    }
  });

  it("validates storm containment and ray intersections deterministically", () => {
    const storm = { phaseIndex: 0, center: { x: 0, z: 0 }, radius: 100, nextCenter: { x: 0, z: 0 }, nextRadius: BR_STORM_PHASES[0].radius, stage: "waiting" as const, stageEndsAt: null, damagePerSecond: 1 };
    expect(stormContains(storm, { x: 99, y: 4, z: 0 })).toBe(true);
    expect(stormContains(storm, { x: 101, y: 4, z: 0 })).toBe(false);
    expect(raySphereDistance({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 1)).toBeCloseTo(9);
    expect(raySphereDistance({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, 1)).toBeNull();
    expect(BR_BALANCE.maxPlayers).toBe(40);
  });

  it("keeps bot difficulty bounded without changing authoritative rules", () => {
    expect(BR_BOT_DIFFICULTY.easy.reactionMs).toBeGreaterThan(BR_BOT_DIFFICULTY.normal.reactionMs);
    expect(BR_BOT_DIFFICULTY.normal.reactionMs).toBeGreaterThan(BR_BOT_DIFFICULTY.hard.reactionMs);
    expect(BR_BOT_DIFFICULTY.easy.aimError).toBeGreaterThan(BR_BOT_DIFFICULTY.hard.aimError);
    expect(BR_BOT_DIFFICULTY.hard.aggression).toBeLessThan(1);
  });

  it("builds nine deterministic POIs with open landmark shells and rooftop access", () => {
    expect(BR_POIS).toHaveLength(9);
    for (const poi of BR_POIS) {
      const blocks = BR_MAP_BLOCKS.filter((block) => block.id.startsWith(`${poi.id}-`));
      expect(blocks.some((block) => block.id.endsWith("floor"))).toBe(true);
      expect(blocks.some((block) => block.id.endsWith("roof"))).toBe(true);
      expect(blocks.filter((block) => block.kind === "ramp")).toHaveLength(11);
      expect(blocks.filter((block) => block.id.includes("wall-front"))).toHaveLength(2);
    }
  });

  it("uses one deterministic movement step for sprint, jump, slide, and descent", () => {
    const base: BrMotionState = { position: { x: 100, y: 0, z: 100 }, velocity: { x: 0, y: 0, z: 0 }, yaw: 0, grounded: true, deployment: "grounded", downed: false, lastJumpSignal: false, lastCrouchSignal: false, slideEndsAt: 0, traversalCooldownUntil: 0 };
    const sprint = stepBrMovement(base, { moveX: 0, moveY: 1, yaw: 0, jump: false, sprint: true, crouch: false }, .1, 1000);
    expect(sprint.velocity.z).toBeLessThan(0); expect(Math.hypot(sprint.velocity.x, sprint.velocity.z)).toBeLessThanOrEqual(BR_BALANCE.sprintSpeed);
    const jump = stepBrMovement({ ...sprint, lastJumpSignal: false }, { moveX: 0, moveY: 1, yaw: 0, jump: true, sprint: false, crouch: false }, .05, 1050);
    expect(jump.grounded).toBe(false); expect(jump.velocity.y).toBeGreaterThan(0);
    const falling: BrMotionState = { ...base, position: { x: 80, y: 20, z: 80 }, velocity: { x: 0, y: -10, z: 0 }, grounded: false, deployment: "freefall" };
    const chute = stepBrMovement(falling, { moveX: 0, moveY: 0, yaw: 0, jump: false, sprint: false, crouch: false }, .1, 2000);
    expect(chute.deployment).toBe("chute"); expect(chute.velocity.y).toBeGreaterThanOrEqual(-BR_BALANCE.chuteSpeed);
  });
});
