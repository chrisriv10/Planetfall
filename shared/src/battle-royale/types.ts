import type { BotDifficulty, EmoteType, EquippedCosmetics, Quat, Vec3 } from "../index.js";

export type GameFamily = "planetfall" | "battle-royale";
export type BrTeamMode = "solo" | "duo" | "squad";
export type BrPhase = "lobby" | "countdown" | "ship" | "combat" | "results";
export type BrDeploymentState = "attached" | "freefall" | "chute" | "grounded" | "downed" | "eliminated";
export type BrRarity = "common" | "rare" | "epic" | "legendary";
export type BrAmmoType = "light" | "heavy" | "plasma";
export type BrWeaponId = "pulse-rifle" | "nova-smg" | "photon-shotgun" | "rail-laser" | "plasma-launcher" | "arc-blaster" | "energy-saber";
export type BrHealId = "med-patch" | "med-kit" | "shield-cell" | "shield-battery";
export type BrItemId = BrWeaponId | BrHealId;
export type BrPingType = "location" | "enemy" | "item" | "move";

export interface BrInventoryItem {
  instanceId: string;
  itemId: BrItemId;
  rarity: BrRarity;
  count: number;
  magazine: number;
}

export interface BrAmmoState { light: number; heavy: number; plasma: number; }

export interface BrPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  color: string;
  teamId: string;
  alive: boolean;
  downed: boolean;
  deployment: BrDeploymentState;
  hp: number;
  shield: number;
  downedHp: number;
  bleedoutEndsAt: number | null;
  position: Vec3;
  velocity: Vec3;
  rotation: Quat;
  yaw: number;
  pitch: number;
  grounded: boolean;
  selectedSlot: number;
  inventory: Array<BrInventoryItem | null>;
  ammo: BrAmmoState;
  lastInputSequence: number;
  kills: number;
  damageDealt: number;
  revives: number;
  placement: number | null;
  crowns: number;
  fallbucks: number;
  sessionLevel: number;
  sessionXp: number;
  sessionTotalXp: number;
  unlockedPassRewards: string[];
  ownedCosmetics: string[];
  equippedCosmetics: EquippedCosmetics;
}

/** Compact, presentation-only state sent for nearby remote players. */
export interface BrPlayerSnapshotState {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
  color: string;
  teamId: string;
  alive: boolean;
  downed: boolean;
  deployment: BrDeploymentState;
  hp: number;
  shield: number;
  downedHp: number;
  bleedoutEndsAt: number | null;
  position: Vec3;
  velocity: Vec3;
  rotation: Quat;
  yaw: number;
  pitch: number;
  grounded: boolean;
  selectedSlot: number;
  heldItem: BrInventoryItem | null;
  kills: number;
  damageDealt: number;
  revives: number;
  placement: number | null;
  equippedCosmetics: EquippedCosmetics;
}

export interface BrLootState {
  id: string;
  itemId?: BrItemId;
  ammoType?: BrAmmoType;
  rarity: BrRarity;
  count: number;
  magazine?: number;
  position: Vec3;
}

export interface BrCrateState { id: string; position: Vec3; opened: boolean; }

export interface BrProjectileState {
  id: string;
  ownerId: string;
  weaponId: "plasma-launcher" | "arc-blaster";
  rarity: BrRarity;
  position: Vec3;
  velocity: Vec3;
  spawnedAt: number;
  expiresAt: number;
}

export interface BrStormState {
  phaseIndex: number;
  center: { x: number; z: number };
  radius: number;
  nextCenter: { x: number; z: number };
  nextRadius: number;
  stage: "waiting" | "closing" | "finished";
  stageEndsAt: number | null;
  damagePerSecond: number;
}

export interface BrShipState {
  start: Vec3;
  end: Vec3;
  position: Vec3;
  startedAt: number;
  endsAt: number;
  playersAboard: number;
}

export interface BrMatchResultPlayer {
  playerId: string;
  teamId: string;
  placement: number;
  kills: number;
  damage: number;
  revives: number;
  survivalMs: number;
  xp: number;
  fallbucks: number;
}

export interface BrMatchResult {
  winningTeamId: string | null;
  players: BrMatchResultPlayer[];
  teamMode: BrTeamMode;
  durationMs: number;
}

export interface BrRoomView {
  family: "battle-royale";
  code: string;
  hostId: string;
  phase: BrPhase;
  teamMode: BrTeamMode;
  targetPlayers: 10 | 20 | 40;
  fillBots: boolean;
  botDifficulty: BotDifficulty;
  players: BrPlayerState[];
  teams: Array<{ id: string; playerIds: string[] }>;
  countdownEndsAt: number | null;
  ship: BrShipState | null;
  storm: BrStormState;
  playersRemaining: number;
  teamsRemaining: number;
  matchResult: BrMatchResult | null;
  returnVotes: string[];
  seed: number;
}

export interface BrInput {
  sequence: number;
  dt: number;
  moveX: number;
  moveY: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  fire: boolean;
  aim: boolean;
  reload: boolean;
}

export interface BrSnapshot {
  serverTime: number;
  phase: BrPhase;
  localPlayer: BrPlayerState;
  players: BrPlayerSnapshotState[];
  projectiles: BrProjectileState[];
  loot: BrLootState[];
  storm: BrStormState;
  ship: BrShipState | null;
  playersRemaining: number;
  teamsRemaining: number;
  spectatorTargetId: string | null;
}

export type BrJoinResult =
  | { ok: true; room: BrRoomView; playerId: string; sessionToken: string }
  | { ok: false; error: string };

export interface BrClientToServerEvents {
  "br:room:create": (payload: { name: string; sessionToken?: string }, ack: (result: BrJoinResult) => void) => void;
  "br:room:join": (payload: { code: string; name: string; sessionToken?: string }, ack: (result: BrJoinResult) => void) => void;
  "br:room:ready": (payload: { ready: boolean }) => void;
  "br:room:configure": (payload: { teamMode?: BrTeamMode; targetPlayers?: 10 | 20 | 40; fillBots?: boolean; botDifficulty?: BotDifficulty }) => void;
  "br:match:start": () => void;
  "br:player:input": (payload: BrInput) => void;
  "br:player:jump": () => void;
  "br:player:deploy": () => void;
  "br:inventory:select": (payload: { slot: number }) => void;
  "br:inventory:pickup": (payload: { lootId: string; replaceSlot?: number }) => void;
  "br:inventory:drop": (payload: { slot: number }) => void;
  "br:crate:open": (payload: { crateId: string }) => void;
  "br:weapon:fire": (payload: { origin: Vec3; direction: Vec3; clientTime: number }) => void;
  "br:weapon:reload": () => void;
  "br:item:use": () => void;
  "br:revive": (payload: { targetId: string; active: boolean }) => void;
  "br:spectate:cycle": (payload: { direction: -1 | 1 }) => void;
  "br:ping": (payload: { type: BrPingType; position: Vec3; itemId?: BrItemId }) => void;
  "br:emote": (payload: { emote: EmoteType; direction: Vec3 }) => void;
  "br:match:return": () => void;
  "br:shop:buy": (payload: { itemId: string }, ack: (result: { ok: boolean; error?: string }) => void) => void;
  "br:shop:equip": (payload: { itemId: string }, ack: (result: { ok: boolean; error?: string }) => void) => void;
}

export interface BrServerToClientEvents {
  "br:room:state": (room: BrRoomView) => void;
  "br:match:snapshot": (snapshot: BrSnapshot) => void;
  "br:match:countdown": (payload: { startsAt: number; seed: number }) => void;
  "br:ship:jumped": (payload: { playerId: string; position: Vec3; velocity: Vec3 }) => void;
  "br:loot:spawned": (loot: BrLootState[]) => void;
  "br:loot:removed": (payload: { ids: string[] }) => void;
  "br:crate:spawned": (crates: BrCrateState[]) => void;
  "br:crate:opened": (payload: { crateId: string; playerId: string; drops: BrLootState[] }) => void;
  "br:weapon:fired": (payload: { playerId: string; weaponId: BrWeaponId; origin: Vec3; direction: Vec3; projectile?: BrProjectileState }) => void;
  "br:player:damaged": (payload: { playerId: string; attackerId?: string; amount: number; hp: number; shield: number; direction: Vec3; shieldBroken: boolean }) => void;
  "br:player:downed": (payload: { playerId: string; attackerId?: string }) => void;
  "br:player:revived": (payload: { playerId: string; reviverId: string }) => void;
  "br:player:eliminated": (payload: { playerId: string; attackerId?: string; weaponId?: BrWeaponId; placement: number }) => void;
  "br:kill-feed": (payload: { id: string; attackerId?: string; victimId: string; weaponId?: BrWeaponId; downed: boolean; createdAt: number }) => void;
  "br:ping": (payload: { playerId: string; teamId: string; type: BrPingType; position: Vec3; itemId?: BrItemId; createdAt: number }) => void;
  "br:emote": (payload: { playerId: string; emote: EmoteType; direction: Vec3; startedAt: number }) => void;
  "br:match:ended": (result: BrMatchResult) => void;
  "br:error": (payload: { message: string; code?: string }) => void;
}
