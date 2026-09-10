import type { BotDifficulty } from "../index.js";
import type { BrAmmoType, BrHealId, BrRarity, BrWeaponId } from "./types.js";

export const BR_BALANCE = {
  minPlayers: 2,
  maxPlayers: 40,
  serverRate: 30,
  inputRate: 20,
  snapshotRate: 15,
  reconnectGraceMs: 30_000,
  countdownMs: 5_000,
  shipDurationMs: 42_000,
  shipHeight: 185,
  freefallSpeed: 32,
  chuteSpeed: 10,
  autoDeployHeight: 42,
  playerRadius: .45,
  playerHeight: 1.4,
  gravity: 24,
  walkSpeed: 7,
  sprintSpeed: 10.5,
  crouchSpeed: 3.5,
  acceleration: 34,
  airControl: .32,
  jumpSpeed: 8.5,
  slideInitialSpeed: 12.5,
  slideDurationMs: 850,
  mantleHeight: 1.8,
  mantleRange: 1.1,
  hp: 100,
  shield: 100,
  downedHp: 100,
  bleedoutMs: 45_000,
  reviveMs: 5_000,
  reviveHp: 30,
  reviveRange: 2.2,
  inventorySlots: 5,
  pickupRange: 2.2,
  maxRewindMs: 250,
  friendlyFire: false,
  interest: { cellSize: 50, players: 220, projectiles: 250, loot: 100 },
  matchTimeoutMs: 18 * 60_000,
  fallBoundaryY: -35
} as const;

export const BR_RARITY_MULTIPLIER: Record<BrRarity, number> = {
  common: 1,
  rare: 1.06,
  epic: 1.12,
  legendary: 1.18
};

export interface BrWeaponDefinition {
  id: BrWeaponId;
  name: string;
  role: string;
  model: "hitscan" | "projectile" | "melee";
  ammo: BrAmmoType | null;
  damage: number;
  fireIntervalMs: number;
  magazine: number;
  reloadMs: number;
  range: number;
  spread: number;
  pellets: number;
  projectileSpeed?: number;
  splashRadius?: number;
  headshotMultiplier: number;
}

export const BR_WEAPONS: Record<BrWeaponId, BrWeaponDefinition> = {
  "pulse-rifle": { id: "pulse-rifle", name: "PULSE RIFLE", role: "Balanced automatic", model: "hitscan", ammo: "light", damage: 22, fireIntervalMs: 155, magazine: 30, reloadMs: 1900, range: 170, spread: .012, pellets: 1, headshotMultiplier: 1.5 },
  "nova-smg": { id: "nova-smg", name: "NOVA SMG", role: "Close-range spray", model: "hitscan", ammo: "light", damage: 14, fireIntervalMs: 82, magazine: 32, reloadMs: 1650, range: 75, spread: .035, pellets: 1, headshotMultiplier: 1.5 },
  "photon-shotgun": { id: "photon-shotgun", name: "PHOTON SHOTGUN", role: "Close burst", model: "hitscan", ammo: "heavy", damage: 10, fireIntervalMs: 900, magazine: 5, reloadMs: 2400, range: 42, spread: .085, pellets: 8, headshotMultiplier: 1.25 },
  "rail-laser": { id: "rail-laser", name: "RAIL LASER", role: "Long-range precision", model: "hitscan", ammo: "heavy", damage: 72, fireIntervalMs: 1300, magazine: 3, reloadMs: 2800, range: 360, spread: .0015, pellets: 1, headshotMultiplier: 1.5 },
  "plasma-launcher": { id: "plasma-launcher", name: "PLASMA LAUNCHER", role: "Explosive pressure", model: "projectile", ammo: "plasma", damage: 40, fireIntervalMs: 950, magazine: 4, reloadMs: 2600, range: 180, spread: .008, pellets: 1, projectileSpeed: 32, splashRadius: 6, headshotMultiplier: 1 },
  "arc-blaster": { id: "arc-blaster", name: "ARC BLASTER", role: "Chaining disruption", model: "projectile", ammo: "plasma", damage: 24, fireIntervalMs: 360, magazine: 18, reloadMs: 2200, range: 100, spread: .018, pellets: 1, projectileSpeed: 54, splashRadius: 2.2, headshotMultiplier: 1 },
  "energy-saber": { id: "energy-saber", name: "ENERGY SABER", role: "Close melee", model: "melee", ammo: null, damage: 30, fireIntervalMs: 520, magazine: 0, reloadMs: 0, range: 2.6, spread: 0, pellets: 1, headshotMultiplier: 1 }
};

export const BR_HEALS: Record<BrHealId, { name: string; durationMs: number; hp: number; shield: number; maxStack: number }> = {
  "med-patch": { name: "MED PATCH", durationMs: 2000, hp: 25, shield: 0, maxStack: 4 },
  "med-kit": { name: "MED KIT", durationMs: 5000, hp: 100, shield: 0, maxStack: 2 },
  "shield-cell": { name: "SHIELD CELL", durationMs: 2000, hp: 0, shield: 25, maxStack: 4 },
  "shield-battery": { name: "SHIELD BATTERY", durationMs: 4000, hp: 0, shield: 50, maxStack: 2 }
};

export const BR_STORM_PHASES = [
  { waitMs: 120_000, closeMs: 90_000, radius: 330, damage: 1 },
  { waitMs: 75_000, closeMs: 75_000, radius: 235, damage: 2 },
  { waitMs: 60_000, closeMs: 60_000, radius: 160, damage: 3 },
  { waitMs: 45_000, closeMs: 50_000, radius: 95, damage: 5 },
  { waitMs: 30_000, closeMs: 40_000, radius: 45, damage: 8 },
  { waitMs: 15_000, closeMs: 30_000, radius: 9, damage: 10 }
] as const;

export const BR_STARTING_AMMO = { light: 90, heavy: 20, plasma: 12 } as const;

export interface BrBotDifficultyProfile {
  reactionMs: number;
  aimError: number;
  aggression: number;
  lootRadius: number;
  healHpBelow: number;
  reviveBias: number;
}

export const BR_BOT_DIFFICULTY: Record<BotDifficulty, BrBotDifficultyProfile> = {
  easy: { reactionMs: 850, aimError: .16, aggression: .38, lootRadius: 28, healHpBelow: 42, reviveBias: .58 },
  normal: { reactionMs: 480, aimError: .08, aggression: .58, lootRadius: 38, healHpBelow: 62, reviveBias: .78 },
  hard: { reactionMs: 260, aimError: .035, aggression: .78, lootRadius: 48, healHpBelow: 76, reviveBias: .94 }
};
