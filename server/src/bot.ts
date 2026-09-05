import {
  BALANCE,
  add,
  cannonPosition,
  clamp,
  distance,
  normalize,
  projectOnPlane,
  repairPosition,
  scale,
  sub,
  type PlanetState,
  type PlayerInput,
  type PlayerState,
  type RoomPhase,
  type ScrapState,
  type Vec3,
  type WeaponType
} from "@planetfall/shared";

export const BOT_NAMES = ["Nova", "Orbit", "Comet", "Astro", "Luna", "Cosmo", "Sol", "Vega", "Apollo", "Meteor"] as const;
export type BotMode = "Recover" | "SeekScrap" | "MoveToCannon" | "Aim" | "MoveToRepair" | "Repair" | "Idle";

export interface BotProfile {
  aggression: number;
  repairThreshold: number;
  aimErrorRadians: number;
  reactionMs: number;
  asteroidBias: number;
}

export interface BotContext {
  now: number;
  phase: RoomPhase;
  player: PlayerState;
  ownPlanet: PlanetState;
  planets: PlanetState[];
  scraps: ScrapState[];
}

export interface BotDecision {
  mode: BotMode;
  input: PlayerInput;
  fire?: { weapon: WeaponType; direction: Vec3 };
  repair?: true;
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
    asteroidBias: 0.25 + random() * 0.4
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

  constructor(readonly id: string) {
    this.profile = createBotProfile(id);
    this.random = mulberry32(hash(`${id}:choices`));
  }

  update(context: BotContext): BotDecision {
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
    return decision;
  }

  private think(context: BotContext): void {
    this.nextThinkAt = context.now + 500 + this.random() * 500;
    const altitude = distance(context.player.position, context.ownPlanet.position) - BALANCE.planetRadius;
    if (altitude > 3.5) { this.mode = "Recover"; return; }

    const shouldRepair = context.phase !== "overtime"
      && context.ownPlanet.integrity <= this.profile.repairThreshold
      && context.player.scrap >= BALANCE.repair.cost;
    if (shouldRepair) {
      const station = repairPosition(context.ownPlanet);
      if (distance(context.player.position, station) <= 3.2) {
        this.mode = "Repair"; this.actionAt = context.now + this.profile.reactionMs * 0.5;
      } else this.mode = "MoveToRepair";
      return;
    }

    const canAttack = context.player.scrap >= BALANCE.weapons.rocket.cost;
    const attackNow = canAttack && this.random() < this.profile.aggression * 0.38;
    if (attackNow) {
      this.targetPlanetId = this.chooseTarget(context)?.id ?? null;
      const cannon = cannonPosition(context.ownPlanet);
      if (this.targetPlanetId && distance(context.player.position, cannon) <= 3.5) {
        this.mode = "Aim"; this.actionAt = context.now + this.profile.reactionMs;
      } else this.mode = "MoveToCannon";
      return;
    }

    const scraps = context.scraps.filter((scrap) => scrap.planetId === context.ownPlanet.id);
    const nearest = scraps.sort((a, b) => distance(context.player.position, a.position) - distance(context.player.position, b.position))[0];
    if (nearest) { this.mode = "SeekScrap"; this.targetScrapId = nearest.id; return; }
    this.mode = "Idle";
    if (!this.wanderPoint || distance(context.player.position, this.wanderPoint) < 2) {
      const theta = this.random() * Math.PI * 2;
      const y = this.random() * 1.4 - 0.7;
      const radial = Math.sqrt(1 - y * y);
      this.wanderPoint = add(context.ownPlanet.position, scale({ x: Math.cos(theta) * radial, y, z: Math.sin(theta) * radial }, BALANCE.planetRadius + 0.95));
    }
  }

  private movementTarget(context: BotContext): Vec3 | null {
    if (this.mode === "Recover") {
      const outward = normalize(sub(context.player.position, context.ownPlanet.position));
      return add(context.ownPlanet.position, scale(outward, BALANCE.planetRadius));
    }
    if (this.mode === "MoveToCannon" || this.mode === "Aim") return cannonPosition(context.ownPlanet);
    if (this.mode === "MoveToRepair" || this.mode === "Repair") return repairPosition(context.ownPlanet);
    if (this.mode === "SeekScrap") return context.scraps.find((scrap) => scrap.id === this.targetScrapId)?.position ?? null;
    return this.wanderPoint;
  }

  private makeInput(context: BotContext, target: Vec3 | null): PlayerInput {
    const outward = normalize(sub(context.player.position, context.ownPlanet.position));
    const direction = target ? normalize(projectOnPlane(sub(target, context.player.position), outward)) : { x: 0, y: 0, z: 1 };
    const moving = Boolean(target && distance(context.player.position, target) > 1.45 && this.mode !== "Aim" && this.mode !== "Repair");
    return {
      sequence: ++this.sequence,
      dt: 1 / BALANCE.serverRate,
      moveX: 0,
      moveY: moving ? 1 : 0,
      cameraForward: direction,
      jump: false,
      burst: moving && this.random() < 0.0025,
      grapple: this.mode === "Recover",
      grapplePoint: this.mode === "Recover" && target ? target : undefined
    };
  }

  private chooseTarget(context: BotContext): PlanetState | undefined {
    const enemies = context.planets.filter((planet) => planet.alive && planet.ownerId !== context.player.id);
    return enemies.sort((a, b) => (a.integrity + this.random() * 24) - (b.integrity + this.random() * 24))[0];
  }

  private chooseWeapon(scrap: number): WeaponType | null {
    if (scrap >= BALANCE.weapons.asteroid.cost && this.random() < this.profile.asteroidBias) return "asteroid";
    return scrap >= BALANCE.weapons.rocket.cost ? "rocket" : null;
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
