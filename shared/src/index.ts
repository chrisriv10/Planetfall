export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };
export type WeaponType = "rocket" | "asteroid";
export type StructureType = "cannon" | "repair";
export type RoomPhase = "lobby" | "countdown" | "playing" | "overtime" | "results";

export const BALANCE = {
  minPlayers: 2,
  maxPlayers: 6,
  planetRadius: 8,
  arenaRadius: 30,
  playerHeight: 1.35,
  moveSpeed: 6.5,
  acceleration: 26,
  airControl: 0.35,
  jumpSpeed: 7.2,
  gravity: 18,
  burstSpeed: 10,
  burstCooldownMs: 2200,
  grappleRange: 30,
  grapplePull: 14,
  launch: { range: 3.25, cooldownMs: 5000, speed: 32, assist: 16, assistMs: 3800 },
  shove: { range: 2.2, cooldownMs: 1200, force: 9.5, lift: 4.2 },
  sabotage: { range: 3.2, channelMs: 1250, durationMs: 7000, immunityMs: 10000 },
  maxIntegrity: 100,
  startingScrap: 20,
  scrapValue: 5,
  scrapSpawnMs: 8000,
  scrapMaxPerPlanet: 6,
  matchMs: 7 * 60 * 1000,
  overtimeMs: 30 * 1000,
  reconnectGraceMs: 30 * 1000,
  inputRate: 20,
  serverRate: 30,
  snapshotRate: 15,
  interpolationMs: 100,
  repair: { cost: 10, heal: 15 },
  weapons: {
    rocket: { cost: 8, damage: 14, speed: 22, radius: 4.5, knockback: 9, cooldownMs: 900 },
    asteroid: { cost: 16, damage: 26, speed: 14, radius: 7, knockback: 16, cooldownMs: 1800 }
  }
} as const;

export const PLAYER_COLORS = ["#70f5ff", "#ff6b8a", "#ffd84d", "#9d7bff", "#63ef8b", "#ff934d"] as const;
export const PLANET_PALETTES = [
  { ground: "#39c886", accent: "#9affca", rock: "#176c61" },
  { ground: "#e58c43", accent: "#ffd17d", rock: "#7e3e35" },
  { ground: "#7dd7ed", accent: "#e5fbff", rock: "#426aa7" },
  { ground: "#7d4b6d", accent: "#ff7a48", rock: "#351f46" },
  { ground: "#91d34f", accent: "#e4ff70", rock: "#397746" },
  { ground: "#dd6de8", accent: "#70f4ff", rock: "#472d74" }
] as const;

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: string;
  planetId: string;
  connected: boolean;
  ready: boolean;
  alive: boolean;
  scrap: number;
  position: Vec3;
  velocity: Vec3;
  rotation: Quat;
  lastInputSequence: number;
  surfacePlanetId: string | null;
  launchCooldownUntil: number;
  shoveCooldownUntil: number;
}

export interface PlanetState {
  id: string;
  ownerId: string;
  position: Vec3;
  integrity: number;
  alive: boolean;
  palette: number;
  damageStage: 0 | 1 | 2 | 3;
  cannonDisabledUntil: number;
  repairDisabledUntil: number;
}

export interface ScrapState { id: string; planetId: string; position: Vec3; }

export interface ProjectileState {
  id: string;
  ownerId: string;
  weapon: WeaponType;
  position: Vec3;
  velocity: Vec3;
  spawnedAt: number;
}

export interface RoomView {
  code: string;
  hostId: string;
  phase: RoomPhase;
  players: PlayerState[];
  planets: PlanetState[];
  scraps: ScrapState[];
  countdownEndsAt: number | null;
  matchEndsAt: number | null;
  winnerId: string | null;
  rematchVotes: string[];
}

export interface PlayerInput {
  sequence: number;
  dt: number;
  moveX: number;
  moveY: number;
  cameraForward: Vec3;
  jump: boolean;
  burst: boolean;
  grapple: boolean;
  grapplePoint?: Vec3;
}

export type PlayerInteraction =
  | { action: "launch"; targetPlanetId: string }
  | { action: "shove"; targetPlayerId: string }
  | { action: "sabotage"; planetId: string; structure: StructureType; active: boolean };

export interface ServerSnapshot {
  serverTime: number;
  phase: RoomPhase;
  players: PlayerState[];
  planets: PlanetState[];
  scraps: ScrapState[];
  matchEndsAt: number | null;
}

export interface ClientToServerEvents {
  "room:create": (payload: { name: string; sessionToken?: string }, ack: (result: JoinResult) => void) => void;
  "room:solo": (payload: { name: string }, ack: (result: JoinResult) => void) => void;
  "room:join": (payload: { code: string; name: string; sessionToken?: string }, ack: (result: JoinResult) => void) => void;
  "room:ready": (payload: { ready: boolean }) => void;
  "room:bot:add": () => void;
  "room:bot:remove": (payload: { botId: string }) => void;
  "match:start": () => void;
  "player:input": (payload: PlayerInput) => void;
  "player:interact": (payload: PlayerInteraction) => void;
  "cannon:fire": (payload: { weapon: WeaponType; direction: Vec3 }) => void;
  "repair:buy": () => void;
  "match:rematch": () => void;
}

export interface ServerToClientEvents {
  "room:state": (room: RoomView) => void;
  "match:snapshot": (snapshot: ServerSnapshot) => void;
  "match:countdown": (payload: { startsAt: number }) => void;
  "projectile:spawned": (projectile: ProjectileState) => void;
  "projectile:exploded": (payload: { id: string; position: Vec3; weapon: WeaponType; planetId?: string }) => void;
  "scrap:collected": (payload: { scrapId: string; playerId: string; planetId: string; ownerId: string; position: Vec3; value: number; stolen: boolean }) => void;
  "player:launched": (payload: { playerId: string; sourcePlanetId: string; targetPlanetId: string; position: Vec3; velocity: Vec3; cooldownUntil: number }) => void;
  "player:landed": (payload: { playerId: string; planetId: string; ownerId: string; intruder: boolean }) => void;
  "player:shoved": (payload: { attackerId: string; targetId: string; planetId: string; position: Vec3; velocity: Vec3 }) => void;
  "structure:sabotaged": (payload: { playerId: string; planetId: string; ownerId: string; structure: StructureType; disabledUntil: number }) => void;
  "structure:sabotage-cancelled": (payload: { playerId: string }) => void;
  "planet:damaged": (payload: { planetId: string; integrity: number; amount: number; hit: Vec3 }) => void;
  "planet:repaired": (payload: { planetId: string; playerId: string; integrity: number; amount: number }) => void;
  "planet:destroyed": (payload: { planetId: string; ownerId: string }) => void;
  "match:ended": (payload: { winnerId: string | null; reason: "last-standing" | "timer" }) => void;
  "server:error": (payload: { message: string; code?: string }) => void;
}

export type JoinResult =
  | { ok: true; room: RoomView; playerId: string; sessionToken: string }
  | { ok: false; error: string };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
export function sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
export function scale(v: Vec3, n: number): Vec3 { return { x: v.x * n, y: v.y * n, z: v.z * n }; }
export function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
export function length(v: Vec3): number { return Math.hypot(v.x, v.y, v.z); }
export function normalize(v: Vec3): Vec3 {
  const l = length(v);
  return l > 1e-6 ? scale(v, 1 / l) : { x: 0, y: 1, z: 0 };
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
export function projectOnPlane(v: Vec3, normal: Vec3): Vec3 { return sub(v, scale(normal, dot(v, normal))); }
export function distance(a: Vec3, b: Vec3): number { return length(sub(a, b)); }

export function ballisticPosition(origin: Vec3, velocity: Vec3, ageSeconds: number): Vec3 {
  return add(origin, scale(velocity, ageSeconds));
}

export function damageStage(integrity: number): 0 | 1 | 2 | 3 {
  if (integrity <= 25) return 3;
  if (integrity <= 50) return 2;
  if (integrity <= 75) return 1;
  return 0;
}

export function sanitizeName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 18);
}

export function isFiniteVec3(value: unknown): value is Vec3 {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<Vec3>;
  return [v.x, v.y, v.z].every((n) => typeof n === "number" && Number.isFinite(n));
}

export function cannonPosition(planet: Pick<PlanetState, "position">): Vec3 {
  return add(planet.position, { x: 0, y: BALANCE.planetRadius + 1.15, z: 0 });
}

export function repairPosition(planet: Pick<PlanetState, "position">): Vec3 {
  return add(planet.position, { x: BALANCE.planetRadius + 0.8, y: 0, z: 0 });
}

export function launchPadNormal(planet: Pick<PlanetState, "position">): Vec3 {
  const inward = length(planet.position) > 0.001 ? normalize(scale(planet.position, -1)) : { x: -1, y: 0, z: 0 };
  const tangent = normalize(cross({ x: 0, y: 1, z: 0 }, inward));
  return normalize(add(scale(inward, 0.84), add(scale(tangent, 0.36), { x: 0, y: 0.42, z: 0 })));
}

export function launchPadPosition(planet: Pick<PlanetState, "position">): Vec3 {
  return add(planet.position, scale(launchPadNormal(planet), BALANCE.planetRadius + 0.7));
}

export function launchLandingPosition(source: Pick<PlanetState, "position">, target: Pick<PlanetState, "position">): Vec3 {
  return add(target.position, scale(normalize(sub(source.position, target.position)), BALANCE.planetRadius + 0.95));
}

export function launchVelocity(from: Vec3, source: Pick<PlanetState, "position">, target: Pick<PlanetState, "position">): Vec3 {
  const outward = normalize(sub(from, source.position));
  const direct = normalize(sub(launchLandingPosition(source, target), from));
  const direction = dot(direct, outward) >= 0.32
    ? direct
    : normalize(add(normalize(projectOnPlane(direct, outward)), scale(outward, 0.42)));
  return scale(direction, BALANCE.launch.speed);
}
