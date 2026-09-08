import { randomBytes } from "node:crypto";
import type { Server as SocketServer, Socket } from "socket.io";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  BALANCE,
  PLAYER_COLORS,
  add,
  applyBurstVelocity,
  applyGrappleVelocity,
  applyLaunchGuidance,
  applyShoveVelocity,
  canExecuteBufferedJump,
  cannonPosition,
  clamp,
  createMatchRules,
  createMatchStats,
  cross,
  damageStage,
  distance,
  dot,
  explosionFalloff,
  gravityAcceleration,
  grappleRestLength,
  isShoveTarget,
  isFiniteVec3,
  launchGravityAcceleration,
  launchPadPosition,
  launchVelocity,
  length,
  limitSpeed,
  normalize,
  projectOnPlane,
  repairPosition,
  sanitizeName,
  selectChaosModifier,
  selectGravityPlanetId,
  selectMatchAwards,
  segmentSphereHit,
  scale,
  stepTangentVelocity,
  sub,
  updateGroundedState,
  type ClientToServerEvents,
  type ChaosModifier,
  type GameMode,
  type JoinResult,
  type MatchEvent,
  type MatchEventType,
  type MatchResult,
  type MatchRules,
  type MatchStats,
  type PlanetState,
  type PlayerInput,
  type PlayerInteraction,
  type PlayerState,
  type ProjectileState,
  type RoomPhase,
  type RoomView,
  type ScrapState,
  type ServerToClientEvents,
  type StructureType,
  type Vec3,
  type WeaponType
} from "@planetfall/shared";
import { BOT_NAMES, BotBrain } from "./bot.js";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;

interface PlayerRecord extends PlayerState {
  socketId: string | null;
  sessionToken: string;
  disconnectedAt: number | null;
  lastBurstAt: number;
  lastFireAt: number;
  lastInputAt: number;
  lastRepairAt: number;
  launchSourcePlanetId: string | null;
  launchTargetPlanetId: string | null;
  launchAssistUntil: number;
  grounded: boolean;
  lastGroundedAt: number;
  jumpQueuedUntil: number;
  jumpSignalActive: boolean;
  grappleAnchor: Vec3 | null;
  grappleRestLength: number;
  sabotage: { planetId: string; structure: StructureType; startedAt: number } | null;
  input: PlayerInput | null;
  body: RAPIER.RigidBody;
}

function id(prefix: string): string { return `${prefix}_${randomBytes(5).toString("hex")}`; }
function token(): string { return randomBytes(18).toString("base64url"); }
function clonePlayer(player: PlayerRecord): PlayerState {
  const {
    socketId: _a, sessionToken: _b, disconnectedAt: _c, lastBurstAt: _d, lastFireAt: _e,
    lastInputAt: _f, lastRepairAt: _g, launchSourcePlanetId: _h, launchTargetPlanetId: _i,
    launchAssistUntil: _j, grounded: _k, lastGroundedAt: _l, jumpQueuedUntil: _m,
    jumpSignalActive: _n, grappleAnchor: _o, grappleRestLength: _p,
    sabotage: _q, input: _r, body: _s, ...view
  } = player;
  return view;
}

export class GameRoom {
  readonly code: string;
  hostId = "";
  phase: RoomPhase = "lobby";
  players = new Map<string, PlayerRecord>();
  planets = new Map<string, PlanetState>();
  scraps = new Map<string, ScrapState>();
  projectiles = new Map<string, ProjectileState>();
  rematchVotes = new Set<string>();
  matchStats = new Map<string, MatchStats>();
  matchResult: MatchResult | null = null;
  gameMode: GameMode = "classic";
  activeModifier: ChaosModifier | null = null;
  rules: MatchRules = createMatchRules();
  winStreak: RoomView["winStreak"] = null;
  matchEndsAt: number | null = null;
  winnerId: string | null = null;
  countdownStartsAt: number | null = null;
  overtimeEndsAt: number | null = null;
  lastScrapSpawn = 0;
  private snapshotAccumulator = 0;
  private world: RAPIER.World;
  private botBrains = new Map<string, BotBrain>();
  private visitedPlanets = new Map<string, Set<string>>();
  private lastChaosModifier: ChaosModifier | null = null;
  private matchStartedAt = 0;
  private readonly matchDurationMs = process.env.NODE_ENV === "test" && Number(process.env.PLANETFALL_TEST_MATCH_MS) >= 5000
    ? Number(process.env.PLANETFALL_TEST_MATCH_MS) : BALANCE.matchMs;

  constructor(code: string, private io: GameServer) {
    this.code = code;
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  }

  join(socket: GameSocket, rawName: unknown, sessionToken?: string): JoinResult {
    const name = sanitizeName(rawName);
    if (!name) return { ok: false, error: "Enter a name first." };

    const now = Date.now();
    const returning = sessionToken
      ? [...this.players.values()].find((p) => p.sessionToken === sessionToken && !p.connected && p.disconnectedAt !== null && now - p.disconnectedAt < BALANCE.reconnectGraceMs)
      : undefined;
    if (returning) {
      returning.connected = true;
      returning.socketId = socket.id;
      returning.disconnectedAt = null;
      returning.name = name;
      returning.lastInputSequence = 0;
      returning.lastInputAt = 0;
      returning.input = null;
      socket.join(this.code);
      socket.data.roomCode = this.code;
      socket.data.playerId = returning.id;
      this.emitRoom();
      return { ok: true, room: this.view(), playerId: returning.id, sessionToken: returning.sessionToken };
    }

    if (this.phase !== "lobby") return { ok: false, error: "That match is already in progress." };
    if (this.players.size >= BALANCE.maxPlayers) return { ok: false, error: "That room is full." };
    if ([...this.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: "That name is already in use." };
    }

    const playerId = id("player");
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.world.createCollider(RAPIER.ColliderDesc.capsule(0.45, 0.38), body);
    const player: PlayerRecord = {
      id: playerId,
      name,
      isBot: false,
      color: PLAYER_COLORS[this.players.size % PLAYER_COLORS.length],
      planetId: "",
      connected: true,
      ready: false,
      alive: true,
      scrap: BALANCE.startingScrap,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      lastInputSequence: 0,
      surfacePlanetId: null,
      gravityPlanetId: null,
      launchCooldownUntil: 0,
      shoveCooldownUntil: 0,
      crowns: 0,
      socketId: socket.id,
      sessionToken: token(),
      disconnectedAt: null,
      lastBurstAt: 0,
      lastFireAt: 0,
      lastInputAt: 0,
      lastRepairAt: 0,
      launchSourcePlanetId: null,
      launchTargetPlanetId: null,
      launchAssistUntil: 0,
      grounded: false,
      lastGroundedAt: 0,
      jumpQueuedUntil: 0,
      jumpSignalActive: false,
      grappleAnchor: null,
      grappleRestLength: 0,
      sabotage: null,
      input: null,
      body
    };
    this.players.set(playerId, player);
    if (!this.hostId) this.hostId = playerId;
    this.rebuildPlanets();
    socket.join(this.code);
    socket.data.roomCode = this.code;
    socket.data.playerId = playerId;
    this.emitRoom();
    return { ok: true, room: this.view(), playerId, sessionToken: player.sessionToken };
  }

  addBot(requesterId: string, emit = true): string | null {
    if (this.phase !== "lobby" || requesterId !== this.hostId) return null;
    if (this.players.size >= BALANCE.maxPlayers) {
      this.error(requesterId, "Room full.");
      return null;
    }
    const usedNames = new Set([...this.players.values()].map((player) => player.name.toLowerCase()));
    const name = BOT_NAMES.find((candidate) => !usedNames.has(candidate.toLowerCase())) ?? `Bot ${this.players.size + 1}`;
    const usedColors = new Set([...this.players.values()].map((player) => player.color));
    const color = PLAYER_COLORS.find((candidate) => !usedColors.has(candidate)) ?? PLAYER_COLORS[this.players.size % PLAYER_COLORS.length];
    const playerId = id("bot");
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.world.createCollider(RAPIER.ColliderDesc.capsule(0.45, 0.38), body);
    const bot: PlayerRecord = {
      id: playerId, name, isBot: true, color, planetId: "", connected: true, ready: true,
      alive: true, scrap: BALANCE.startingScrap,
      position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, lastInputSequence: 0,
      surfacePlanetId: null, gravityPlanetId: null, launchCooldownUntil: 0, shoveCooldownUntil: 0,
      crowns: 0,
      socketId: null, sessionToken: "", disconnectedAt: null,
      lastBurstAt: 0, lastFireAt: 0, lastInputAt: 0, lastRepairAt: 0,
      launchSourcePlanetId: null, launchTargetPlanetId: null, launchAssistUntil: 0,
      grounded: false, lastGroundedAt: 0, jumpQueuedUntil: 0, jumpSignalActive: false,
      grappleAnchor: null, grappleRestLength: 0, sabotage: null,
      input: null, body
    };
    this.players.set(playerId, bot);
    this.botBrains.set(playerId, new BotBrain(`${this.code}:${playerId}`));
    this.rebuildPlanets();
    if (emit) this.emitRoom();
    return playerId;
  }

  removeBot(requesterId: string, botId: string): void {
    if (this.phase !== "lobby" || requesterId !== this.hostId) return;
    const bot = this.players.get(botId);
    if (!bot?.isBot) return;
    this.world.removeRigidBody(bot.body);
    this.players.delete(botId);
    this.botBrains.delete(botId);
    this.matchStats.delete(botId);
    this.visitedPlanets.delete(botId);
    this.rebuildPlanets();
    this.emitRoom();
  }

  prepareSolo(playerId: string, botCount = 3): void {
    if (playerId !== this.hostId || this.phase !== "lobby") return;
    for (let i = 0; i < botCount && this.players.size < BALANCE.maxPlayers; i++) this.addBot(playerId, false);
    const human = this.players.get(playerId);
    if (human) human.ready = true;
    this.start(playerId);
  }

  disconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.isBot) return;
    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = Date.now();
    player.input = null;
    player.jumpSignalActive = false;
    player.jumpQueuedUntil = 0;
    player.grappleAnchor = null;
    player.grappleRestLength = 0;
    player.sabotage = null;
    if (player.id === this.hostId) this.migrateHost();
    this.emitRoom();
  }

  setReady(playerId: string, ready: boolean): void {
    if (this.phase !== "lobby") return;
    const player = this.players.get(playerId);
    if (!player || player.isBot) return;
    player.ready = Boolean(ready);
    this.emitRoom();
  }

  setMode(playerId: string, mode: unknown): void {
    if (this.phase !== "lobby" || playerId !== this.hostId || (mode !== "classic" && mode !== "chaos")) return;
    this.gameMode = mode;
    this.activeModifier = null;
    this.rules = createMatchRules();
    this.emitRoom();
  }

  start(playerId: string): void {
    if (this.phase !== "lobby" || playerId !== this.hostId) return;
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (connected.length < BALANCE.minPlayers) return this.error(playerId, "Add another player or bot.");
    if ([...this.players.values()].some((p) => !p.connected)) return this.error(playerId, "Waiting for players to reconnect.");
    if (!connected.every((p) => p.ready)) return this.error(playerId, "Waiting for players.");
    this.activeModifier = this.gameMode === "chaos" ? selectChaosModifier(this.lastChaosModifier) : null;
    if (this.activeModifier) this.lastChaosModifier = this.activeModifier;
    this.rules = createMatchRules(this.activeModifier);
    this.resetMatch();
    this.phase = "countdown";
    this.countdownStartsAt = Date.now() + 3200;
    this.emitRoom();
    this.io.to(this.code).emit("match:countdown", {
      startsAt: this.countdownStartsAt, mode: this.gameMode, modifier: this.activeModifier, rules: this.rules
    });
  }

  setInput(playerId: string, input: unknown): void {
    const player = this.players.get(playerId);
    if (!player?.alive || (this.phase !== "playing" && this.phase !== "overtime")) return;
    if (!input || typeof input !== "object") return;
    const candidate = input as Partial<PlayerInput>;
    if (!Number.isInteger(candidate.sequence) || candidate.sequence! <= player.lastInputSequence || !isFiniteVec3(candidate.cameraForward)) return;
    const now = Date.now();
    if (!player.isBot && now - player.lastInputAt < 20) return;
    const grapplePoint = isFiniteVec3(candidate.grapplePoint) ? { ...candidate.grapplePoint } : undefined;
    const jumpSignal = candidate.jump === true;
    if (jumpSignal && !player.jumpSignalActive) player.jumpQueuedUntil = now + BALANCE.ground.jumpBufferMs;
    player.jumpSignalActive = jumpSignal;
    player.input = {
      sequence: candidate.sequence!,
      dt: clamp(Number(candidate.dt) || 0, 0, 0.1),
      moveX: clamp(Number(candidate.moveX) || 0, -1, 1),
      moveY: clamp(Number(candidate.moveY) || 0, -1, 1),
      cameraForward: { ...candidate.cameraForward },
      jump: candidate.jump === true,
      burst: candidate.burst === true,
      grapple: candidate.grapple === true && Boolean(grapplePoint),
      grapplePoint
    };
    player.lastInputAt = now;
    player.lastInputSequence = candidate.sequence!;
  }

  interact(playerId: string, interaction: unknown): void {
    if (!interaction || typeof interaction !== "object") return;
    const payload = interaction as Partial<PlayerInteraction> & Record<string, unknown>;
    if (payload.action === "launch" && typeof payload.targetPlanetId === "string") {
      this.launch(playerId, payload.targetPlanetId);
    } else if (payload.action === "shove" && typeof payload.targetPlayerId === "string") {
      this.shove(playerId, payload.targetPlayerId);
    } else if (
      payload.action === "sabotage"
      && typeof payload.planetId === "string"
      && (payload.structure === "cannon" || payload.structure === "repair")
      && typeof payload.active === "boolean"
    ) {
      this.sabotage(playerId, payload.planetId, payload.structure, payload.active);
    }
  }

  launch(playerId: string, targetPlanetId: string, now = Date.now()): boolean {
    const player = this.players.get(playerId);
    const target = this.planets.get(targetPlanetId);
    if (!player?.alive || !target?.alive || (this.phase !== "playing" && this.phase !== "overtime")) return false;
    const source = [...this.planets.values()]
      .filter((planet) => planet.alive && planet.id !== target.id)
      .sort((a, b) => distance(player.position, launchPadPosition(a)) - distance(player.position, launchPadPosition(b)))[0];
    if (!source || distance(player.position, launchPadPosition(source)) > BALANCE.launch.range) {
      this.error(playerId, "Stand on a launch pad.");
      return false;
    }
    if (now < player.launchCooldownUntil) {
      this.error(playerId, "Launch pad recharging.");
      return false;
    }
    this.cancelSabotage(player, true);
    player.velocity = launchVelocity(player.position, source, target);
    player.launchCooldownUntil = now + this.rules.launchCooldownMs;
    player.launchSourcePlanetId = source.id;
    player.launchTargetPlanetId = target.id;
    player.launchAssistUntil = now + BALANCE.launch.assistMs;
    player.surfacePlanetId = null;
    player.gravityPlanetId = source.id;
    player.grounded = false;
    player.lastGroundedAt = 0;
    player.jumpQueuedUntil = 0;
    player.grappleAnchor = null;
    player.grappleRestLength = 0;
    this.io.to(this.code).emit("player:launched", {
      playerId, sourcePlanetId: source.id, targetPlanetId: target.id,
      position: { ...player.position }, velocity: { ...player.velocity }, cooldownUntil: player.launchCooldownUntil
    });
    this.emitMatchEvent("launch", { actorId: player.id, targetId: target.ownerId, planetId: target.id }, now);
    return true;
  }

  shove(playerId: string, targetPlayerId: string, now = Date.now()): boolean {
    const player = this.players.get(playerId);
    const target = this.players.get(targetPlayerId);
    if (!player?.alive || !target?.alive || player.id === target.id || (this.phase !== "playing" && this.phase !== "overtime")) return false;
    if (now < player.shoveCooldownUntil || distance(player.position, target.position) > BALANCE.shove.range) return false;
    const planet = this.nearestAlivePlanet(player.position);
    const targetPlanet = this.nearestAlivePlanet(target.position);
    if (!planet || targetPlanet?.id !== planet.id) return false;
    if (distance(player.position, planet.position) - BALANCE.planetRadius > 2 || distance(target.position, planet.position) - BALANCE.planetRadius > 2) return false;
    if (!isShoveTarget(player.position, target.position, planet.position, player.input?.cameraForward ?? sub(target.position, player.position))) return false;
    const outward = normalize(sub(target.position, planet.position));
    const tangentAway = projectOnPlane(sub(target.position, player.position), outward);
    let away = length(tangentAway) >= 0.1 ? normalize(tangentAway) : normalize(projectOnPlane(player.input?.cameraForward ?? { x: 0, y: 0, z: 1 }, outward));
    target.velocity = applyShoveVelocity(target.velocity, away, outward, this.rules.shoveForce);
    target.grounded = false;
    target.jumpQueuedUntil = 0;
    player.shoveCooldownUntil = now + this.rules.shoveCooldownMs;
    this.stat(player.id).successfulShoves += 1;
    this.stat(target.id).timesShoved += 1;
    this.cancelSabotage(target, true);
    this.io.to(this.code).emit("player:shoved", {
      attackerId: player.id, targetId: target.id, planetId: planet.id,
      position: { ...target.position }, velocity: { ...target.velocity }
    });
    this.emitMatchEvent("shove", { actorId: player.id, targetId: target.id, planetId: planet.id }, now);
    return true;
  }

  sabotage(playerId: string, planetId: string, structure: StructureType, active: boolean, now = Date.now()): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    if (!active) {
      this.cancelSabotage(player, true);
      return true;
    }
    const planet = this.planets.get(planetId);
    if (!player.alive || !planet?.alive || planet.ownerId === player.id || (this.phase !== "playing" && this.phase !== "overtime")) return false;
    if (distance(player.position, this.structurePosition(planet, structure)) > BALANCE.sabotage.range) return false;
    const disabledUntil = structure === "cannon" ? planet.cannonDisabledUntil : planet.repairDisabledUntil;
    const immuneUntil = structure === "cannon" ? planet.cannonSabotageImmuneUntil : planet.repairSabotageImmuneUntil;
    if (disabledUntil > now || immuneUntil > now) return false;
    if (player.sabotage?.planetId === planetId && player.sabotage.structure === structure) return true;
    player.sabotage = { planetId, structure, startedAt: now };
    return true;
  }

  fire(playerId: string, weapon: unknown, direction: unknown, now = Date.now()): void {
    const player = this.players.get(playerId);
    const planet = player ? this.planets.get(player.planetId) : undefined;
    if (!player?.alive || !planet?.alive || !isFiniteVec3(direction) || (weapon !== "rocket" && weapon !== "asteroid")) return;
    if (this.phase !== "playing" && this.phase !== "overtime") return;
    const config = BALANCE.weapons[weapon];
    if (!config) return;
    if (now - player.lastFireAt < config.cooldownMs) return;
    if (planet.cannonDisabledUntil > now) return this.error(playerId, "Cannon jammed.");
    const cannon = cannonPosition(planet);
    if (distance(player.position, cannon) > BALANCE.cannonRange) return this.error(playerId, "Stand beside your cannon to fire.");
    if (player.scrap < config.cost) return this.error(playerId, "Not enough scrap.");
    const aim = normalize(direction);
    if (dot(aim, normalize(sub(cannon, planet.position))) < -0.35) return;
    player.scrap -= config.cost;
    player.lastFireAt = now;
    if (weapon === "rocket") this.stat(player.id).rocketsFired += 1;
    else this.stat(player.id).asteroidsFired += 1;
    const projectile: ProjectileState = {
      id: id("shot"), ownerId: playerId, weapon,
      position: add(cannon, scale(aim, 1.8)),
      velocity: scale(aim, config.speed), spawnedAt: now
    };
    this.projectiles.set(projectile.id, projectile);
    this.io.to(this.code).emit("projectile:spawned", projectile);
    this.emitRoom();
  }

  repair(playerId: string, now = Date.now()): void {
    const player = this.players.get(playerId);
    const planet = player ? this.planets.get(player.planetId) : undefined;
    if (!player?.alive || !planet?.alive || this.phase === "overtime") return;
    if (this.phase !== "playing") return;
    if (now - player.lastRepairAt < 250) return;
    if (planet.repairDisabledUntil > now) return this.error(playerId, "Repair core jammed.");
    const station = repairPosition(planet);
    if (distance(player.position, station) > BALANCE.repair.range) return this.error(playerId, "Stand beside the repair core.");
    if (player.scrap < BALANCE.repair.cost) return this.error(playerId, "Not enough scrap.");
    if (planet.integrity >= this.rules.maxIntegrity) return this.error(playerId, "Your planet is already at full integrity.");
    player.scrap -= BALANCE.repair.cost;
    player.lastRepairAt = now;
    const before = planet.integrity;
    planet.integrity = Math.min(this.rules.maxIntegrity, planet.integrity + BALANCE.repair.heal);
    planet.damageStage = damageStage(planet.integrity);
    const stats = this.stat(player.id);
    stats.repairsPerformed += 1;
    stats.integrityRepaired += planet.integrity - before;
    this.io.to(this.code).emit("planet:repaired", { planetId: planet.id, playerId, integrity: planet.integrity, amount: planet.integrity - before });
    this.emitRoom();
  }

  voteRematch(playerId: string): void {
    if (this.phase !== "results" || !this.players.has(playerId)) return;
    this.rematchVotes.add(playerId);
    const connected = [...this.players.values()].filter((p) => p.connected);
    const humans = connected.filter((p) => !p.isBot);
    if (humans.length >= 1 && humans.every((p) => this.rematchVotes.has(p.id))) {
      const readyVotes = new Set(this.rematchVotes);
      this.phase = "lobby";
      this.winnerId = null;
      this.matchEndsAt = null;
      this.countdownStartsAt = null;
      this.overtimeEndsAt = null;
      this.lastScrapSpawn = 0;
      this.snapshotAccumulator = 0;
      this.scraps.clear();
      this.projectiles.clear();
      this.matchResult = null;
      this.matchStartedAt = 0;
      this.activeModifier = null;
      this.rules = createMatchRules();
      this.rematchVotes.clear();
      for (const p of connected) {
        p.ready = p.isBot || readyVotes.has(p.id);
        p.alive = true;
        p.scrap = BALANCE.startingScrap;
        p.input = null;
        p.lastInputSequence = 0;
        p.surfacePlanetId = p.planetId;
        p.gravityPlanetId = p.planetId;
        p.launchCooldownUntil = 0;
        p.shoveCooldownUntil = 0;
        p.launchSourcePlanetId = null;
        p.launchTargetPlanetId = null;
        p.launchAssistUntil = 0;
        p.grounded = true;
        p.lastGroundedAt = Date.now();
        p.jumpQueuedUntil = 0;
        p.jumpSignalActive = false;
        p.grappleAnchor = null;
        p.grappleRestLength = 0;
        p.sabotage = null;
      }
      this.rebuildPlanets();
      this.resetMatchStats();
    }
    this.emitRoom();
  }

  update(dt: number, now: number): void {
    this.removeExpiredDisconnects(now);
    if (this.phase === "countdown" && this.countdownStartsAt && now >= this.countdownStartsAt) {
      this.phase = "playing";
      this.matchStartedAt = now;
      this.matchEndsAt = now + this.matchDurationMs;
      this.countdownStartsAt = null;
      this.emitRoom();
    }
    if (this.phase !== "playing" && this.phase !== "overtime") return;
    this.updateBots(now);
    for (const player of this.players.values()) this.updatePlayer(player, dt, now);
    this.updateSabotage(now);
    this.updateProjectiles(dt, now);
    this.collectScrap();
    if (now - this.lastScrapSpawn >= this.rules.scrapSpawnMs) {
      this.lastScrapSpawn = now;
      for (const planet of this.planets.values()) if (planet.alive) this.spawnScrap(planet);
    }
    if (this.phase === "playing" && this.matchEndsAt && now >= this.matchEndsAt) this.resolveTimer(now);
    if (this.phase === "overtime" && this.overtimeEndsAt && now >= this.overtimeEndsAt) this.resolveTimer(now);
    this.snapshotAccumulator += dt;
    if (this.snapshotAccumulator >= 1 / BALANCE.snapshotRate) {
      this.snapshotAccumulator = 0;
      this.io.to(this.code).emit("match:snapshot", {
        serverTime: now, phase: this.phase,
        players: [...this.players.values()].map(clonePlayer),
        planets: [...this.planets.values()], scraps: [...this.scraps.values()], matchEndsAt: this.matchEndsAt
      });
    }
    this.world.step();
  }

  view(): RoomView {
    return {
      code: this.code, hostId: this.hostId, phase: this.phase,
      players: [...this.players.values()].map(clonePlayer),
      planets: [...this.planets.values()], scraps: [...this.scraps.values()],
      countdownEndsAt: this.countdownStartsAt,
      matchEndsAt: this.matchEndsAt, winnerId: this.winnerId,
      rematchVotes: [...this.rematchVotes],
      matchStats: [...this.matchStats.values()].map((entry) => ({ ...entry })),
      matchResult: this.matchResult,
      gameMode: this.gameMode, activeModifier: this.activeModifier, rules: { ...this.rules },
      winStreak: this.winStreak ? { ...this.winStreak } : null
    };
  }

  isEmpty(): boolean { return ![...this.players.values()].some((player) => !player.isBot); }

  private rebuildPlanets(): void {
    this.planets.clear();
    const players = [...this.players.values()];
    players.forEach((player, index) => {
      const angle = (index / Math.max(players.length, 2)) * Math.PI * 2;
      const position = { x: Math.cos(angle) * BALANCE.arenaRadius, y: 0, z: Math.sin(angle) * BALANCE.arenaRadius };
      const planetId = `planet_${player.id}`;
      player.planetId = planetId;
      player.position = add(position, { x: 0, y: BALANCE.planetRadius + 1.15, z: 0 });
      player.velocity = { x: 0, y: 0, z: 0 };
      player.surfacePlanetId = planetId;
      player.gravityPlanetId = planetId;
      player.grounded = true;
      player.lastGroundedAt = Date.now();
      player.body.setNextKinematicTranslation(player.position);
      this.planets.set(planetId, {
        id: planetId, ownerId: player.id, position,
        integrity: this.rules.maxIntegrity, alive: true,
        palette: index % 6, damageStage: this.activeModifier === "fragile-worlds" ? 1 : 0,
        cannonDisabledUntil: 0, repairDisabledUntil: 0,
        cannonSabotageImmuneUntil: 0, repairSabotageImmuneUntil: 0
      });
    });
  }

  private resetMatch(): void {
    this.scraps.clear(); this.projectiles.clear(); this.rematchVotes.clear(); this.winnerId = null; this.overtimeEndsAt = null;
    this.matchResult = null; this.matchStartedAt = 0;
    this.rebuildPlanets();
    this.resetMatchStats();
    for (const player of this.players.values()) {
      player.alive = player.connected; player.scrap = BALANCE.startingScrap; player.input = null;
      player.lastInputSequence = 0; player.lastFireAt = 0; player.lastBurstAt = 0; player.lastInputAt = 0; player.lastRepairAt = 0;
      player.surfacePlanetId = player.planetId; player.launchCooldownUntil = 0; player.shoveCooldownUntil = 0;
      player.gravityPlanetId = player.planetId;
      player.launchSourcePlanetId = null; player.launchTargetPlanetId = null; player.launchAssistUntil = 0;
      player.grounded = true; player.lastGroundedAt = Date.now(); player.jumpQueuedUntil = 0; player.jumpSignalActive = false;
      player.grappleAnchor = null; player.grappleRestLength = 0; player.sabotage = null;
    }
    for (const planet of this.planets.values()) for (let i = 0; i < 3; i++) this.spawnScrap(planet);
  }

  private updatePlayer(player: PlayerRecord, dt: number, now: number): void {
    if (!player.alive) return;
    const activeLaunch = now < player.launchAssistUntil
      && Boolean(player.launchSourcePlanetId && player.launchTargetPlanetId);
    const surfacePlanet = player.surfacePlanetId ? this.planets.get(player.surfacePlanetId) : undefined;
    const preferredGravityId = activeLaunch ? player.launchTargetPlanetId : null;
    player.gravityPlanetId = surfacePlanet?.alive
      ? surfacePlanet.id
      : selectGravityPlanetId(player.position, [...this.planets.values()], player.gravityPlanetId, preferredGravityId);
    const planet = player.gravityPlanetId ? this.planets.get(player.gravityPlanetId) : this.nearestAlivePlanet(player.position);
    if (!planet) return;
    const outward = normalize(sub(player.position, planet.position));
    const altitude = distance(player.position, planet.position) - BALANCE.planetRadius;
    player.grounded = !activeLaunch && updateGroundedState(player.grounded, altitude, dot(player.velocity, outward));
    if (player.grounded) player.lastGroundedAt = now;
    const input = player.input;
    let tangentVelocity = projectOnPlane(player.velocity, outward);
    let desired: Vec3 = { x: 0, y: 0, z: 0 };
    let hasMove = false;
    if (input) {
      const projectedForward = projectOnPlane(input.cameraForward, outward);
      const forward = length(projectedForward) >= 0.1 ? normalize(projectedForward) : normalize(cross(
        outward, Math.abs(outward.y) > .9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
      ));
      const right = normalize(cross(forward, outward));
      const inputMagnitude = Math.min(1, Math.hypot(input.moveX, input.moveY));
      const moveDirection = add(scale(right, input.moveX), scale(forward, input.moveY));
      hasMove = length(moveDirection) > 0.05;
      desired = hasMove ? scale(normalize(moveDirection), BALANCE.moveSpeed * inputMagnitude) : desired;
      tangentVelocity = stepTangentVelocity(
        tangentVelocity,
        desired,
        hasMove,
        player.grounded,
        dt,
        now - player.lastBurstAt < BALANCE.burstRecoveryMs
      );
      const jump = canExecuteBufferedJump(now, player.jumpQueuedUntil, player.lastGroundedAt, player.grounded);
      let radialSpeed = dot(player.velocity, outward);
      if (jump) {
        radialSpeed = this.rules.jumpSpeed;
        player.jumpQueuedUntil = 0;
        player.grounded = false;
      } else if (player.grounded && radialSpeed < 0.5) {
        radialSpeed = Math.min(radialSpeed, -BALANCE.ground.adhesionSpeed);
      }
      player.velocity = add(tangentVelocity, scale(outward, radialSpeed));
      if (!jump) {
        const source = player.launchSourcePlanetId ? this.planets.get(player.launchSourcePlanetId) : undefined;
        const target = player.launchTargetPlanetId ? this.planets.get(player.launchTargetPlanetId) : undefined;
        const gravity = activeLaunch && source?.alive && target?.alive
          ? launchGravityAcceleration(player.position, source, target, this.rules.gravity)
          : gravityAcceleration(player.position, planet, this.rules.gravity);
        player.velocity = add(player.velocity, scale(gravity, dt));
      }
      if (input.burst && now - player.lastBurstAt > BALANCE.burstCooldownMs) {
        player.lastBurstAt = now;
        player.velocity = applyBurstVelocity(player.velocity, hasMove ? desired : forward, outward, player.grounded);
      }
      if (input.grapple && input.grapplePoint && this.validGrapple(player.position, input.grapplePoint)) {
        if (!player.grappleAnchor || distance(player.grappleAnchor, input.grapplePoint) > 0.35) {
          player.grappleAnchor = { ...input.grapplePoint };
          player.grappleRestLength = grappleRestLength(distance(player.position, input.grapplePoint));
        }
        player.velocity = applyGrappleVelocity(player.velocity, player.position, player.grappleAnchor, player.grappleRestLength, dt);
      } else {
        player.grappleAnchor = null;
        player.grappleRestLength = 0;
      }
    } else {
      tangentVelocity = stepTangentVelocity(tangentVelocity, { x: 0, y: 0, z: 0 }, false, player.grounded, dt);
      let radialSpeed = dot(player.velocity, outward);
      if (player.grounded && radialSpeed < 0.5) radialSpeed = Math.min(radialSpeed, -BALANCE.ground.adhesionSpeed);
      const source = player.launchSourcePlanetId ? this.planets.get(player.launchSourcePlanetId) : undefined;
      const target = player.launchTargetPlanetId ? this.planets.get(player.launchTargetPlanetId) : undefined;
      const gravity = activeLaunch && source?.alive && target?.alive
        ? launchGravityAcceleration(player.position, source, target, this.rules.gravity)
        : gravityAcceleration(player.position, planet, this.rules.gravity);
      player.velocity = add(add(tangentVelocity, scale(outward, radialSpeed)), scale(gravity, dt));
      player.grappleAnchor = null;
      player.grappleRestLength = 0;
    }
    const launchTarget = player.launchTargetPlanetId ? this.planets.get(player.launchTargetPlanetId) : undefined;
    const launchSource = player.launchSourcePlanetId ? this.planets.get(player.launchSourcePlanetId) : undefined;
    if (launchTarget?.alive && launchSource?.alive && activeLaunch && !player.surfacePlanetId) {
      player.velocity = applyLaunchGuidance(player.velocity, player.position, launchSource, launchTarget, dt);
    }
    if (length(player.position) > BALANCE.softBoundaryRadius) {
      const recovery = this.nearestAlivePlanet(player.position);
      if (recovery) player.velocity = add(player.velocity, scale(normalize(sub(recovery.position, player.position)), BALANCE.softBoundaryPull * dt));
    }
    player.velocity = length(player.velocity) > BALANCE.maxPlayerSpeed ? scale(normalize(player.velocity), BALANCE.maxPlayerSpeed) : player.velocity;
    player.position = add(player.position, scale(player.velocity, dt));
    const collisionPlanet = this.nearestAlivePlanet(player.position) ?? planet;
    const nextOutward = normalize(sub(player.position, collisionPlanet.position));
    const minDistance = BALANCE.planetRadius + 0.95;
    const radialDistance = distance(player.position, collisionPlanet.position);
    if (radialDistance < minDistance) {
      player.position = add(collisionPlanet.position, scale(nextOutward, minDistance));
      const inwardSpeed = dot(player.velocity, nextOutward);
      if (inwardSpeed < 0) player.velocity = sub(player.velocity, scale(nextOutward, inwardSpeed));
    }
    player.body.setNextKinematicTranslation(player.position);
    const surface = this.nearestAlivePlanet(player.position);
    const surfaceAltitude = surface ? distance(player.position, surface.position) - BALANCE.planetRadius : Infinity;
    if (surface && surfaceAltitude <= BALANCE.ground.enterAltitude) {
      if (player.surfacePlanetId !== surface.id) {
        player.surfacePlanetId = surface.id;
        player.gravityPlanetId = surface.id;
        player.grounded = true;
        player.lastGroundedAt = now;
        player.launchSourcePlanetId = null;
        player.launchTargetPlanetId = null;
        player.launchAssistUntil = 0;
        this.io.to(this.code).emit("player:landed", {
          playerId: player.id, planetId: surface.id, ownerId: surface.ownerId, intruder: surface.ownerId !== player.id
        });
        if (surface.ownerId !== player.id) {
          const visited = this.visitedPlanets.get(player.id) ?? new Set<string>();
          if (!visited.has(surface.id)) {
            visited.add(surface.id);
            this.visitedPlanets.set(player.id, visited);
            this.stat(player.id).planetsVisited += 1;
          }
        }
      }
    } else if (surfaceAltitude > BALANCE.ground.detachAltitude) {
      player.surfacePlanetId = null;
    }
  }

  private updateProjectiles(dt: number, now: number): void {
    for (const projectile of [...this.projectiles.values()]) {
      const start = projectile.position;
      const end = add(start, scale(projectile.velocity, dt));
      let hit: PlanetState | undefined;
      let hitT = Number.POSITIVE_INFINITY;
      if (now - projectile.spawnedAt > 180) {
        const projectileRadius = projectile.weapon === "asteroid" ? 0.9 : 0.35;
        for (const candidate of this.planets.values()) {
          if (!candidate.alive) continue;
          const intersection = segmentSphereHit(start, end, candidate.position, BALANCE.planetRadius + projectileRadius);
          if (intersection !== null && intersection < hitT) {
            hit = candidate;
            hitT = intersection;
          }
        }
      }
      if (hit) {
        projectile.position = add(start, scale(sub(end, start), hitT));
        this.explode(projectile, hit);
      }
      else {
        projectile.position = end;
        if (now - projectile.spawnedAt > 12000 || length(projectile.position) > 150) this.projectiles.delete(projectile.id);
      }
    }
  }

  private explode(projectile: ProjectileState, planet: PlanetState): void {
    const config = BALANCE.weapons[projectile.weapon];
    const multiplier = this.phase === "overtime" ? 2 : 1;
    const amount = config.damage * multiplier;
    const before = planet.integrity;
    planet.integrity = Math.max(0, planet.integrity - amount);
    const dealt = before - planet.integrity;
    const attacker = this.stat(projectile.ownerId);
    attacker.damageDealt += dealt;
    attacker.shotsHit += 1;
    this.stat(planet.ownerId).damageReceived += dealt;
    planet.damageStage = damageStage(planet.integrity);
    this.projectiles.delete(projectile.id);
    this.io.to(this.code).emit("projectile:exploded", { id: projectile.id, position: projectile.position, weapon: projectile.weapon, planetId: planet.id });
    this.io.to(this.code).emit("planet:damaged", { planetId: planet.id, integrity: planet.integrity, amount, hit: projectile.position });
    const crossedStage = damageStage(before) !== planet.damageStage;
    if (crossedStage || projectile.weapon === "asteroid") {
      this.emitMatchEvent("damage", { actorId: projectile.ownerId, targetId: planet.ownerId, planetId: planet.id, amount: dealt, weapon: projectile.weapon });
    }
    for (const player of this.players.values()) {
      const d = distance(player.position, projectile.position);
      const falloff = explosionFalloff(d, config.radius * 1.8);
      if (player.alive && falloff > 0) {
        const blastDirection = normalize(sub(player.position, projectile.position));
        const localPlanet = this.nearestAlivePlanet(player.position);
        const surfaceOutward = localPlanet ? normalize(sub(player.position, localPlanet.position)) : blastDirection;
        const impulseDirection = normalize(add(blastDirection, scale(surfaceOutward, 0.32)));
        player.velocity = limitSpeed(
          add(player.velocity, scale(impulseDirection, config.knockback * falloff)),
          BALANCE.maxPlayerSpeed
        );
        player.grounded = false;
        player.jumpQueuedUntil = 0;
      }
    }
    if (planet.integrity <= 0) {
      planet.alive = false;
      const owner = this.players.get(planet.ownerId);
      if (owner) {
        owner.alive = false;
        this.recordSurvival(owner.id);
      }
      attacker.planetKills += 1;
      this.io.to(this.code).emit("planet:destroyed", { planetId: planet.id, ownerId: planet.ownerId });
      this.emitMatchEvent("destroyed", { actorId: projectile.ownerId, targetId: planet.ownerId, planetId: planet.id, weapon: projectile.weapon });
      this.checkWinner();
    }
  }

  private updateSabotage(now: number): void {
    for (const player of this.players.values()) {
      const channel = player.sabotage;
      if (!channel) continue;
      const planet = this.planets.get(channel.planetId);
      if (
        !player.alive || !planet?.alive || planet.ownerId === player.id
        || distance(player.position, this.structurePosition(planet, channel.structure)) > BALANCE.sabotage.cancelRange
      ) {
        this.cancelSabotage(player, true);
        continue;
      }
      if (now - channel.startedAt < BALANCE.sabotage.channelMs) continue;
      const disabledUntil = now + BALANCE.sabotage.durationMs;
      const immuneUntil = disabledUntil + BALANCE.sabotage.immunityMs;
      if (channel.structure === "cannon") {
        planet.cannonDisabledUntil = disabledUntil;
        planet.cannonSabotageImmuneUntil = immuneUntil;
      } else {
        planet.repairDisabledUntil = disabledUntil;
        planet.repairSabotageImmuneUntil = immuneUntil;
      }
      this.stat(player.id).sabotagesCompleted += 1;
      player.sabotage = null;
      this.io.to(this.code).emit("structure:sabotaged", {
        playerId: player.id, planetId: planet.id, ownerId: planet.ownerId,
        structure: channel.structure, disabledUntil
      });
      this.emitMatchEvent("sabotage", {
        actorId: player.id, targetId: planet.ownerId, planetId: planet.id, structure: channel.structure
      }, now);
      this.emitRoom();
    }
  }

  private cancelSabotage(player: PlayerRecord, notify: boolean): void {
    if (!player.sabotage) return;
    player.sabotage = null;
    if (notify && player.socketId) this.io.to(player.socketId).emit("structure:sabotage-cancelled", { playerId: player.id });
  }

  private structurePosition(planet: PlanetState, structure: StructureType): Vec3 {
    return structure === "cannon" ? cannonPosition(planet) : repairPosition(planet);
  }

  private collectScrap(): void {
    for (const scrap of [...this.scraps.values()]) {
      let collector: PlayerRecord | undefined;
      for (const player of this.players.values()) {
        if (player.alive && distance(player.position, scrap.position) < BALANCE.scrapPickupRadius) {
          collector = player;
          break;
        }
      }
      if (collector) {
        collector.scrap += BALANCE.scrapValue;
        const stats = this.stat(collector.id);
        stats.scrapCollected += BALANCE.scrapValue;
        this.scraps.delete(scrap.id);
        const planet = this.planets.get(scrap.planetId);
        const ownerId = planet?.ownerId ?? "";
        const stolen = Boolean(ownerId && ownerId !== collector.id);
        if (stolen) {
          stats.stolenScrap += BALANCE.scrapValue;
          this.emitMatchEvent("stolen", { actorId: collector.id, targetId: ownerId, planetId: scrap.planetId, amount: BALANCE.scrapValue });
        }
        this.io.to(this.code).emit("scrap:collected", {
          scrapId: scrap.id, playerId: collector.id, planetId: scrap.planetId, ownerId,
          position: scrap.position, value: BALANCE.scrapValue, stolen
        });
      }
    }
  }

  private spawnScrap(planet: PlanetState): void {
    const count = [...this.scraps.values()].filter((s) => s.planetId === planet.id).length;
    if (count >= this.rules.scrapMaxPerPlanet) return;
    let normal = { x: 0, y: 0, z: 1 };
    for (let attempt = 0; attempt < 8; attempt++) {
      const theta = Math.random() * Math.PI * 2;
      const y = Math.random() * 1.6 - 0.8;
      const radial = Math.sqrt(1 - y * y);
      const candidate = { x: radial * Math.cos(theta), y, z: radial * Math.sin(theta) };
      const position = add(planet.position, scale(candidate, BALANCE.planetRadius + 0.75));
      normal = candidate;
      if ([cannonPosition(planet), repairPosition(planet), launchPadPosition(planet)].every((structure) => distance(position, structure) > 2.6)) break;
    }
    const scrap: ScrapState = { id: id("scrap"), planetId: planet.id, position: add(planet.position, scale(normal, BALANCE.planetRadius + 0.75)) };
    this.scraps.set(scrap.id, scrap);
  }

  private nearestAlivePlanet(position: Vec3): PlanetState | undefined {
    let nearest: PlanetState | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const planet of this.planets.values()) {
      if (!planet.alive) continue;
      const candidateDistance = distance(position, planet.position);
      if (candidateDistance < nearestDistance) {
        nearest = planet;
        nearestDistance = candidateDistance;
      }
    }
    return nearest;
  }

  private validGrapple(from: Vec3, point: Vec3): boolean {
    if (distance(from, point) > BALANCE.grappleRange) return false;
    return [...this.planets.values()].some((p) => p.alive && Math.abs(distance(point, p.position) - BALANCE.planetRadius) < 2.5);
  }

  private resolveTimer(now: number): void {
    const alive = [...this.planets.values()].filter((p) => p.alive);
    const max = Math.max(...alive.map((p) => p.integrity));
    const leaders = alive.filter((p) => p.integrity === max);
    if (leaders.length === 1) return this.end(leaders[0].ownerId, "timer", now);
    if (this.phase === "overtime") return this.end(null, "timer", now);
    this.phase = "overtime";
    this.overtimeEndsAt = now + BALANCE.overtimeMs;
    this.matchEndsAt = this.overtimeEndsAt;
    this.emitRoom();
  }

  private updateBots(now: number): void {
    for (const [botId, brain] of this.botBrains) {
      const player = this.players.get(botId);
      const ownPlanet = player ? this.planets.get(player.planetId) : undefined;
      if (!player?.alive || !ownPlanet?.alive) continue;
      const decision = brain.update({
        now, phase: this.phase, player, ownPlanet,
        surfacePlanet: player.surfacePlanetId ? this.planets.get(player.surfacePlanetId) : undefined,
        planets: [...this.planets.values()], players: [...this.players.values()], scraps: [...this.scraps.values()],
        rules: this.rules, activeModifier: this.activeModifier
      });
      this.setInput(botId, decision.input);
      if (decision.fire) this.fire(botId, decision.fire.weapon, decision.fire.direction);
      if (decision.repair) this.repair(botId);
      if (decision.launchTargetId) this.launch(botId, decision.launchTargetId);
      if (decision.shoveTargetId) this.shove(botId, decision.shoveTargetId);
    }
  }

  private checkWinner(): void {
    const alive = [...this.planets.values()].filter((p) => p.alive);
    if (alive.length <= 1) this.end(alive[0]?.ownerId ?? null, "last-standing");
  }

  private end(winnerId: string | null, reason: "last-standing" | "timer", now = Date.now()): void {
    if (this.phase === "results") return;
    for (const player of this.players.values()) this.recordSurvival(player.id, now);
    this.phase = "results"; this.winnerId = winnerId; this.matchEndsAt = null; this.overtimeEndsAt = null;
    if (winnerId) {
      const winner = this.players.get(winnerId);
      if (winner) winner.crowns += 1;
      this.winStreak = this.winStreak?.playerId === winnerId
        ? { playerId: winnerId, count: this.winStreak.count + 1 }
        : { playerId: winnerId, count: 1 };
    } else this.winStreak = null;
    const placements = [...this.players.values()]
      .map((player) => ({
        playerId: player.id,
        integrity: this.planets.get(player.planetId)?.integrity ?? 0,
        survivalTimeMs: this.stat(player.id).survivalTimeMs
      }))
      .sort((a, b) => Number(b.playerId === winnerId) - Number(a.playerId === winnerId)
        || b.survivalTimeMs - a.survivalTimeMs || b.integrity - a.integrity || a.playerId.localeCompare(b.playerId))
      .map(({ playerId, integrity }, index) => ({ playerId, integrity, place: index + 1 }));
    const stats = [...this.matchStats.values()].map((entry) => ({ ...entry }));
    const winnerIntegrity = placements.find((entry) => entry.playerId === winnerId)?.integrity ?? 0;
    this.matchResult = {
      winnerId, reason, placements, stats, awards: selectMatchAwards(stats, winnerId, winnerIntegrity),
      crowns: [...this.players.values()].map((player) => ({ playerId: player.id, crowns: player.crowns })),
      winStreak: this.winStreak ? { ...this.winStreak } : null
    };
    this.io.to(this.code).emit("match:ended", { winnerId, reason, result: this.matchResult });
    this.emitRoom();
  }

  private removeExpiredDisconnects(now: number): void {
    let changed = false;
    const matchActive = this.phase === "playing" || this.phase === "overtime";
    for (const player of [...this.players.values()]) {
      if (!player.connected && player.disconnectedAt && now - player.disconnectedAt >= BALANCE.reconnectGraceMs) {
        if (matchActive) {
          const planet = this.planets.get(player.planetId);
          if (planet?.alive) {
            planet.alive = false; planet.integrity = 0; planet.damageStage = 3;
            this.recordSurvival(player.id, now);
            this.io.to(this.code).emit("planet:destroyed", { planetId: planet.id, ownerId: player.id });
          }
        } else {
          this.planets.delete(player.planetId);
        }
        this.world.removeRigidBody(player.body);
        this.players.delete(player.id);
        this.matchStats.delete(player.id);
        this.visitedPlanets.delete(player.id);
        this.rematchVotes.delete(player.id);
        changed = true;
      }
    }
    if (!this.players.has(this.hostId)) this.migrateHost();
    if (matchActive && changed) this.checkWinner();
    if (changed && this.phase === "lobby") this.rebuildPlanets();
    if (changed) this.emitRoom();
  }

  private migrateHost(): void {
    this.hostId = [...this.players.values()].find((p) => p.connected && !p.isBot)?.id ?? "";
  }

  private stat(playerId: string): MatchStats {
    let stats = this.matchStats.get(playerId);
    if (!stats) {
      stats = createMatchStats(playerId);
      this.matchStats.set(playerId, stats);
    }
    return stats;
  }

  private resetMatchStats(): void {
    this.matchStats.clear();
    this.visitedPlanets.clear();
    for (const player of this.players.values()) {
      this.matchStats.set(player.id, createMatchStats(player.id));
      this.visitedPlanets.set(player.id, new Set([player.planetId]));
    }
  }

  private recordSurvival(playerId: string, now = Date.now()): void {
    const stats = this.stat(playerId);
    if (stats.survivalTimeMs === 0 && this.matchStartedAt > 0) stats.survivalTimeMs = Math.max(1, now - this.matchStartedAt);
  }

  private emitMatchEvent(type: MatchEventType, detail: Omit<MatchEvent, "id" | "type" | "createdAt">, now = Date.now()): void {
    this.io.to(this.code).emit("match:event", { id: id("event"), type, createdAt: now, ...detail });
  }

  private emitRoom(): void { this.io.to(this.code).emit("room:state", this.view()); }
  private error(playerId: string, message: string): void {
    const socketId = this.players.get(playerId)?.socketId;
    if (socketId) this.io.to(socketId).emit("server:error", { message });
  }

  dispose(): void {
    this.players.clear();
    this.planets.clear();
    this.scraps.clear();
    this.projectiles.clear();
    this.botBrains.clear();
    this.matchStats.clear();
    this.visitedPlanets.clear();
    this.rematchVotes.clear();
    this.world.free();
  }
}
