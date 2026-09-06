import { randomBytes } from "node:crypto";
import type { Server as SocketServer, Socket } from "socket.io";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  BALANCE,
  PLAYER_COLORS,
  add,
  cannonPosition,
  clamp,
  cross,
  damageStage,
  distance,
  dot,
  isFiniteVec3,
  launchLandingPosition,
  launchPadPosition,
  launchVelocity,
  length,
  normalize,
  projectOnPlane,
  repairPosition,
  sanitizeName,
  scale,
  sub,
  type ClientToServerEvents,
  type JoinResult,
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
    launchAssistUntil: _j, sabotage: _k, input: _l, body: _m, ...view
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
  matchEndsAt: number | null = null;
  winnerId: string | null = null;
  countdownStartsAt: number | null = null;
  overtimeEndsAt: number | null = null;
  lastScrapSpawn = 0;
  private snapshotAccumulator = 0;
  private world: RAPIER.World;
  private botBrains = new Map<string, BotBrain>();
  private structureImmunity = new Map<string, number>();

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
      launchCooldownUntil: 0,
      shoveCooldownUntil: 0,
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
      surfacePlanetId: null, launchCooldownUntil: 0, shoveCooldownUntil: 0,
      socketId: null, sessionToken: "", disconnectedAt: null,
      lastBurstAt: 0, lastFireAt: 0, lastInputAt: 0, lastRepairAt: 0,
      launchSourcePlanetId: null, launchTargetPlanetId: null, launchAssistUntil: 0, sabotage: null,
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

  start(playerId: string): void {
    if (this.phase !== "lobby" || playerId !== this.hostId) return;
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (connected.length < BALANCE.minPlayers) return this.error(playerId, "Add another player or bot.");
    if ([...this.players.values()].some((p) => !p.connected)) return this.error(playerId, "Waiting for players to reconnect.");
    if (!connected.every((p) => p.ready)) return this.error(playerId, "Waiting for players.");
    this.resetMatch();
    this.phase = "countdown";
    this.countdownStartsAt = Date.now() + 3200;
    this.io.to(this.code).emit("match:countdown", { startsAt: this.countdownStartsAt });
    this.emitRoom();
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
    player.launchCooldownUntil = now + BALANCE.launch.cooldownMs;
    player.launchSourcePlanetId = source.id;
    player.launchTargetPlanetId = target.id;
    player.launchAssistUntil = now + BALANCE.launch.assistMs;
    player.surfacePlanetId = null;
    this.io.to(this.code).emit("player:launched", {
      playerId, sourcePlanetId: source.id, targetPlanetId: target.id,
      position: { ...player.position }, velocity: { ...player.velocity }, cooldownUntil: player.launchCooldownUntil
    });
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
    const outward = normalize(sub(target.position, planet.position));
    let away = normalize(projectOnPlane(sub(target.position, player.position), outward));
    if (length(away) < 0.1) away = normalize(projectOnPlane(player.input?.cameraForward ?? { x: 0, y: 0, z: 1 }, outward));
    target.velocity = add(target.velocity, add(scale(away, BALANCE.shove.force), scale(outward, BALANCE.shove.lift)));
    player.shoveCooldownUntil = now + BALANCE.shove.cooldownMs;
    this.cancelSabotage(target, true);
    this.io.to(this.code).emit("player:shoved", {
      attackerId: player.id, targetId: target.id, planetId: planet.id,
      position: { ...target.position }, velocity: { ...target.velocity }
    });
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
    if (disabledUntil > now || (this.structureImmunity.get(this.structureKey(planet.id, structure)) ?? 0) > now) return false;
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
    if (distance(player.position, cannon) > 5) return this.error(playerId, "Stand beside your cannon to fire.");
    if (player.scrap < config.cost) return this.error(playerId, "Not enough scrap.");
    const aim = normalize(direction);
    if (dot(aim, normalize(sub(cannon, planet.position))) < -0.35) return;
    player.scrap -= config.cost;
    player.lastFireAt = now;
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
    if (distance(player.position, station) > 4) return this.error(playerId, "Stand beside the repair core.");
    if (player.scrap < BALANCE.repair.cost) return this.error(playerId, "Not enough scrap.");
    if (planet.integrity >= BALANCE.maxIntegrity) return this.error(playerId, "Your planet is already at full integrity.");
    player.scrap -= BALANCE.repair.cost;
    player.lastRepairAt = now;
    const before = planet.integrity;
    planet.integrity = Math.min(BALANCE.maxIntegrity, planet.integrity + BALANCE.repair.heal);
    planet.damageStage = damageStage(planet.integrity);
    this.io.to(this.code).emit("planet:repaired", { planetId: planet.id, playerId, integrity: planet.integrity, amount: planet.integrity - before });
    this.emitRoom();
  }

  voteRematch(playerId: string): void {
    if (this.phase !== "results" || !this.players.has(playerId)) return;
    this.rematchVotes.add(playerId);
    const connected = [...this.players.values()].filter((p) => p.connected);
    const humans = connected.filter((p) => !p.isBot);
    if (humans.length >= 1 && humans.every((p) => this.rematchVotes.has(p.id))) {
      this.phase = "lobby";
      this.winnerId = null;
      this.matchEndsAt = null;
      this.countdownStartsAt = null;
      this.overtimeEndsAt = null;
      this.lastScrapSpawn = 0;
      this.snapshotAccumulator = 0;
      this.scraps.clear();
      this.projectiles.clear();
      this.structureImmunity.clear();
      this.rematchVotes.clear();
      for (const p of connected) {
        p.ready = p.isBot;
        p.alive = true;
        p.scrap = BALANCE.startingScrap;
        p.input = null;
        p.lastInputSequence = 0;
        p.surfacePlanetId = p.planetId;
        p.launchCooldownUntil = 0;
        p.shoveCooldownUntil = 0;
        p.launchSourcePlanetId = null;
        p.launchTargetPlanetId = null;
        p.launchAssistUntil = 0;
        p.sabotage = null;
      }
      this.rebuildPlanets();
    }
    this.emitRoom();
  }

  update(dt: number, now: number): void {
    this.removeExpiredDisconnects(now);
    if (this.phase === "countdown" && this.countdownStartsAt && now >= this.countdownStartsAt) {
      this.phase = "playing";
      this.matchEndsAt = now + BALANCE.matchMs;
      this.countdownStartsAt = null;
      this.emitRoom();
    }
    if (this.phase !== "playing" && this.phase !== "overtime") return;
    this.updateBots(now);
    for (const player of this.players.values()) this.updatePlayer(player, dt, now);
    this.updateSabotage(now);
    this.updateProjectiles(dt, now);
    this.collectScrap();
    if (now - this.lastScrapSpawn >= BALANCE.scrapSpawnMs) {
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
      rematchVotes: [...this.rematchVotes]
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
      player.body.setNextKinematicTranslation(player.position);
      this.planets.set(planetId, {
        id: planetId, ownerId: player.id, position,
        integrity: BALANCE.maxIntegrity, alive: true,
        palette: index % 6, damageStage: 0,
        cannonDisabledUntil: 0, repairDisabledUntil: 0
      });
    });
  }

  private resetMatch(): void {
    this.scraps.clear(); this.projectiles.clear(); this.structureImmunity.clear(); this.rematchVotes.clear(); this.winnerId = null; this.overtimeEndsAt = null;
    this.rebuildPlanets();
    for (const player of this.players.values()) {
      player.alive = player.connected; player.scrap = BALANCE.startingScrap; player.input = null;
      player.lastInputSequence = 0; player.lastFireAt = 0; player.lastBurstAt = 0; player.lastInputAt = 0; player.lastRepairAt = 0;
      player.surfacePlanetId = player.planetId; player.launchCooldownUntil = 0; player.shoveCooldownUntil = 0;
      player.launchSourcePlanetId = null; player.launchTargetPlanetId = null; player.launchAssistUntil = 0; player.sabotage = null;
    }
    for (const planet of this.planets.values()) for (let i = 0; i < 3; i++) this.spawnScrap(planet);
  }

  private updatePlayer(player: PlayerRecord, dt: number, now: number): void {
    if (!player.alive) return;
    const planet = this.nearestAlivePlanet(player.position);
    if (!planet) return;
    const outward = normalize(sub(player.position, planet.position));
    const altitude = distance(player.position, planet.position) - BALANCE.planetRadius;
    const grounded = altitude <= 1.25;
    const input = player.input;
    let tangentVelocity = projectOnPlane(player.velocity, outward);
    if (input) {
      let forward = normalize(projectOnPlane(input.cameraForward, outward));
      if (length(forward) < 0.1) forward = normalize(cross(outward, { x: 1, y: 0, z: 0 }));
      const right = normalize(cross(forward, outward));
      const desired = scale(normalize(add(scale(right, input.moveX), scale(forward, input.moveY))), BALANCE.moveSpeed);
      const hasMove = Math.abs(input.moveX) + Math.abs(input.moveY) > 0.05;
      const control = grounded ? 1 : BALANCE.airControl;
      const delta = sub(hasMove ? desired : { x: 0, y: 0, z: 0 }, tangentVelocity);
      tangentVelocity = add(tangentVelocity, scale(delta, Math.min(1, BALANCE.acceleration * control * dt / Math.max(length(delta), 1))));
      if (input.jump && grounded) player.velocity = add(tangentVelocity, scale(outward, BALANCE.jumpSpeed));
      else player.velocity = add(tangentVelocity, scale(outward, dot(player.velocity, outward) - BALANCE.gravity * dt));
      if (input.burst && now - player.lastBurstAt > BALANCE.burstCooldownMs) {
        player.lastBurstAt = now;
        player.velocity = add(player.velocity, scale(hasMove ? normalize(desired) : forward, BALANCE.burstSpeed));
      }
      if (input.grapple && input.grapplePoint && this.validGrapple(player.position, input.grapplePoint)) {
        const rope = sub(input.grapplePoint, player.position);
        player.velocity = add(player.velocity, scale(normalize(rope), BALANCE.grapplePull * dt * clamp(length(rope) / 8, 0.5, 2)));
      }
    } else {
      player.velocity = add(tangentVelocity, scale(outward, dot(player.velocity, outward) - BALANCE.gravity * dt));
    }
    const launchTarget = player.launchTargetPlanetId ? this.planets.get(player.launchTargetPlanetId) : undefined;
    const launchSource = player.launchSourcePlanetId ? this.planets.get(player.launchSourcePlanetId) : undefined;
    if (launchTarget?.alive && launchSource && now < player.launchAssistUntil && !player.surfacePlanetId) {
      const guide = normalize(sub(launchLandingPosition(launchSource, launchTarget), player.position));
      player.velocity = add(player.velocity, scale(guide, BALANCE.launch.assist * dt));
      const maxLaunchSpeed = BALANCE.launch.speed * 1.12;
      if (length(player.velocity) > maxLaunchSpeed) player.velocity = scale(normalize(player.velocity), maxLaunchSpeed);
    }
    player.position = add(player.position, scale(player.velocity, dt));
    const nextOutward = normalize(sub(player.position, planet.position));
    const minDistance = BALANCE.planetRadius + 0.95;
    const radialDistance = distance(player.position, planet.position);
    if (radialDistance < minDistance) {
      player.position = add(planet.position, scale(nextOutward, minDistance));
      const inwardSpeed = dot(player.velocity, nextOutward);
      if (inwardSpeed < 0) player.velocity = sub(player.velocity, scale(nextOutward, inwardSpeed));
    }
    player.body.setNextKinematicTranslation(player.position);
    const surface = this.nearestAlivePlanet(player.position);
    const surfaceAltitude = surface ? distance(player.position, surface.position) - BALANCE.planetRadius : Infinity;
    if (surface && surfaceAltitude <= 1.2) {
      if (player.surfacePlanetId !== surface.id) {
        player.surfacePlanetId = surface.id;
        player.launchSourcePlanetId = null;
        player.launchTargetPlanetId = null;
        player.launchAssistUntil = 0;
        this.io.to(this.code).emit("player:landed", {
          playerId: player.id, planetId: surface.id, ownerId: surface.ownerId, intruder: surface.ownerId !== player.id
        });
      }
    } else if (surfaceAltitude > 1.8) {
      player.surfacePlanetId = null;
    }
  }

  private updateProjectiles(dt: number, now: number): void {
    for (const projectile of [...this.projectiles.values()]) {
      projectile.position = add(projectile.position, scale(projectile.velocity, dt));
      let hit: PlanetState | undefined;
      if (now - projectile.spawnedAt > 180) {
        hit = [...this.planets.values()].find((p) => p.alive && distance(projectile.position, p.position) <= BALANCE.planetRadius + (projectile.weapon === "asteroid" ? 0.9 : 0.35));
      }
      if (hit) this.explode(projectile, hit);
      else if (now - projectile.spawnedAt > 12000 || length(projectile.position) > 150) this.projectiles.delete(projectile.id);
    }
  }

  private explode(projectile: ProjectileState, planet: PlanetState): void {
    const config = BALANCE.weapons[projectile.weapon];
    const multiplier = this.phase === "overtime" ? 2 : 1;
    const amount = config.damage * multiplier;
    planet.integrity = Math.max(0, planet.integrity - amount);
    planet.damageStage = damageStage(planet.integrity);
    this.projectiles.delete(projectile.id);
    this.io.to(this.code).emit("projectile:exploded", { id: projectile.id, position: projectile.position, weapon: projectile.weapon, planetId: planet.id });
    this.io.to(this.code).emit("planet:damaged", { planetId: planet.id, integrity: planet.integrity, amount, hit: projectile.position });
    for (const player of this.players.values()) {
      const d = distance(player.position, projectile.position);
      if (player.alive && d < config.radius * 1.8) {
        player.velocity = add(player.velocity, scale(normalize(sub(player.position, projectile.position)), config.knockback * (1 - d / (config.radius * 1.8))));
      }
    }
    if (planet.integrity <= 0) {
      planet.alive = false;
      const owner = this.players.get(planet.ownerId);
      if (owner) owner.alive = false;
      this.io.to(this.code).emit("planet:destroyed", { planetId: planet.id, ownerId: planet.ownerId });
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
        || distance(player.position, this.structurePosition(planet, channel.structure)) > BALANCE.sabotage.range
      ) {
        this.cancelSabotage(player, true);
        continue;
      }
      if (now - channel.startedAt < BALANCE.sabotage.channelMs) continue;
      const disabledUntil = now + BALANCE.sabotage.durationMs;
      if (channel.structure === "cannon") planet.cannonDisabledUntil = disabledUntil;
      else planet.repairDisabledUntil = disabledUntil;
      this.structureImmunity.set(this.structureKey(planet.id, channel.structure), disabledUntil + BALANCE.sabotage.immunityMs);
      player.sabotage = null;
      this.io.to(this.code).emit("structure:sabotaged", {
        playerId: player.id, planetId: planet.id, ownerId: planet.ownerId,
        structure: channel.structure, disabledUntil
      });
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

  private structureKey(planetId: string, structure: StructureType): string {
    return `${planetId}:${structure}`;
  }

  private collectScrap(): void {
    for (const scrap of [...this.scraps.values()]) {
      const collector = [...this.players.values()].find((p) => p.alive && distance(p.position, scrap.position) < 1.8);
      if (collector) {
        collector.scrap += BALANCE.scrapValue;
        this.scraps.delete(scrap.id);
        const planet = this.planets.get(scrap.planetId);
        const ownerId = planet?.ownerId ?? "";
        this.io.to(this.code).emit("scrap:collected", {
          scrapId: scrap.id, playerId: collector.id, planetId: scrap.planetId, ownerId,
          position: scrap.position, value: BALANCE.scrapValue, stolen: Boolean(ownerId && ownerId !== collector.id)
        });
      }
    }
  }

  private spawnScrap(planet: PlanetState): void {
    const count = [...this.scraps.values()].filter((s) => s.planetId === planet.id).length;
    if (count >= BALANCE.scrapMaxPerPlanet) return;
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
    return [...this.planets.values()].filter((p) => p.alive).sort((a, b) => distance(position, a.position) - distance(position, b.position))[0];
  }

  private validGrapple(from: Vec3, point: Vec3): boolean {
    if (distance(from, point) > BALANCE.grappleRange) return false;
    return [...this.planets.values()].some((p) => p.alive && Math.abs(distance(point, p.position) - BALANCE.planetRadius) < 2.5);
  }

  private resolveTimer(now: number): void {
    const alive = [...this.planets.values()].filter((p) => p.alive);
    const max = Math.max(...alive.map((p) => p.integrity));
    const leaders = alive.filter((p) => p.integrity === max);
    if (leaders.length === 1) return this.end(leaders[0].ownerId, "timer");
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
        planets: [...this.planets.values()], players: [...this.players.values()], scraps: [...this.scraps.values()]
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

  private end(winnerId: string | null, reason: "last-standing" | "timer"): void {
    this.phase = "results"; this.winnerId = winnerId; this.matchEndsAt = null; this.overtimeEndsAt = null;
    this.io.to(this.code).emit("match:ended", { winnerId, reason });
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
            this.io.to(this.code).emit("planet:destroyed", { planetId: planet.id, ownerId: player.id });
          }
        } else {
          this.planets.delete(player.planetId);
        }
        this.world.removeRigidBody(player.body);
        this.players.delete(player.id);
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
    this.structureImmunity.clear();
    this.rematchVotes.clear();
    this.world.free();
  }
}
