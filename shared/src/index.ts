import type { BrClientToServerEvents, BrServerToClientEvents } from "./battle-royale/types.js";
export * from "./battle-royale/index.js";

export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };
export type WeaponType = "rocket" | "asteroid" | "cluster" | "gravity-bomb";
export type StructureType = "cannon" | "repair";
export type RoomPhase = "lobby" | "countdown" | "playing" | "overtime" | "results";
export type GameMode = "classic" | "chaos";
export type ChaosModifier = "low-gravity" | "scrap-rush" | "fragile-worlds" | "launch-party" | "super-shove";
export type BotDifficulty = "easy" | "normal" | "hard";
export type EmoteType = "wave" | "laugh" | "point" | "panic" | "taunt" | "celebrate";
export type ScrapUtility = "shield" | "overcharge" | "launch-boost";
export type CosmeticCategory = "suit" | "trail" | "emote" | "victory";

export interface EquippedCosmetics {
  suit: string;
  trail: string;
  victory: string;
}

export interface ShopItem {
  id: string;
  name: string;
  category: CosmeticCategory;
  price: number;
  color?: string;
  emote?: EmoteType;
  passLevel?: number;
}

export interface PlanetPassReward {
  id: string;
  level: number;
  label: string;
  fallbucks?: number;
  cosmeticId?: string;
  badge?: string;
}

export const FREE_EMOTES: readonly EmoteType[] = ["wave", "point", "celebrate"];
export const DEFAULT_COSMETICS: EquippedCosmetics = { suit: "default", trail: "default", victory: "default" };
export const SHOP_CATALOG: readonly ShopItem[] = [
  { id: "solar-gold", name: "Solar Gold", category: "suit", price: 100, color: "#ffd84d" },
  { id: "ice-blue", name: "Ice Blue", category: "suit", price: 100, color: "#70f5ff" },
  { id: "nebula-purple", name: "Nebula Purple", category: "suit", price: 200, color: "#b67cff" },
  { id: "ember-orange", name: "Ember Orange", category: "suit", price: 100, color: "#ff934d" },
  { id: "comet", name: "Comet", category: "trail", price: 100, color: "#70f5ff" },
  { id: "sparks", name: "Sparks", category: "trail", price: 100, color: "#ffd84d" },
  { id: "bubbles", name: "Bubbles", category: "trail", price: 200, color: "#ff8bd9" },
  { id: "stardust", name: "Stardust", category: "trail", price: 300, color: "#b67cff" },
  { id: "laugh", name: "Laugh", category: "emote", price: 100, emote: "laugh" },
  { id: "panic", name: "Panic", category: "emote", price: 100, emote: "panic" },
  { id: "taunt", name: "Taunt", category: "emote", price: 200, emote: "taunt" },
  { id: "hero", name: "Hero", category: "victory", price: 100 },
  { id: "spin", name: "Spin", category: "victory", price: 200 },
  { id: "double-pump", name: "Double Fist Pump", category: "victory", price: 200 },
  { id: "ion-blue", name: "Ion Blue", category: "trail", price: 0, color: "#55dfff", passLevel: 3 },
  { id: "solar-visor", name: "Solar Visor", category: "suit", price: 0, color: "#ffe66b", passLevel: 5 },
  { id: "warp-spark", name: "Warp Spark", category: "trail", price: 0, color: "#ff79e6", passLevel: 7 },
  { id: "ace", name: "Ace", category: "victory", price: 0, passLevel: 9 }
];

export const SESSION_PROGRESSION = { xpPerLevel: 100, maxLevel: 10 } as const;
export const PLANET_PASS_REWARDS: readonly PlanetPassReward[] = [
  { id: "default", level: 1, label: "READY FOR LAUNCH" },
  { id: "bucks-50", level: 2, label: "+50 FALLBUCKS", fallbucks: 50 },
  { id: "ion-blue", level: 3, label: "ION BLUE TRAIL", cosmeticId: "ion-blue" },
  { id: "bucks-75", level: 4, label: "+75 FALLBUCKS", fallbucks: 75 },
  { id: "solar-visor", level: 5, label: "SOLAR VISOR", cosmeticId: "solar-visor" },
  { id: "bucks-100", level: 6, label: "+100 FALLBUCKS", fallbucks: 100 },
  { id: "warp-spark", level: 7, label: "WARP SPARK TRAIL", cosmeticId: "warp-spark" },
  { id: "bucks-125", level: 8, label: "+125 FALLBUCKS", fallbucks: 125 },
  { id: "ace", level: 9, label: "ACE VICTORY POSE", cosmeticId: "ace" },
  { id: "ace-pilot", level: 10, label: "+200 FALLBUCKS · ACE PILOT", fallbucks: 200, badge: "ACE PILOT" }
];

export interface MatchRules {
  gravity: number;
  jumpSpeed: number;
  scrapSpawnMs: number;
  scrapMaxPerPlanet: number;
  maxIntegrity: number;
  launchCooldownMs: number;
  shoveForce: number;
  shoveCooldownMs: number;
}

export const BALANCE = {
  minPlayers: 2,
  maxPlayers: 6,
  planetRadius: 8,
  arenaRadius: 30,
  playerHeight: 1.35,
  moveSpeed: 6.5,
  acceleration: 32,
  braking: 27,
  turnAcceleration: 40,
  airControl: 0.35,
  jumpSpeed: 7.2,
  gravity: 18,
  burstSpeed: 10,
  burstCooldownMs: 2200,
  burstRecoveryMs: 280,
  burstSpeedCap: 17.5,
  maxPlayerSpeed: 40,
  ground: { enterAltitude: 1.18, exitAltitude: 1.48, detachAltitude: 1.8, coyoteMs: 130, jumpBufferMs: 140, adhesionSpeed: 0.7 },
  gravitySwitchRatio: 0.82,
  softBoundaryRadius: 105,
  softBoundaryPull: 7,
  grappleRange: 30,
  playerGrapple: { range: 11, facingDot: 0.965, reciprocal: 0.16, maxDurationMs: 4200 },
  grapple: { reelRatio: 0.74, minRestLength: 3, spring: 3.2, damping: 2.4, basePull: 3, maxForce: 32, speedCap: 38 },
  launch: { range: 3.25, cooldownMs: 5000, speed: 32, assist: 13, assistMs: 4200, arrivalRadius: 8, arrivalSpeed: 19 },
  shove: { range: 2.2, networkRangeTolerance: 0.45, cooldownMs: 1200, force: 9.5, lift: 4.2, facingDot: 0.2, speedCap: 23 },
  sabotage: { range: 3.2, cancelRange: 3.55, channelMs: 1250, durationMs: 7000, immunityMs: 10000 },
  emoteCooldownMs: 1800,
  burstBump: { range: 1.35, activeMs: 260, perTargetCooldownMs: 850, force: 3.6, lift: 1.25 },
  maxIntegrity: 100,
  startingScrap: 20,
  scrapValue: 5,
  scrapPickupRadius: 2.05,
  scrapSpawnMs: 6500,
  scrapMaxPerPlanet: 6,
  cannonRange: 5,
  matchMs: 7 * 60 * 1000,
  overtimeMs: 30 * 1000,
  reconnectGraceMs: 30 * 1000,
  inputRate: 20,
  serverRate: 30,
  snapshotRate: 15,
  interpolationMs: 100,
  repair: { cost: 10, heal: 15, range: 4 },
  utilities: {
    shield: { cost: 15, durationMs: 6000, cooldownMs: 12000, damageReduction: 0.38, range: 4 },
    overcharge: { cost: 10, durationMs: 8000, speedMultiplier: 1.2, range: 5 },
    launchBoost: { cost: 5, durationMs: 10000, speedMultiplier: 1.12, assistBonusMs: 800, range: 3.25 }
  },
  weapons: {
    rocket: { cost: 8, damage: 14, speed: 22, radius: 4.5, knockback: 9, cooldownMs: 900 },
    asteroid: { cost: 16, damage: 26, speed: 14, radius: 7, knockback: 16, cooldownMs: 1800 },
    cluster: { cost: 14, damage: 5, speed: 18, radius: 3.6, knockback: 7, cooldownMs: 1400, burstMs: 900, fragmentCount: 5, fragmentSpeed: 15 },
    "gravity-bomb": { cost: 12, damage: 7, speed: 17, radius: 7.5, knockback: 14, cooldownMs: 1500 }
  }
} as const;

export const WEAPON_ORDER: readonly WeaponType[] = ["rocket", "asteroid", "cluster", "gravity-bomb"];
export const WEAPON_COPY: Record<WeaponType, { name: string; role: string }> = {
  rocket: { name: "BASIC ROCKET", role: "Fast and precise" },
  asteroid: { name: "HEAVY ASTEROID", role: "Heavy damage" },
  cluster: { name: "CLUSTER BOMB", role: "Area pressure" },
  "gravity-bomb": { name: "GRAVITY BOMB", role: "Pulls nearby pilots" }
};

export const CHAOS_MODIFIERS: readonly ChaosModifier[] = [
  "low-gravity", "scrap-rush", "fragile-worlds", "launch-party", "super-shove"
];

export const CHAOS_COPY: Record<ChaosModifier, { title: string; description: string }> = {
  "low-gravity": { title: "LOW GRAVITY", description: "Jump farther." },
  "scrap-rush": { title: "SCRAP RUSH", description: "Scrap is everywhere." },
  "fragile-worlds": { title: "FRAGILE WORLDS", description: "Planets break fast." },
  "launch-party": { title: "LAUNCH PARTY", description: "Launch pads recharge fast." },
  "super-shove": { title: "SUPER SHOVE", description: "Shoves hit harder." }
};

export function createMatchRules(modifier: ChaosModifier | null = null): MatchRules {
  const rules: MatchRules = {
    gravity: BALANCE.gravity,
    jumpSpeed: BALANCE.jumpSpeed,
    scrapSpawnMs: BALANCE.scrapSpawnMs,
    scrapMaxPerPlanet: BALANCE.scrapMaxPerPlanet,
    maxIntegrity: BALANCE.maxIntegrity,
    launchCooldownMs: BALANCE.launch.cooldownMs,
    shoveForce: BALANCE.shove.force,
    shoveCooldownMs: BALANCE.shove.cooldownMs
  };
  if (modifier === "low-gravity") { rules.gravity = BALANCE.gravity * 0.65; rules.jumpSpeed = 7.8; }
  if (modifier === "scrap-rush") { rules.scrapSpawnMs = 4000; rules.scrapMaxPerPlanet = 8; }
  if (modifier === "fragile-worlds") rules.maxIntegrity = 70;
  if (modifier === "launch-party") rules.launchCooldownMs = 2250;
  if (modifier === "super-shove") { rules.shoveForce = 14; rules.shoveCooldownMs = 900; }
  return rules;
}

export function selectChaosModifier(previous: ChaosModifier | null, random = Math.random): ChaosModifier {
  const choices = previous ? CHAOS_MODIFIERS.filter((modifier) => modifier !== previous) : CHAOS_MODIFIERS;
  return choices[Math.min(choices.length - 1, Math.floor(clamp(random(), 0, 0.999999) * choices.length))];
}

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
  gravityPlanetId: string | null;
  launchCooldownUntil: number;
  shoveCooldownUntil: number;
  crowns: number;
  fallbucks: number;
  ownedCosmetics: string[];
  equippedCosmetics: EquippedCosmetics;
  overchargeUntil: number;
  launchBoostUntil: number;
  grappleTargetPlayerId: string | null;
  sessionLevel: number;
  sessionXp: number;
  sessionTotalXp: number;
  unlockedPassRewards: string[];
  lobbyBadge?: string;
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
  cannonSabotageImmuneUntil: number;
  repairSabotageImmuneUntil: number;
  shieldUntil: number;
  shieldCooldownUntil: number;
}

export interface ScrapState { id: string; planetId: string; position: Vec3; }

export interface ProjectileState {
  id: string;
  ownerId: string;
  weapon: WeaponType;
  position: Vec3;
  velocity: Vec3;
  spawnedAt: number;
  fragment?: boolean;
  shotId?: string;
}

export interface MatchStats {
  playerId: string;
  damageDealt: number;
  damageReceived: number;
  scrapCollected: number;
  stolenScrap: number;
  repairsPerformed: number;
  integrityRepaired: number;
  planetsVisited: number;
  successfulShoves: number;
  timesShoved: number;
  sabotagesCompleted: number;
  rocketsFired: number;
  asteroidsFired: number;
  clusterBombsFired: number;
  gravityBombsFired: number;
  clusterFragmentsHit: number;
  gravityBombPlayersDisplaced: number;
  scrapUtilitiesPurchased: number;
  shotsHit: number;
  planetKills: number;
  survivalTimeMs: number;
}

export type MatchAwardId = "menace" | "space-thief" | "mechanic" | "bully" | "tourist" | "survivor" | "bad-aim";
export interface MatchAward { id: MatchAwardId; title: string; subtitle: string; playerId: string; }
export interface MatchPlacement { playerId: string; place: number; integrity: number; }
export interface MatchResult {
  winnerId: string | null;
  reason: "last-standing" | "timer";
  placements: MatchPlacement[];
  stats: MatchStats[];
  awards: MatchAward[];
  crowns: { playerId: string; crowns: number }[];
  winStreak: WinStreak | null;
  fallbucks: { playerId: string; reward: number; balance: number }[];
  progression: SessionProgressAward[];
}

export interface SessionProgressAward {
  playerId: string;
  xpEarned: number;
  previousLevel: number;
  level: number;
  xp: number;
  totalXp: number;
  unlockedLevels: number[];
  rewards: PlanetPassReward[];
  fallbucksGranted: number;
}

export interface WinStreak { playerId: string; count: number; }

export type MatchEventType = "launch" | "stolen" | "shove" | "sabotage" | "damage" | "destroyed";
export type MatchCalloutType = "first-hit" | "first-raid" | "planet-down" | "last-two" | "overtime";
export interface MatchEvent {
  id: string;
  type: MatchEventType;
  createdAt: number;
  actorId?: string;
  targetId?: string;
  planetId?: string;
  amount?: number;
  weapon?: WeaponType;
  structure?: StructureType;
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
  matchStats: MatchStats[];
  matchResult: MatchResult | null;
  gameMode: GameMode;
  activeModifier: ChaosModifier | null;
  rules: MatchRules;
  winStreak: WinStreak | null;
  botDifficulty: BotDifficulty;
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
  grappleTargetPlayerId?: string;
}

export type PlayerInteraction =
  | { action: "launch"; targetPlanetId: string }
  | { action: "shove"; targetPlayerId: string; facing?: Vec3 }
  | { action: "sabotage"; planetId: string; structure: StructureType; active: boolean }
  | { action: "utility"; planetId: string; utility: ScrapUtility };

export type ShopResult = { ok: true } | { ok: false; error: string };

export interface ServerSnapshot {
  serverTime: number;
  phase: RoomPhase;
  players: PlayerState[];
  planets: PlanetState[];
  scraps: ScrapState[];
  matchEndsAt: number | null;
}

export interface ClientToServerEvents extends BrClientToServerEvents {
  "room:create": (payload: { name: string; sessionToken?: string }, ack: (result: JoinResult) => void) => void;
  "room:solo": (payload: { name: string }, ack: (result: JoinResult) => void) => void;
  "room:join": (payload: { code: string; name: string; sessionToken?: string }, ack: (result: JoinResult) => void) => void;
  "room:ready": (payload: { ready: boolean }) => void;
  "room:bot:add": () => void;
  "room:bot:remove": (payload: { botId: string }) => void;
  "room:mode": (payload: { mode: GameMode }) => void;
  "room:bot:difficulty": (payload: { difficulty: BotDifficulty }) => void;
  "match:start": () => void;
  "player:input": (payload: PlayerInput) => void;
  "player:interact": (payload: PlayerInteraction) => void;
  "cannon:fire": (payload: { weapon: WeaponType; direction: Vec3 }) => void;
  "repair:buy": () => void;
  "player:emote": (payload: { emote: EmoteType; direction: Vec3 }) => void;
  "shop:buy": (payload: { itemId: string }, ack: (result: ShopResult) => void) => void;
  "shop:equip": (payload: { itemId: string }, ack: (result: ShopResult) => void) => void;
  "match:rematch": () => void;
}

export interface ServerToClientEvents extends BrServerToClientEvents {
  "room:state": (room: RoomView) => void;
  "match:snapshot": (snapshot: ServerSnapshot) => void;
  "match:countdown": (payload: { startsAt: number; mode: GameMode; modifier: ChaosModifier | null; rules: MatchRules }) => void;
  "projectile:spawned": (projectile: ProjectileState) => void;
  "projectile:exploded": (payload: { id: string; position: Vec3; weapon: WeaponType; planetId?: string; burst?: boolean }) => void;
  "scrap:collected": (payload: { scrapId: string; playerId: string; planetId: string; ownerId: string; position: Vec3; value: number; stolen: boolean }) => void;
  "player:launched": (payload: { playerId: string; sourcePlanetId: string; targetPlanetId: string; position: Vec3; velocity: Vec3; cooldownUntil: number; boosted: boolean }) => void;
  "player:landed": (payload: { playerId: string; planetId: string; ownerId: string; intruder: boolean }) => void;
  "player:shoved": (payload: { attackerId: string; targetId: string; planetId: string; position: Vec3; velocity: Vec3 }) => void;
  "player:bumped": (payload: { attackerId: string; targetId: string; planetId: string; position: Vec3; velocity: Vec3 }) => void;
  "player:emote": (payload: { playerId: string; emote: EmoteType; direction: Vec3; startedAt: number }) => void;
  "player:tethered": (payload: { playerId: string; targetPlayerId: string; startedAt: number }) => void;
  "social:high-five": (payload: { playerIds: [string, string]; position: Vec3; startedAt: number }) => void;
  "structure:sabotaged": (payload: { playerId: string; planetId: string; ownerId: string; structure: StructureType; disabledUntil: number }) => void;
  "structure:sabotage-cancelled": (payload: { playerId: string }) => void;
  "planet:damaged": (payload: { planetId: string; integrity: number; amount: number; hit: Vec3 }) => void;
  "planet:repaired": (payload: { planetId: string; playerId: string; integrity: number; amount: number }) => void;
  "utility:purchased": (payload: { playerId: string; planetId: string; utility: ScrapUtility; activeUntil: number; cooldownUntil?: number }) => void;
  "planet:destroyed": (payload: { planetId: string; ownerId: string }) => void;
  "match:event": (payload: MatchEvent) => void;
  "match:stat": (payload: MatchStats) => void;
  "match:callout": (payload: { type: MatchCalloutType; createdAt: number }) => void;
  "match:ended": (payload: { winnerId: string | null; reason: "last-standing" | "timer"; result: MatchResult }) => void;
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

export function moveTowards(current: Vec3, target: Vec3, maxDelta: number): Vec3 {
  const delta = sub(target, current);
  const deltaLength = length(delta);
  return deltaLength <= maxDelta || deltaLength < 1e-8 ? { ...target } : add(current, scale(delta, maxDelta / deltaLength));
}

export function limitSpeed(velocity: Vec3, maximum: number): Vec3 {
  const speed = length(velocity);
  return speed > maximum ? scale(velocity, maximum / speed) : velocity;
}

export function updateGroundedState(wasGrounded: boolean, altitude: number, outwardSpeed = 0): boolean {
  if (!wasGrounded && outwardSpeed > .65) return false;
  return altitude <= (wasGrounded ? BALANCE.ground.exitAltitude : BALANCE.ground.enterAltitude);
}

export function canExecuteBufferedJump(now: number, queuedUntil: number, lastGroundedAt: number, grounded: boolean): boolean {
  return queuedUntil >= now && (grounded || now - lastGroundedAt <= BALANCE.ground.coyoteMs);
}

export function stepTangentVelocity(current: Vec3, desired: Vec3, hasInput: boolean, grounded: boolean, dt: number, recoveringFromBurst = false): Vec3 {
  let rate: number = hasInput ? BALANCE.acceleration : BALANCE.braking;
  if (hasInput && length(current) > 0.1 && length(desired) > 0.1 && dot(normalize(current), normalize(desired)) < 0.35) rate = BALANCE.turnAcceleration;
  if (!grounded) rate *= BALANCE.airControl;
  if (recoveringFromBurst) rate *= 0.42;
  return moveTowards(current, desired, Math.max(0, rate * dt));
}

export function selectGravityPlanetId(
  position: Vec3,
  planets: Iterable<Pick<PlanetState, "id" | "position" | "alive">>,
  currentId: string | null,
  preferredId: string | null = null
): string | null {
  let closest: Pick<PlanetState, "id" | "position" | "alive"> | undefined;
  let current: Pick<PlanetState, "id" | "position" | "alive"> | undefined;
  let preferred: Pick<PlanetState, "id" | "position" | "alive"> | undefined;
  let closestDistance = Infinity;
  for (const planet of planets) {
    if (!planet.alive) continue;
    if (planet.id === currentId) current = planet;
    if (planet.id === preferredId) preferred = planet;
    const d = distance(position, planet.position);
    if (d < closestDistance) { closest = planet; closestDistance = d; }
  }
  if (!closest) return null;
  if (!current) return closest.id;
  const currentDistance = distance(position, current.position);
  if (preferred && preferred.id !== current.id && distance(position, preferred.position) < currentDistance * 0.94) return preferred.id;
  if (closest.id !== current.id && closestDistance < currentDistance * BALANCE.gravitySwitchRatio) return closest.id;
  return current.id;
}

export function gravityAcceleration(position: Vec3, planet: Pick<PlanetState, "position">, gravity: number): Vec3 {
  return scale(normalize(sub(planet.position, position)), gravity);
}

export function launchGravityAcceleration(
  position: Vec3,
  source: Pick<PlanetState, "position">,
  target: Pick<PlanetState, "position">,
  gravity: number
): Vec3 {
  const sourceDistance = Math.max(0, distance(position, source.position) - BALANCE.planetRadius);
  const targetDistance = Math.max(0, distance(position, target.position) - BALANCE.planetRadius);
  const rawProgress = sourceDistance / Math.max(0.001, sourceDistance + targetDistance);
  const progress = clamp((rawProgress - 0.28) / 0.44, 0, 1);
  const blend = progress * progress * (3 - 2 * progress);
  return add(
    scale(normalize(sub(source.position, position)), gravity * (1 - blend)),
    scale(normalize(sub(target.position, position)), gravity * blend)
  );
}

export function applyBurstVelocity(velocity: Vec3, direction: Vec3, outward: Vec3, grounded: boolean): Vec3 {
  const projectedDirection = projectOnPlane(direction, outward);
  const dash = length(projectedDirection) > 1e-5 ? normalize(projectedDirection) : { x: 0, y: 0, z: 0 };
  const tangent = projectOnPlane(velocity, outward);
  const radial = scale(outward, dot(velocity, outward));
  const carry = grounded ? 0.48 : 0.68;
  const impulse = BALANCE.burstSpeed * (grounded ? 1 : 0.82);
  const burstTangent = limitSpeed(add(scale(tangent, carry), scale(dash, impulse)), BALANCE.burstSpeedCap);
  return limitSpeed(add(burstTangent, radial), BALANCE.maxPlayerSpeed);
}

export function grappleRestLength(distanceToAnchor: number): number {
  return Math.max(BALANCE.grapple.minRestLength, distanceToAnchor * BALANCE.grapple.reelRatio);
}

export function applyGrappleVelocity(velocity: Vec3, position: Vec3, anchor: Vec3, restLength: number, dt: number): Vec3 {
  const rope = sub(anchor, position);
  const ropeLength = length(rope);
  if (ropeLength < 1e-6) return velocity;
  const toward = scale(rope, 1 / ropeLength);
  const stretch = Math.max(0, ropeLength - restLength);
  if (stretch <= 0) return limitSpeed(velocity, BALANCE.grapple.speedCap);
  const awaySpeed = Math.max(0, -dot(velocity, toward));
  const force = Math.min(BALANCE.grapple.maxForce, BALANCE.grapple.basePull + stretch * BALANCE.grapple.spring + awaySpeed * BALANCE.grapple.damping);
  return limitSpeed(add(velocity, scale(toward, force * dt)), BALANCE.grapple.speedCap);
}

export function applyLaunchGuidance(
  velocity: Vec3,
  position: Vec3,
  source: Pick<PlanetState, "position">,
  target: Pick<PlanetState, "position">,
  dt: number
): Vec3 {
  const landing = launchLandingPosition(source, target);
  const toLanding = sub(landing, position);
  const surfaceDistance = Math.max(0, distance(position, target.position) - BALANCE.planetRadius);
  const arrival = clamp(surfaceDistance / BALANCE.launch.arrivalRadius, 0, 1);
  const desiredSpeed = BALANCE.launch.arrivalSpeed + (BALANCE.launch.speed - BALANCE.launch.arrivalSpeed) * arrival;
  const desired = scale(normalize(toLanding), desiredSpeed);
  const guided = moveTowards(velocity, desired, BALANCE.launch.assist * dt * (surfaceDistance < BALANCE.launch.arrivalRadius ? 1.25 : 1));
  return limitSpeed(guided, BALANCE.launch.speed * 1.12);
}

export function isShoveTarget(
  attacker: Vec3,
  target: Vec3,
  planetCenter: Vec3,
  facing: Vec3,
  range: number = BALANCE.shove.range
): boolean {
  const separation = distance(attacker, target);
  if (separation > range) return false;
  const outward = normalize(sub(attacker, planetCenter));
  const targetDirection = projectOnPlane(sub(target, attacker), outward);
  const facingDirection = projectOnPlane(facing, outward);
  if (length(facingDirection) < 1e-5) return false;
  // Players use lightweight networked capsules and can briefly occupy nearly the
  // same surface point. Treat that overlap as a valid close shove so they can
  // separate using the already-authoritative facing fallback.
  if (separation <= .85 || length(targetDirection) < .08) return true;
  const towardTarget = normalize(targetDirection);
  const forward = normalize(facingDirection);
  return dot(forward, towardTarget) >= BALANCE.shove.facingDot;
}

export function applyShoveVelocity(velocity: Vec3, away: Vec3, outward: Vec3, force: number, lift: number = BALANCE.shove.lift): Vec3 {
  const tangentMomentum = scale(projectOnPlane(velocity, outward), 0.7);
  const existingLift = Math.max(0, dot(velocity, outward)) * 0.45;
  const tangentAway = projectOnPlane(away, outward);
  const shoveDirection = length(tangentAway) > 1e-5 ? normalize(tangentAway) : { x: 0, y: 0, z: 0 };
  const result = add(tangentMomentum, add(scale(shoveDirection, force), scale(outward, lift + existingLift)));
  return limitSpeed(result, force > BALANCE.shove.force ? BALANCE.shove.speedCap * 1.2 : BALANCE.shove.speedCap);
}

export function explosionFalloff(distanceFromImpact: number, outerRadius: number): number {
  return Math.sqrt(clamp(1 - distanceFromImpact / Math.max(0.001, outerRadius), 0, 1));
}

export function segmentSphereHit(start: Vec3, end: Vec3, center: Vec3, radius: number): number | null {
  const segment = sub(end, start);
  const offset = sub(start, center);
  if (dot(offset, offset) <= radius * radius) return 0;
  const a = dot(segment, segment);
  if (a < 1e-10) return distance(start, center) <= radius ? 0 : null;
  const b = 2 * dot(offset, segment);
  const c = dot(offset, offset) - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const enter = (-b - root) / (2 * a);
  const exit = (-b + root) / (2 * a);
  if (enter >= 0 && enter <= 1) return enter;
  if (exit >= 0 && exit <= 1) return exit;
  return null;
}

export function reconciliationStrength(error: number): number {
  if (error < 0.06) return 0;
  if (error < 0.75) return 0.1;
  if (error < 4.5) return 0.22;
  return 1;
}

export function ballisticPosition(origin: Vec3, velocity: Vec3, ageSeconds: number): Vec3 {
  return add(origin, scale(velocity, ageSeconds));
}

export function damageStage(integrity: number): 0 | 1 | 2 | 3 {
  if (integrity <= 25) return 3;
  if (integrity <= 50) return 2;
  if (integrity <= 75) return 1;
  return 0;
}

export function createMatchStats(playerId: string): MatchStats {
  return {
    playerId, damageDealt: 0, damageReceived: 0, scrapCollected: 0, stolenScrap: 0,
    repairsPerformed: 0, integrityRepaired: 0, planetsVisited: 0,
    successfulShoves: 0, timesShoved: 0, sabotagesCompleted: 0,
    rocketsFired: 0, asteroidsFired: 0, clusterBombsFired: 0, gravityBombsFired: 0,
    clusterFragmentsHit: 0, gravityBombPlayersDisplaced: 0, scrapUtilitiesPurchased: 0,
    shotsHit: 0, planetKills: 0, survivalTimeMs: 0
  };
}

export function selectMatchAwards(stats: MatchStats[], winnerId: string | null, winnerIntegrity: number): MatchAward[] {
  const stable = [...stats].sort((a, b) => a.playerId.localeCompare(b.playerId));
  const maxBy = (value: (entry: MatchStats) => number, minimum = 1): MatchStats | undefined => {
    const ranked = [...stable].sort((a, b) => value(b) - value(a));
    return ranked[0] && value(ranked[0]) >= minimum ? ranked[0] : undefined;
  };
  const awards: MatchAward[] = [];
  const add = (entry: MatchStats | undefined, id: MatchAwardId, title: string, subtitle: string) => {
    if (entry) awards.push({ id, title, subtitle, playerId: entry.playerId });
  };
  add(maxBy((entry) => entry.damageDealt), "menace", "MENACE", "Most damage dealt");
  add(maxBy((entry) => entry.stolenScrap), "space-thief", "SPACE THIEF", "Most stolen scrap");
  add(maxBy((entry) => entry.integrityRepaired), "mechanic", "MECHANIC", "Most integrity repaired");
  add(maxBy((entry) => entry.successfulShoves), "bully", "BULLY", "Most successful shoves");
  add(maxBy((entry) => entry.planetsVisited), "tourist", "TOURIST", "Most enemy planets visited");
  if (winnerId && winnerIntegrity > 0 && winnerIntegrity <= 25) {
    awards.push({ id: "survivor", title: "SURVIVOR", subtitle: `Won at ${Math.round(winnerIntegrity)}% integrity`, playerId: winnerId });
  }
  const badAim = maxBy((entry) => entry.rocketsFired + entry.asteroidsFired + entry.clusterBombsFired + entry.gravityBombsFired - entry.shotsHit, 2);
  if (badAim) awards.push({ id: "bad-aim", title: "BAD AIM", subtitle: "Most shots missed", playerId: badAim.playerId });
  return awards.slice(0, 4);
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

export function isWeaponType(value: unknown): value is WeaponType {
  return typeof value === "string" && (WEAPON_ORDER as readonly string[]).includes(value);
}

export function isBotDifficulty(value: unknown): value is BotDifficulty {
  return value === "easy" || value === "normal" || value === "hard";
}

export function isEmoteType(value: unknown): value is EmoteType {
  return value === "wave" || value === "laugh" || value === "point" || value === "panic" || value === "taunt" || value === "celebrate";
}

export function fallbucksReward(place: number): number {
  return place === 1 ? 100 : place === 2 ? 50 : place === 3 ? 25 : 10;
}

export function sessionLevelForXp(totalXp: number): number {
  return Math.min(SESSION_PROGRESSION.maxLevel, Math.floor(Math.max(0, totalXp) / SESSION_PROGRESSION.xpPerLevel) + 1);
}

export function sessionXpInLevel(totalXp: number): number {
  const safe = Math.max(0, totalXp);
  if (sessionLevelForXp(safe) >= SESSION_PROGRESSION.maxLevel) return SESSION_PROGRESSION.xpPerLevel;
  return safe % SESSION_PROGRESSION.xpPerLevel;
}

export function sessionMatchXp(place: number, awardCount: number, planetKills: number): number {
  const placement = place === 1 ? 60 : place === 2 ? 40 : place === 3 ? 25 : 0;
  return 40 + placement + Math.min(20, Math.max(0, awardCount) * 10) + Math.min(15, Math.max(0, planetKills) * 5);
}

export function planetPassRewardsBetween(previousLevel: number, nextLevel: number): PlanetPassReward[] {
  return PLANET_PASS_REWARDS.filter((reward) => reward.level > previousLevel && reward.level <= nextLevel);
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
