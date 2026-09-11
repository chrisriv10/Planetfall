import { describe, expect, it } from "vitest";
import {
  BR_BALANCE, BR_BOT_DIFFICULTY, BR_CRATE_SOCKETS, BR_ISLAND_OUTLINE, BR_LOOT_SOCKETS, BR_MAP, BR_MAP_BLOCKS, BR_NAV_NODES, BR_POIS, BR_ROADS, BR_STORM_PHASES, BR_STRUCTURES, BR_TERRAIN_PATCHES, BR_WEAPONS, applyBrDamage, brHasStandingClearance, brMantleTopAt, brMuzzlePosition, brNextWaypoint, brPlayerHitDistance, brRarityDamage, brShipPath, isInsideBrIsland,
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

  it("builds one authored island with nine distinct connected districts and enterable structures", () => {
    expect(BR_POIS).toHaveLength(9);
    expect(BR_ISLAND_OUTLINE.length).toBeGreaterThanOrEqual(16);
    expect(BR_STRUCTURES.length).toBeGreaterThanOrEqual(60);
    expect(BR_ROADS.length).toBeGreaterThanOrEqual(16);
    expect(BR_TERRAIN_PATCHES.length).toBeGreaterThanOrEqual(BR_POIS.length);
    for (const poi of BR_POIS) {
      const structures = BR_STRUCTURES.filter((structure) => structure.districtId === poi.id);
      const blocks = BR_MAP_BLOCKS.filter((block) => block.districtId === poi.id);
      expect(structures.length).toBeGreaterThanOrEqual(3);
      expect(blocks.some((block) => block.id.endsWith("floor"))).toBe(true);
      expect(blocks.some((block) => block.id.endsWith("roof"))).toBe(true);
      expect(blocks.filter((block) => block.kind === "wall").length).toBeGreaterThanOrEqual(10);
      expect(structures.some((structure) => structure.roofAccess)).toBe(true);
      expect(isInsideBrIsland(poi.position)).toBe(true);
    }
    expect(BR_MAP_BLOCKS.filter((block)=>block.kind==="ramp").length).toBeGreaterThanOrEqual(15);
    for(const patch of BR_TERRAIN_PATCHES) expect(isInsideBrIsland(patch.position)).toBe(true);
  });

  it("keeps every district connected and places loot in authored playable structures",()=>{
    const visited=new Set<string>([BR_NAV_NODES[0].id]),queue=[BR_NAV_NODES[0].id];while(queue.length){const current=queue.shift()!;const node=BR_NAV_NODES.find((entry)=>entry.id===current)!;for(const next of node.neighbors)if(!visited.has(next)){visited.add(next);queue.push(next);}}
    expect(visited.size).toBe(BR_POIS.length);expect(BR_LOOT_SOCKETS.length).toBeGreaterThan(BR_STRUCTURES.length);expect(BR_CRATE_SOCKETS).toHaveLength(BR_POIS.length);
    for(const socket of BR_LOOT_SOCKETS){expect(isInsideBrIsland(socket.position)).toBe(true);const structure=BR_STRUCTURES.find((entry)=>entry.id===socket.structureId)!;expect(structure).toBeTruthy();expect(Math.abs(socket.position.x-structure.position.x)).toBeLessThan(structure.size.x/2);expect(Math.abs(socket.position.z-structure.position.z)).toBeLessThan(structure.size.z/2);expect(socket.position.y).toBeGreaterThan(0);}
    for(const crate of BR_CRATE_SOCKETS)expect(isInsideBrIsland(crate)).toBe(true);
    for(const target of BR_POIS.slice(1))expect(isInsideBrIsland(brNextWaypoint(BR_POIS[0].position,target.position))).toBe(true);
  });

  it("buffers and coyote-accepts exactly one jump inside bounded windows",()=>{
    const base:BrMotionState={position:{x:70,y:.4,z:70},velocity:{x:0,y:-1,z:0},yaw:0,grounded:false,crouched:false,deployment:"grounded",downed:false,lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0,lastGroundedAt:1000,jumpBufferedUntil:0};
    const coyote=stepBrMovement(base,{moveX:0,moveY:0,yaw:0,jump:true,sprint:false,crouch:false},.02,1100);expect(coyote.velocity.y).toBeGreaterThan(0);expect(coyote.jumpBufferedUntil).toBe(0);
    const held=stepBrMovement(coyote,{moveX:0,moveY:0,yaw:0,jump:true,sprint:false,crouch:false},.02,1120);expect(held.velocity.y).toBeLessThan(coyote.velocity.y);
    const expired=stepBrMovement({...base,lastGroundedAt:1000},{moveX:0,moveY:0,yaw:0,jump:true,sprint:false,crouch:false},.02,1000+BR_BALANCE.coyoteMs+1);expect(expired.velocity.y).toBeLessThan(0);
    const buffered=stepBrMovement({...base,position:{x:70,y:.04,z:70},velocity:{x:0,y:-2,z:0},lastGroundedAt:Number.NEGATIVE_INFINITY},{moveX:0,moveY:0,yaw:0,jump:true,sprint:false,crouch:false},.001,2000);
    const landed=stepBrMovement(buffered,{moveX:0,moveY:0,yaw:0,jump:false,sprint:false,crouch:false},.04,2040);expect(landed.velocity.y).toBe(BR_BALANCE.jumpSpeed);expect(landed.grounded).toBe(false);expect(landed.jumpBufferedUntil).toBe(0);
  });

  it("uses one deterministic movement step for sprint, jump, slide, and descent", () => {
    const base: BrMotionState = { position: { x: 100, y: 0, z: 100 }, velocity: { x: 0, y: 0, z: 0 }, yaw: 0, grounded: true, crouched: false, deployment: "grounded", downed: false, lastJumpSignal: false, lastCrouchSignal: false, slideEndsAt: 0, traversalCooldownUntil: 0 };
    const sprint = stepBrMovement(base, { moveX: 0, moveY: 1, yaw: 0, jump: false, sprint: true, crouch: false }, .1, 1000);
    expect(sprint.velocity.z).toBeLessThan(0); expect(Math.hypot(sprint.velocity.x, sprint.velocity.z)).toBeLessThanOrEqual(BR_BALANCE.sprintSpeed);
    const jump = stepBrMovement({ ...sprint, lastJumpSignal: false }, { moveX: 0, moveY: 1, yaw: 0, jump: true, sprint: false, crouch: false }, .05, 1050);
    expect(jump.grounded).toBe(false); expect(jump.velocity.y).toBeGreaterThan(0);
    const falling: BrMotionState = { ...base, position: { x: 80, y: 20, z: 80 }, velocity: { x: 0, y: -10, z: 0 }, grounded: false, deployment: "freefall" };
    const chute = stepBrMovement(falling, { moveX: 0, moveY: 0, yaw: 0, jump: false, sprint: false, crouch: false }, .1, 2000);
    expect(chute.deployment).toBe("chute"); expect(chute.velocity.y).toBeGreaterThanOrEqual(-BR_BALANCE.chuteSpeed);
  });

  it("requires directional, reachable mantle geometry and standing head clearance", () => {
    const cover = BR_MAP_BLOCKS.find((block) => block.kind === "cover")!;
    const feet = { x: cover.position.x, y: 0, z: cover.position.z + cover.size.z / 2 + BR_BALANCE.playerRadius + .04 };
    expect(brMantleTopAt(feet, { x: 0, y: .12, z: -.2 })).toBeCloseTo(cover.position.y + cover.size.y / 2);
    expect(brMantleTopAt(feet, { x: 0, y: .12, z: .2 })).toBeNull();
    expect(brMantleTopAt(feet, { x: 0, y: .12, z: 0 })).toBeNull();
    const ceiling = BR_MAP_BLOCKS.find((block) => block.id.includes("-deck-1-left"))!;
    const ceilingBottom = ceiling.position.y - ceiling.size.y / 2;
    const crouchedHeight = BR_BALANCE.playerRadius * 2 + .12;
    expect(brHasStandingClearance({ x: ceiling.position.x, y: ceilingBottom - crouchedHeight, z: ceiling.position.z })).toBe(false);
    expect(brHasStandingClearance({ x: ceiling.position.x, y: ceilingBottom - BR_BALANCE.playerHeight - .2, z: ceiling.position.z })).toBe(true);
  });

  it("shares finite camera aim, muzzle, body, and head hit math", () => {
    const muzzle=brMuzzlePosition({ x: 2, y: 3, z: 4 }, 0, 0);expect(muzzle.x).toBeCloseTo(2);expect(muzzle.y).toBeCloseTo(3.72);expect(muzzle.z).toBeCloseTo(3.52);
    const origin = { x: 0, y: 1.13, z: 5 }; const direction = { x: 0, y: 0, z: -1 }; const feet = { x: 0, y: 0, z: 0 };
    expect(brPlayerHitDistance(origin, direction, feet)?.headshot).toBe(true);
    expect(brPlayerHitDistance({ x: 0, y: .5, z: 5 }, direction, feet)?.headshot).toBe(false);
    expect(brPlayerHitDistance({ x: 3, y: .5, z: 5 }, direction, feet)).toBeNull();
  });
});
