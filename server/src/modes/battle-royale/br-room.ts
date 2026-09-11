import { randomBytes, randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import {
  BR_BALANCE, BR_BOT_DIFFICULTY, BR_CRATE_SOCKETS, BR_HEALS, BR_LOOT_SOCKETS, BR_MAP, BR_POIS, BR_RARITY_MULTIPLIER, BR_STARTING_AMMO, BR_STORM_PHASES, BR_WEAPONS,
  DEFAULT_COSMETICS, FREE_EMOTES, PLAYER_COLORS, PLANET_PASS_REWARDS, SESSION_PROGRESSION, SHOP_CATALOG, applyBrDamage, brAimDirection, brClamp, brDistance2d, brItemMagazine, brMuzzlePosition, brNormalize,
  brBlocksNear, brNextWaypoint, brPlayerHitDistance, brRarityDamage, brShipPath, createEmptyBrInventory, isBrHeal, isBrWeapon, isInsideBrIsland,
  reloadBrItem, seededRandom, sessionLevelForXp, sessionXpInLevel, stepBrMovement, stormContains,
  type BotDifficulty, type BrCrateState, type BrInput, type BrInventoryItem, type BrItemId, type BrJoinResult, type BrLootState,
  type BrMatchResult, type BrPhase, type BrPlayerSnapshotState, type BrPlayerState, type BrProjectileState, type BrRarity, type BrRoomView,
  type BrSnapshot, type BrStormState, type BrTeamMode, type BrWeaponId, type ClientToServerEvents,
  type EmoteType, type ServerToClientEvents, type Vec3
} from "@planetfall/shared";
import { SpatialGrid } from "./spatial-grid.js";
import { BrPhysicsWorld } from "./br-physics.js";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

interface BrPlayerRecord extends BrPlayerState {
  socketId: string | null;
  sessionToken: string;
  disconnectedAt: number | null;
  input: BrInput | null;
  lastInputAt: number;
  lastJumpSignal: boolean;
  lastCrouchSignal: boolean;
  lastFireAt: number;
  reloadEndsAt: number;
  reloadSlot: number;
  useEndsAt: number;
  useSlot: number;
  reviveTargetId: string | null;
  reviveStartedAt: number;
  slideEndsAt: number;
  matchStartedAt: number;
  eliminatedAt: number | null;
  nextBotDecisionAt: number;
  botGoal: Vec3 | null;
  shipJumpAt: number;
  lastEmoteAt: number;
  saberCombo: number;
  saberComboAt: number;
  stormDamageRemainder: number;
  traversalCooldownUntil: number;
  lastGroundedAt: number;
  jumpBufferedUntil: number;
  spectatorTargetId: string | null;
  lastPingAt: number;
  history: Array<{ at: number; position: Vec3 }>;
}

const BOT_NAMES = ["Orbit", "Nova", "Comet", "Luna", "Vega", "Cosmo", "Pip", "Rocket", "Sol", "Astro", "Quark", "Pixel", "Echo", "Mars", "Pluto", "Mochi", "Ziggy", "Bolt", "Kite", "Riff", "Tango", "Mica", "Iris", "Juno", "Atlas", "Ceres", "Dusk", "Flare", "Halo", "Ion", "Jet", "Kilo", "Lux", "Mako", "Nix", "Opal", "Puck", "Rune", "Sora", "Triton"];
const RARITIES: readonly BrRarity[] = ["common", "rare", "epic", "legendary"];
const WEAPON_IDS = Object.keys(BR_WEAPONS) as BrWeaponId[];
const ITEM_IDS: BrItemId[] = [...WEAPON_IDS, ...Object.keys(BR_HEALS) as BrItemId[]];

function id(prefix: string): string { return `${prefix}-${randomUUID().slice(0, 8)}`; }
function token(): string { return randomBytes(18).toString("base64url"); }
function sanitizeName(value: unknown): string { return typeof value === "string" ? value.trim().replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 18) : ""; }
function isFiniteVec3(value: unknown): value is Vec3 {
  if (!value || typeof value !== "object") return false;
  const vector = value as Partial<Vec3>;
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}
function clonePlayer(player: BrPlayerRecord): BrPlayerState {
  const { socketId: _socketId, sessionToken: _sessionToken, disconnectedAt: _disconnectedAt, input: _input, lastInputAt: _lastInputAt,
    lastJumpSignal: _lastJumpSignal, lastCrouchSignal: _lastCrouchSignal, lastFireAt: _lastFireAt, reloadEndsAt: _reloadEndsAt, reloadSlot: _reloadSlot,
    useEndsAt: _useEndsAt, useSlot: _useSlot, reviveTargetId: _reviveTargetId, reviveStartedAt: _reviveStartedAt,
    slideEndsAt: _slideEndsAt, matchStartedAt: _matchStartedAt, eliminatedAt: _eliminatedAt, nextBotDecisionAt: _nextBotDecisionAt,
    botGoal: _botGoal, shipJumpAt: _shipJumpAt, lastEmoteAt: _lastEmoteAt, saberCombo: _saberCombo,
    saberComboAt: _saberComboAt, stormDamageRemainder: _stormDamageRemainder, traversalCooldownUntil: _traversalCooldownUntil,
    lastGroundedAt: _lastGroundedAt, jumpBufferedUntil: _jumpBufferedUntil,
    spectatorTargetId: _spectatorTargetId, lastPingAt: _lastPingAt, history: _history, ...state } = player;
  return { ...state, position: { ...state.position }, velocity: { ...state.velocity }, rotation: { ...state.rotation }, inventory: state.inventory.map((item) => item ? { ...item } : null), ammo: { ...state.ammo }, unlockedPassRewards: [...state.unlockedPassRewards], ownedCosmetics: [...state.ownedCosmetics], equippedCosmetics: { ...state.equippedCosmetics } };
}

function snapshotPlayer(player: BrPlayerRecord): BrPlayerSnapshotState {
  const heldItem = player.inventory[player.selectedSlot];
  return {
    id: player.id, name: player.name, isBot: player.isBot, connected: player.connected, color: player.color, teamId: player.teamId,
    alive: player.alive, downed: player.downed, deployment: player.deployment, hp: player.hp, shield: player.shield,
    downedHp: player.downedHp, bleedoutEndsAt: player.bleedoutEndsAt, position: { ...player.position }, velocity: { ...player.velocity },
    rotation: { ...player.rotation }, yaw: player.yaw, pitch: player.pitch, grounded: player.grounded, crouched: player.crouched, selectedSlot: player.selectedSlot,
    heldItem: heldItem ? { ...heldItem } : null, kills: player.kills, damageDealt: player.damageDealt, revives: player.revives,
    placement: player.placement, equippedCosmetics: { ...player.equippedCosmetics }
  };
}

export class BattleRoyaleRoom {
  readonly family = "battle-royale" as const;
  readonly code: string;
  hostId = "";
  phase: BrPhase = "lobby";
  teamMode: BrTeamMode = "solo";
  targetPlayers: 10 | 20 | 40 = 10;
  fillBots = true;
  botDifficulty: BotDifficulty = "normal";
  players = new Map<string, BrPlayerRecord>();
  loot = new Map<string, BrLootState>();
  crates = new Map<string, BrCrateState>();
  projectiles = new Map<string, BrProjectileState>();
  teams = new Map<string, string[]>();
  countdownEndsAt: number | null = null;
  ship: BrRoomView["ship"] = null;
  matchResult: BrMatchResult | null = null;
  returnVotes = new Set<string>();
  seed: number;
  storm: BrStormState;
  private stormStageStartedAt = 0;
  private matchStartedAt = 0;
  private snapshotAccumulator = 0;
  private playerGrid = new SpatialGrid<BrPlayerRecord>(BR_BALANCE.interest.cellSize);
  private lootGrid = new SpatialGrid<BrLootState>(BR_BALANCE.interest.cellSize);
  private projectileGrid = new SpatialGrid<BrProjectileState>(BR_BALANCE.interest.cellSize);
  private physics = new BrPhysicsWorld();

  constructor(code: string, private io: GameServer, seed = Math.floor(Math.random() * 0x7fffffff)) {
    this.code = code;
    this.seed = seed;
    this.storm = this.initialStorm();
  }

  join(socket: GameSocket, rawName: unknown, sessionToken?: string): BrJoinResult {
    const name = sanitizeName(rawName);
    if (!name) return { ok: false, error: "Enter a name first." };
    const now = Date.now();
    const returning = sessionToken ? [...this.players.values()].find((player) => player.sessionToken === sessionToken && !player.connected && player.disconnectedAt !== null && now - player.disconnectedAt < BR_BALANCE.reconnectGraceMs) : undefined;
    if (returning) {
      returning.connected = true; returning.socketId = socket.id; returning.disconnectedAt = null; returning.name = name; returning.input = null;
      socket.join(this.code); socket.data.roomCode = this.code; socket.data.playerId = returning.id; socket.data.gameFamily = this.family;
      this.emitRoom();
      if (this.crates.size) this.io.to(socket.id).emit("br:crate:spawned", [...this.crates.values()].filter((entry) => !entry.opened).map((entry) => ({ ...entry, position: { ...entry.position } })));
      return { ok: true, room: this.view(), playerId: returning.id, sessionToken: returning.sessionToken };
    }
    if (this.phase !== "lobby") return { ok: false, error: "That Battle Royale is already in progress." };
    if (this.players.size >= BR_BALANCE.maxPlayers) return { ok: false, error: "That room is full." };
    if ([...this.players.values()].some((player) => player.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: "That name is already in use." };
    const player = this.makePlayer(id("br-player"), name, false, this.players.size);
    player.socketId = socket.id;
    player.sessionToken = token();
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    socket.join(this.code); socket.data.roomCode = this.code; socket.data.playerId = player.id; socket.data.gameFamily = this.family;
    this.assignTeams(); this.emitRoom();
    return { ok: true, room: this.view(), playerId: player.id, sessionToken: player.sessionToken };
  }

  configure(playerId: string, payload: { teamMode?: BrTeamMode; targetPlayers?: 10 | 20 | 40; fillBots?: boolean; botDifficulty?: BotDifficulty }): void {
    if (this.phase !== "lobby" || playerId !== this.hostId) return;
    if (payload.teamMode && ["solo", "duo", "squad"].includes(payload.teamMode)) this.teamMode = payload.teamMode;
    if (payload.targetPlayers && [10, 20, 40].includes(payload.targetPlayers)) this.targetPlayers = payload.targetPlayers;
    if (typeof payload.fillBots === "boolean") this.fillBots = payload.fillBots;
    if (payload.botDifficulty && ["easy", "normal", "hard"].includes(payload.botDifficulty)) this.botDifficulty = payload.botDifficulty;
    this.assignTeams(); this.emitRoom();
  }

  setReady(playerId: string, ready: boolean): void {
    if (this.phase !== "lobby") return;
    const player = this.players.get(playerId);
    if (!player || player.isBot) return;
    player.ready = Boolean(ready); this.emitRoom();
  }

  start(playerId: string, now = Date.now()): boolean {
    if (this.phase !== "lobby" || playerId !== this.hostId) return false;
    const humans = [...this.players.values()].filter((player) => !player.isBot && player.connected);
    if (humans.length < 1 || !humans.every((player) => player.ready)) { this.error(playerId, "Everyone must be ready."); return false; }
    if (this.fillBots) while (this.players.size < this.targetPlayers) this.addBot(false);
    if (this.players.size < BR_BALANCE.minPlayers) { this.error(playerId, "Add another player or enable bot fill."); return false; }
    this.assignTeams();
    if (this.teams.size < 2) { this.error(playerId, "Battle Royale needs at least two crews."); return false; }
    this.resetMatch(now);
    this.phase = "countdown"; this.countdownEndsAt = now + BR_BALANCE.countdownMs;
    this.io.to(this.code).emit("br:match:countdown", { startsAt: this.countdownEndsAt, seed: this.seed });
    this.emitRoom(); return true;
  }

  setInput(playerId: string, input: BrInput): void {
    const player = this.players.get(playerId);
    if (!player || player.isBot || !player.alive || !Number.isFinite(input?.sequence) || input.sequence <= player.lastInputSequence) return;
    player.lastInputSequence = Math.floor(input.sequence);
    player.input = {
      sequence: player.lastInputSequence, dt: brClamp(Number(input.dt) || .05, .001, .1),
      moveX: brClamp(Number(input.moveX) || 0, -1, 1), moveY: brClamp(Number(input.moveY) || 0, -1, 1),
      yaw: Number.isFinite(input.yaw) ? input.yaw : player.yaw, pitch: brClamp(Number(input.pitch) || 0, -1.35, 1.35),
      jump: Boolean(input.jump), sprint: Boolean(input.sprint), crouch: Boolean(input.crouch), fire: Boolean(input.fire), aim: Boolean(input.aim), reload: Boolean(input.reload)
    };
    player.lastInputAt = Date.now();
  }

  jumpFromShip(playerId: string, now = Date.now()): boolean {
    const player = this.players.get(playerId);
    if (this.phase !== "ship" || !player || player.deployment !== "attached" || !this.ship) return false;
    player.deployment = "freefall"; player.position = { ...this.ship.position };
    player.velocity = { x: Math.sin(player.yaw) * 4, y: -5, z: -Math.cos(player.yaw) * 4 };
    this.io.to(this.code).emit("br:ship:jumped", { playerId, position: player.position, velocity: player.velocity });
    this.ship.playersAboard = Math.max(0, this.ship.playersAboard - 1);
    return true;
  }

  deployChute(playerId: string): void {
    const player = this.players.get(playerId);
    if (player?.deployment === "freefall") player.deployment = "chute";
  }

  selectSlot(playerId: string, slot: number): void {
    const player = this.players.get(playerId);
    if (player && Number.isInteger(slot) && slot >= 0 && slot < BR_BALANCE.inventorySlots) { player.selectedSlot = slot; this.cancelTimedActions(player); }
  }

  pickup(playerId: string, lootId: string, replaceSlot?: number): boolean {
    const player = this.players.get(playerId); const loot = this.loot.get(lootId);
    if (!this.isActionPhase() || !player || !loot || !player.alive || player.downed || player.deployment !== "grounded" || this.distance(player.position, loot.position) > BR_BALANCE.pickupRange) return false;
    if (loot.ammoType) {
      player.ammo[loot.ammoType] = Math.min(999, player.ammo[loot.ammoType] + loot.count);
    } else if (loot.itemId) {
      const itemId = loot.itemId;
      const heal = isBrHeal(itemId) ? BR_HEALS[itemId] : null;
      const stack = heal ? player.inventory.find((item) => item?.itemId === itemId && item.count < heal.maxStack) : undefined;
      if (stack && heal) stack.count = Math.min(heal.maxStack, stack.count + loot.count);
      else {
        let slot = player.inventory.findIndex((item) => item === null);
        if (slot < 0 && Number.isInteger(replaceSlot) && replaceSlot! >= 0 && replaceSlot! < BR_BALANCE.inventorySlots) slot = replaceSlot!;
        if (slot < 0) return false;
        if (player.inventory[slot]) this.drop(playerId, slot);
        player.inventory[slot] = { instanceId: id("item"), itemId: loot.itemId, rarity: loot.rarity, count: loot.count, magazine: loot.magazine ?? brItemMagazine(loot.itemId) };
        player.selectedSlot = slot;
      }
    }
    this.loot.delete(lootId); this.io.to(this.code).emit("br:loot:removed", { ids: [lootId] }); return true;
  }

  drop(playerId: string, slot: number): boolean {
    const player = this.players.get(playerId); const item = player?.inventory[slot];
    if (!this.isActionPhase() || !player || !item || !player.alive || player.downed || player.deployment !== "grounded") return false;
    this.dropItem(player, slot);
    return true;
  }

  private dropItem(player: BrPlayerRecord, slot: number): void {
    const item = player.inventory[slot];
    if (!item) return;
    const loot: BrLootState = { id: id("loot"), itemId: item.itemId, rarity: item.rarity, count: item.count, magazine: item.magazine, position: { x: player.position.x + Math.sin(player.yaw) * 1.2, y: player.position.y + .5, z: player.position.z - Math.cos(player.yaw) * 1.2 } };
    this.loot.set(loot.id, loot); player.inventory[slot] = null; this.io.to(this.code).emit("br:loot:spawned", [loot]);
  }

  openCrate(playerId: string, crateId: string): boolean {
    const player = this.players.get(playerId); const crate = this.crates.get(crateId);
    if (!this.isActionPhase() || !player || !crate || crate.opened || !player.alive || player.downed || player.deployment !== "grounded" || this.distance(player.position, crate.position) > 2.7) return false;
    crate.opened = true; const random = seededRandom(this.seed ^ this.hash(crate.id)); const drops: BrLootState[] = [];
    for (let index = 0; index < 3; index++) {
      const itemId = ITEM_IDS[Math.floor(random() * ITEM_IDS.length)]; const rarityRoll = random(); const rarity: BrRarity = rarityRoll > .9 ? "legendary" : rarityRoll > .55 ? "epic" : "rare";
      const angle = index / 3 * Math.PI * 2; const drop: BrLootState = { id: id("crate-loot"), itemId, rarity, count: isBrHeal(itemId) ? 2 : 1, magazine: brItemMagazine(itemId), position: { x: crate.position.x + Math.cos(angle) * 1.6, y: crate.position.y + .45, z: crate.position.z + Math.sin(angle) * 1.6 } };
      this.loot.set(drop.id, drop); drops.push(drop);
    }
    this.io.to(this.code).emit("br:crate:opened", { crateId, playerId, drops }); return true;
  }

  reload(playerId: string, now = Date.now()): boolean {
    const player = this.players.get(playerId); const item = player?.inventory[player.selectedSlot];
    if (!this.isActionPhase() || !player || !item || !isBrWeapon(item.itemId) || !player.alive || player.downed || player.deployment !== "grounded" || player.reloadEndsAt > now || player.useEndsAt > now) return false;
    const weapon = BR_WEAPONS[item.itemId];
    if (!weapon.ammo || item.magazine >= weapon.magazine || player.ammo[weapon.ammo] <= 0) return false;
    player.reloadSlot = player.selectedSlot; player.reloadEndsAt = now + weapon.reloadMs; return true;
  }

  useItem(playerId: string, now = Date.now()): boolean {
    const player = this.players.get(playerId); const item = player?.inventory[player.selectedSlot];
    if (!this.isActionPhase() || !player || !item || !isBrHeal(item.itemId) || !player.alive || player.downed || player.deployment !== "grounded" || player.useEndsAt > now) return false;
    const heal = BR_HEALS[item.itemId];
    if ((heal.hp > 0 && player.hp >= BR_BALANCE.hp) || (heal.shield > 0 && player.shield >= BR_BALANCE.shield)) return false;
    player.useSlot = player.selectedSlot; player.useEndsAt = now + heal.durationMs; return true;
  }

  setRevive(playerId: string, targetId: string, active: boolean, now = Date.now()): void {
    const player = this.players.get(playerId); const target = this.players.get(targetId);
    if (!active) { if (player) { player.reviveTargetId = null; player.reviveStartedAt = 0; } return; }
    if (!this.isActionPhase() || !player || !target || !player.alive || player.downed || player.deployment !== "grounded" || !target.alive || !target.downed || player.teamId !== target.teamId || this.distance(player.position, target.position) > BR_BALANCE.reviveRange) return;
    if (player.reviveTargetId !== targetId) { player.reviveTargetId = targetId; player.reviveStartedAt = now; }
  }

  fire(playerId: string, origin: Vec3, rawDirection: Vec3, clientTime: number, now = Date.now()): boolean {
    const player = this.players.get(playerId); const item = player?.inventory[player.selectedSlot];
    if (!this.isActionPhase() || !player || !item || !isBrWeapon(item.itemId) || !player.alive || player.downed || player.deployment !== "grounded" || player.reloadEndsAt > now || player.useEndsAt > now || !isFiniteVec3(origin) || !isFiniteVec3(rawDirection)) return false;
    const weapon = BR_WEAPONS[item.itemId];
    if (now - player.lastFireAt < weapon.fireIntervalMs || (weapon.ammo && item.magazine <= 0)) return false;
    if (this.distance(player.position, origin) > 2.2) return false;
    const rawDirectionLength = Math.hypot(rawDirection.x, rawDirection.y, rawDirection.z);
    if (rawDirectionLength < 1e-5) return false;
    const direction = brNormalize(rawDirection);
    const expectedAim = brAimDirection(player.yaw, player.pitch);
    if (direction.x * expectedAim.x + direction.y * expectedAim.y + direction.z * expectedAim.z < .72) return false;
    const muzzle = brMuzzlePosition(player.position, player.yaw, player.pitch);
    player.lastFireAt = now; player.reloadEndsAt = 0; player.useEndsAt = 0;
    if (weapon.ammo) item.magazine--;
    const shotTime = Number.isFinite(clientTime) ? brClamp(clientTime, now - BR_BALANCE.maxRewindMs, now) : now;
    if (weapon.model === "hitscan") this.fireHitscan(player, item, muzzle, direction, shotTime, now);
    else if (weapon.model === "projectile") {
      const projectile: BrProjectileState = { id: id("br-projectile"), ownerId: player.id, weaponId: item.itemId as BrProjectileState["weaponId"], rarity: item.rarity, position: { ...muzzle }, velocity: { x: direction.x * weapon.projectileSpeed!, y: direction.y * weapon.projectileSpeed!, z: direction.z * weapon.projectileSpeed! }, spawnedAt: now, expiresAt: now + weapon.range / weapon.projectileSpeed! * 1000 };
      this.projectiles.set(projectile.id, projectile);
      this.io.to(this.code).emit("br:weapon:fired", { playerId, weaponId: item.itemId, origin: muzzle, direction, projectile });
    } else this.fireMelee(player, item.itemId, direction, now);
    if (weapon.model !== "projectile") this.io.to(this.code).emit("br:weapon:fired", { playerId, weaponId: item.itemId, origin: muzzle, direction });
    return true;
  }

  playEmote(playerId: string, emote: EmoteType, direction: Vec3, now = Date.now()): void {
    const player = this.players.get(playerId);
    const socialPhase = this.phase === "lobby" || this.phase === "countdown" || this.phase === "results";
    const activePhase = this.phase === "ship" || this.phase === "combat";
    const unlocked = player && (FREE_EMOTES.includes(emote) || SHOP_CATALOG.some((item) => item.emote === emote && player.ownedCosmetics.includes(item.id)));
    if (!player || !unlocked || !isFiniteVec3(direction) || now - player.lastEmoteAt < 1800 || (!socialPhase && !activePhase) || (activePhase && !player.alive)) return;
    player.lastEmoteAt = now; this.io.to(this.code).emit("br:emote", { playerId, emote, direction: brNormalize(direction), startedAt: now });
  }

  buyShopItem(playerId: string, itemId: string): { ok: boolean; error?: string } {
    if (this.phase !== "lobby" && this.phase !== "results") return { ok: false, error: "Shop is only available between matches." };
    const player = this.players.get(playerId); const item = SHOP_CATALOG.find((entry) => entry.id === itemId && !entry.passLevel);
    if (!player || !item) return { ok: false, error: "Item not found." };
    if (player.ownedCosmetics.includes(item.id)) return { ok: false, error: "Already owned." };
    if (player.fallbucks < item.price) return { ok: false, error: "Not enough Fallbucks." };
    player.fallbucks -= item.price; player.ownedCosmetics.push(item.id); this.emitRoom(); return { ok: true };
  }

  equipShopItem(playerId: string, itemId: string): { ok: boolean; error?: string } {
    if (this.phase !== "lobby" && this.phase !== "results") return { ok: false, error: "Shop is only available between matches." };
    const player = this.players.get(playerId); const item = SHOP_CATALOG.find((entry) => entry.id === itemId);
    if (!player || !item || item.category === "emote" || !player.ownedCosmetics.includes(item.id)) return { ok: false, error: "You do not own that item." };
    player.equippedCosmetics[item.category] = item.id; this.emitRoom(); return { ok: true };
  }

  returnToLobby(playerId: string): void {
    if (this.phase !== "results" || !this.players.has(playerId)) return;
    this.returnVotes.add(playerId);
    const humans = [...this.players.values()].filter((player) => !player.isBot && player.connected);
    if (!humans.every((player) => this.returnVotes.has(player.id))) { this.emitRoom(); return; }
    this.phase = "lobby"; this.matchResult = null; this.ship = null; this.countdownEndsAt = null; this.loot.clear(); this.crates.clear(); this.projectiles.clear();
    this.returnVotes.clear();
    for (const [id, player] of this.players) if (player.isBot) { this.physics.remove(id); this.players.delete(id); }
    for (const player of this.players.values()) { player.ready = player.isBot; player.input = null; }
    this.assignTeams(); this.emitRoom();
  }

  ping(playerId: string, type: "location" | "enemy" | "item" | "move", position: Vec3, itemId?: BrItemId): void {
    const player = this.players.get(playerId);
    const now = Date.now();
    if ((this.phase !== "ship" && this.phase !== "combat") || !player || !player.alive || !isFiniteVec3(position) || !["location", "enemy", "item", "move"].includes(type) || now - player.lastPingAt < 650 || this.distance(player.position, position) > 500) return;
    player.lastPingAt = now;
    for (const teammate of this.players.values()) if (teammate.teamId === player.teamId && teammate.socketId) this.io.to(teammate.socketId).emit("br:ping", { playerId, teamId: player.teamId, type, position, itemId, createdAt: Date.now() });
  }

  cycleSpectator(playerId: string, direction: unknown): void {
    const player = this.players.get(playerId); if (!player || player.alive) return;
    const candidates = [...this.players.values()].filter((entry) => entry.alive && (entry.teamId === player.teamId || ![...this.players.values()].some((mate) => mate.alive && mate.teamId === player.teamId)));
    if (!candidates.length) { player.spectatorTargetId = null; return; }
    const current = candidates.findIndex((entry) => entry.id === player.spectatorTargetId);
    const step = direction === -1 ? -1 : 1;
    player.spectatorTargetId = candidates[(current + step + candidates.length) % candidates.length].id;
  }

  update(dt: number, now: number): void {
    this.cleanupDisconnected(now);
    if (this.phase === "countdown" && this.countdownEndsAt && now >= this.countdownEndsAt) this.beginShip(now);
    if (this.phase === "ship") this.updateShip(dt, now);
    if (this.phase === "combat" || this.phase === "ship") {
      this.updateBots(now);
      for (const player of this.players.values()) this.updatePlayer(player, dt, now);
      this.updateProjectiles(dt, now);
      if (this.phase === "combat") this.updateStorm(dt, now);
      this.updateChannels(now);
      this.playerGrid.rebuild(this.players.values()); this.lootGrid.rebuild(this.loot.values()); this.projectileGrid.rebuild(this.projectiles.values());
      this.checkWinner(now);
    }
    this.snapshotAccumulator += dt;
    if (this.snapshotAccumulator >= 1 / BR_BALANCE.snapshotRate) { this.snapshotAccumulator %= 1 / BR_BALANCE.snapshotRate; this.emitSnapshots(now); }
  }

  disconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.isBot) return;
    player.connected = false; player.socketId = null; player.disconnectedAt = Date.now(); player.input = null; this.cancelTimedActions(player);
    if (playerId === this.hostId) this.migrateHost();
    this.emitRoom();
  }

  isEmpty(): boolean { return ![...this.players.values()].some((player) => !player.isBot && (player.connected || player.disconnectedAt && Date.now() - player.disconnectedAt < BR_BALANCE.reconnectGraceMs)); }
  dispose(): void { this.physics.dispose(); this.players.clear(); this.loot.clear(); this.crates.clear(); this.projectiles.clear(); this.teams.clear(); }

  view(): BrRoomView {
    const players = [...this.players.values()].map(clonePlayer);
    const living = players.filter((player) => player.alive && !player.downed);
    return { family: this.family, code: this.code, hostId: this.hostId, phase: this.phase, teamMode: this.teamMode, targetPlayers: this.targetPlayers, fillBots: this.fillBots, botDifficulty: this.botDifficulty,
      players, teams: [...this.teams].map(([id, playerIds]) => ({ id, playerIds: [...playerIds] })), countdownEndsAt: this.countdownEndsAt, ship: this.ship ? { ...this.ship, start: { ...this.ship.start }, end: { ...this.ship.end }, position: { ...this.ship.position } } : null,
      storm: { ...this.storm, center: { ...this.storm.center }, nextCenter: { ...this.storm.nextCenter } }, playersRemaining: living.length, teamsRemaining: new Set(living.map((player) => player.teamId)).size, matchResult: this.matchResult, returnVotes: [...this.returnVotes], seed: this.seed };
  }

  private makePlayer(playerId: string, name: string, isBot: boolean, colorIndex: number): BrPlayerRecord {
    return {
      id: playerId, name, isBot, connected: true, ready: isBot, color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length], teamId: "", alive: true, downed: false, deployment: "attached",
      hp: BR_BALANCE.hp, shield: 0, downedHp: BR_BALANCE.downedHp, bleedoutEndsAt: null, position: { x: 0, y: BR_BALANCE.shipHeight, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, yaw: 0, pitch: 0, grounded: false, crouched: false,
      selectedSlot: 0, inventory: createEmptyBrInventory(), ammo: { ...BR_STARTING_AMMO }, lastInputSequence: 0, kills: 0, damageDealt: 0, revives: 0, placement: null,
      crowns: 0, fallbucks: 0, sessionLevel: 1, sessionXp: 0, sessionTotalXp: 0, unlockedPassRewards: ["default"], ownedCosmetics: [], equippedCosmetics: { ...DEFAULT_COSMETICS },
      socketId: null, sessionToken: isBot ? "" : token(), disconnectedAt: null, input: null, lastInputAt: 0, lastJumpSignal: false, lastCrouchSignal: false, lastFireAt: 0, reloadEndsAt: 0, reloadSlot: -1,
      useEndsAt: 0, useSlot: -1, reviveTargetId: null, reviveStartedAt: 0, slideEndsAt: 0, matchStartedAt: 0, eliminatedAt: null, nextBotDecisionAt: 0, botGoal: null,
      shipJumpAt: 0, lastEmoteAt: 0, saberCombo: 0, saberComboAt: 0, stormDamageRemainder: 0, traversalCooldownUntil: 0,
      lastGroundedAt: Number.NEGATIVE_INFINITY, jumpBufferedUntil: 0, spectatorTargetId: null, lastPingAt: 0, history: []
    };
  }

  private addBot(emit = true): void {
    if (this.players.size >= BR_BALANCE.maxPlayers) return;
    const names = new Set([...this.players.values()].map((player) => player.name.toLowerCase()));
    const base = BOT_NAMES.find((name) => !names.has(name.toLowerCase())) ?? `Astro ${this.players.size + 1}`;
    const bot = this.makePlayer(id("br-bot"), base, true, this.players.size);
    this.players.set(bot.id, bot); this.assignTeams(); if (emit) this.emitRoom();
  }

  private assignTeams(): void {
    this.teams.clear();
    const teamSize = this.teamMode === "solo" ? 1 : this.teamMode === "duo" ? 2 : 4;
    [...this.players.values()].forEach((player, index) => {
      const teamId = `team-${Math.floor(index / teamSize) + 1}`;
      player.teamId = teamId;
      const members = this.teams.get(teamId); if (members) members.push(player.id); else this.teams.set(teamId, [player.id]);
    });
  }

  private resetMatch(now: number): void {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0; this.matchStartedAt = now; this.matchResult = null; this.returnVotes.clear(); this.ship = null; this.loot.clear(); this.crates.clear(); this.projectiles.clear(); this.storm = this.initialStorm(); this.stormStageStartedAt = 0; this.physics.reset();
    for (const player of this.players.values()) {
      player.alive = true; player.downed = false; player.deployment = "attached"; player.hp = BR_BALANCE.hp; player.shield = 0; player.downedHp = BR_BALANCE.downedHp; player.bleedoutEndsAt = null; player.crouched = false;
      player.position = { x: 0, y: BR_BALANCE.shipHeight, z: 0 }; player.velocity = { x: 0, y: 0, z: 0 }; player.grounded = false; player.inventory = createEmptyBrInventory(); player.ammo = { ...BR_STARTING_AMMO };
      player.selectedSlot = 0; player.lastInputSequence = 0; player.input = null; player.kills = 0; player.damageDealt = 0; player.revives = 0; player.placement = null; player.eliminatedAt = null; player.matchStartedAt = now;
      player.shipJumpAt = now + 7000 + seededRandom(this.seed ^ this.hash(player.id))() * 27_000; player.history = []; player.traversalCooldownUntil = 0; player.slideEndsAt = 0; player.lastGroundedAt = Number.NEGATIVE_INFINITY; player.jumpBufferedUntil = 0; player.spectatorTargetId = null; player.lastPingAt = 0; this.cancelTimedActions(player);
    }
  }

  private beginShip(now: number): void {
    this.phase = "ship"; this.countdownEndsAt = null;
    const path = brShipPath(this.seed);
    this.ship = { ...path, position: { ...path.start }, startedAt: now, endsAt: now + BR_BALANCE.shipDurationMs, playersAboard: [...this.players.values()].filter((player) => player.alive).length };
    this.spawnLoot(); this.emitRoom();
  }

  private updateShip(_dt: number, now: number): void {
    if (!this.ship) return;
    const t = brClamp((now - this.ship.startedAt) / (this.ship.endsAt - this.ship.startedAt), 0, 1);
    this.ship.position = { x: this.ship.start.x + (this.ship.end.x - this.ship.start.x) * t, y: this.ship.start.y, z: this.ship.start.z + (this.ship.end.z - this.ship.start.z) * t };
    for (const player of this.players.values()) if (player.deployment === "attached") {
      const offset = this.hash(player.id) % 8 - 4;
      player.position = { x: this.ship.position.x + offset, y: this.ship.position.y, z: this.ship.position.z + (this.hash(player.id) % 5 - 2) };
      if ((player.isBot && now >= player.shipJumpAt) || now >= this.ship.endsAt) this.jumpFromShip(player.id, now);
    }
    if (this.ship.playersAboard === 0 || now >= this.ship.endsAt) { this.phase = "combat"; this.beginStorm(now); this.emitRoom(); }
  }

  private updatePlayer(player: BrPlayerRecord, dt: number, now: number): void {
    if (!player.alive || player.deployment === "attached" || player.deployment === "eliminated") return;
    if (player.downed && player.bleedoutEndsAt && now >= player.bleedoutEndsAt) { this.eliminate(player, undefined, undefined, now); return; }
    const input = player.input;
    player.pitch = input?.pitch ?? player.pitch;
    const motion = stepBrMovement(player, {
      moveX: input?.moveX ?? 0, moveY: input?.moveY ?? 0, yaw: input?.yaw ?? player.yaw,
      jump: Boolean(input?.jump), sprint: Boolean(input?.sprint), crouch: Boolean(input?.crouch)
    }, dt, now, (position, desired, options) => this.physics.move(player.id, position, desired, options.jumping, options.crouched));
    player.position = motion.position; player.velocity = motion.velocity; player.yaw = motion.yaw; player.grounded = motion.grounded; player.crouched = motion.crouched; player.deployment = motion.deployment;
    player.lastJumpSignal = motion.lastJumpSignal; player.lastCrouchSignal = motion.lastCrouchSignal; player.slideEndsAt = motion.slideEndsAt; player.traversalCooldownUntil = motion.traversalCooldownUntil;
    player.lastGroundedAt = motion.lastGroundedAt ?? player.lastGroundedAt; player.jumpBufferedUntil = motion.jumpBufferedUntil ?? player.jumpBufferedUntil;
    player.history.push({ at: now, position: { ...player.position } });
    while (player.history.length > 2 && player.history[0].at < now - BR_BALANCE.maxRewindMs) player.history.shift();
    if (player.position.y < BR_BALANCE.fallBoundaryY) this.eliminate(player, undefined, undefined, now);
    if (player.reloadEndsAt && now >= player.reloadEndsAt) { const item = player.inventory[player.reloadSlot]; if (item) reloadBrItem(item, player.ammo); player.reloadEndsAt = 0; player.reloadSlot = -1; }
  }

  private mapRayDistance(origin: Vec3, direction: Vec3, maximum: number): number {
    return this.physics.rayDistance(origin,direction,maximum);
  }

  private fireHitscan(player: BrPlayerRecord, item: BrInventoryItem, origin: Vec3, direction: Vec3, clientTime: number, now: number): void {
    const weapon = BR_WEAPONS[item.itemId as BrWeaponId]; const random = seededRandom(this.seed ^ this.hash(`${player.id}:${now}`));
    const targets = [...this.players.values()].filter((target) => this.canDamage(player, target));
    for (let pellet = 0; pellet < weapon.pellets; pellet++) {
      const shotDirection = brNormalize({ x: direction.x + (random() - .5) * weapon.spread, y: direction.y + (random() - .5) * weapon.spread, z: direction.z + (random() - .5) * weapon.spread });
      let hit: BrPlayerRecord | null = null; let distance = weapon.range; let headshot = false;
      const obstruction = this.mapRayDistance(origin, shotDirection, weapon.range);
      for (const target of targets) {
        const historical = target.history.reduce((best, sample) => Math.abs(sample.at - clientTime) < Math.abs(best.at - clientTime) ? sample : best, target.history[0] ?? { at: now, position: target.position });
        const result = brPlayerHitDistance(origin, shotDirection, historical.position, target.crouched, target.downed);
        if (result !== null && result.distance < distance && result.distance < obstruction) { hit = target; distance = result.distance; headshot = result.headshot; }
      }
      if (hit) this.damage(hit, brRarityDamage(item.itemId as BrWeaponId, item.rarity) * (headshot ? weapon.headshotMultiplier : 1), player, item.itemId as BrWeaponId, now);
    }
  }

  private fireMelee(player: BrPlayerRecord, weaponId: BrWeaponId, direction: Vec3, now: number): void {
    player.saberCombo = now - player.saberComboAt <= 1100 ? (player.saberCombo + 1) % 3 : 0; player.saberComboAt = now;
    const damages = [30, 35, 50];
    for (const target of this.playerGrid.nearby(player.position, BR_WEAPONS[weaponId].range)) {
      if (!this.canDamage(player, target)) continue;
      const to = brNormalize({ x: target.position.x - player.position.x, y: 0, z: target.position.z - player.position.z });
      if (to.x * direction.x + to.z * direction.z >= .35 && this.hasLineOfSight(player,target)) this.damage(target, damages[player.saberCombo] * BR_RARITY_MULTIPLIER[player.inventory[player.selectedSlot]!.rarity], player, weaponId, now);
    }
  }

  private updateProjectiles(dt: number, now: number): void {
    for (const projectile of [...this.projectiles.values()]) {
      const previous = { ...projectile.position };
      projectile.position.x += projectile.velocity.x * dt; projectile.position.y += projectile.velocity.y * dt; projectile.position.z += projectile.velocity.z * dt;
      if (now >= projectile.expiresAt || projectile.position.y <= 0 || !isInsideBrIsland(projectile.position, 80)) { this.explodeProjectile(projectile, previous, now); continue; }
      const owner = this.players.get(projectile.ownerId);
      const direction = brNormalize({ x: projectile.position.x - previous.x, y: projectile.position.y - previous.y, z: projectile.position.z - previous.z }); const segmentLength = this.distance(previous, projectile.position);
      const obstruction = this.mapRayDistance(previous, direction, segmentLength);
      if (obstruction < segmentLength) {
        this.explodeProjectile(projectile, { x: previous.x + direction.x * obstruction, y: previous.y + direction.y * obstruction, z: previous.z + direction.z * obstruction }, now);
        continue;
      }
      const midpoint = { x: (previous.x + projectile.position.x) / 2, y: (previous.y + projectile.position.y) / 2, z: (previous.z + projectile.position.z) / 2 };
      for (const target of this.playerGrid.nearby(midpoint, segmentLength / 2 + 1.5)) {
        if (!owner || !this.canDamage(owner, target)) continue;
        const hit = brPlayerHitDistance(previous, direction, target.position, target.crouched, target.downed);
        if (hit !== null && hit.distance <= segmentLength) { this.explodeProjectile(projectile, target.position, now); break; }
      }
    }
  }

  private explodeProjectile(projectile: BrProjectileState, point: Vec3, now: number): void {
    if (!this.projectiles.delete(projectile.id)) return;
    const owner = this.players.get(projectile.ownerId); if (!owner) return;
    const weapon = BR_WEAPONS[projectile.weaponId];
    const targets = this.playerGrid.nearby(point, weapon.splashRadius ?? 2).filter((target) => this.canDamage(owner, target)).sort((a, b) => this.distance(point, a.position) - this.distance(point, b.position));
    for (const target of projectile.weaponId === "arc-blaster" ? targets.slice(0, 1) : targets) {
      const distance = this.distance(point, target.position); const falloff = 1 - brClamp(distance / (weapon.splashRadius ?? 2), 0, 1);
      this.damage(target, brRarityDamage(projectile.weaponId, projectile.rarity) * (.25 + .75 * falloff), owner, projectile.weaponId, now);
    }
    if (projectile.weaponId === "arc-blaster" && targets[0]) {
      const chained = this.playerGrid.nearby(targets[0].position, 5.5).filter((target) => target.id !== targets[0].id && this.canDamage(owner, target)).sort((a, b) => this.distance(targets[0].position, a.position) - this.distance(targets[0].position, b.position))[0];
      if (chained) this.damage(chained, brRarityDamage(projectile.weaponId, projectile.rarity) * .55, owner, projectile.weaponId, now);
    }
  }

  private damage(target: BrPlayerRecord, amount: number, attacker: BrPlayerRecord | undefined, weaponId: BrWeaponId | undefined, now: number, storm = false): void {
    if (!target.alive || amount <= 0 || (attacker && !this.canDamage(attacker, target))) return;
    if (amount >= 5) { target.useEndsAt = 0; target.useSlot = -1; target.reviveTargetId = null; target.reviveStartedAt = 0; }
    if (target.downed) { target.downedHp = Math.max(0, target.downedHp - amount); if (target.downedHp <= 0) this.eliminate(target, attacker, weaponId, now); return; }
    const result = applyBrDamage(target.hp, target.shield, amount, storm); target.hp = result.hp; target.shield = result.shield;
    if (attacker && attacker.id !== target.id) attacker.damageDealt += result.hpDamage + result.shieldDamage;
    this.io.to(this.code).emit("br:player:damaged", { playerId: target.id, attackerId: attacker?.id, amount: result.hpDamage + result.shieldDamage, hp: target.hp, shield: target.shield, direction: attacker ? brNormalize({ x: target.position.x - attacker.position.x, y: 0, z: target.position.z - attacker.position.z }) : { x: 0, y: 1, z: 0 }, shieldBroken: result.shieldBroken });
    if (target.hp <= 0) {
      const teammateAlive = [...this.players.values()].some((player) => player.id !== target.id && player.teamId === target.teamId && player.alive && !player.downed);
      if (this.teamMode !== "solo" && teammateAlive) {
        target.downed = true; target.deployment = "downed"; target.downedHp = BR_BALANCE.downedHp; target.bleedoutEndsAt = now + BR_BALANCE.bleedoutMs; target.hp = 0; target.velocity = { x: 0, y: 0, z: 0 };
        this.io.to(this.code).emit("br:player:downed", { playerId: target.id, attackerId: attacker?.id }); this.killFeed(target, attacker, weaponId, true, now);
      } else this.eliminate(target, attacker, weaponId, now);
    }
  }

  private eliminate(target: BrPlayerRecord, attacker: BrPlayerRecord | undefined, weaponId: BrWeaponId | undefined, now: number): void {
    if (!target.alive) return;
    target.alive = false; target.downed = false; target.deployment = "eliminated"; target.eliminatedAt = now; target.velocity = { x: 0, y: 0, z: 0 }; this.cancelTimedActions(target);
    if (attacker && attacker.id !== target.id) attacker.kills++;
    for (let slot = 0; slot < target.inventory.length; slot++) if (target.inventory[slot]) this.dropItem(target, slot);
    const alive = [...this.players.values()].filter((player) => player.alive); target.placement = Math.max(1, new Set(alive.map((player) => player.teamId)).size + 1);
    target.spectatorTargetId = alive.find((player) => player.teamId === target.teamId)?.id ?? alive[0]?.id ?? null;
    this.io.to(this.code).emit("br:player:eliminated", { playerId: target.id, attackerId: attacker?.id, weaponId, placement: target.placement }); this.killFeed(target, attacker, weaponId, false, now);
    const eligibleTeammate = [...this.players.values()].some((player) => player.teamId === target.teamId && player.alive && !player.downed);
    if (!eligibleTeammate) for (const teammate of [...this.players.values()]) if (teammate.teamId === target.teamId && teammate.alive && teammate.downed) this.eliminate(teammate, undefined, weaponId, now);
  }

  private killFeed(target: BrPlayerRecord, attacker: BrPlayerRecord | undefined, weaponId: BrWeaponId | undefined, downed: boolean, now: number): void {
    this.io.to(this.code).emit("br:kill-feed", { id: id("feed"), attackerId: attacker?.id, victimId: target.id, weaponId, downed, createdAt: now });
  }

  private updateChannels(now: number): void {
    for (const player of this.players.values()) {
      if (player.useEndsAt && now >= player.useEndsAt) {
        const item = player.inventory[player.useSlot];
        if (item && isBrHeal(item.itemId)) { const heal = BR_HEALS[item.itemId]; player.hp = Math.min(BR_BALANCE.hp, player.hp + heal.hp); player.shield = Math.min(BR_BALANCE.shield, player.shield + heal.shield); if (--item.count <= 0) player.inventory[player.useSlot] = null; }
        player.useEndsAt = 0; player.useSlot = -1;
      }
      if (player.reviveTargetId) {
        const target = this.players.get(player.reviveTargetId);
        if (!player.alive || player.downed || player.deployment !== "grounded" || !target?.alive || !target.downed || player.teamId !== target.teamId || this.distance(player.position, target.position) > BR_BALANCE.reviveRange) { player.reviveTargetId = null; player.reviveStartedAt = 0; }
        else if (now - player.reviveStartedAt >= BR_BALANCE.reviveMs) {
          target.downed = false; target.deployment = "grounded"; target.hp = BR_BALANCE.reviveHp; target.shield = 0; target.downedHp = BR_BALANCE.downedHp; target.bleedoutEndsAt = null; player.revives++;
          this.io.to(this.code).emit("br:player:revived", { playerId: target.id, reviverId: player.id }); player.reviveTargetId = null; player.reviveStartedAt = 0;
        }
      }
    }
  }

  private updateStorm(dt: number, now: number): void {
    const definition = BR_STORM_PHASES[Math.min(this.storm.phaseIndex, BR_STORM_PHASES.length - 1)];
    if (this.storm.stage !== "finished" && this.storm.stageEndsAt && now >= this.storm.stageEndsAt) {
      if (this.storm.stage === "waiting") { this.storm.stage = "closing"; this.stormStageStartedAt = now; this.storm.stageEndsAt = now + definition.closeMs; }
      else {
        this.storm.center = { ...this.storm.nextCenter }; this.storm.radius = this.storm.nextRadius;
        if (this.storm.phaseIndex >= BR_STORM_PHASES.length - 1) { this.storm.stage = "finished"; this.storm.stageEndsAt = null; }
        else { this.storm.phaseIndex++; this.prepareNextCircle(now); }
      }
    }
    if (this.storm.stage === "closing" && this.storm.stageEndsAt) {
      const progress = brClamp((now - this.stormStageStartedAt) / definition.closeMs, 0, 1);
      const startRadius = this.storm.phaseIndex === 0 ? BR_MAP.radius : BR_STORM_PHASES[this.storm.phaseIndex - 1].radius;
      this.storm.radius = startRadius + (this.storm.nextRadius - startRadius) * progress;
      this.storm.center.x += (this.storm.nextCenter.x - this.storm.center.x) * Math.min(1, dt / Math.max(.01, (this.storm.stageEndsAt - now) / 1000));
      this.storm.center.z += (this.storm.nextCenter.z - this.storm.center.z) * Math.min(1, dt / Math.max(.01, (this.storm.stageEndsAt - now) / 1000));
    }
    for (const player of this.players.values()) if (player.alive && !stormContains(this.storm, player.position)) {
      player.stormDamageRemainder += this.storm.damagePerSecond * dt;
      const whole = Math.floor(player.stormDamageRemainder);
      if (whole > 0) { player.stormDamageRemainder -= whole; this.damage(player, whole, undefined, undefined, now, true); }
    }
  }

  private beginStorm(now: number): void { this.stormStageStartedAt = now; this.prepareNextCircle(now); }
  private prepareNextCircle(now: number): void {
    const definition = BR_STORM_PHASES[this.storm.phaseIndex]; const random = seededRandom(this.seed ^ (this.storm.phaseIndex + 1) * 991);
    const maxOffset = Math.max(0, this.storm.radius - definition.radius); const angle = random() * Math.PI * 2; const offset = maxOffset * Math.sqrt(random()) * .72;
    this.storm.nextCenter = { x: this.storm.center.x + Math.cos(angle) * offset, z: this.storm.center.z + Math.sin(angle) * offset };
    this.storm.nextRadius = definition.radius; this.storm.damagePerSecond = definition.damage; this.storm.stage = "waiting"; this.storm.stageEndsAt = now + definition.waitMs;
  }
  private initialStorm(): BrStormState { return { phaseIndex: 0, center: { x: 0, z: 0 }, radius: BR_MAP.radius, nextCenter: { x: 0, z: 0 }, nextRadius: BR_STORM_PHASES[0].radius, stage: "waiting", stageEndsAt: null, damagePerSecond: BR_STORM_PHASES[0].damage }; }

  private spawnLoot(): void {
    const random = seededRandom(this.seed);
    for (const [index,socket] of BR_LOOT_SOCKETS.entries()) {
      const rarityRoll = random(); const rarity: BrRarity = rarityRoll > .965 ? "legendary" : rarityRoll > .82 ? "epic" : rarityRoll > .48 ? "rare" : "common";
      const itemId = ITEM_IDS[Math.floor(random() * ITEM_IDS.length)]; const loot: BrLootState = { id: id("loot"), itemId, rarity, count: isBrHeal(itemId) ? 1 + Math.floor(random() * 2) : 1, magazine: brItemMagazine(itemId), position: { x: socket.position.x + (random() - .5) * 1.4, y: socket.position.y, z: socket.position.z + (random() - .5) * 1.4 } };
      this.loot.set(loot.id, loot);
      if (index%2===0 && random() > .28) { const ammoType = random() > .68 ? "plasma" : random() > .45 ? "heavy" : "light"; const ammo: BrLootState = { id: id("ammo"), ammoType, rarity: "common", count: ammoType === "light" ? 30 : ammoType === "heavy" ? 10 : 6, position: { x: loot.position.x + 1.15, y:socket.position.y, z: loot.position.z - .95 } }; this.loot.set(ammo.id, ammo); }
    }
    this.lootGrid.rebuild(this.loot.values());
    const crates = BR_CRATE_SOCKETS.map((position, index) => ({ id: `crate-${this.seed}-${index}`, position: { ...position }, opened: false }));
    for (const crate of crates) this.crates.set(crate.id, crate);
    this.io.to(this.code).emit("br:crate:spawned", crates);
  }

  private updateBots(now: number): void {
    const profile = BR_BOT_DIFFICULTY[this.botDifficulty];
    for (const bot of this.players.values()) {
      if (!bot.isBot || !bot.alive || bot.deployment === "attached") continue;
      if (bot.deployment === "freefall" || bot.deployment === "chute") {
        const target = BR_POIS[this.hash(bot.id) % BR_POIS.length].position; bot.yaw = Math.atan2(target.x - bot.position.x, -(target.z - bot.position.z)); bot.input = { sequence: ++bot.lastInputSequence, dt: .05, moveX: 0, moveY: 1, yaw: bot.yaw, pitch: -.55, jump: false, sprint: false, crouch: false, fire: false, aim: false, reload: false }; continue;
      }
      if (now < bot.nextBotDecisionAt) continue;
      bot.nextBotDecisionAt = now + profile.reactionMs;
      const random = seededRandom(this.seed ^ this.hash(`${bot.id}:${Math.floor(now / profile.reactionMs)}`));
      const nearbyLoot = this.nearestTo(bot.position,this.lootGrid.nearby(bot.position, profile.lootRadius));
      const nearbyCrate = this.nearestTo(bot.position,[...this.crates.values()].filter((crate) => !crate.opened && this.distance(bot.position, crate.position) <= profile.lootRadius));
      const safeTarget = !stormContains(this.storm, bot.position) ? { x: this.storm.center.x, y: BR_BALANCE.playerHeight, z: this.storm.center.z } : null;
      const nearestEnemy = this.nearestTo(bot.position,this.playerGrid.nearby(bot.position, 70).filter((target) => this.canDamage(bot, target)));
      const enemy=nearestEnemy&&this.hasLineOfSight(bot,nearestEnemy)?nearestEnemy:undefined;
      const teammate=this.teamMode!=="solo"?this.nearestTo(bot.position,[...this.players.values()].filter((target)=>target.id!==bot.id&&target.teamId===bot.teamId&&target.alive&&!target.downed)):undefined;
      const downedTeammate = this.nearestTo(bot.position,[...this.players.values()].filter((target) => target.downed && target.teamId === bot.teamId));
      if (downedTeammate && random() < profile.reviveBias) {
        if (this.distance(bot.position, downedTeammate.position) <= BR_BALANCE.reviveRange) { bot.input = { sequence: ++bot.lastInputSequence, dt: .05, moveX: 0, moveY: 0, yaw: bot.yaw, pitch: 0, jump: false, sprint: false, crouch: false, fire: false, aim: false, reload: false }; this.setRevive(bot.id, downedTeammate.id, true, now); continue; }
        bot.botGoal = downedTeammate.position;
      }
      if (bot.hp < profile.healHpBelow || bot.shield < 30) {
        const healSlot = bot.inventory.findIndex((item) => item && isBrHeal(item.itemId) && ((BR_HEALS[item.itemId].hp > 0 && bot.hp < profile.healHpBelow) || (BR_HEALS[item.itemId].shield > 0 && bot.shield < 30)));
        if (healSlot >= 0) { bot.selectedSlot = healSlot; if (this.useItem(bot.id, now)) { bot.input = { sequence: ++bot.lastInputSequence, dt: .05, moveX: 0, moveY: 0, yaw: bot.yaw, pitch: 0, jump: false, sprint: false, crouch: false, fire: false, aim: false, reload: false }; continue; } }
      }
      if (nearbyCrate && this.distance(bot.position, nearbyCrate.position) <= 2.7) this.openCrate(bot.id, nearbyCrate.id);
      const regroup=teammate&&this.distance(bot.position,teammate.position)>85?teammate.position:null;
      bot.botGoal = bot.botGoal && downedTeammate ? bot.botGoal : safeTarget ?? regroup ?? (enemy && random() < profile.aggression ? enemy.position : nearbyLoot?.position ?? nearbyCrate?.position ?? BR_POIS[this.hash(`${bot.id}:${Math.floor(now / 6000)}`) % BR_POIS.length].position);
      const directEnemy = enemy && this.distance(bot.position,enemy.position)<28;
      const steeringTarget = directEnemy ? bot.botGoal : brNextWaypoint(bot.position,bot.botGoal);
      const delta = { x: steeringTarget.x - bot.position.x, z: steeringTarget.z - bot.position.z }; bot.yaw = Math.atan2(delta.x, -delta.z);
      const goalDistance = Math.hypot(delta.x, delta.z); const throttle = Math.min(1, Math.max(0, (goalDistance - .7) / 4));
      bot.input = { sequence: ++bot.lastInputSequence, dt: .05, moveX: 0, moveY: throttle, yaw: bot.yaw, pitch: 0, jump: goalDistance > 2 && this.nearBlockingGeometry(bot.position, bot.yaw), sprint: goalDistance > 8, crouch: false, fire: false, aim: false, reload: false };
      if (nearbyLoot && this.distance(bot.position, nearbyLoot.position) <= BR_BALANCE.pickupRange) this.pickup(bot.id, nearbyLoot.id);
      const weaponSlot = bot.inventory.findIndex((item) => item && isBrWeapon(item.itemId));
      if (enemy && weaponSlot >= 0 && this.distance(bot.position, enemy.position) < 65) {
        bot.selectedSlot = weaponSlot;
        const held = bot.inventory[weaponSlot]!;
        if (isBrWeapon(held.itemId) && BR_WEAPONS[held.itemId].ammo && held.magazine <= 0) { this.reload(bot.id, now); continue; }
        const aim = brNormalize({ x: enemy.position.x - bot.position.x + (random() - .5) * profile.aimError * 12, y: enemy.position.y + .5 - (bot.position.y + .7), z: enemy.position.z - bot.position.z + (random() - .5) * profile.aimError * 12 });
        this.fire(bot.id, { x: bot.position.x, y: bot.position.y + .7, z: bot.position.z }, aim, now, now);
      }
    }
  }

  private nearBlockingGeometry(position: Vec3, yaw: number): boolean {
    const probe = { x: position.x + Math.sin(yaw) * 1.1, y: position.y, z: position.z - Math.cos(yaw) * 1.1 };
    return brBlocksNear(probe,BR_BALANCE.playerRadius).some((block) => block.kind !== "platform" && block.kind !== "ramp" && Math.abs(probe.x - block.position.x) < block.size.x / 2 + BR_BALANCE.playerRadius && Math.abs(probe.z - block.position.z) < block.size.z / 2 + BR_BALANCE.playerRadius && position.y < block.position.y + block.size.y / 2);
  }

  private hasLineOfSight(observer:BrPlayerRecord,target:BrPlayerRecord):boolean {const origin={x:observer.position.x,y:observer.position.y+.72,z:observer.position.z};const aim={x:target.position.x-origin.x,y:target.position.y+.65-origin.y,z:target.position.z-origin.z};const distance=Math.hypot(aim.x,aim.y,aim.z);if(distance<.001)return true;const direction={x:aim.x/distance,y:aim.y/distance,z:aim.z/distance};return this.mapRayDistance(origin,direction,distance)>=distance-.3;}
  private nearestTo<T extends {position:Vec3}>(origin:Vec3,values:Iterable<T>):T|undefined {let nearest:T|undefined,best=Number.POSITIVE_INFINITY;for(const value of values){const distance=this.distance(origin,value.position);if(distance<best){best=distance;nearest=value;}}return nearest;}

  private checkWinner(now: number): void {
    if (this.phase !== "combat" || this.matchResult) return;
    const alive = [...this.players.values()].filter((player) => player.alive && !player.downed);
    const teams = new Set(alive.map((player) => player.teamId));
    if (teams.size > 1 && now - this.matchStartedAt < BR_BALANCE.matchTimeoutMs) return;
    const scoreTeam = (teamId: string): [number, number, number] => {
      const members = [...this.players.values()].filter((player) => player.teamId === teamId);
      return [members.filter((player) => player.alive && !player.downed).length, members.reduce((sum, player) => sum + player.hp + player.shield, 0), members.reduce((sum, player) => sum + player.kills, 0)];
    };
    const candidateTeams = teams.size ? [...teams] : [...this.teams.keys()];
    candidateTeams.sort((a, b) => { const left = scoreTeam(a); const right = scoreTeam(b); return right[0] - left[0] || right[1] - left[1] || right[2] - left[2] || a.localeCompare(b); });
    const winningTeamId = candidateTeams[0] ?? null;
    if (winningTeamId) for (const player of this.players.values()) if (player.teamId === winningTeamId) player.crowns++;
    const orderedTeams = [...this.teams.keys()].sort((a, b) => {
      if (a === winningTeamId) return -1; if (b === winningTeamId) return 1;
      const eliminatedAt = (teamId: string) => Math.max(0, ...[...this.players.values()].filter((player) => player.teamId === teamId).map((player) => player.eliminatedAt ?? 0));
      return eliminatedAt(b) - eliminatedAt(a) || a.localeCompare(b);
    });
    this.matchResult = { winningTeamId, teamMode: this.teamMode, durationMs: now - this.matchStartedAt, players: [...this.players.values()].map((player) => {
      const placement = winningTeamId === player.teamId ? 1 : Math.max(2, orderedTeams.indexOf(player.teamId) + 1); player.placement = placement;
      const xp = 40 + (placement === 1 ? 60 : placement <= 5 ? 30 : placement <= 10 ? 20 : 0) + Math.min(8, player.kills) * 5 + Math.min(4, player.revives) * 5;
      const bucks = placement === 1 ? 100 : placement === 2 ? 50 : placement === 3 ? 25 : 10;
      if (!player.isBot) {
        player.fallbucks += bucks;
        const previousLevel = player.sessionLevel;
        const maximumXp = (SESSION_PROGRESSION.maxLevel - 1) * SESSION_PROGRESSION.xpPerLevel;
        player.sessionTotalXp = Math.min(maximumXp, player.sessionTotalXp + xp);
        player.sessionLevel = sessionLevelForXp(player.sessionTotalXp);
        player.sessionXp = sessionXpInLevel(player.sessionTotalXp);
        for (const reward of PLANET_PASS_REWARDS) if (reward.level > previousLevel && reward.level <= player.sessionLevel && !player.unlockedPassRewards.includes(reward.id)) {
          player.unlockedPassRewards.push(reward.id);
          if (reward.fallbucks) player.fallbucks += reward.fallbucks;
          if (reward.cosmeticId && !player.ownedCosmetics.includes(reward.cosmeticId)) player.ownedCosmetics.push(reward.cosmeticId);
        }
      }
      return { playerId: player.id, teamId: player.teamId, placement, kills: player.kills, damage: Math.round(player.damageDealt), revives: player.revives, survivalMs: (player.eliminatedAt ?? now) - player.matchStartedAt, xp, fallbucks: bucks };
    }) };
    this.phase = "results"; this.io.to(this.code).emit("br:match:ended", this.matchResult); this.emitRoom();
  }

  private emitSnapshots(now: number): void {
    const all = [...this.players.values()];
    const recipients = all.filter((player): player is BrPlayerRecord & { socketId: string } => Boolean(player.socketId));
    if (!recipients.length) return;
    // A bot-filled private room often has only one network recipient. Avoid
    // cloning every bot before relevance has discarded most of them, while
    // retaining the shared cache for populated human lobbies.
    const cacheAllStates = recipients.length * 2 >= all.length;
    const networkStates = cacheAllStates ? new Map(all.map((player) => [player.id, snapshotPlayer(player)])) : new Map<string, ReturnType<typeof snapshotPlayer>>();
    const networkState = (player: BrPlayerRecord): ReturnType<typeof snapshotPlayer> => {
      const cached = networkStates.get(player.id);
      if (cached) return cached;
      const state = snapshotPlayer(player); networkStates.set(player.id, state); return state;
    };
    const living = all.filter((entry) => entry.alive);
    const playersRemaining = living.length;
    const teamsRemaining = new Set(living.map((entry) => entry.teamId)).size;
    for (const player of recipients) {
      const spectator = !player.alive ? this.players.get(player.spectatorTargetId ?? "") ?? all.find((entry) => entry.alive && entry.teamId === player.teamId) ?? all.find((entry) => entry.alive) : undefined;
      if (spectator) player.spectatorTargetId = spectator.id;
      const anchor = spectator?.position ?? player.position;
      const relevantIds = new Set(this.playerGrid.nearby(anchor, BR_BALANCE.interest.players).map((entry) => entry.id));
      relevantIds.add(player.id); if (spectator) relevantIds.add(spectator.id);
      for (const teammate of all) if (teammate.teamId === player.teamId) relevantIds.add(teammate.id);
      const snapshot: BrSnapshot = { serverTime: now, phase: this.phase, localPlayer: clonePlayer(player), players: all.filter((entry) => relevantIds.has(entry.id)).map(networkState), projectiles: this.projectileGrid.nearby(anchor, BR_BALANCE.interest.projectiles).map((entry) => ({ ...entry, position: { ...entry.position }, velocity: { ...entry.velocity } })), loot: this.lootGrid.nearby(anchor,BR_BALANCE.interest.loot).map((entry)=>({...entry,position:{...entry.position}})), storm: { ...this.storm, center: { ...this.storm.center }, nextCenter: { ...this.storm.nextCenter } }, ship: this.ship ? { ...this.ship, position: { ...this.ship.position }, start: { ...this.ship.start }, end: { ...this.ship.end } } : null, playersRemaining, teamsRemaining, spectatorTargetId: spectator?.id ?? null };
      this.io.to(player.socketId).emit("br:match:snapshot", snapshot);
    }
  }

  private emitRoom(): void { this.io.to(this.code).emit("br:room:state", this.view()); }
  private error(playerId: string, message: string, code?: string): void { const player = this.players.get(playerId); if (player?.socketId) this.io.to(player.socketId).emit("br:error", { message, code }); }
  private canDamage(attacker: BrPlayerRecord, target: BrPlayerRecord): boolean { return target.alive && target.id !== attacker.id && (BR_BALANCE.friendlyFire || target.teamId !== attacker.teamId); }
  private isActionPhase(): boolean { return this.phase === "ship" || this.phase === "combat"; }
  private cancelTimedActions(player: BrPlayerRecord): void { player.reloadEndsAt = 0; player.reloadSlot = -1; player.useEndsAt = 0; player.useSlot = -1; player.reviveTargetId = null; player.reviveStartedAt = 0; }
  private distance(a: Vec3, b: Vec3): number { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
  private hash(value: string): number { let hash = 2166136261; for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619); return hash >>> 0; }
  private migrateHost(): void { this.hostId = [...this.players.values()].find((player) => !player.isBot && player.connected)?.id ?? ""; }
  private cleanupDisconnected(now: number): void {
    for (const player of [...this.players.values()]) {
      if (player.connected || player.isBot || player.disconnectedAt === null || now - player.disconnectedAt < BR_BALANCE.reconnectGraceMs) continue;
      if (this.phase === "lobby") { this.physics.remove(player.id); this.players.delete(player.id); } else this.eliminate(player, undefined, undefined, now);
    }
    if (!this.players.has(this.hostId)) this.migrateHost();
  }
}
