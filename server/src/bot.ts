import {
  BALANCE,
  add,
  cannonPosition,
  clamp,
  cross,
  distance,
  launchLandingPosition,
  launchPadPosition,
  normalize,
  projectOnPlane,
  repairPosition,
  scale,
  sub,
  type PlanetState,
  type PlayerInput,
  type PlayerState,
  type BotDifficulty,
  type ChaosModifier,
  type MatchRules,
  type RoomPhase,
  type ScrapState,
  type StructureType,
  type Vec3,
  type WeaponType
} from "@planetfall/shared";

export const BOT_NAMES = ["Nova", "Orbit", "Comet", "Astro", "Luna", "Cosmo", "Sol", "Vega", "Apollo", "Meteor"] as const;
export type BotMode = "Recover" | "SeekScrap" | "MoveToCannon" | "Aim" | "MoveToRepair" | "Repair" | "MoveToLaunch" | "Sabotage" | "Idle";

export interface BotProfile {
  aggression: number;
  repairThreshold: number;
  aimErrorRadians: number;
  reactionMs: number;
  asteroidBias: number;
  riskTolerance: number;
  sabotageChance: number;
  recoveryDelayMs: number;
}

export interface BotContext {
  now: number;
  phase: RoomPhase;
  player: PlayerState;
  ownPlanet: PlanetState;
  surfacePlanet?: PlanetState;
  planets: PlanetState[];
  players: PlayerState[];
  scraps: ScrapState[];
  rules: MatchRules;
  activeModifier: ChaosModifier | null;
  difficulty: BotDifficulty;
  activeSabotage?: { planetId: string; structure: StructureType };
}

export interface BotDecision {
  mode: BotMode;
  input: PlayerInput;
  fire?: { weapon: WeaponType; direction: Vec3 };
  repair?: true;
  launchTargetId?: string;
  shoveTargetId?: string;
  sabotage?: { planetId: string; structure: StructureType };
}

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function createBotProfile(seed: string): BotProfile {
  const random = mulberry32(hash(seed));
  return {
    aggression: 0.45 + random() * 0.3,
    repairThreshold: 35 + random() * 25,
    aimErrorRadians: (5 + random() * 10) * Math.PI / 180,
    reactionMs: 850 + Math.floor(random() * 850),
    asteroidBias: 0.25 + random() * 0.4,
    riskTolerance: 0.3 + random() * 0.5,
    sabotageChance: 0.16 + random() * 0.12,
    recoveryDelayMs: 0
  };
}

export function botDifficultyProfile(base: BotProfile, difficulty: BotDifficulty): BotProfile {
  if (difficulty === "easy") return {
    aggression: base.aggression * 0.62,
    repairThreshold: base.repairThreshold - 7,
    aimErrorRadians: base.aimErrorRadians * 1.65,
    reactionMs: base.reactionMs * 1.55,
    asteroidBias: base.asteroidBias * 0.7,
    riskTolerance: base.riskTolerance * 0.7,
    sabotageChance: base.sabotageChance * .3,
    recoveryDelayMs: 750
  };
  if (difficulty === "hard") return {
    aggression: Math.min(0.92, base.aggression * 1.22),
    repairThreshold: Math.min(68, base.repairThreshold + 6),
    aimErrorRadians: base.aimErrorRadians * 0.62,
    reactionMs: Math.max(480, base.reactionMs * 0.68),
    asteroidBias: Math.min(0.8, base.asteroidBias * 1.18),
    riskTolerance: Math.min(0.95, base.riskTolerance * 1.14),
    sabotageChance: Math.min(.5, base.sabotageChance * 1.35),
    recoveryDelayMs: -1_200
  };
  return { ...base };
}

export class BotBrain {
  readonly profile: BotProfile;
  private activeProfile: BotProfile;
  mode: BotMode = "Idle";
  private random: () => number;
  private nextThinkAt = 0;
  private actionAt = 0;
  private sequence = 0;
  private targetScrapId: string | null = null;
  private targetPlanetId: string | null = null;
  private wanderPoint: Vec3 | null = null;
  private wanderPlanetId: string | null = null;
  private raidTargetPlanetId: string | null = null;
  private raidEndsAt = 0;
  private sabotageTarget: { planetId: string; structure: StructureType } | null = null;

  constructor(readonly id: string) {
    this.profile = createBotProfile(id);
    this.activeProfile = { ...this.profile };
    this.random = mulberry32(hash(`${id}:choices`));
  }

  update(context: BotContext): BotDecision {
    this.activeProfile = botDifficultyProfile(this.profile, context.difficulty);
    const surface = context.surfacePlanet;
    if (context.activeSabotage) {
      const planet = context.planets.find((candidate) => candidate.id === context.activeSabotage!.planetId && candidate.alive);
      const target = planet ? this.structurePosition(planet, context.activeSabotage.structure) : null;
      const input = this.makeInput(context, target);
      input.moveY = 0; input.burst = false;
      return { mode: "Sabotage", input };
    }
    if (this.mode === "MoveToLaunch" && surface && this.raidTargetPlanetId && distance(context.player.position, launchPadPosition(surface)) <= BALANCE.launch.range) {
      const decision: BotDecision = { mode: this.mode, input: this.makeInput(context, launchPadPosition(surface)), launchTargetId: this.raidTargetPlanetId };
      this.mode = "Recover";
      this.nextThinkAt = context.now + 1500;
      return decision;
    }
    if (this.mode === "Aim") {
      const decision: BotDecision = { mode: this.mode, input: this.makeInput(context, cannonPosition(context.ownPlanet)) };
      if (context.now < this.actionAt) return decision;
      const targetPlanet = context.planets.find((planet) => planet.id === this.targetPlanetId && planet.alive);
      if (targetPlanet) {
        const weapon = this.chooseWeapon(context.player.scrap);
        if (weapon) decision.fire = { weapon, direction: this.aimAt(context.ownPlanet, targetPlanet) };
      }
      this.nextThinkAt = context.now + 1200 + this.random() * 1000;
      this.mode = "Idle";
      return decision;
    }
    if (this.mode === "Repair") {
      const decision: BotDecision = { mode: this.mode, input: this.makeInput(context, repairPosition(context.ownPlanet)) };
      if (context.now < this.actionAt) return decision;
      decision.repair = true;
      this.nextThinkAt = context.now + 900;
      this.mode = "Idle";
      return decision;
    }
    if (this.mode === "Sabotage" && this.sabotageTarget) {
      const planet = context.planets.find((candidate) => candidate.id === this.sabotageTarget!.planetId && candidate.alive);
      if (!planet || planet.ownerId === context.player.id) {
        this.sabotageTarget = null; this.mode = "Idle";
      } else {
        const target = this.structurePosition(planet, this.sabotageTarget.structure);
        const decision: BotDecision = { mode: this.mode, input: this.makeInput(context, target) };
        if (distance(context.player.position, target) <= BALANCE.sabotage.range && context.now >= this.actionAt) {
          decision.sabotage = { ...this.sabotageTarget };
          this.sabotageTarget = null;
          this.mode = "Idle";
          this.nextThinkAt = context.now + BALANCE.sabotage.channelMs + 700;
        }
        return decision;
      }
    }
    if (context.now >= this.nextThinkAt) this.think(context);
    const target = this.movementTarget(context);
    const input = this.makeInput(context, target);
    const decision: BotDecision = { mode: this.mode, input };
    const nearbyEnemy = context.players.find((candidate) => candidate.alive && candidate.id !== context.player.id && candidate.surfacePlanetId && candidate.surfacePlanetId === context.player.surfacePlanetId && distance(candidate.position, context.player.position) <= BALANCE.shove.range);
    const shoveChance = (context.activeModifier === "super-shove" ? 0.075 : 0.035) * (context.difficulty === "easy" ? .55 : context.difficulty === "hard" ? 1.3 : 1);
    if (nearbyEnemy && this.random() < shoveChance) {
      decision.shoveTargetId = nearbyEnemy.id;
      decision.input.cameraForward = normalize(sub(nearbyEnemy.position, context.player.position));
    }
    return decision;
  }

  private think(context: BotContext): void {
    const thoughtDelay = context.difficulty === "easy" ? 1.35 : context.difficulty === "hard" ? .78 : 1;
    this.nextThinkAt = context.now + (500 + this.random() * 500) * thoughtDelay;
    const navigationPlanet = context.surfacePlanet ?? this.nearestPlanet(context.player.position, context.planets);
    const altitude = navigationPlanet ? distance(context.player.position, navigationPlanet.position) - BALANCE.planetRadius : Infinity;
    if (altitude > 3.5) { this.mode = "Recover"; return; }

    if (context.surfacePlanet && context.surfacePlanet.id !== context.ownPlanet.id) {
      if (context.ownPlanet.integrity <= this.activeProfile.repairThreshold || context.now >= this.raidEndsAt) {
        this.raidTargetPlanetId = context.ownPlanet.id;
        this.mode = "MoveToLaunch";
        return;
      }
      const enemyScraps = context.scraps.filter((scrap) => scrap.planetId === context.surfacePlanet!.id);
      const nearestEnemyScrap = this.nearestScrap(context.player.position, enemyScraps);
      if (nearestEnemyScrap) { this.mode = "SeekScrap"; this.targetScrapId = nearestEnemyScrap.id; return; }
      const structures = (["cannon", "repair"] as const).filter((structure) => {
        const disabledUntil = structure === "cannon" ? context.surfacePlanet!.cannonDisabledUntil : context.surfacePlanet!.repairDisabledUntil;
        const immuneUntil = structure === "cannon" ? context.surfacePlanet!.cannonSabotageImmuneUntil : context.surfacePlanet!.repairSabotageImmuneUntil;
        return disabledUntil <= context.now && immuneUntil <= context.now;
      });
      if (structures.length && this.random() < this.activeProfile.sabotageChance) {
        const structure = structures[Math.floor(this.random() * structures.length)];
        this.sabotageTarget = { planetId: context.surfacePlanet.id, structure };
        this.actionAt = context.now + this.activeProfile.reactionMs * .35;
        this.mode = "Sabotage";
        return;
      }
      this.mode = "Idle";
      this.chooseWanderPoint(context, context.surfacePlanet);
      return;
    }

    if (this.raidTargetPlanetId === context.ownPlanet.id) this.raidTargetPlanetId = null;

    const repairThreshold = this.activeProfile.repairThreshold + (context.activeModifier === "fragile-worlds" ? 8 : 0);
    const shouldRepair = context.phase !== "overtime"
      && context.ownPlanet.integrity <= Math.min(context.rules.maxIntegrity - 1, repairThreshold)
      && context.player.scrap >= BALANCE.repair.cost;
    if (shouldRepair) {
      const station = repairPosition(context.ownPlanet);
      if (distance(context.player.position, station) <= 3.2) {
        this.mode = "Repair"; this.actionAt = context.now + this.activeProfile.reactionMs * 0.5;
      } else this.mode = "MoveToRepair";
      return;
    }

    const raidTarget = this.chooseTarget(context);
    const raidBoost = context.activeModifier === "launch-party" ? 1.65 : 1;
    if (raidTarget && context.now >= context.player.launchCooldownUntil && this.random() < this.activeProfile.aggression * this.activeProfile.riskTolerance * 0.09 * raidBoost) {
      this.raidTargetPlanetId = raidTarget.id;
      this.raidEndsAt = context.now + 8500 + this.random() * 6500;
      this.mode = "MoveToLaunch";
      return;
    }

    const canAttack = context.player.scrap >= BALANCE.weapons.rocket.cost;
    const spendBoost = context.activeModifier === "scrap-rush" ? 1.3 : 1;
    const attackNow = canAttack && this.random() < this.activeProfile.aggression * 0.38 * spendBoost;
    if (attackNow) {
      this.targetPlanetId = this.chooseTarget(context)?.id ?? null;
      const cannon = cannonPosition(context.ownPlanet);
      if (this.targetPlanetId && distance(context.player.position, cannon) <= 3.5) {
        this.mode = "Aim"; this.actionAt = context.now + this.activeProfile.reactionMs;
      } else this.mode = "MoveToCannon";
      return;
    }

    const scraps = context.scraps.filter((scrap) => scrap.planetId === context.ownPlanet.id);
    const nearest = this.nearestScrap(context.player.position, scraps);
    if (nearest) { this.mode = "SeekScrap"; this.targetScrapId = nearest.id; return; }
    this.mode = "Idle";
    this.chooseWanderPoint(context, context.ownPlanet);
  }

  private movementTarget(context: BotContext): Vec3 | null {
    if (this.mode === "Recover") {
      const raidTarget = this.raidTargetPlanetId ? context.planets.find((planet) => planet.id === this.raidTargetPlanetId && planet.alive) : undefined;
      if (raidTarget) return launchLandingPosition(context.surfacePlanet ?? context.ownPlanet, raidTarget);
      const gravityPlanet = context.planets.find((planet) => planet.id === context.player.gravityPlanetId && planet.alive);
      const recoveryPlanet = gravityPlanet ?? this.nearestPlanet(context.player.position, context.planets) ?? context.ownPlanet;
      const outward = normalize(sub(context.player.position, recoveryPlanet.position));
      return add(recoveryPlanet.position, scale(outward, BALANCE.planetRadius));
    }
    if (this.mode === "MoveToCannon" || this.mode === "Aim") return cannonPosition(context.ownPlanet);
    if (this.mode === "MoveToRepair" || this.mode === "Repair") return repairPosition(context.ownPlanet);
    if (this.mode === "MoveToLaunch" && context.surfacePlanet) return launchPadPosition(context.surfacePlanet);
    if (this.mode === "Sabotage" && this.sabotageTarget) {
      const planet = context.planets.find((candidate) => candidate.id === this.sabotageTarget!.planetId && candidate.alive);
      return planet ? this.structurePosition(planet, this.sabotageTarget.structure) : null;
    }
    if (this.mode === "SeekScrap") return context.scraps.find((scrap) => scrap.id === this.targetScrapId)?.position ?? null;
    return this.wanderPoint;
  }

  private makeInput(context: BotContext, target: Vec3 | null): PlayerInput {
    const gravityPlanet = context.planets.find((planet) => planet.id === context.player.gravityPlanetId && planet.alive);
    const navigationPlanet = context.surfacePlanet ?? gravityPlanet ?? this.nearestPlanet(context.player.position, context.planets) ?? context.ownPlanet;
    const outward = normalize(sub(context.player.position, navigationPlanet.position));
    let direction: Vec3 = { x: 0, y: 0, z: 1 };
    if (target) {
      const projected = projectOnPlane(sub(target, context.player.position), outward);
      const projectedLengthSquared = projected.x ** 2 + projected.y ** 2 + projected.z ** 2;
      direction = projectedLengthSquared > .0001
        ? normalize(projected)
        : normalize(cross(outward, Math.abs(outward.y) > .9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }));
    }
    const targetDistance = target ? distance(context.player.position, target) : 0;
    const moving = Boolean(target && targetDistance > 1.45 && this.mode !== "Aim" && this.mode !== "Repair");
    const moveAmount = moving ? clamp((targetDistance - 1.15) / 3.4, .22, 1) : 0;
    const recoveryReady = context.activeModifier === "low-gravity"
      || context.now >= context.player.launchCooldownUntil + this.activeProfile.recoveryDelayMs;
    return {
      sequence: ++this.sequence,
      dt: 1 / BALANCE.serverRate,
      moveX: 0,
      moveY: moveAmount,
      cameraForward: direction,
      jump: false,
      burst: moving && this.random() < 0.0025,
      grapple: this.mode === "Recover" && recoveryReady,
      grapplePoint: this.mode === "Recover" && recoveryReady && target ? target : undefined
    };
  }

  private structurePosition(planet: PlanetState, structure: StructureType): Vec3 {
    return structure === "cannon" ? cannonPosition(planet) : repairPosition(planet);
  }

  private chooseTarget(context: BotContext): PlanetState | undefined {
    const enemies = context.planets.filter((planet) => planet.alive && planet.ownerId !== context.player.id);
    let target: PlanetState | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
      const score = enemy.integrity + this.random() * 24;
      if (score < bestScore) { target = enemy; bestScore = score; }
    }
    return target;
  }

  private nearestPlanet(position: Vec3, planets: PlanetState[]): PlanetState | undefined {
    let nearest: PlanetState | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const planet of planets) {
      if (!planet.alive) continue;
      const candidateDistance = distance(position, planet.position);
      if (candidateDistance < nearestDistance) { nearest = planet; nearestDistance = candidateDistance; }
    }
    return nearest;
  }

  private nearestScrap(position: Vec3, scraps: ScrapState[]): ScrapState | undefined {
    let nearest: ScrapState | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const scrap of scraps) {
      const candidateDistance = distance(position, scrap.position);
      if (candidateDistance < nearestDistance) { nearest = scrap; nearestDistance = candidateDistance; }
    }
    return nearest;
  }

  private chooseWeapon(scrap: number): WeaponType | null {
    if (scrap >= BALANCE.weapons.asteroid.cost && this.random() < this.activeProfile.asteroidBias) return "asteroid";
    if (scrap >= BALANCE.weapons.cluster.cost && this.random() < .22) return "cluster";
    if (scrap >= BALANCE.weapons["gravity-bomb"].cost && this.random() < .18) return "gravity-bomb";
    return scrap >= BALANCE.weapons.rocket.cost ? "rocket" : null;
  }

  private chooseWanderPoint(context: BotContext, planet: PlanetState): void {
    if (this.wanderPlanetId === planet.id && this.wanderPoint && distance(context.player.position, this.wanderPoint) >= 2) return;
    const theta = this.random() * Math.PI * 2;
    const y = this.random() * 1.4 - 0.7;
    const radial = Math.sqrt(1 - y * y);
    this.wanderPlanetId = planet.id;
    this.wanderPoint = add(planet.position, scale({ x: Math.cos(theta) * radial, y, z: Math.sin(theta) * radial }, BALANCE.planetRadius + 0.95));
  }

  private aimAt(ownPlanet: PlanetState, target: PlanetState): Vec3 {
    const origin = cannonPosition(ownPlanet);
    const direct = normalize(sub(target.position, origin));
    const fallback = Math.abs(direct.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const side = normalize(projectOnPlane(fallback, direct));
    const second = normalize({
      x: direct.y * side.z - direct.z * side.y,
      y: direct.z * side.x - direct.x * side.z,
      z: direct.x * side.y - direct.y * side.x
    });
    const angle = this.activeProfile.aimErrorRadians * (0.35 + this.random() * 0.9);
    const phase = this.random() * Math.PI * 2;
    return normalize(add(direct, add(scale(side, Math.cos(phase) * Math.tan(angle)), scale(second, Math.sin(phase) * Math.tan(angle)))));
  }
}
