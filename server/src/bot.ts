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
  type ChaosModifier,
  type MatchRules,
  type RoomPhase,
  type ScrapState,
  type Vec3,
  type WeaponType
} from "@planetfall/shared";

export const BOT_NAMES = ["Nova", "Orbit", "Comet", "Astro", "Luna", "Cosmo", "Sol", "Vega", "Apollo", "Meteor"] as const;
export type BotMode = "Recover" | "SeekScrap" | "MoveToCannon" | "Aim" | "MoveToRepair" | "Repair" | "MoveToLaunch" | "Idle";

export interface BotProfile {
  aggression: number;
  repairThreshold: number;
  aimErrorRadians: number;
  reactionMs: number;
  asteroidBias: number;
  riskTolerance: number;
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
}

export interface BotDecision {
  mode: BotMode;
  input: PlayerInput;
  fire?: { weapon: WeaponType; direction: Vec3 };
  repair?: true;
  launchTargetId?: string;
  shoveTargetId?: string;
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
    riskTolerance: 0.3 + random() * 0.5
  };
}

export class BotBrain {
  readonly profile: BotProfile;
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

  constructor(readonly id: string) {
    this.profile = createBotProfile(id);
    this.random = mulberry32(hash(`${id}:choices`));
  }

  update(context: BotContext): BotDecision {
    const surface = context.surfacePlanet;
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
    if (context.now >= this.nextThinkAt) this.think(context);
    const target = this.movementTarget(context);
    const input = this.makeInput(context, target);
    const decision: BotDecision = { mode: this.mode, input };
    const nearbyEnemy = context.players.find((candidate) => candidate.alive && candidate.id !== context.player.id && candidate.surfacePlanetId && candidate.surfacePlanetId === context.player.surfacePlanetId && distance(candidate.position, context.player.position) <= BALANCE.shove.range);
    const shoveChance = context.activeModifier === "super-shove" ? 0.075 : 0.035;
    if (nearbyEnemy && this.random() < shoveChance) {
      decision.shoveTargetId = nearbyEnemy.id;
      decision.input.cameraForward = normalize(sub(nearbyEnemy.position, context.player.position));
    }
    return decision;
  }

  private think(context: BotContext): void {
    this.nextThinkAt = context.now + 500 + this.random() * 500;
    const navigationPlanet = context.surfacePlanet ?? this.nearestPlanet(context.player.position, context.planets);
    const altitude = navigationPlanet ? distance(context.player.position, navigationPlanet.position) - BALANCE.planetRadius : Infinity;
    if (altitude > 3.5) { this.mode = "Recover"; return; }

    if (context.surfacePlanet && context.surfacePlanet.id !== context.ownPlanet.id) {
      if (context.ownPlanet.integrity <= this.profile.repairThreshold || context.now >= this.raidEndsAt) {
        this.raidTargetPlanetId = context.ownPlanet.id;
        this.mode = "MoveToLaunch";
        return;
      }
      const enemyScraps = context.scraps.filter((scrap) => scrap.planetId === context.surfacePlanet!.id);
      const nearestEnemyScrap = this.nearestScrap(context.player.position, enemyScraps);
      if (nearestEnemyScrap) { this.mode = "SeekScrap"; this.targetScrapId = nearestEnemyScrap.id; return; }
      this.mode = "Idle";
      this.chooseWanderPoint(context, context.surfacePlanet);
      return;
    }

    if (this.raidTargetPlanetId === context.ownPlanet.id) this.raidTargetPlanetId = null;

    const repairThreshold = this.profile.repairThreshold + (context.activeModifier === "fragile-worlds" ? 8 : 0);
    const shouldRepair = context.phase !== "overtime"
      && context.ownPlanet.integrity <= Math.min(context.rules.maxIntegrity - 1, repairThreshold)
      && context.player.scrap >= BALANCE.repair.cost;
    if (shouldRepair) {
      const station = repairPosition(context.ownPlanet);
      if (distance(context.player.position, station) <= 3.2) {
        this.mode = "Repair"; this.actionAt = context.now + this.profile.reactionMs * 0.5;
      } else this.mode = "MoveToRepair";
      return;
    }

    const raidTarget = this.chooseTarget(context);
    const raidBoost = context.activeModifier === "launch-party" ? 1.65 : 1;
    if (raidTarget && context.now >= context.player.launchCooldownUntil && this.random() < this.profile.aggression * this.profile.riskTolerance * 0.09 * raidBoost) {
      this.raidTargetPlanetId = raidTarget.id;
      this.raidEndsAt = context.now + 8500 + this.random() * 6500;
      this.mode = "MoveToLaunch";
      return;
    }

    const canAttack = context.player.scrap >= BALANCE.weapons.rocket.cost;
    const spendBoost = context.activeModifier === "scrap-rush" ? 1.3 : 1;
    const attackNow = canAttack && this.random() < this.profile.aggression * 0.38 * spendBoost;
    if (attackNow) {
      this.targetPlanetId = this.chooseTarget(context)?.id ?? null;
      const cannon = cannonPosition(context.ownPlanet);
      if (this.targetPlanetId && distance(context.player.position, cannon) <= 3.5) {
        this.mode = "Aim"; this.actionAt = context.now + this.profile.reactionMs;
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
      const nearest = this.nearestPlanet(context.player.position, context.planets) ?? context.ownPlanet;
      const outward = normalize(sub(context.player.position, nearest.position));
      return add(nearest.position, scale(outward, BALANCE.planetRadius));
    }
    if (this.mode === "MoveToCannon" || this.mode === "Aim") return cannonPosition(context.ownPlanet);
    if (this.mode === "MoveToRepair" || this.mode === "Repair") return repairPosition(context.ownPlanet);
    if (this.mode === "MoveToLaunch" && context.surfacePlanet) return launchPadPosition(context.surfacePlanet);
    if (this.mode === "SeekScrap") return context.scraps.find((scrap) => scrap.id === this.targetScrapId)?.position ?? null;
    return this.wanderPoint;
  }

  private makeInput(context: BotContext, target: Vec3 | null): PlayerInput {
    const navigationPlanet = context.surfacePlanet ?? this.nearestPlanet(context.player.position, context.planets) ?? context.ownPlanet;
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
    return {
      sequence: ++this.sequence,
      dt: 1 / BALANCE.serverRate,
      moveX: 0,
      moveY: moveAmount,
      cameraForward: direction,
      jump: false,
      burst: moving && this.random() < 0.0025,
      grapple: this.mode === "Recover" && (context.activeModifier === "low-gravity" || context.player.launchCooldownUntil <= context.now),
      grapplePoint: this.mode === "Recover" && (context.activeModifier === "low-gravity" || context.player.launchCooldownUntil <= context.now) && target ? target : undefined
    };
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
    if (scrap >= BALANCE.weapons.asteroid.cost && this.random() < this.profile.asteroidBias) return "asteroid";
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
    const angle = this.profile.aimErrorRadians * (0.35 + this.random() * 0.9);
    const phase = this.random() * Math.PI * 2;
    return normalize(add(direct, add(scale(side, Math.cos(phase) * Math.tan(angle)), scale(second, Math.sin(phase) * Math.tan(angle)))));
  }
}
