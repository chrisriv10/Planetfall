import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  BALANCE,
  FREE_EMOTES,
  PLANET_PALETTES,
  SHOP_CATALOG,
  WEAPON_COPY,
  WEAPON_ORDER,
  add,
  applyBurstVelocity,
  applyGrappleVelocity,
  applyLaunchGuidance,
  canExecuteBufferedJump,
  cannonPosition,
  clamp,
  createMatchRules,
  cross,
  distance,
  dot,
  explosionFalloff,
  gravityAcceleration,
  grappleRestLength,
  isShoveTarget,
  length,
  launchGravityAcceleration,
  launchPadNormal,
  launchPadPosition,
  launchVelocity,
  limitSpeed,
  normalize,
  projectOnPlane,
  repairPosition,
  reconciliationStrength,
  scale,
  selectGravityPlanetId,
  stepTangentVelocity,
  sub,
  updateGroundedState,
  type PlanetState,
  type EmoteType,
  type MatchRules,
  type PlayerInput,
  type PlayerInteraction,
  type PlayerState,
  type ProjectileState,
  type RoomView,
  type ServerSnapshot,
  type StructureType,
  type Vec3,
  type WeaponType
} from "@planetfall/shared";
import { GameAudio } from "./audio";
import { GameInput, inputLabel, type InputAction, type InputFrame, type InputMethod } from "./input";
import { ReconciliationTracker, interpolationAlpha, shouldAcceptSnapshot, type ReconciliationMetrics } from "./reconciliation";
import { QUALITY_PRESETS, defaultSettings, shakeMultiplier, type QualityPreset, type UserSettings } from "./settings";

type PlanetVisual = {
  group: THREE.Group;
  shell: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  atmosphere: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  surfacePatches: THREE.Group;
  cracks: THREE.Group;
  props: THREE.Group;
  damageDebris: THREE.Group;
  cannon: THREE.Group;
  barrel: THREE.Group;
  muzzle: THREE.Mesh;
  cannonAccent: THREE.MeshStandardMaterial;
  repair: THREE.Group;
  repairCore: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  repairRings: THREE.Group;
  launchPad: THREE.Group;
  launchRing: THREE.Mesh;
  launchArms: THREE.Group;
  launchHighlight: THREE.Group;
  cannonJam: THREE.Group;
  repairJam: THREE.Group;
  structureLabels: { cannon: THREE.Sprite; repair: THREE.Sprite; launch: THREE.Sprite };
  label: THREE.Sprite;
  labelCanvas: HTMLCanvasElement;
  labelContext: CanvasRenderingContext2D;
  labelTexture: THREE.CanvasTexture;
  labelKey: string;
  baseColor: THREE.Color;
  recoil: number;
  repairPulse: number;
  launchPulse: number;
  nextJamSparkAt: number;
  nextDamagePulseAt: number;
  destroyedAt: number;
  state: PlanetState;
  body?: RAPIER.RigidBody;
};
type PlayerVisual = {
  group: THREE.Group;
  target: THREE.Vector3;
  state: PlayerState;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  torso: THREE.Mesh;
  helmet: THREE.Group;
  visor: THREE.Mesh;
  backpack: THREE.Group;
  flightTrail: THREE.Line;
  flightTrailPoints: THREE.Vector3[];
  intruderMarker: THREE.Group;
  intruderDiamond: THREE.Mesh;
  nameLabel: THREE.Sprite;
  localMarker: THREE.Group;
  suitMaterial: THREE.MeshStandardMaterial;
  emote: EmoteType | null;
  emoteUntil: number;
  shoveUntil: number;
  hitPulse: number;
  landingPulse: number;
  previousSurfacePlanetId: string | null;
  presentationUp: THREE.Vector3;
  presentationForward: THREE.Vector3;
  lodDetails: THREE.Object3D[];
};
type ProjectileVisual = { mesh: THREE.Group; velocity: THREE.Vector3; weapon: WeaponType; ownerId: string; fragment: boolean; threatening: boolean; trail: THREE.Line; trailPoints: THREE.Vector3[]; maxTrailPoints: number };
type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number; growth?: number; spin?: number };

export type PromptKind = "idle" | "launch" | "shove" | "sabotage" | "cooldown" | "weapon";
export type EdgeIndicator = { id: string; label: string; color: string; x: number; y: number; angle: number; danger?: boolean };

const vec = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z);
const plain = (v: THREE.Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
const particleGeometry = new THREE.IcosahedronGeometry(0.12, 0);
const damagedPlanetColor = new THREE.Color(0x33243c);
const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const atmosphereFragmentShader = `
  uniform vec3 glowColor;
  uniform float intensity;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float rim = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.35);
    gl_FragColor = vec4(glowColor, rim * intensity);
  }
`;

function seededRandom(seed: string): () => number {
  let value = [...seed].reduce((total, character) => Math.imul(total ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}

function makeWorldLabel(text: string, color = "#70f5ff", width = 256): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "rgba(5,8,31,.82)";
  context.beginPath(); context.roundRect(4, 8, width - 8, 48, 15); context.fill();
  context.strokeStyle = color; context.lineWidth = 3; context.stroke();
  context.fillStyle = "#fff"; context.font = "900 24px Trebuchet MS";
  context.textAlign = "center"; context.textBaseline = "middle";
  context.fillText(text, width / 2, 32, width - 24);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.renderOrder = 9;
  sprite.userData.canvasTexture = texture;
  sprite.userData.canvas = canvas;
  sprite.userData.color = color;
  sprite.userData.labelKey = `${text}|${color}`;
  return sprite;
}

function updateWorldLabel(sprite: THREE.Sprite, text: string, color?: string): void {
  const nextColor = color ?? String(sprite.userData.color ?? "#70f5ff");
  const key = `${text}|${nextColor}`;
  if (sprite.userData.labelKey === key) return;
  sprite.userData.labelKey = key; sprite.userData.color = nextColor;
  const canvas = sprite.userData.canvas as HTMLCanvasElement;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(5,8,31,.82)"; context.beginPath(); context.roundRect(4, 8, canvas.width - 8, 48, 15); context.fill();
  context.strokeStyle = nextColor; context.lineWidth = 3; context.stroke();
  context.fillStyle = "#fff"; context.font = "900 24px Trebuchet MS"; context.textAlign = "center"; context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, 32, canvas.width - 24);
  (sprite.userData.canvasTexture as THREE.CanvasTexture).needsUpdate = true;
}

function cosmeticColor(itemId: string, fallback: string): string {
  return SHOP_CATALOG.find((item) => item.id === itemId)?.color ?? fallback;
}

export class PlanetfallGame {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 500);
  readonly audio = new GameAudio();
  readonly canvas: HTMLCanvasElement;
  weapon: WeaponType = "rocket";
  onInput?: (input: PlayerInput) => void;
  onFire?: (weapon: WeaponType, direction: Vec3) => void;
  onRepair?: () => void;
  onInteract?: (interaction: PlayerInteraction) => void;
  onWeaponChange?: (weapon: WeaponType) => void;
  onEmote?: (emote: EmoteType, direction: Vec3) => void;
  onEmoteMenu?: (open: boolean, selected: EmoteType) => void;
  onPrompt?: (text: string, aiming: boolean, label?: string, kind?: PromptKind, progress?: number) => void;
  onIndicators?: (indicators: EdgeIndicator[]) => void;
  onHint?: (id: string, text: string) => void;
  onInputMethod?: (method: InputMethod) => void;
  onMenuNavigate?: (action: "up" | "down" | "left" | "right" | "confirm" | "back") => void;
  onPauseRequest?: () => void;

  private physics!: RAPIER.World;
  private room: RoomView | null = null;
  private localId = "";
  private planets = new Map<string, PlanetVisual>();
  private players = new Map<string, PlayerVisual>();
  private scraps = new Map<string, THREE.Group>();
  private projectiles = new Map<string, ProjectileVisual>();
  private particles: Particle[] = [];
  private readonly input: GameInput;
  private inputFrame: InputFrame | null = null;
  private settings: UserSettings = defaultSettings(matchMedia("(prefers-reduced-motion: reduce)").matches);
  private quality: QualityPreset = QUALITY_PRESETS.high;
  private uiCaptured = false;
  private yaw = 0;
  private pitch = 0.2;
  private lookYawDelta = 0;
  private inputSequence = 0;
  private inputAccumulator = 0;
  private cameraForward = new THREE.Vector3(0, 0, -1);
  private cameraLocalUp = new THREE.Vector3(0, 1, 0);
  private labelPosition = new THREE.Vector3();
  private localPosition = new THREE.Vector3();
  private localVelocity = new THREE.Vector3();
  private correction = new THREE.Vector3();
  private localInitialized = false;
  private jumpLatch = false;
  private jumpQueuedUntil = 0;
  private burstLatch = false;
  private grappleHeld = false;
  private grapplePoint: THREE.Vector3 | null = null;
  private grappleRestLength = 0;
  private grappleTension = 0;
  private localSurfacePlanetId: string | null = null;
  private localGravityPlanetId: string | null = null;
  private localGrounded = false;
  private lastLocalGroundedAt = 0;
  private previousRadialSpeed = 0;
  private launchAiming = false;
  private launchSourcePlanetId: string | null = null;
  private launchTargetPlanetId: string | null = null;
  private launchTargetOffset = 0;
  private launchTargetCycled = false;
  private emoteSelecting = false;
  private emoteSelection: EmoteType = "wave";
  private activeSabotage: { planetId: string; structure: StructureType; startedAt: number } | null = null;
  private localLaunchTargetPlanetId: string | null = null;
  private localLaunchSourcePlanetId: string | null = null;
  private localLaunchAssistUntil = 0;
  private lastLocalBurst = 0;
  private lastFrame = performance.now();
  private demo = new THREE.Group();
  private demoTime = 0;
  private rope: THREE.Line;
  private ropeAnchor: THREE.Mesh;
  private trajectory: THREE.Line;
  private starLayers: THREE.Points[] = [];
  private particleMaterials = new Map<number, THREE.MeshBasicMaterial>();
  private shake = 0;
  private recentDamage = new Map<string, number>();
  private lastIndicatorUpdate = 0;
  private lastIncomingWarning = 0;
  private lastCriticalWarning = 0;
  private nextChaosParticleAt = 0;
  private measuredFps = 60;
  private performanceFrames = 0;
  private performanceSampleAt = performance.now();
  private lastSnapshotServerTime = Number.NEGATIVE_INFINITY;
  private reconciliationTracker = new ReconciliationTracker();
  private spectatorIndex = 0;
  private wasGrounded = false;
  private mode: "home" | "lobby" | "match" | "results" = "home";
  private rules: MatchRules = createMatchRules();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.input = new GameInput(canvas);
    this.input.onMethodChange = (method) => this.onInputMethod?.(method);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene.fog = new THREE.FogExp2(0x07091e, 0.0035);

    const ropeGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.rope = new THREE.Line(ropeGeometry, new THREE.LineBasicMaterial({ color: 0x70f5ff, transparent: true, opacity: 0.9 }));
    this.rope.visible = false;
    this.ropeAnchor = new THREE.Mesh(
      new THREE.OctahedronGeometry(.18, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9 })
    );
    this.ropeAnchor.visible = false;
    this.scene.add(this.rope, this.ropeAnchor);
    this.trajectory = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffdc4f, dashSize: 0.55, gapSize: 0.35, transparent: true, opacity: 0.8 }));
    this.trajectory.visible = false;
    this.scene.add(this.trajectory);

    this.setupScene();
    this.bindControls();
    addEventListener("resize", () => this.resize());
  }

  async init(): Promise<void> {
    await RAPIER.init();
    this.physics = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.createDemo();
    this.lastFrame = performance.now();
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  setMode(mode: "home" | "lobby" | "match" | "results"): void {
    this.mode = mode;
    this.demo.visible = mode === "home" || mode === "lobby";
    for (const planet of this.planets.values()) planet.group.visible = mode === "match" || mode === "results";
    for (const player of this.players.values()) player.group.visible = mode === "match" || mode === "results";
    if (mode !== "match") {
      this.onIndicators?.([]);
      this.trajectory.visible = false;
      this.rope.visible = false;
      this.ropeAnchor.visible = false;
      this.launchAiming = false;
      this.launchSourcePlanetId = null;
      this.launchTargetPlanetId = null;
      this.activeSabotage = null;
      this.localLaunchTargetPlanetId = null;
      this.localLaunchSourcePlanetId = null;
      this.localLaunchAssistUntil = 0;
      document.exitPointerLock?.();
    }
  }

  setLocalId(id: string): void {
    this.localId = id;
    this.localInitialized = false;
    this.localSurfacePlanetId = null;
    this.localGravityPlanetId = null;
    this.localGrounded = false;
    this.lastLocalGroundedAt = 0;
    this.jumpQueuedUntil = 0;
    this.grappleRestLength = 0;
    this.lastSnapshotServerTime = Number.NEGATIVE_INFINITY;
    this.reconciliationTracker.reset();
  }

  setSettings(settings: UserSettings): void {
    this.settings = settings;
    this.quality = QUALITY_PRESETS[settings.graphicsQuality];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pixelRatioCap));
    this.audio.setVolumes(settings.musicVolume, settings.sfxVolume);
  }

  setUiCaptured(captured: boolean): void {
    this.uiCaptured = captured;
    if (captured) {
      this.jumpLatch = false;
      this.burstLatch = false;
      this.grappleHeld = false;
      this.grapplePoint = null;
      this.grappleRestLength = 0;
      this.grappleTension = 0;
      if (this.activeSabotage) {
        this.onInteract?.({ action: "sabotage", planetId: this.activeSabotage.planetId, structure: this.activeSabotage.structure, active: false });
        this.activeSabotage = null;
      }
      document.exitPointerLock?.();
    }
  }

  getInputMethod(): InputMethod { return this.input.method; }

  setRoom(room: RoomView): void {
    this.room = room;
    this.rules = room.rules ?? createMatchRules();
    this.syncPlanets(room.planets);
    this.syncPlayers(room.players);
    this.syncScraps(room.scraps);
  }

  debugState(): {
    localId: string;
    localPosition: Vec3;
    cameraForward: Vec3;
    players: PlayerState[];
    planets: PlanetState[];
    matchStats: RoomView["matchStats"];
    gameMode: RoomView["gameMode"] | null;
    activeModifier: RoomView["activeModifier"] | null;
    rules: MatchRules;
    scraps: RoomView["scraps"];
    launchPads: { planetId: string; position: Vec3 }[];
    cannons: { planetId: string; position: Vec3 }[];
    repairs: { planetId: string; position: Vec3 }[];
    performance: { fps: number; drawCalls: number; triangles: number; particles: number; projectiles: number };
    mechanics: { speed: number; grounded: boolean; gravityPlanetId: string | null; altitude: number | null; correction: number; grappleTension: number; launchAssist: boolean; reconciliation: ReconciliationMetrics };
  } {
    const gravityPlanet = this.localGravityPlanetId ? this.planets.get(this.localGravityPlanetId) : undefined;
    return {
      localId: this.localId,
      localPosition: plain(this.localPosition),
      cameraForward: plain(this.cameraForward),
      players: this.room?.players.map((player) => ({ ...player, position: { ...player.position }, velocity: { ...player.velocity }, rotation: { ...player.rotation } })) ?? [],
      planets: this.room?.planets.map((planet) => ({ ...planet, position: { ...planet.position } })) ?? [],
      matchStats: this.room?.matchStats.map((stats) => ({ ...stats })) ?? [],
      gameMode: this.room?.gameMode ?? null,
      activeModifier: this.room?.activeModifier ?? null,
      rules: { ...this.rules },
      scraps: this.room?.scraps.map((scrap) => ({ ...scrap, position: { ...scrap.position } })) ?? [],
      launchPads: this.room?.planets.map((planet) => ({ planetId: planet.id, position: launchPadPosition(planet) })) ?? [],
      cannons: this.room?.planets.map((planet) => ({ planetId: planet.id, position: cannonPosition(planet) })) ?? [],
      repairs: this.room?.planets.map((planet) => ({ planetId: planet.id, position: repairPosition(planet) })) ?? [],
      performance: {
        fps: this.measuredFps, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
        particles: this.particles.length, projectiles: this.projectiles.size
      },
      mechanics: {
        speed: this.localVelocity.length(), grounded: this.localGrounded, gravityPlanetId: this.localGravityPlanetId,
        altitude: gravityPlanet ? this.localPosition.distanceTo(gravityPlanet.group.position) - BALANCE.planetRadius : null,
        correction: this.correction.length(), grappleTension: this.grappleTension,
        launchAssist: performance.now() < this.localLaunchAssistUntil,
        reconciliation: this.reconciliationTracker.summary(performance.now())
      }
    };
  }

  applySnapshot(snapshot: ServerSnapshot): boolean {
    if (!this.room || !shouldAcceptSnapshot(this.lastSnapshotServerTime, snapshot.serverTime)) return false;
    this.lastSnapshotServerTime = snapshot.serverTime;
    this.room.phase = snapshot.phase;
    this.room.matchEndsAt = snapshot.matchEndsAt;
    this.room.players = snapshot.players;
    this.room.planets = snapshot.planets;
    this.room.scraps = snapshot.scraps;
    this.syncPlanets(snapshot.planets);
    this.syncPlayers(snapshot.players);
    this.syncScraps(snapshot.scraps);
    return true;
  }

  spawnProjectile(projectile: ProjectileState): void {
    if (this.projectiles.has(projectile.id)) return;
    const group = this.makeProjectile(projectile);
    group.position.copy(vec(projectile.position));
    group.lookAt(group.position.clone().add(vec(projectile.velocity)));
    this.scene.add(group);
    const maxTrailPoints = Math.max(5, Math.round((projectile.weapon === "asteroid" ? 9 : projectile.weapon === "cluster" ? 11 : 13) * this.quality.trailScale));
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxTrailPoints * 3), 3).setUsage(THREE.DynamicDrawUsage));
    trailGeometry.setDrawRange(0, 1);
    const trail = new THREE.Line(
      trailGeometry,
      new THREE.LineBasicMaterial({ color: projectile.weapon === "rocket" ? 0x70f5ff : projectile.weapon === "cluster" ? 0xffdc4f : projectile.weapon === "gravity-bomb" ? 0xb67cff : 0xff7b4d, transparent: true, opacity: 0.72 })
    );
    this.scene.add(trail);
    const threatening = this.threatensLocalPlanet(projectile);
    this.projectiles.set(projectile.id, {
      mesh: group, velocity: vec(projectile.velocity), weapon: projectile.weapon, ownerId: projectile.ownerId, fragment: Boolean(projectile.fragment),
      threatening, trail, trailPoints: [group.position.clone()], maxTrailPoints
    });
    const ownerPlanet = [...this.planets.values()].find((planet) => planet.state.ownerId === projectile.ownerId);
    if (ownerPlanet && !projectile.fragment) {
      ownerPlanet.recoil = 1;
      (ownerPlanet.muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 5;
      const muzzlePosition = ownerPlanet.muzzle.getWorldPosition(new THREE.Vector3());
      this.spawnBurst(muzzlePosition, [0xffdc4f, 0xffffff, 0x9fb4ca], projectile.weapon === "asteroid" ? 14 : 9, projectile.weapon === "asteroid" ? 5 : 3.5);
      this.spawnPulse(muzzlePosition, projectile.weapon === "asteroid" ? 0xff8a4f : 0xffdc4f, projectile.weapon === "asteroid" ? 1.3 : .85);
    }
    if (!projectile.fragment) {
      if (projectile.weapon === "asteroid") this.audio.asteroid();
      else if (projectile.weapon === "cluster") this.audio.cluster();
      else if (projectile.weapon === "gravity-bomb") this.audio.gravityBomb();
      else this.audio.rocket();
    }
    if (threatening && performance.now() - this.lastIncomingWarning > 1400) {
      this.lastIncomingWarning = performance.now();
      this.audio.incoming(projectile.weapon === "asteroid");
    }
    if (!projectile.fragment) this.shake = Math.max(this.shake, 0.18);
  }

  explode(payload: { id: string; position: Vec3; weapon: WeaponType; burst?: boolean }): void {
    const projectile = this.projectiles.get(payload.id);
    if (projectile) this.disposeProjectile(projectile);
    this.projectiles.delete(payload.id);
    const position = vec(payload.position);
    if (payload.burst) {
      this.spawnBurst(position, [0xffdc4f, 0xff8bd9, 0xffffff], 18, 5.5);
      this.spawnPulse(position, 0xffdc4f, 1.2);
      this.audio.clusterBurst();
      return;
    }
    const local = this.players.get(this.localId);
    const config = BALANCE.weapons[payload.weapon];
    const knockbackFalloff = local?.state.alive ? explosionFalloff(this.localPosition.distanceTo(position), config.radius * 1.8) : 0;
    if (knockbackFalloff > 0) {
      const gravityPlanet = (this.localGravityPlanetId ? this.planets.get(this.localGravityPlanetId) : undefined)
        ?? this.nearestPlanet(this.localPosition, true);
      const blastDirection = payload.weapon === "gravity-bomb"
        ? position.clone().sub(this.localPosition).normalize()
        : this.localPosition.clone().sub(position).normalize();
      const surfaceOutward = gravityPlanet
        ? this.localPosition.clone().sub(gravityPlanet.group.position).normalize()
        : blastDirection.clone();
      const impulseDirection = payload.weapon === "gravity-bomb" ? blastDirection : blastDirection.addScaledVector(surfaceOutward, .32).normalize();
      this.localVelocity.addScaledVector(impulseDirection, config.knockback * knockbackFalloff);
      this.localVelocity.copy(vec(limitSpeed(plain(this.localVelocity), BALANCE.maxPlayerSpeed)));
      this.localGrounded = false;
      this.jumpQueuedUntil = 0;
    }
    const count = Math.round((payload.weapon === "asteroid" ? 34 : payload.weapon === "cluster" ? 17 : 22) * this.quality.particleScale);
    const colors = payload.weapon === "asteroid" ? [0xff794c, 0xffcf57, 0xb67cff]
      : payload.weapon === "cluster" ? [0xffdc4f, 0xff8bd9, 0xffffff]
        : payload.weapon === "gravity-bomb" ? [0xb67cff, 0x70f5ff, 0xffffff]
          : [0xff496c, 0xffd45c, 0x70f5ff];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
      mesh.scale.setScalar(Math.random() * 1.7 + 0.65);
      mesh.position.copy(position);
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 9 + 3), life: 0.55 + Math.random() * 0.55, maxLife: 1.1 });
    }
    this.audio.explosion(payload.weapon === "asteroid");
    this.shake = payload.weapon === "asteroid" ? 0.8 : 0.48;
    const impactDistance = this.localPosition.distanceTo(position);
    if (projectile?.threatening || impactDistance < 30) {
      const proximity = clamp(1 - impactDistance / 36, .18, 1);
      this.input.vibrate(payload.weapon === "asteroid" ? 320 : 180, (payload.weapon === "asteroid" ? .75 : .38) * proximity);
    }
    this.spawnPulse(position, colors[1], payload.weapon === "asteroid" ? 2.6 : 1.8);
    this.spawnShockwave(position, payload.weapon === "asteroid" ? 0xff8a4f : 0x70f5ff, payload.weapon === "asteroid" ? 7 : 4.5);
  }

  collectScrap(payload: { scrapId: string; playerId: string; planetId: string; ownerId: string; position: Vec3; value: number; stolen: boolean }): void {
    const scrap = this.scraps.get(payload.scrapId);
    if (scrap) { this.scene.remove(scrap); this.disposeObject(scrap); }
    this.scraps.delete(payload.scrapId);
    const position = vec(payload.position);
    this.spawnBurst(position, payload.stolen ? [0xffdc4f, 0xff6b8a, 0xffffff] : [0xffdc4f, 0xfff4ae, 0x70f5ff], payload.stolen ? 18 : 12, payload.stolen ? 5.5 : 4.5);
    this.spawnPulse(position, payload.stolen ? 0xff6b8a : 0xffdc4f, payload.stolen ? 1.05 : 0.8);
    if (payload.playerId === this.localId) payload.stolen ? this.audio.stolen() : this.audio.pickup();
  }

  launchPlayer(payload: { playerId: string; sourcePlanetId: string; targetPlanetId: string; position: Vec3; velocity: Vec3; cooldownUntil: number; boosted: boolean }): void {
    const player = this.players.get(payload.playerId);
    if (player) {
      player.state.velocity = { ...payload.velocity };
      player.state.surfacePlanetId = null;
      player.state.gravityPlanetId = payload.sourcePlanetId;
      player.state.launchCooldownUntil = payload.cooldownUntil;
    }
    const source = this.planets.get(payload.sourcePlanetId);
    if (source) {
      source.launchPulse = 1;
      const pad = vec(launchPadPosition(source.state));
      this.spawnBurst(pad, payload.boosted ? [0xffdc4f, 0xff8bd9, 0xffffff] : [0x70f5ff, 0xffdc4f, 0xffffff], payload.boosted ? 30 : 22, payload.boosted ? 9 : 7);
      this.spawnPulse(pad, 0x70f5ff, 1.45);
    }
    if (payload.playerId === this.localId) {
      this.localPosition.copy(vec(payload.position));
      this.localVelocity.copy(vec(payload.velocity));
      this.correction.set(0, 0, 0);
      this.localSurfacePlanetId = null;
      this.localGravityPlanetId = payload.sourcePlanetId;
      this.localGrounded = false;
      this.jumpQueuedUntil = 0;
      this.localLaunchTargetPlanetId = payload.targetPlanetId;
      this.localLaunchSourcePlanetId = payload.sourcePlanetId;
      this.localLaunchAssistUntil = performance.now() + BALANCE.launch.assistMs + (payload.boosted ? BALANCE.utilities.launchBoost.assistBonusMs : 0);
      this.audio.launch();
      this.shake = Math.max(this.shake, 0.52);
      this.input.vibrate(170, .28, .48);
    }
  }

  landPlayer(payload: { playerId: string; planetId: string; ownerId: string; intruder: boolean }): void {
    const player = this.players.get(payload.playerId);
    const planet = this.planets.get(payload.planetId);
    const predictedLocalLanding = payload.playerId === this.localId && this.localSurfacePlanetId === payload.planetId;
    if (player) {
      player.state.surfacePlanetId = payload.planetId;
      player.state.gravityPlanetId = payload.planetId;
    }
    if (player && planet && !predictedLocalLanding) {
      const outward = player.group.position.clone().sub(planet.group.position).normalize();
      this.spawnBurst(player.group.position.clone().addScaledVector(outward, -0.65), [0xd7e5ff, 0x9fb4ca, 0x70f5ff], 12, 3.2);
      player.hitPulse = Math.max(player.hitPulse, .48);
      player.landingPulse = 1;
      this.spawnPulse(player.group.position.clone().addScaledVector(outward, -.55), new THREE.Color(player.state.color).getHex(), .72);
    }
    if (payload.playerId === this.localId) {
      this.localSurfacePlanetId = payload.planetId;
      this.localGravityPlanetId = payload.planetId;
      this.localGrounded = true;
      this.lastLocalGroundedAt = performance.now();
      this.localLaunchTargetPlanetId = null;
      this.localLaunchSourcePlanetId = null;
      this.localLaunchAssistUntil = 0;
      if (!predictedLocalLanding) this.audio.land();
      this.shake = Math.max(this.shake, 0.24);
      this.input.vibrate(95, .24);
    } else if (payload.ownerId === this.localId && payload.intruder) {
      this.audio.intruder();
    }
  }

  shovePlayer(payload: { attackerId: string; targetId: string; planetId: string; position: Vec3; velocity: Vec3 }): void {
    const attacker = this.players.get(payload.attackerId);
    const target = this.players.get(payload.targetId);
    if (attacker) attacker.shoveUntil = performance.now() + 280;
    if (target) {
      target.state.velocity = { ...payload.velocity };
      target.hitPulse = 1;
      const superShove = this.room?.activeModifier === "super-shove";
      this.spawnBurst(target.group.position.clone().add(new THREE.Vector3(0, 1, 0)), [0xffdc4f, 0xffffff, 0xff6b8a], superShove ? 18 : 11, superShove ? 6.2 : 4.2);
      this.spawnPulse(target.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffdc4f, superShove ? 1.05 : 0.65);
    }
    if (payload.targetId === this.localId) {
      this.localVelocity.copy(vec(payload.velocity));
      this.correction.set(0, 0, 0);
      this.localGrounded = false;
      this.jumpQueuedUntil = 0;
      this.shake = Math.max(this.shake, 0.38);
      this.canvas.classList.remove("shove-impact");
      void this.canvas.offsetWidth;
      this.canvas.classList.add("shove-impact");
      setTimeout(() => this.canvas.classList.remove("shove-impact"), 110);
      this.input.vibrate(140, .52, .32);
    }
    if (payload.attackerId === this.localId || payload.targetId === this.localId) this.audio.shove();
  }

  bumpPlayer(payload: { attackerId: string; targetId: string; planetId: string; position: Vec3; velocity: Vec3 }): void {
    const target = this.players.get(payload.targetId);
    if (target) {
      target.state.velocity = { ...payload.velocity };
      target.hitPulse = Math.max(target.hitPulse, .5);
      this.spawnBurst(target.group.position.clone().add(new THREE.Vector3(0, .8, 0)), [0x70f5ff, 0xffffff], 6, 2.8);
    }
    if (payload.targetId === this.localId) {
      this.localVelocity.copy(vec(payload.velocity)); this.correction.set(0, 0, 0); this.localGrounded = false;
      this.shake = Math.max(this.shake, .16); this.input.vibrate(70, .2);
    }
  }

  playEmote(payload: { playerId: string; emote: EmoteType; direction: Vec3; startedAt: number }): void {
    const visual = this.players.get(payload.playerId);
    if (!visual) return;
    visual.emote = payload.emote;
    visual.emoteUntil = performance.now() + (payload.emote === "celebrate" || payload.emote === "panic" ? 1700 : 1350);
  }

  utilityPurchased(payload: { playerId: string; planetId: string; utility: "shield" | "overcharge" | "launch-boost"; activeUntil: number }): void {
    const planet = this.planets.get(payload.planetId);
    const player = this.players.get(payload.playerId);
    if (payload.utility === "shield" && planet) {
      planet.state.shieldUntil = payload.activeUntil;
      this.spawnShockwave(planet.group.position, 0x70f5ff, BALANCE.planetRadius * 1.18);
    } else if (payload.utility === "overcharge" && player) {
      player.state.overchargeUntil = payload.activeUntil;
      if (planet) this.spawnPulse(planet.cannon.getWorldPosition(new THREE.Vector3()), 0xffdc4f, 1.2);
    } else if (player) {
      player.state.launchBoostUntil = payload.activeUntil;
      if (planet) this.spawnPulse(vec(launchPadPosition(planet.state)), 0xff8bd9, 1.05);
    }
    if (payload.playerId === this.localId) this.audio.pickup();
  }

  sabotageStructure(payload: { playerId: string; planetId: string; ownerId: string; structure: StructureType; disabledUntil: number }): void {
    const planet = this.planets.get(payload.planetId);
    if (!planet) return;
    if (payload.structure === "cannon") planet.state.cannonDisabledUntil = payload.disabledUntil;
    else planet.state.repairDisabledUntil = payload.disabledUntil;
    const position = payload.structure === "cannon" ? planet.cannon.getWorldPosition(new THREE.Vector3()) : planet.repair.getWorldPosition(new THREE.Vector3());
    this.spawnBurst(position, [0xff6b8a, 0xb67cff, 0x70f5ff], 17, 4.5);
    this.spawnPulse(position, 0xff6b8a, 1.1);
    if (payload.playerId === this.localId) this.activeSabotage = null;
    if (payload.playerId === this.localId || payload.ownerId === this.localId) this.audio.sabotage();
  }

  cancelSabotage(playerId: string): void {
    if (playerId === this.localId) this.activeSabotage = null;
  }

  repairPlanet(payload: { planetId: string; playerId: string; integrity: number; amount: number }): void {
    const visual = this.planets.get(payload.planetId);
    if (!visual) return;
    visual.repairPulse = 1;
    const position = visual.repair.getWorldPosition(new THREE.Vector3());
    this.spawnBurst(position, [0x70f5ff, 0x8affbd, 0xffffff], 18, 3.4);
    this.spawnPulse(position, 0x70f5ff, 1.25);
    this.spawnShockwave(visual.group.position, 0x62f4bd, BALANCE.planetRadius * 1.08);
    if (payload.playerId === this.localId) this.audio.repair();
  }

  damagePlanet(planetId: string, hit: Vec3, integrity: number): void {
    const visual = this.planets.get(planetId);
    if (!visual) return;
    const worldHit = vec(hit);
    const normal = worldHit.clone().sub(visual.group.position).normalize();
    const crater = new THREE.Mesh(
      new THREE.CircleGeometry(integrity <= 50 ? 1.15 : 0.72, 14),
      new THREE.MeshBasicMaterial({ color: 0x251d3d, transparent: true, opacity: 0.82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    crater.position.copy(normal.clone().multiplyScalar(BALANCE.planetRadius + 0.025));
    crater.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    visual.cracks.add(crater);
    visual.shell.material.emissive.setHex(0xff5738);
    setTimeout(() => visual.shell.material.emissive.setHex(0x000000), 130);
    this.spawnBurst(worldHit, [0xff794c, 0xffcf57, 0x4b2947], integrity <= 25 ? 20 : 12, integrity <= 25 ? 6 : 4);
    this.spawnPulse(worldHit, 0xff704c, integrity <= 50 ? 1.7 : 1.05);
    this.recentDamage.set(planetId, performance.now() + 3200);
    const local = this.players.get(this.localId);
    if (local?.state.planetId === planetId && integrity <= 25 && performance.now() - this.lastCriticalWarning > 5000) {
      this.lastCriticalWarning = performance.now();
      this.audio.critical();
      this.input.vibrate(90, .12, .2);
    }
  }

  destroyPlanet(planetId: string): void {
    const visual = this.planets.get(planetId);
    if (!visual) return;
    visual.destroyedAt = performance.now();
    const center = visual.group.position.clone();
    const flashShell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(BALANCE.planetRadius * 1.015, 2),
      new THREE.MeshBasicMaterial({ color: 0xfff2c2, transparent: true, opacity: .82, wireframe: true, depthWrite: false })
    );
    flashShell.position.copy(center); this.scene.add(flashShell);
    this.particles.push({ mesh: flashShell, velocity: new THREE.Vector3(), life: .48, maxLife: .48, growth: 1.2, spin: 1.8 });
    visual.shell.visible = false;
    visual.cannon.visible = false;
    visual.repair.visible = false;
    visual.launchPad.visible = false;
    visual.launchHighlight.visible = false;
    visual.label.visible = false;
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(Math.random() * 1.4 + 0.55, 0),
        new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0xff794c : visual.shell.material.color, roughness: 0.9, flatShading: true })
      );
      mesh.position.copy(center).add(new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 3.4));
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 8 + 3), life: 3.4 + Math.random() * 1.8, maxLife: 5.2, spin: 1.5 + Math.random() * 2.5 });
    }
    this.audio.explosion(true);
    this.shake = 1.3;
    if (this.players.get(this.localId)?.state.planetId === planetId) this.input.vibrate(420, .9, .62);
    this.spawnBurst(center, [0xfff0b3, 0xff7a48, 0x4b2947, 0xb67cff], 44, 9);
    this.spawnPulse(center, 0xffd25c, 4.5);
    this.spawnShockwave(center, 0xffd25c, 13);
    setTimeout(() => {
      this.spawnBurst(center, [0x9a7798, 0x55435f, 0xff8a4f], 20, 4.4);
      this.spawnShockwave(center, 0xb67cff, 17);
    }, 130);
  }

  resetVisualEffects(): void {
    for (const particle of this.particles) this.disposeParticle(particle);
    this.particles = [];
    for (const shot of this.projectiles.values()) this.disposeProjectile(shot);
    this.projectiles.clear();
    this.recentDamage.clear();
    this.onIndicators?.([]);
    for (const planet of this.planets.values()) {
      for (const child of [...planet.cracks.children]) if (!child.userData.stageMark) { planet.cracks.remove(child); this.disposeObject(child); }
      planet.shell.visible = true; planet.cannon.visible = true; planet.repair.visible = true; planet.launchPad.visible = true; planet.props.visible = true; planet.surfacePatches.visible = true;
      planet.launchHighlight.visible = false;
      planet.label.visible = true;
      planet.group.scale.setScalar(1); planet.shell.material.emissive.setHex(0x000000); planet.destroyedAt = 0;
    }
  }

  private setupScene(): void {
    const ambient = new THREE.HemisphereLight(0xbdeaff, 0x251942, 2.35);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffeed3, 3.45);
    sun.position.set(-35, 46, 28);
    this.scene.add(sun);
    const coolFill = new THREE.DirectionalLight(0x70dfff, 1.1);
    coolFill.position.set(35, -18, 16); this.scene.add(coolFill);
    const rim = new THREE.PointLight(0xa56dff, 105, 125, 2);
    rim.position.set(30, -8, -35);
    this.scene.add(rim);

    const random = seededRandom("planetfall-space");
    for (const [layer, count, near, spread, size, opacity] of [
      [0, 1250, 95, 195, .24, .72],
      [1, 430, 72, 115, .48, .68],
      [2, 95, 64, 80, .92, .82]
    ] as const) {
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const theta = random() * Math.PI * 2;
        const z = random() * 2 - 1;
        const radius = Math.sqrt(1 - z * z);
        const distance = near + random() * spread;
        positions.set([Math.cos(theta) * radius * distance, z * distance, Math.sin(theta) * radius * distance], i * 3);
        const c = new THREE.Color((i + layer) % 11 === 0 ? 0xffb4e4 : (i + layer) % 7 === 0 ? 0x75eaff : (i + layer) % 17 === 0 ? 0xffe5a3 : 0xffffff);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity, sizeAttenuation: true, depthWrite: false, fog: false }));
      points.userData.speed = .0025 + layer * .0015;
      this.starLayers.push(points); this.scene.add(points);
    }

    const dustPositions = new Float32Array(280 * 3);
    for (let i = 0; i < 280; i++) {
      const point = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize().multiplyScalar(46 + random() * 72);
      dustPositions.set([point.x, point.y, point.z], i * 3);
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    this.scene.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0x7a64c9, size: 0.8, transparent: true, opacity: 0.16, depthWrite: false })));

    for (const [position, color, radius] of [
      [new THREE.Vector3(-68, 31, -105), 0x7651c9, 14],
      [new THREE.Vector3(84, -24, -128), 0x1aa5b8, 19],
      [new THREE.Vector3(8, 62, -158), 0xe05491, 10]
    ] as const) {
      const distant = new THREE.Group();
      const world = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .2, fog: false }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.08, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .055, side: THREE.BackSide, depthWrite: false, fog: false }));
      distant.add(world, halo); distant.position.copy(position); this.scene.add(distant);
    }
    for (let index = 0; index < 13; index++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.1 + random() * 2.6, 0),
        new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0x41385f : 0x252844, roughness: 1, flatShading: true })
      );
      const angle = random() * Math.PI * 2;
      const radius = 74 + random() * 65;
      rock.position.set(Math.cos(angle) * radius, (random() * 2 - 1) * 46, Math.sin(angle) * radius - 42);
      rock.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      rock.userData.spaceRock = true;
      this.scene.add(rock);
    }
  }

  private createDemo(): void {
    const a = this.makePlanet({ id: "demo-a", ownerId: "", position: { x: 13, y: -2, z: -4 }, integrity: 100, alive: true, palette: 0, damageStage: 0, cannonDisabledUntil: 0, repairDisabledUntil: 0, cannonSabotageImmuneUntil: 0, repairSabotageImmuneUntil: 0, shieldUntil: 0, shieldCooldownUntil: 0 });
    a.group.scale.setScalar(1.25);
    const b = this.makePlanet({ id: "demo-b", ownerId: "", position: { x: -12, y: 3, z: -18 }, integrity: 58, alive: true, palette: 3, damageStage: 2, cannonDisabledUntil: 0, repairDisabledUntil: 0, cannonSabotageImmuneUntil: 0, repairSabotageImmuneUntil: 0, shieldUntil: 0, shieldCooldownUntil: 0 });
    b.group.scale.setScalar(0.7);
    this.demo.add(a.group, b.group);
    const astronaut = this.makePlayer({ id: "demo", name: "", isBot: false, color: "#ffdc4f", planetId: "", connected: true, ready: true, alive: true, scrap: 0, position: { x: 13, y: 9.5, z: -4 }, velocity: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, lastInputSequence: 0, surfacePlanetId: "demo-a", gravityPlanetId: "demo-a", launchCooldownUntil: 0, shoveCooldownUntil: 0, crowns: 0, fallbucks: 0, ownedCosmetics: [], equippedCosmetics: { suit: "default", trail: "default", victory: "default" }, overchargeUntil: 0, launchBoostUntil: 0 });
    astronaut.group.position.set(13, 9.4, -4);
    astronaut.group.scale.setScalar(1.2);
    this.demo.add(astronaut.group);
    this.scene.add(this.demo);
  }

  private makePlanet(state: PlanetState): PlanetVisual {
    const palette = PLANET_PALETTES[state.palette % PLANET_PALETTES.length];
    const random = seededRandom(`${state.id}:${state.palette}`);
    const group = new THREE.Group();
    group.position.copy(vec(state.position));
    const shellGeometry = new THREE.IcosahedronGeometry(BALANCE.planetRadius, 4);
    const positions = shellGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i).normalize();
      const broad = Math.sin(point.x * 3.7 + state.palette) * Math.cos(point.z * 3.2 - state.palette) * .11;
      const variation = broad + Math.sin(point.x * 11 + point.z * 7) * .065
        + Math.sin(point.y * 13 - point.x * 5) * .045
        + Math.cos((point.x + point.y + point.z) * 17) * .025;
      point.multiplyScalar(BALANCE.planetRadius + variation);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    shellGeometry.computeVertexNormals();
    const baseColor = new THREE.Color(palette.ground);
    const shell = new THREE.Mesh(
      shellGeometry,
      new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.86, metalness: 0.015, flatShading: true })
    );
    shell.castShadow = false; shell.receiveShadow = false;
    group.add(shell);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(BALANCE.planetRadius * 1.075, 24, 16),
      new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color(palette.accent) }, intensity: { value: .46 } },
        vertexShader: atmosphereVertexShader, fragmentShader: atmosphereFragmentShader,
        transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending
      })
    );
    group.add(atmosphere);
    const surfacePatches = new THREE.Group(); group.add(surfacePatches);
    const patchMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.ground).lerp(new THREE.Color(palette.accent), .2),
      roughness: .92, flatShading: true, polygonOffset: true, polygonOffsetFactor: -1
    });
    for (let index = 0; index < 9; index++) {
      const normal = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
      const patch = new THREE.Mesh(new THREE.CircleGeometry(.65 + random() * 1.05, 9), patchMaterial);
      patch.position.copy(normal.clone().multiplyScalar(BALANCE.planetRadius + .04));
      patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      patch.scale.set(1, .45 + random() * .4, 1);
      patch.rotation.z = random() * Math.PI;
      surfacePatches.add(patch);
    }
    const labelCanvas = document.createElement("canvas"); labelCanvas.width = 384; labelCanvas.height = 112;
    const labelContext = labelCanvas.getContext("2d")!;
    const labelTexture = new THREE.CanvasTexture(labelCanvas); labelTexture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false, depthWrite: false }));
    label.position.set(0, BALANCE.planetRadius + 4.1, 0); label.scale.set(7.2, 2.1, 1); label.renderOrder = 8; group.add(label);
    const cracks = new THREE.Group(); group.add(cracks);
    for (let stage = 1; stage <= 3; stage++) {
      for (let branch = 0; branch < stage + 1; branch++) {
        const scar = new THREE.Mesh(
          new THREE.TorusGeometry(BALANCE.planetRadius + .055, .025 + stage * .014, 4, 18 + stage * 5, Math.PI * (.34 + random() * .42)),
          new THREE.MeshBasicMaterial({ color: stage === 3 ? 0xff7a48 : 0x33213d, transparent: true, opacity: .54 + stage * .12, depthWrite: false })
        );
        scar.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
        scar.visible = state.damageStage >= stage;
        scar.userData.stageMark = stage;
        cracks.add(scar);
      }
    }

    const ownerColor = this.room?.players.find((player) => player.id === state.ownerId)?.color ?? palette.accent;
    const cannonAccent = new THREE.MeshStandardMaterial({ color: ownerColor, emissive: ownerColor, emissiveIntensity: .22, metalness: .4, roughness: .3 });
    const cannon = new THREE.Group();
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x30375c, metalness: 0.52, roughness: 0.42, flatShading: true });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.62, 0.86, 10), baseMaterial);
    const baseTrim = new THREE.Mesh(new THREE.TorusGeometry(1.28, .12, 6, 14), cannonAccent); baseTrim.rotation.x = Math.PI / 2; baseTrim.position.y = .43;
    const swivel = new THREE.Mesh(new THREE.CylinderGeometry(.82, 1, .56, 10), baseMaterial); swivel.position.y = .72;
    const barrelRig = new THREE.Group(); barrelRig.position.y = 1.4;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.62, 3.5, 10), new THREE.MeshStandardMaterial({ color: 0x697399, metalness: 0.62, roughness: 0.28, flatShading: true }));
    barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.8;
    const barrelBand = new THREE.Mesh(new THREE.TorusGeometry(.48, .09, 6, 12), cannonAccent); barrelBand.position.z = -.55;
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.17, 6, 12), new THREE.MeshStandardMaterial({ color: 0xffdc4f, emissive: 0x7a3b00, emissiveIntensity: 1.1 }));
    muzzle.position.set(0, 0, -2.45); muzzle.rotation.x = Math.PI / 2;
    const braceMaterial = new THREE.MeshStandardMaterial({ color: 0x485173, metalness: 0.55, roughness: 0.42 });
    const leftBrace = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.55, 0.38), braceMaterial); leftBrace.position.set(-0.74, 0.7, 0);
    const rightBrace = leftBrace.clone(); rightBrace.position.x = 0.72;
    const hubLeft = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .2, 10), cannonAccent); hubLeft.rotation.z = Math.PI / 2; hubLeft.position.set(-.78, 1.35, 0);
    const hubRight = hubLeft.clone(); hubRight.position.x = .78;
    barrelRig.add(barrel, barrelBand, muzzle);
    cannon.add(base, baseTrim, swivel, leftBrace, rightBrace, hubLeft, hubRight, barrelRig); cannon.position.set(0, BALANCE.planetRadius + 0.15, 0); group.add(cannon);

    const repair = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.82, 0), new THREE.MeshStandardMaterial({ color: 0x70f5ff, emissive: 0x247a91, emissiveIntensity: 1.5, metalness: 0.25 }));
    const repairRings = new THREE.Group();
    for (let index = 0; index < 3; index++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.12 + index * .18, .07 + index * .02, 7, 20), new THREE.MeshStandardMaterial({ color: index === 1 ? ownerColor : 0xa4b2e6, emissive: index === 1 ? ownerColor : 0x182044, emissiveIntensity: .45, metalness: 0.5 }));
      ring.rotation.set(index === 0 ? Math.PI / 2 : 0, index === 1 ? Math.PI / 2 : 0, index === 2 ? Math.PI / 2 : 0);
      repairRings.add(ring);
    }
    const repairBase = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.24, .38, 10), baseMaterial); repairBase.position.y = -.86;
    repair.add(core, repairRings, repairBase); repair.position.set(BALANCE.planetRadius + 0.65, 0, 0); repair.rotation.z = -Math.PI / 2; group.add(repair);

    const padNormal = vec(launchPadNormal(state));
    const launchPad = new THREE.Group();
    const padMaterial = new THREE.MeshStandardMaterial({ color: 0x38466d, metalness: 0.62, roughness: 0.34, flatShading: true });
    const padGlow = new THREE.MeshStandardMaterial({ color: 0x70f5ff, emissive: 0x16708a, emissiveIntensity: 2.1, metalness: 0.25, roughness: 0.25 });
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.52, 0.28, 12), padMaterial);
    const launchRing = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.11, 6, 24), padGlow);
    launchRing.rotation.x = Math.PI / 2; launchRing.position.y = 0.2;
    const arrowStem = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.13, 1.05), padGlow); arrowStem.position.set(0, 0.25, -0.15);
    const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 5), padGlow); arrowHead.rotation.x = -Math.PI / 2; arrowHead.position.set(0, 0.25, -0.88);
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x7582aa, metalness: 0.58, roughness: 0.35 });
    const launchArms = new THREE.Group();
    for (const x of [-0.88, 0.88]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.3), armMaterial);
      arm.position.set(x, 0.28, 0.05); arm.rotation.z = x * -0.22; launchArms.add(arm);
    }
    const padNodes = new THREE.Group();
    for (let index = 0; index < 4; index++) {
      const node = new THREE.Mesh(new THREE.SphereGeometry(.12, 7, 5), cannonAccent);
      const angle = index * Math.PI / 2; node.position.set(Math.cos(angle) * 1.27, .18, Math.sin(angle) * 1.27); padNodes.add(node);
    }
    launchPad.add(platform, launchRing, arrowStem, arrowHead, launchArms, padNodes);
    launchPad.position.copy(padNormal.clone().multiplyScalar(BALANCE.planetRadius + 0.2));
    launchPad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), padNormal);
    group.add(launchPad);

    const launchHighlight = new THREE.Group();
    const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0x70f5ff, transparent: true, opacity: 0.38, depthWrite: false });
    for (let axis = 0; axis < 3; axis++) {
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(BALANCE.planetRadius + 0.65, 0.075, 4, 48), highlightMaterial);
      if (axis === 1) orbit.rotation.x = Math.PI / 2;
      if (axis === 2) orbit.rotation.y = Math.PI / 2;
      launchHighlight.add(orbit);
    }
    launchHighlight.visible = false; group.add(launchHighlight);

    const makeJamIndicator = () => {
      const indicator = new THREE.Group();
      const material = new THREE.MeshBasicMaterial({ color: 0xff5d8f, transparent: true, opacity: 0.88, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.075, 5, 18), material);
      const slashA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), material); slashA.rotation.z = 0.72;
      const slashB = slashA.clone(); slashB.rotation.z = -0.72;
      indicator.add(halo, slashA, slashB); indicator.visible = false;
      return indicator;
    };
    const cannonJam = makeJamIndicator(); cannonJam.position.y = 2.25; cannon.add(cannonJam);
    const repairJam = makeJamIndicator(); repair.add(repairJam);
    const cannonLabel = makeWorldLabel("CANNON", ownerColor); cannonLabel.position.set(0, BALANCE.planetRadius + 4.2, 0); cannonLabel.scale.set(3.5, .88, 1);
    const repairLabel = makeWorldLabel("REPAIR", ownerColor); repairLabel.position.set(BALANCE.planetRadius + 3.15, 0, 0); repairLabel.scale.set(3.4, .85, 1);
    const launchLabel = makeWorldLabel("LAUNCH PAD", "#70f5ff"); launchLabel.position.copy(padNormal.clone().multiplyScalar(BALANCE.planetRadius + 2.9)); launchLabel.scale.set(4.15, 1.02, 1);
    group.add(cannonLabel, repairLabel, launchLabel);

    const props = new THREE.Group(); group.add(props);
    const damageDebris = new THREE.Group(); group.add(damageDebris);
    const propMaterial = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.85, flatShading: true, emissive: state.palette === 3 || state.palette === 5 ? palette.rock : 0x000000, emissiveIntensity: 0.18 });
    const rockMaterial = new THREE.MeshStandardMaterial({ color: palette.rock, roughness: 0.95, flatShading: true });
    const glowMaterial = new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: .8, roughness: .35, flatShading: true });
    const paleMaterial = new THREE.MeshStandardMaterial({ color: state.palette === 2 ? 0xf3fcff : 0xfff1bb, roughness: .72, flatShading: true });
    const clusterCenters = Array.from({ length: 4 }, () => new THREE.Vector3(random() * 2 - 1, random() * 1.7 - .85, random() * 2 - 1).normalize());
    const makeBiomeProp = (index: number): THREE.Object3D => {
      const landmark = index < 4 ? 1.35 : .8 + random() * .45;
      if (state.palette === 0) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.1 * landmark, .16 * landmark, .72 * landmark, 6), rockMaterial); trunk.position.y = .36 * landmark;
        const crownA = new THREE.Mesh(new THREE.IcosahedronGeometry(.43 * landmark, 1), propMaterial); crownA.position.y = .88 * landmark;
        const crownB = new THREE.Mesh(new THREE.IcosahedronGeometry(.29 * landmark, 1), propMaterial); crownB.position.set(.22 * landmark, 1.12 * landmark, 0);
        tree.add(trunk, crownA, crownB);
        if (index % 5 === 0) {
          const flower = new THREE.Mesh(new THREE.SphereGeometry(.1, 6, 4), paleMaterial); flower.position.set(-.28, .16, .12); tree.add(flower);
        }
        return tree;
      }
      if (state.palette === 1) {
        if (index % 3 === 0) {
          const cactus = new THREE.Group();
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(.13, .18, 1.25 * landmark, 6), propMaterial); stem.position.y = .62 * landmark;
          cactus.add(stem);
          for (const side of [-1, 1]) {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, .5 * landmark, 6), propMaterial);
            arm.position.set(side * .2, .68 * landmark, 0); arm.rotation.z = side * .9; cactus.add(arm);
          }
          return cactus;
        }
        const mesa = new THREE.Mesh(new THREE.CylinderGeometry(.28 * landmark, .46 * landmark, .48 * landmark, 7), rockMaterial); mesa.position.y = .24 * landmark; return mesa;
      }
      if (state.palette === 2) {
        const crystal = new THREE.Group();
        for (let shard = 0; shard < 3; shard++) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry((.13 + shard * .04) * landmark, (.72 + shard * .2) * landmark, 5), shard === 1 ? glowMaterial : paleMaterial);
          spike.position.set((shard - 1) * .18 * landmark, (.36 + shard * .1) * landmark, shard % 2 * .08); spike.rotation.z = (shard - 1) * .17; crystal.add(spike);
        }
        return crystal;
      }
      if (state.palette === 3) {
        const vent = new THREE.Group();
        const rock = new THREE.Mesh(new THREE.ConeGeometry(.38 * landmark, .62 * landmark, 7, 1, true), rockMaterial); rock.position.y = .28 * landmark;
        const ember = new THREE.Mesh(new THREE.SphereGeometry(.11 * landmark, 6, 4), glowMaterial); ember.position.y = .63 * landmark;
        vent.add(rock, ember); vent.userData.vent = true; return vent;
      }
      if (state.palette === 4) {
        const plant = new THREE.Group();
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(.07, .12, .72 * landmark, 6), rockMaterial); stalk.position.y = .36 * landmark;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(.34 * landmark, 9, 6), propMaterial); bulb.scale.y = 1.22; bulb.position.y = .86 * landmark;
        const spore = new THREE.Mesh(new THREE.SphereGeometry(.1 * landmark, 6, 4), glowMaterial); spore.position.set(.24 * landmark, 1.04 * landmark, 0);
        plant.add(stalk, bulb, spore); plant.userData.bulb = true; return plant;
      }
      const formation = new THREE.Group();
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(.42 * landmark, 0), glowMaterial); shard.scale.y = 1.75; shard.position.y = .58 * landmark;
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(.48 * landmark, .045, 5, 14), paleMaterial); orbit.rotation.x = Math.PI / 2; orbit.position.y = .56 * landmark;
      const floater = new THREE.Mesh(new THREE.DodecahedronGeometry(.14 * landmark, 0), rockMaterial); floater.position.set(.45 * landmark, 1.02 * landmark, 0);
      formation.add(shard, orbit, floater); formation.userData.cosmic = true; return formation;
    };
    for (let index = 0; index < 26; index++) {
      const center = clusterCenters[index % clusterCenters.length];
      const scatter = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).multiplyScalar(index < 4 ? .12 : .38);
      const normal = center.clone().multiplyScalar(.92).add(scatter).normalize();
      const worldPosition = vec(state.position).addScaledVector(normal, BALANCE.planetRadius + .25);
      if (Math.abs(normal.y) > .86 || normal.x > .86 || normal.dot(padNormal) > .84) continue;
      if ([cannonPosition(state), repairPosition(state), launchPadPosition(state)].some((structure) => worldPosition.distanceTo(vec(structure)) < 3)) continue;
      const prop = makeBiomeProp(index);
      prop.position.copy(normal.clone().multiplyScalar(BALANCE.planetRadius + .04));
      prop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      prop.rotateY(random() * Math.PI * 2);
      prop.traverse((child) => { child.castShadow = false; }); props.add(prop);
    }
    for (let i = 0; i < 7; i++) {
      const fragment = new THREE.Mesh(new THREE.DodecahedronGeometry(.13 + random() * .18, 0), rockMaterial);
      fragment.position.set((random() * 2 - 1) * 10, (random() * 2 - 1) * 10, (random() * 2 - 1) * 10).normalize().multiplyScalar(BALANCE.planetRadius + 1.15 + random() * .75);
      fragment.visible = false; fragment.userData.damageLevel = 1 + i % 3; damageDebris.add(fragment);
    }
    return {
      group, shell, atmosphere, surfacePatches, cracks, props, damageDebris, cannon, barrel: barrelRig, muzzle, cannonAccent,
      repair, repairCore: core, repairRings, launchPad, launchRing, launchArms, launchHighlight, cannonJam, repairJam,
      structureLabels: { cannon: cannonLabel, repair: repairLabel, launch: launchLabel },
      label, labelCanvas, labelContext, labelTexture, labelKey: "",
      baseColor, recoil: 0, repairPulse: 0, launchPulse: 0, nextJamSparkAt: 0, nextDamagePulseAt: 0, destroyedAt: 0, state
    };
  }

  private makePlayer(state: PlayerState): PlayerVisual {
    const group = new THREE.Group();
    const lodDetails: THREE.Object3D[] = [];
    const suitAccent = cosmeticColor(state.equippedCosmetics.suit, state.color);
    const suit = new THREE.MeshStandardMaterial({ color: suitAccent, roughness: .58, flatShading: true });
    const white = new THREE.MeshStandardMaterial({ color: 0xf0f6ff, roughness: .48, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x202747, roughness: .72, flatShading: true });
    const glow = new THREE.MeshStandardMaterial({ color: state.color, emissive: state.color, emissiveIntensity: .75, metalness: .25, roughness: .3 });
    const visorMaterial = new THREE.MeshStandardMaterial({ color: 0x102344, metalness: .82, roughness: .12, emissive: 0x0b4167, emissiveIntensity: .6 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.48, .52, 5, 9), white); torso.position.y = .72; torso.scale.set(1.06, 1, .92);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(.62, .36, .12), suit); chest.position.set(0, .82, .43);
    const chestLight = new THREE.Mesh(new THREE.BoxGeometry(.3, .07, .025), glow); chestLight.position.set(0, .86, .505);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(.43, .075, 5, 10), dark); belt.rotation.x = Math.PI / 2; belt.position.y = .45; belt.scale.z = .78;
    const helmet = new THREE.Group(); helmet.position.y = 1.46;
    const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(.56, 12, 9), white); helmetShell.scale.set(1.02, .98, .98);
    const helmetBand = new THREE.Mesh(new THREE.TorusGeometry(.48, .055, 5, 12), suit); helmetBand.rotation.x = Math.PI / 2; helmetBand.position.y = -.18;
    const visor = new THREE.Mesh(new THREE.SphereGeometry(.43, 12, 8, 0, Math.PI * 2, 0, Math.PI * .58), visorMaterial); visor.position.set(0, .02, .31); visor.scale.set(.98, .74, .42);
    const visorGlint = new THREE.Mesh(new THREE.SphereGeometry(.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0xbef8ff, transparent: true, opacity: .75 })); visorGlint.position.set(-.2, .17, .58); visorGlint.scale.set(1.8, .6, .35);
    helmet.add(helmetShell, helmetBand, visor, visorGlint);
    lodDetails.push(chestLight, belt, helmetBand, visorGlint);
    const backpack = new THREE.Group(); backpack.position.set(0, .86, -.45);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(.66, .74, .32), dark); pack.scale.z = 1.12;
    const tankMaterial = new THREE.MeshStandardMaterial({ color: 0xa9bad9, metalness: .45, roughness: .35 });
    for (const x of [-.22, .22]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .56, 7), tankMaterial); tank.position.set(x, .02, -.22); backpack.add(tank);
      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(.1, .2, 7, 1, true), glow); nozzle.rotation.x = Math.PI; nozzle.position.set(x, -.39, -.22); backpack.add(nozzle);
      lodDetails.push(tank, nozzle);
    }
    backpack.add(pack);
    const limbGeometry = new THREE.CapsuleGeometry(.13, .4, 3, 7);
    const bootGeometry = new THREE.SphereGeometry(.24, 8, 6);
    const makeLeg = (x: number) => {
      const rig = new THREE.Group(); rig.position.set(x, .48, 0);
      const leg = new THREE.Mesh(limbGeometry, dark); leg.position.y = -.25;
      const knee = new THREE.Mesh(new THREE.SphereGeometry(.15, 7, 5), suit); knee.position.set(0, -.28, .1);
      const boot = new THREE.Mesh(bootGeometry, white); boot.position.set(0, -.58, .13); boot.scale.set(1.05, .72, 1.5);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(.36, .08, .48), dark); sole.position.set(0, -.73, .18);
      lodDetails.push(knee, sole);
      rig.add(leg, knee, boot, sole); return rig;
    };
    const makeArm = (x: number) => {
      const rig = new THREE.Group(); rig.position.set(x, 1.02, 0);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(.19, 7, 5), suit); shoulder.scale.set(1.2, .8, 1);
      const arm = new THREE.Mesh(limbGeometry, dark); arm.position.y = -.27;
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .14, 7), suit); cuff.position.y = -.48;
      const glove = new THREE.Mesh(new THREE.SphereGeometry(.18, 7, 5), white); glove.position.y = -.61;
      lodDetails.push(shoulder, cuff);
      rig.add(shoulder, arm, cuff, glove); rig.rotation.z = x > 0 ? -.17 : .17; return rig;
    };
    const leftLeg = makeLeg(-.26); const rightLeg = makeLeg(.26); const leftArm = makeArm(-.57); const rightArm = makeArm(.57);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .38, 5), white); antenna.position.set(.3, .39, -.05); antenna.rotation.z = -.2;
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(.075, 6, 4), new THREE.MeshBasicMaterial({ color: state.isBot ? 0xff7f9b : state.color })); antennaTip.position.set(.34, .6, -.05);
    helmet.add(antenna, antennaTip);
    lodDetails.push(antenna, antennaTip);
    for (const object of [torso, chest, chestLight, belt, helmet, backpack]) object.traverse((child) => { (child as THREE.Mesh).castShadow = false; });
    group.add(torso, chest, chestLight, belt, helmet, backpack, leftLeg, rightLeg, leftArm, rightArm);
    const intruderMarker = new THREE.Group();
    const markerDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: state.color }));
    markerDiamond.position.y = 2.75; intruderMarker.add(markerDiamond);
    const label = makeWorldLabel(`${state.name.toUpperCase()}${state.isBot ? "  BOT" : ""}`, state.color);
    label.position.y = 3.25; label.scale.set(3.2, 0.8, 1); intruderMarker.add(label); group.add(intruderMarker);
    const localMarker = new THREE.Group();
    const localRing = new THREE.Mesh(new THREE.TorusGeometry(.63, .035, 5, 22), new THREE.MeshBasicMaterial({ color: state.color, transparent: true, opacity: .58, depthWrite: false }));
    localRing.rotation.x = Math.PI / 2; localRing.position.y = -.72;
    const localChevron = new THREE.Mesh(new THREE.ConeGeometry(.13, .26, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, depthTest: false }));
    localChevron.position.y = 2.55; localChevron.rotation.z = Math.PI;
    localMarker.add(localRing, localChevron); localMarker.visible = false; group.add(localMarker);
    group.position.copy(vec(state.position));
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    trailGeometry.setDrawRange(0, 0);
    const flightTrail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: cosmeticColor(state.equippedCosmetics.trail, state.color), transparent: true, opacity: 0.72 }));
    flightTrail.visible = false;
    return {
      group, target: group.position.clone(), state, leftArm, rightArm, leftLeg, rightLeg, torso, helmet, visor, backpack,
      flightTrail, flightTrailPoints: [], intruderMarker, intruderDiamond: markerDiamond, nameLabel: label, localMarker,
      suitMaterial: suit, emote: null, emoteUntil: 0, shoveUntil: 0, hitPulse: 0, landingPulse: 0,
      previousSurfacePlanetId: state.surfacePlanetId,
      presentationUp: new THREE.Vector3(0, 1, 0),
      presentationForward: new THREE.Vector3(0, 0, 1),
      lodDetails
    };
  }

  private makeScrap(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0xffdc4f, emissive: 0xa84d00, emissiveIntensity: 1.2, metalness: 0.55, roughness: 0.25 });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.4, 0), material); crystal.scale.y = 1.25;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .64, 6), new THREE.MeshStandardMaterial({ color: 0xb8c8e8, metalness: .8, roughness: .2 })); bolt.rotation.z = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.055, 5, 12), new THREE.MeshBasicMaterial({ color: 0xffed9b, transparent: true, opacity: .82 }));
    ring.rotation.x = Math.PI / 2;
    group.add(crystal, bolt, ring);
    group.userData.ring = ring;
    return group;
  }

  private makeProjectile(projectile: ProjectileState): THREE.Group {
    const group = new THREE.Group();
    const weapon = projectile.weapon;
    if (weapon === "rocket") {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.31, 1.45, 8), new THREE.MeshStandardMaterial({ color: 0xf1f5ff, metalness: 0.35, roughness: 0.34, flatShading: true }));
      body.rotation.x = Math.PI / 2;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.52, 8), new THREE.MeshStandardMaterial({ color: 0xff547d, emissive: 0x55111f }));
      nose.rotation.x = -Math.PI / 2; nose.position.z = -0.98;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 7), new THREE.MeshBasicMaterial({ color: 0x70f5ff, transparent: true, opacity: 0.85 }));
      flame.rotation.x = Math.PI / 2; flame.position.z = 1.05;
      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(.1, .62, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9 })); innerFlame.rotation.x = Math.PI / 2; innerFlame.position.z = 1.02;
      const finMaterial = new THREE.MeshStandardMaterial({ color: 0xff547d, roughness: .48, flatShading: true });
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(.2, .48, 3), finMaterial); fin.position.set(Math.cos(angle) * .28, Math.sin(angle) * .28, .54); fin.rotation.z = angle; group.add(fin);
      }
      const windowBand = new THREE.Mesh(new THREE.TorusGeometry(.265, .045, 5, 10), new THREE.MeshStandardMaterial({ color: 0x70f5ff, emissive: 0x17627d, emissiveIntensity: .9 })); windowBand.position.z = -.38;
      group.add(body, nose, flame, innerFlame, windowBand);
      group.userData.flame = flame; group.userData.innerFlame = innerFlame;
    } else if (weapon === "asteroid") {
      const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x70445f, emissive: 0x5c1e2d, emissiveIntensity: .85, roughness: .96, flatShading: true });
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.92, 1), rockMaterial); rock.scale.set(1.18, .92, 1.05);
      for (let index = 0; index < 5; index++) {
        const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(.28 + index * .035, 0), rockMaterial);
        chunk.position.set(Math.sin(index * 2.3) * .68, Math.cos(index * 1.7) * .52, Math.sin(index * 1.1) * .55); group.add(chunk);
      }
      const crackMaterial = new THREE.MeshBasicMaterial({ color: 0xff8a4f, transparent: true, opacity: .9 });
      for (let index = 0; index < 3; index++) {
        const crack = new THREE.Mesh(new THREE.TorusGeometry(.76 + index * .06, .025, 4, 10, Math.PI * .75), crackMaterial);
        crack.rotation.set(index * 1.4, index * .8, index * .4); group.add(crack);
      }
      const glow = new THREE.PointLight(0xff704c, 18, 9); group.add(rock, glow);
      group.userData.rock = rock;
    } else if (weapon === "cluster") {
      const size = projectile.fragment ? .22 : .56;
      const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 1),
        new THREE.MeshStandardMaterial({ color: 0xffdc4f, emissive: 0x8a3154, emissiveIntensity: 1.25, metalness: .35, roughness: .28, flatShading: true })
      );
      shell.scale.set(1, .82, 1.35);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 1.08, size * .12, 5, 12), new THREE.MeshBasicMaterial({ color: 0xff8bd9 }));
      ring.rotation.x = Math.PI / 2;
      group.add(shell, ring);
      group.userData.flame = ring;
    } else {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(.5, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x31215f, emissive: 0x7447d9, emissiveIntensity: 2.1, metalness: .2, roughness: .18 })
      );
      const orbitA = new THREE.Mesh(new THREE.TorusGeometry(.72, .07, 5, 18), new THREE.MeshBasicMaterial({ color: 0xb67cff }));
      const orbitB = orbitA.clone(); orbitB.rotation.y = Math.PI / 2;
      group.add(core, orbitA, orbitB);
      group.userData.flame = orbitA;
    }
    return group;
  }

  private syncPlanets(states: PlanetState[]): void {
    for (const state of states) {
      let visual = this.planets.get(state.id);
      if (!visual) {
        visual = this.makePlanet(state); this.planets.set(state.id, visual); this.scene.add(visual.group);
        if (this.physics) {
          const body = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(state.position.x, state.position.y, state.position.z));
          this.physics.createCollider(RAPIER.ColliderDesc.ball(BALANCE.planetRadius), body);
          visual.body = body;
        }
      }
      visual.state = state;
      visual.group.position.copy(vec(state.position));
      visual.body?.setTranslation(state.position, true);
      visual.shell.material.color.copy(visual.baseColor).lerp(damagedPlanetColor, state.damageStage * 0.13);
      for (const mark of visual.cracks.children) if (mark.userData.stageMark) mark.visible = state.damageStage >= mark.userData.stageMark;
      visual.props.children.forEach((prop, index) => { prop.visible = state.alive && (state.damageStage < 2 || index % (state.damageStage === 2 ? 4 : 2) !== 0); });
      visual.damageDebris.children.forEach((fragment) => { fragment.visible = state.alive && state.damageStage >= fragment.userData.damageLevel; });
      visual.props.rotation.z = state.damageStage >= 3 ? Math.sin(this.demoTime * 2 + state.palette) * 0.007 : 0;
      visual.props.visible = state.alive;
      visual.surfacePatches.visible = state.alive;
      this.updatePlanetLabel(visual);
      if (!state.alive) { visual.shell.visible = false; visual.cannon.visible = false; visual.repair.visible = false; visual.launchPad.visible = false; visual.launchHighlight.visible = false; visual.label.visible = false; }
      else { visual.shell.visible = true; visual.cannon.visible = true; visual.repair.visible = true; visual.launchPad.visible = true; }
    }
    for (const [id, visual] of this.planets) {
      if (states.some((state) => state.id === id)) continue;
      this.scene.remove(visual.group);
      if (visual.body && this.physics) this.physics.removeRigidBody(visual.body);
      this.disposeObject(visual.group);
      this.planets.delete(id);
    }
  }

  private syncPlayers(states: PlayerState[]): void {
    for (const state of states) {
      let visual = this.players.get(state.id);
      if (!visual) { visual = this.makePlayer(state); this.players.set(state.id, visual); this.scene.add(visual.group, visual.flightTrail); }
      visual.state = state;
      updateWorldLabel(visual.nameLabel, `${state.name.toUpperCase()}${state.isBot ? "  BOT" : ""}`, state.color);
      visual.suitMaterial.color.set(cosmeticColor(state.equippedCosmetics.suit, state.color));
      (visual.flightTrail.material as THREE.LineBasicMaterial).color.set(cosmeticColor(state.equippedCosmetics.trail, state.color));
      visual.target.copy(vec(state.position));
      visual.group.visible = state.alive && (this.mode === "match" || this.mode === "results");
      visual.intruderMarker.visible = Boolean(state.alive && this.mode === "match");
      visual.intruderDiamond.visible = Boolean(state.surfacePlanetId && state.surfacePlanetId !== state.planetId);
      visual.localMarker.visible = state.alive && state.id === this.localId && this.mode === "match";
      if (state.id === this.localId) {
        if (!this.localInitialized) {
          this.localPosition.copy(visual.target);
          this.localVelocity.copy(vec(state.velocity));
          this.localSurfacePlanetId = state.surfacePlanetId;
          this.localGravityPlanetId = state.gravityPlanetId ?? state.surfacePlanetId;
          this.localGrounded = Boolean(state.surfacePlanetId);
          this.lastLocalGroundedAt = this.localGrounded ? performance.now() : 0;
          this.localInitialized = true;
        } else {
          const error = visual.target.clone().sub(this.localPosition);
          const strength = reconciliationStrength(error.length());
          if (import.meta.env.DEV && strength > 0) this.reconciliationTracker.record(error.length(), strength >= 1, performance.now());
          if (strength >= 1) {
            this.localPosition.copy(visual.target);
            this.correction.set(0, 0, 0);
          } else if (strength > 0) this.correction.copy(error).multiplyScalar(strength);
          else this.correction.set(0, 0, 0);
          this.localVelocity.lerp(vec(state.velocity), .06 + strength * .18);
          this.localSurfacePlanetId = state.surfacePlanetId;
          this.localGravityPlanetId = state.gravityPlanetId ?? state.surfacePlanetId ?? this.localGravityPlanetId;
          const authoritativePlanet = this.localGravityPlanetId ? this.planets.get(this.localGravityPlanetId) : undefined;
          if (authoritativePlanet) {
            const altitude = this.localPosition.distanceTo(authoritativePlanet.group.position) - BALANCE.planetRadius;
            const outward = this.localPosition.clone().sub(authoritativePlanet.group.position).normalize();
            this.localGrounded = Boolean(state.surfacePlanetId) && updateGroundedState(this.localGrounded, altitude, this.localVelocity.dot(outward));
            if (this.localGrounded) this.lastLocalGroundedAt = performance.now();
          }
        }
      }
    }
    for (const [id, visual] of this.players) if (!states.some((s) => s.id === id)) {
      this.scene.remove(visual.group, visual.flightTrail); this.disposeObject(visual.group);
      visual.flightTrail.geometry.dispose(); this.disposeMaterial(visual.flightTrail.material); this.players.delete(id);
    }
  }

  private updatePlanetLabel(visual: PlanetVisual): void {
    const owner = this.room?.players.find((player) => player.id === visual.state.ownerId);
    if (!owner) { visual.label.visible = false; return; }
    const now = Date.now();
    const intruder = this.room?.players.some((player) => player.alive && player.id !== owner.id && player.surfacePlanetId === visual.state.id) ?? false;
    const jammed = visual.state.cannonDisabledUntil > now || visual.state.repairDisabledUntil > now;
    const critical = visual.state.integrity <= 25;
    const status = intruder ? "INTRUDER" : jammed ? "JAMMED" : critical ? "CRITICAL" : owner.id === this.localId ? "YOUR PLANET" : "";
    const integrity = Math.round(visual.state.integrity / Math.max(1, this.rules.maxIntegrity) * 100);
    const key = `${owner.name}|${owner.color}|${integrity}|${status}|${visual.state.alive}`;
    if (key === visual.labelKey) return;
    visual.labelKey = key;
    const context = visual.labelContext;
    context.clearRect(0, 0, visual.labelCanvas.width, visual.labelCanvas.height);
    context.fillStyle = critical ? "rgba(47,7,25,.88)" : "rgba(5,8,31,.82)";
    context.beginPath(); context.roundRect(7, 7, 370, status ? 96 : 72, 18); context.fill();
    context.strokeStyle = critical ? "#ff5d72" : owner.color; context.lineWidth = owner.id === this.localId ? 6 : 4; context.stroke();
    context.fillStyle = "#ffffff"; context.textBaseline = "middle"; context.font = "900 30px Trebuchet MS"; context.textAlign = "left";
    context.fillText(owner.name.toUpperCase(), 26, 39, 250);
    context.fillStyle = critical ? "#ff8b74" : owner.color; context.textAlign = "right"; context.font = "900 32px Arial Black"; context.fillText(`${integrity}%`, 357, 39);
    if (status) {
      context.fillStyle = intruder || jammed || critical ? "#ffdc4f" : "#9eacd3";
      context.font = "900 18px Trebuchet MS"; context.textAlign = "center";
      context.fillText(status, 192, 82);
    }
    visual.labelTexture.needsUpdate = true;
  }

  private syncScraps(states: RoomView["scraps"]): void {
    for (const state of states) {
      if (!this.scraps.has(state.id)) {
        const mesh = this.makeScrap(); mesh.position.copy(vec(state.position)); mesh.scale.setScalar(.1); mesh.userData.spawnedAt = performance.now();
        this.scene.add(mesh); this.scraps.set(state.id, mesh);
        if (this.mode === "match") this.spawnPulse(mesh.position, 0xffdc4f, .55);
      }
    }
    for (const [id, mesh] of this.scraps) if (!states.some((s) => s.id === id)) { this.scene.remove(mesh); this.disposeObject(mesh); this.scraps.delete(id); }
  }

  private bindControls(): void {
    this.canvas.addEventListener("click", () => {
      this.audio.unlock();
      if (this.mode === "match" && !this.uiCaptured && document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock().catch(() => undefined);
    });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  private frame(now: number): void {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.inputFrame = this.input.sample();
    this.processControls(this.inputFrame, dt);
    this.demoTime += dt;
    this.starLayers.forEach((layer, index) => {
      layer.rotation.y += dt * layer.userData.speed;
      layer.rotation.x = Math.sin(this.demoTime * .04 + index) * .018;
    });
    if (this.mode === "home" || this.mode === "lobby") this.updateDemo(dt);
    else if (this.mode === "results") this.updateResults(dt);
    else this.updateMatch(dt, now);
    this.updateEffects(dt);
    if (this.physics) this.physics.step();
    this.renderer.render(this.scene, this.camera);
    this.performanceFrames += 1;
    if (now - this.performanceSampleAt >= 1000) {
      this.measuredFps = this.performanceFrames * 1000 / (now - this.performanceSampleAt);
      this.performanceFrames = 0; this.performanceSampleAt = now;
    }
  }

  private processControls(frame: InputFrame, dt: number): void {
    if (frame.method === "gamepad" && [frame.confirm, frame.jump, frame.burst, frame.interact, frame.fire, frame.grapple, frame.emote, frame.pause].some((state) => state.pressed)) this.audio.unlock();
    const navigatingUi = this.mode !== "match" || this.uiCaptured;
    if (navigatingUi && frame.menuY) this.onMenuNavigate?.(frame.menuY < 0 ? "up" : "down");
    if (navigatingUi && frame.menuX) this.onMenuNavigate?.(frame.menuX < 0 ? "left" : "right");
    if (navigatingUi && frame.confirm.pressed) this.onMenuNavigate?.("confirm");

    if (this.mode !== "match") {
      if (frame.cancel.pressed || frame.burst.pressed) this.onMenuNavigate?.("back");
      return;
    }
    if (frame.pause.pressed || (frame.method === "keyboard" && frame.cancel.pressed && !this.launchAiming)) {
      this.onPauseRequest?.();
      return;
    }
    if (this.uiCaptured) {
      if (frame.cancel.pressed || frame.burst.pressed) this.onMenuNavigate?.("back");
      return;
    }

    const local = this.players.get(this.localId);
    if (!local?.state.alive) {
      if (frame.previousTarget.pressed || frame.menuX < 0) this.spectatorIndex -= 1;
      if (frame.nextTarget.pressed || frame.menuX > 0 || frame.repair.pressed) this.spectatorIndex += 1;
      this.applyLook(frame, dt);
      return;
    }
    if (frame.emote.pressed) {
      this.emoteSelecting = true;
      this.emoteSelection = this.availableEmotes(local.state)[0] ?? "wave";
      this.onEmoteMenu?.(true, this.emoteSelection);
    }
    if (this.emoteSelecting && frame.emote.held) {
      const available = this.availableEmotes(local.state);
      if (available.length && Math.hypot(frame.moveX, frame.moveY) > .35) {
        const angle = Math.atan2(frame.moveY, frame.moveX);
        const index = ((Math.round((angle + Math.PI) / (Math.PI * 2) * available.length) % available.length) + available.length) % available.length;
        if (available[index] !== this.emoteSelection) {
          this.emoteSelection = available[index]; this.onEmoteMenu?.(true, this.emoteSelection);
        }
      }
    }
    if (this.emoteSelecting && frame.emote.released) {
      this.emoteSelecting = false;
      this.onEmoteMenu?.(false, this.emoteSelection);
      this.onEmote?.(this.emoteSelection, plain(this.cameraForward));
    }
    if (this.launchAiming && (frame.cancel.pressed || frame.burst.pressed)) this.cancelLaunchAim();
    else if (frame.switchWeapon.pressed) this.toggleWeapon();
    if (frame.repair.pressed && !this.launchAiming) {
      const nearbyPad = this.nearbyLaunchPad();
      if (nearbyPad) {
        if (local.state.launchBoostUntil <= Date.now() && local.state.scrap >= BALANCE.utilities.launchBoost.cost) {
          this.onInteract?.({ action: "utility", planetId: nearbyPad.state.id, utility: "launch-boost" });
        } else this.audio.denied();
        return;
      }
      const ownPlanet = this.planets.get(local.state.planetId);
      const nearRepair = ownPlanet && distance(plain(this.localPosition), repairPosition(ownPlanet.state)) <= BALANCE.repair.range;
      const canRepair = ownPlanet && nearRepair && this.room?.phase !== "overtime"
        && ownPlanet.state.repairDisabledUntil <= Date.now()
        && ownPlanet.state.integrity < this.rules.maxIntegrity
        && local.state.scrap >= BALANCE.repair.cost;
      if (canRepair) this.onRepair?.();
      else if (nearRepair) this.audio.denied();
    }
    if (frame.interact.pressed) this.handleInteractDown();
    if (frame.interact.released && this.activeSabotage) {
      this.onInteract?.({ action: "sabotage", planetId: this.activeSabotage.planetId, structure: this.activeSabotage.structure, active: false });
      this.activeSabotage = null;
    }
    if (this.launchAiming) {
      if (frame.previousTarget.pressed) this.cycleLaunchTarget(-1);
      if (frame.nextTarget.pressed || frame.repair.pressed) this.cycleLaunchTarget(1);
    }
    if (frame.jump.pressed) {
      this.jumpLatch = true;
      this.jumpQueuedUntil = performance.now() + BALANCE.ground.jumpBufferMs;
    }
    if (frame.burst.pressed && !this.launchAiming) this.burstLatch = true;
    if (frame.fire.pressed && !this.launchAiming && this.nearOwnCannon()) {
      const ownPlanet = this.planets.get(local.state.planetId);
      const canFire = ownPlanet && ownPlanet.state.cannonDisabledUntil <= Date.now()
        && local.state.scrap >= BALANCE.weapons[this.weapon].cost;
      if (canFire) {
        ownPlanet.recoil = Math.max(ownPlanet.recoil, .28);
        (ownPlanet.muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.4;
        this.audio.cannonTrigger(this.weapon === "asteroid");
        this.onFire?.(this.weapon, plain(this.cameraForward));
        this.input.vibrate(this.weapon === "asteroid" ? 150 : 80, this.weapon === "asteroid" ? .48 : .2);
      } else this.audio.denied();
    }
    if (frame.grapple.pressed) {
      this.grapplePoint = this.findGrapplePoint();
      if (this.grapplePoint) {
        this.grappleRestLength = grappleRestLength(this.localPosition.distanceTo(this.grapplePoint));
        this.audio.grapple();
      }
    }
    this.grappleHeld = frame.grapple.held && Boolean(this.grapplePoint);
    if (frame.grapple.released) {
      if (this.grapplePoint) this.audio.grappleRelease();
      this.grapplePoint = null;
      this.grappleRestLength = 0;
      this.grappleTension = 0;
    }
    this.applyLook(frame, dt);
  }

  private applyLook(frame: InputFrame, dt: number): void {
    if (frame.method === "keyboard") {
      if (document.pointerLockElement !== this.canvas) return;
      this.lookYawDelta -= frame.lookX * .0022 * this.settings.mouseSensitivity;
      const invert = this.settings.invertY ? -1 : 1;
      this.pitch = clamp(this.pitch - frame.lookY * .0018 * this.settings.mouseSensitivity * invert, -.28, 1.02);
      return;
    }
    let assist = 1;
    if (this.nearOwnCannon()) {
      const closeToTarget = [...this.planets.values()].some((planet) => planet.state.alive && planet.state.ownerId !== this.localId
        && planet.group.position.clone().sub(this.camera.position).normalize().dot(this.cameraForward) > .965);
      if (closeToTarget) assist = .64;
    }
    const invert = this.settings.invertY ? -1 : 1;
    const speed = this.settings.controllerSensitivity * assist;
    this.lookYawDelta -= frame.lookX * dt * 2.85 * speed;
    this.pitch = clamp(this.pitch - frame.lookY * dt * 2.25 * speed * invert, -.28, 1.02);
  }

  private updateDemo(dt: number): void {
    this.demo.rotation.y += dt * 0.055;
    for (const child of this.demo.children) child.rotation.y += dt * 0.08;
    const compact = innerWidth < 820;
    const target = compact ? new THREE.Vector3(0, 2, 0) : new THREE.Vector3(10, 1, -4);
    const cameraPosition = compact ? new THREE.Vector3(0, 8, 36) : new THREE.Vector3(20, 10, 32);
    this.camera.position.lerp(cameraPosition, 0.025);
    this.camera.lookAt(target);
  }

  private updateResults(dt: number): void {
    const winner = this.room?.winnerId ? this.room.players.find((player) => player.id === this.room!.winnerId) : undefined;
    const planet = winner ? this.planets.get(winner.planetId) : [...this.planets.values()].find((candidate) => candidate.state.alive);
    if (!planet) return;
    const angle = this.demoTime * .12;
    const desired = planet.group.position.clone().add(new THREE.Vector3(Math.cos(angle) * 23, 12, Math.sin(angle) * 23));
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 2.2));
    this.camera.up.lerp(new THREE.Vector3(0, 1, 0), 1 - Math.exp(-dt * 3)).normalize();
    this.camera.lookAt(planet.group.position);
    this.camera.fov += (52 - this.camera.fov) * (1 - Math.exp(-dt * 3));
    this.camera.updateProjectionMatrix();
    const mascot = winner ? this.players.get(winner.id) : undefined;
    if (mascot) {
      const pose = winner!.equippedCosmetics.victory;
      if (pose === "spin") mascot.group.rotateY(dt * 4.2);
      if (pose === "hero") { mascot.leftArm.rotation.x = -2.25; mascot.rightArm.rotation.x = -2.25; }
      if (pose === "double-pump") {
        const pump = Math.sin(this.demoTime * 9) * .28;
        mascot.leftArm.rotation.x = -2.1 + pump; mascot.rightArm.rotation.x = -2.1 - pump;
      }
    }
  }

  private updateMatch(dt: number, now: number): void {
    const local = this.players.get(this.localId);
    if (!local || !this.room) return;
    if (!local.state.alive) { this.updateSpectator(dt); return; }
    this.predictLocal(dt, now);
    local.group.position.copy(this.localPosition);
    const planet = (this.localGravityPlanetId ? this.planets.get(this.localGravityPlanetId) : undefined)
      ?? this.nearestPlanet(this.localPosition, true);
    if (!planet) return;
    const outward = this.localPosition.clone().sub(planet.group.position).normalize();
    const upRotation = new THREE.Quaternion().setFromUnitVectors(this.cameraLocalUp, outward);
    const upStep = new THREE.Quaternion().slerp(upRotation, 1 - Math.exp(-dt * (this.localSurfacePlanetId ? 9 : 3.1)));
    this.cameraLocalUp.applyQuaternion(upStep).normalize();
    const yawAxis = this.cameraLocalUp;
    const baseForward = this.cameraForward.clone().projectOnPlane(this.cameraLocalUp);
    if (baseForward.lengthSq() < .01) {
      const reference = Math.abs(this.cameraLocalUp.y) > .95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      baseForward.crossVectors(reference, this.cameraLocalUp);
    }
    baseForward.normalize().applyAxisAngle(yawAxis, this.lookYawDelta);
    this.lookYawDelta = 0;
    this.cameraForward.copy(baseForward);
    const right = new THREE.Vector3().crossVectors(this.cameraForward, outward).normalize();
    this.cameraForward.applyAxisAngle(right, this.pitch).normalize();

    const planarForward = this.cameraForward.clone().projectOnPlane(outward).normalize();
    const facing = this.localVelocity.clone().projectOnPlane(outward);
    const modelForward = facing.lengthSq() > 0.2 ? facing.normalize() : planarForward;
    this.orientPlayer(local.group, outward, modelForward, dt);
    const flightAmount = clamp((this.localVelocity.length() - 8) / 12, 0, 1) * (local.state.surfacePlanetId ? 0.35 : 1);
    const destination = this.localLaunchTargetPlanetId ? this.planets.get(this.localLaunchTargetPlanetId) : undefined;
    const destinationDirection = destination ? destination.group.position.clone().sub(this.localPosition).normalize() : new THREE.Vector3();
    const desired = this.localPosition.clone().addScaledVector(outward, 4.1 + flightAmount * 2.2).addScaledVector(this.cameraForward, -8.6 - flightAmount * 4.5);
    const cameraCollision = this.preventCameraClip(desired, this.localPosition, planet.group.position);
    this.camera.position.lerp(cameraCollision, 1 - Math.exp(-dt * (flightAmount > 0.15 ? 5 : 8)));
    this.camera.up.lerp(this.cameraLocalUp, 1 - Math.exp(-dt * 10)).normalize();
    const shakeOffset = new THREE.Vector3().randomDirection().multiplyScalar(this.shake * 0.25 * shakeMultiplier(this.settings.cameraShake));
    this.camera.position.add(shakeOffset);
    this.camera.lookAt(this.localPosition.clone().addScaledVector(outward, 1.1).addScaledVector(planarForward, 1.6).addScaledVector(destinationDirection, flightAmount * 2.7));
    const targetFov = 58 + flightAmount * 8;
    if (Math.abs(this.camera.fov - targetFov) > 0.02) { this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-dt * 5)); this.camera.updateProjectionMatrix(); }

    for (const [id, player] of this.players) {
      if (id === this.localId) continue;
      const airborne = !player.state.surfacePlanetId;
      player.group.position.lerp(player.target, interpolationAlpha(dt, airborne ? 8 : 13));
      const gravityPlanet = (player.state.gravityPlanetId ? this.planets.get(player.state.gravityPlanetId) : undefined)
        ?? this.nearestPlanet(player.group.position, true);
      if (gravityPlanet) {
        const up = player.group.position.clone().sub(gravityPlanet.group.position).normalize();
        const upRotation = new THREE.Quaternion().setFromUnitVectors(player.presentationUp, up);
        player.presentationUp.applyQuaternion(new THREE.Quaternion().slerp(upRotation, 1 - Math.exp(-dt * (airborne ? 3.5 : 10)))).normalize();
        const velocity = vec(player.state.velocity).projectOnPlane(player.presentationUp);
        const desiredFacing = velocity.lengthSq() > 0.1
          ? velocity.normalize()
          : player.presentationForward.clone().projectOnPlane(player.presentationUp).normalize();
        if (desiredFacing.lengthSq() > .01) {
          player.presentationForward.lerp(desiredFacing, 1 - Math.exp(-dt * 11)).projectOnPlane(player.presentationUp).normalize();
        }
        this.orientPlayer(player.group, player.presentationUp, player.presentationForward, dt);
      }
    }
    this.updateContext();
  }

  private predictLocal(dt: number, now: number): void {
    const activeLaunch = now < this.localLaunchAssistUntil
      && Boolean(this.localLaunchSourcePlanetId && this.localLaunchTargetPlanetId);
    if (!activeLaunch && this.localLaunchAssistUntil > 0) {
      this.localLaunchSourcePlanetId = null;
      this.localLaunchTargetPlanetId = null;
      this.localLaunchAssistUntil = 0;
    }
    const planetStates = this.room?.planets ?? [];
    const surfacePlanet = this.localSurfacePlanetId ? this.planets.get(this.localSurfacePlanetId) : undefined;
    this.localGravityPlanetId = surfacePlanet?.state.alive
      ? surfacePlanet.state.id
      : selectGravityPlanetId(
        plain(this.localPosition),
        planetStates,
        this.localGravityPlanetId,
        activeLaunch ? this.localLaunchTargetPlanetId : null
      );
    const planet = (this.localGravityPlanetId ? this.planets.get(this.localGravityPlanetId) : undefined)
      ?? this.nearestPlanet(this.localPosition, true);
    if (!planet) return;
    const outward = this.localPosition.clone().sub(planet.group.position).normalize();
    const altitude = this.localPosition.distanceTo(planet.group.position) - BALANCE.planetRadius;
    this.localGrounded = !activeLaunch && updateGroundedState(this.localGrounded, altitude, this.localVelocity.dot(outward));
    if (this.localGrounded) this.lastLocalGroundedAt = now;
    const tangentCamera = this.cameraForward.clone().projectOnPlane(outward);
    if (tangentCamera.lengthSq() < .01) {
      tangentCamera.crossVectors(outward, Math.abs(outward.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
    }
    tangentCamera.normalize();
    const right = new THREE.Vector3().crossVectors(tangentCamera, outward).normalize();
    const moveX = this.uiCaptured ? 0 : this.inputFrame?.moveX ?? 0;
    const moveY = this.uiCaptured ? 0 : this.inputFrame?.moveY ?? 0;
    const move = right.multiplyScalar(moveX).add(tangentCamera.multiplyScalar(moveY));
    const moveMagnitude = Math.min(1, Math.hypot(moveX, moveY));
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(moveMagnitude);
    const tangentVelocity = this.localVelocity.clone().projectOnPlane(outward);
    const desired = move.clone().multiplyScalar(BALANCE.moveSpeed);
    const steppedTangent = stepTangentVelocity(
      plain(tangentVelocity),
      plain(desired),
      move.lengthSq() > .0025,
      this.localGrounded,
      dt,
      now - this.lastLocalBurst < BALANCE.burstRecoveryMs
    );
    let radialSpeed = this.localVelocity.dot(outward);
    const jump = canExecuteBufferedJump(now, this.jumpQueuedUntil, this.lastLocalGroundedAt, this.localGrounded);
    if (jump) {
      radialSpeed = this.rules.jumpSpeed;
      this.jumpQueuedUntil = 0;
      this.localGrounded = false;
      this.audio.jump();
      this.spawnThruster(this.localPosition, outward, 8);
    } else if (this.jumpQueuedUntil > 0 && now > this.jumpQueuedUntil) {
      this.jumpQueuedUntil = 0;
    } else if (this.localGrounded && radialSpeed < .5) {
      radialSpeed = Math.min(radialSpeed, -BALANCE.ground.adhesionSpeed);
    }
    this.localVelocity.copy(vec(add(steppedTangent, scale(plain(outward), radialSpeed))));
    if (!jump) {
      const launchTarget = this.localLaunchTargetPlanetId ? this.planets.get(this.localLaunchTargetPlanetId) : undefined;
      const launchSource = this.localLaunchSourcePlanetId ? this.planets.get(this.localLaunchSourcePlanetId) : undefined;
      const gravity = activeLaunch && launchTarget?.state.alive && launchSource?.state.alive
        ? launchGravityAcceleration(plain(this.localPosition), launchSource.state, launchTarget.state, this.rules.gravity)
        : gravityAcceleration(plain(this.localPosition), planet.state, this.rules.gravity);
      this.localVelocity.addScaledVector(vec(gravity), dt);
    }
    if (this.burstLatch && now - this.lastLocalBurst > BALANCE.burstCooldownMs) {
      this.lastLocalBurst = now;
      const burstDirection = desired.lengthSq() ? desired.clone().normalize() : this.cameraForward.clone().projectOnPlane(outward).normalize();
      this.localVelocity.copy(vec(applyBurstVelocity(
        plain(this.localVelocity), plain(burstDirection), plain(outward), this.localGrounded
      )));
      this.audio.burst();
      this.spawnThruster(this.localPosition, burstDirection.clone().negate(), 14);
    }
    if (this.grappleHeld && this.grapplePoint) {
      const ropeLength = this.grapplePoint.distanceTo(this.localPosition);
      this.grappleTension = Math.max(0, ropeLength - this.grappleRestLength);
      this.localVelocity.copy(vec(applyGrappleVelocity(
        plain(this.localVelocity), plain(this.localPosition), plain(this.grapplePoint), this.grappleRestLength, dt
      )));
    } else {
      this.grappleTension = 0;
    }
    const launchTarget = this.localLaunchTargetPlanetId ? this.planets.get(this.localLaunchTargetPlanetId) : undefined;
    const launchSource = this.localLaunchSourcePlanetId ? this.planets.get(this.localLaunchSourcePlanetId) : undefined;
    if (launchTarget?.state.alive && launchSource?.state.alive && activeLaunch && !this.localSurfacePlanetId) {
      this.localVelocity.copy(vec(applyLaunchGuidance(
        plain(this.localVelocity), plain(this.localPosition), launchSource.state, launchTarget.state, dt
      )));
    }
    if (this.localPosition.length() > BALANCE.softBoundaryRadius) {
      const recovery = this.nearestPlanet(this.localPosition, true);
      if (recovery) this.localVelocity.addScaledVector(recovery.group.position.clone().sub(this.localPosition).normalize(), BALANCE.softBoundaryPull * dt);
    }
    this.localVelocity.copy(vec(limitSpeed(plain(this.localVelocity), BALANCE.maxPlayerSpeed)));
    this.localPosition.addScaledVector(this.localVelocity, dt).add(this.correction);
    this.correction.multiplyScalar(0.72);
    const collisionPlanet = this.nearestPlanet(this.localPosition, true) ?? planet;
    const nextUp = this.localPosition.clone().sub(collisionPlanet.group.position).normalize();
    const minDistance = BALANCE.planetRadius + 0.95;
    let landingSpeed = 0;
    if (this.localPosition.distanceTo(collisionPlanet.group.position) < minDistance) {
      this.localPosition.copy(collisionPlanet.group.position).addScaledVector(nextUp, minDistance);
      const inward = this.localVelocity.dot(nextUp);
      if (inward < 0) {
        landingSpeed = -inward;
        this.localVelocity.addScaledVector(nextUp, -inward);
      }
    }
    const surface = this.nearestPlanet(this.localPosition, true);
    const surfaceAltitude = surface ? this.localPosition.distanceTo(surface.group.position) - BALANCE.planetRadius : Infinity;
    const surfaceUp = surface ? this.localPosition.clone().sub(surface.group.position).normalize() : nextUp;
    if (surface && surfaceAltitude <= BALANCE.ground.enterAltitude && this.localVelocity.dot(surfaceUp) <= .5) {
      this.localSurfacePlanetId = surface.state.id;
      this.localGravityPlanetId = surface.state.id;
      this.localGrounded = true;
      this.lastLocalGroundedAt = now;
      this.localLaunchTargetPlanetId = null;
      this.localLaunchSourcePlanetId = null;
      this.localLaunchAssistUntil = 0;
    } else if (surfaceAltitude > BALANCE.ground.detachAltitude) {
      this.localSurfacePlanetId = null;
    }
    if (this.localGrounded && !this.wasGrounded) {
      const impact = Math.max(landingSpeed, Math.max(0, -this.previousRadialSpeed));
      if (impact > 2.2) {
        this.audio.land(impact);
        this.shake = Math.max(this.shake, impact > 10 ? .3 : impact > 6 ? .2 : .1);
        this.input.vibrate(45 + Math.min(80, impact * 5), Math.min(.38, .1 + impact * .018));
        const localVisual = this.players.get(this.localId);
        if (localVisual) {
          localVisual.landingPulse = Math.min(1.35, .45 + impact * .07);
          this.spawnBurst(this.localPosition.clone().addScaledVector(surfaceUp, -.7), [0xd7e5ff, 0x9fb4ca, 0x70f5ff], impact > 9 ? 15 : 9, impact > 9 ? 4 : 2.6);
          this.spawnPulse(this.localPosition.clone().addScaledVector(surfaceUp, -.65), new THREE.Color(localVisual.state.color).getHex(), impact > 9 ? .9 : .55);
        }
      }
    }
    this.wasGrounded = this.localGrounded;
    this.previousRadialSpeed = this.localVelocity.dot(surfaceUp);
    this.inputAccumulator += dt;
    if (this.inputAccumulator >= 1 / BALANCE.inputRate) {
      this.inputAccumulator = 0;
      this.onInput?.({
        sequence: ++this.inputSequence, dt: 1 / BALANCE.inputRate, moveX, moveY,
        cameraForward: plain(this.cameraForward), jump: this.jumpLatch, burst: this.burstLatch,
        grapple: this.grappleHeld && Boolean(this.grapplePoint),
        grapplePoint: this.grapplePoint ? plain(this.grapplePoint) : undefined
      });
      this.jumpLatch = false; this.burstLatch = false;
    }
    this.rope.visible = Boolean(this.grappleHeld && this.grapplePoint);
    this.ropeAnchor.visible = this.rope.visible;
    if (this.rope.visible && this.grapplePoint) {
      this.rope.geometry.setFromPoints([this.localPosition.clone().addScaledVector(nextUp, 1), this.grapplePoint]);
      this.ropeAnchor.position.copy(this.grapplePoint);
      this.ropeAnchor.rotation.y += dt * 8;
      this.ropeAnchor.scale.setScalar(1 + Math.sin(this.demoTime * 20) * .18 + Math.min(.18, this.grappleTension * .025));
      (this.rope.material as THREE.LineBasicMaterial).opacity = .68 + Math.min(.3, this.grappleTension * .045);
    }
  }

  private updateContext(): void {
    const local = this.players.get(this.localId);
    const ownPlanet = local ? this.planets.get(local.state.planetId) : undefined;
    if (!local || !ownPlanet) return;
    for (const planet of this.planets.values()) planet.launchHighlight.visible = false;
    if (this.room?.phase === "countdown") {
      this.trajectory.visible = false;
      this.onPrompt?.("GET READY", false, undefined, "idle");
      return;
    }

    if (this.activeSabotage) {
      const planet = this.planets.get(this.activeSabotage.planetId);
      const position = planet ? vec(this.activeSabotage.structure === "cannon" ? cannonPosition(planet.state) : repairPosition(planet.state)) : null;
      if (!planet || !this.inputFrame?.interact.held || !position || position.distanceTo(this.localPosition) > BALANCE.sabotage.cancelRange) {
        this.onInteract?.({ action: "sabotage", planetId: this.activeSabotage.planetId, structure: this.activeSabotage.structure, active: false });
        this.activeSabotage = null;
      } else {
        this.trajectory.visible = false;
        const progress = clamp((performance.now() - this.activeSabotage.startedAt) / BALANCE.sabotage.channelMs, 0, 1);
        this.onPrompt?.(`HOLD ${this.label("interact")}  JAMMING ${Math.round(progress * 100)}%`, false, undefined, "sabotage", progress);
        return;
      }
    }

    if (this.launchAiming) {
      const source = this.launchSourcePlanetId ? this.planets.get(this.launchSourcePlanetId) : undefined;
      if (!source?.state.alive || this.localPosition.distanceTo(vec(launchPadPosition(source.state))) > BALANCE.launch.range + 0.8) {
        this.cancelLaunchAim();
      } else {
        const selected = this.launchTargetPlanetId ? this.planets.get(this.launchTargetPlanetId) : undefined;
        const target = this.launchTargetCycled && selected?.state.alive ? selected : this.selectLaunchTarget(source.state.id);
        this.launchTargetPlanetId = target?.state.id ?? null;
        if (target) {
          target.launchHighlight.visible = true;
          const owner = this.room?.players.find((player) => player.id === target.state.ownerId);
          target.launchHighlight.traverse((child) => {
            const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
            if (mesh.material?.color && owner) { mesh.material.color.set(owner.color); mesh.material.opacity = .62; }
          });
          this.updateLaunchTrajectory(source, target);
          const cycle = this.input.method === "gamepad" ? `${this.label("previousTarget")}/${this.label("nextTarget")}` : this.label("nextTarget");
          this.onPrompt?.(`${this.label("interact")}  LAUNCH TO ${owner?.name.toUpperCase() ?? "PLANET"}   •   ${cycle}  TARGET   •   ${this.label("cancel")}  CANCEL`, true, `TARGET · ${owner?.name?.toUpperCase() ?? "PLANET"} · ${Math.round(target.state.integrity)}%`, "launch");
          return;
        }
      }
    }

    this.trajectory.visible = false;
    const enemyStructure = this.nearbyEnemyStructure();
    if (enemyStructure) {
      const now = Date.now();
      if (enemyStructure.disabledUntil > now) {
        this.onPrompt?.(`${enemyStructure.structure === "cannon" ? "CANNON" : "REPAIR"} JAMMED  ${Math.ceil((enemyStructure.disabledUntil - now) / 1000)}s`, false, undefined, "cooldown");
      } else if (enemyStructure.immuneUntil > now) {
        this.onPrompt?.(`SYSTEM SHIELDED  ${Math.ceil((enemyStructure.immuneUntil - now) / 1000)}s`, false, undefined, "cooldown");
      } else {
        this.onPrompt?.(`HOLD ${this.label("interact")}  JAM ${enemyStructure.structure === "cannon" ? "CANNON" : "REPAIR"}`, false, undefined, "sabotage");
      }
      return;
    }
    const shoveTarget = this.nearbyPlayer();
    if (shoveTarget) {
      const cooldown = Math.max(0, (local.state.shoveCooldownUntil - Date.now()) / 1000);
      this.onPrompt?.(cooldown > 0 ? `SHOVE READY IN ${cooldown.toFixed(1)}s` : `${this.label("interact")}  SHOVE ${shoveTarget.state.name.toUpperCase()}`, false, undefined, cooldown > 0 ? "cooldown" : "shove");
      return;
    }
    const launchPad = this.nearbyLaunchPad();
    if (launchPad) {
      const cooldown = Math.max(0, (local.state.launchCooldownUntil - Date.now()) / 1000);
      this.onHint?.("launch", "Launch to rival planets and steal their scrap");
      const boost = local.state.launchBoostUntil > Date.now() ? "BOOST READY" : `${this.label("repair")}  BOOST ${BALANCE.utilities.launchBoost.cost}`;
      this.onPrompt?.(cooldown > 0 ? `LAUNCH READY IN ${cooldown.toFixed(1)}s  ·  ${boost}` : `${this.label("interact")}  LAUNCH  ·  ${boost}`, false, undefined, cooldown > 0 ? "cooldown" : "launch");
      return;
    }

    const nearCannon = this.nearOwnCannon();
    const nearRepair = distance(plain(this.localPosition), repairPosition(ownPlanet.state)) < BALANCE.repair.range;
    if (nearCannon && ownPlanet.state.cannonDisabledUntil > Date.now()) {
      this.onPrompt?.(`CANNON JAMMED  ${Math.ceil((ownPlanet.state.cannonDisabledUntil - Date.now()) / 1000)}s`, false, undefined, "cooldown");
    } else if (nearRepair && ownPlanet.state.repairDisabledUntil > Date.now()) {
      this.onPrompt?.(`REPAIR JAMMED  ${Math.ceil((ownPlanet.state.repairDisabledUntil - Date.now()) / 1000)}s`, false, undefined, "cooldown");
    } else if (nearCannon) {
      const origin = vec(cannonPosition(ownPlanet.state)).addScaledVector(this.cameraForward, 1.8);
      const points = Array.from({ length: 56 }, (_, i) => origin.clone().addScaledVector(this.cameraForward, i * 1.65));
      this.trajectory.geometry.setFromPoints(points);
      (this.trajectory as THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>).computeLineDistances();
      const flatAim = this.cameraForward.clone().projectOnPlane(new THREE.Vector3(0, 1, 0)).normalize();
      if (flatAim.lengthSq() > 0.1) ownPlanet.cannon.rotation.y = Math.atan2(-flatAim.x, -flatAim.z);
      this.trajectory.visible = true;
      this.onHint?.("cannon", "Fire at rival planets");
      const weaponCost = BALANCE.weapons[this.weapon].cost;
      const overchargeCopy = local.state.overchargeUntil > Date.now() ? "OVERCHARGE READY" : `${this.label("interact")}  OVERCHARGE ${BALANCE.utilities.overcharge.cost}`;
      this.onPrompt?.(
        local.state.scrap < weaponCost ? `NEED ${weaponCost - local.state.scrap} MORE SCRAP` : `${this.label("fire")}  FIRE  ·  ${overchargeCopy}`,
        true,
        `${WEAPON_COPY[this.weapon].name} · ${weaponCost} SCRAP`,
        local.state.scrap < weaponCost ? "cooldown" : "weapon"
      );
    } else if (nearRepair) {
      this.onHint?.("repair", `${this.label("repair")} repairs your planet`);
      const shieldCopy = ownPlanet.state.shieldUntil > Date.now() ? "SHIELD ACTIVE"
        : ownPlanet.state.shieldCooldownUntil > Date.now() ? `SHIELD READY IN ${Math.ceil((ownPlanet.state.shieldCooldownUntil - Date.now()) / 1000)}s`
          : `${this.label("interact")}  SHIELD ${BALANCE.utilities.shield.cost}`;
      if (this.room?.phase === "overtime") this.onPrompt?.("REPAIRS OFFLINE IN OVERTIME", false, undefined, "cooldown");
      else if (ownPlanet.state.integrity >= this.rules.maxIntegrity) this.onPrompt?.(`PLANET FULL  ·  ${shieldCopy}`, false, undefined, "idle");
      else if (local.state.scrap < BALANCE.repair.cost) this.onPrompt?.(`NEED ${BALANCE.repair.cost - local.state.scrap} MORE SCRAP`, false, undefined, "cooldown");
      else this.onPrompt?.(`${this.label("repair")}  REPAIR ${BALANCE.repair.heal}% · ${shieldCopy}`, false, undefined, "idle");
    } else if (this.input.method === "keyboard" && document.pointerLockElement !== this.canvas) this.onPrompt?.("CLICK THE ARENA TO TAKE CONTROL", false, undefined, "idle");
    else {
      if (!this.localSurfacePlanetId && this.localVelocity.length() > 8) this.onHint?.("grapple-space", `${this.label("grapple")} to grapple back`);
      else if (this.localSurfacePlanetId && this.localSurfacePlanetId !== local.state.planetId) this.onHint?.("enemy-world", "Steal scrap, shove defenders, or jam structures");
      else if ([...this.scraps.values()].some((scrap) => scrap.position.distanceTo(this.localPosition) < 4)) this.onHint?.("scrap", "Collect scrap to fire and repair");
      this.onPrompt?.("COLLECT · RAID · DEFEND", false, undefined, "idle");
    }
  }

  private handleInteractDown(): void {
    if (!this.room || (this.room.phase !== "playing" && this.room.phase !== "overtime")) return;
    if (this.launchAiming) {
      if (this.launchTargetPlanetId) this.onInteract?.({ action: "launch", targetPlanetId: this.launchTargetPlanetId });
      this.cancelLaunchAim();
      return;
    }
    const structure = this.nearbyEnemyStructure();
    if (structure && structure.disabledUntil <= Date.now() && structure.immuneUntil <= Date.now()) {
      this.activeSabotage = { planetId: structure.planet.state.id, structure: structure.structure, startedAt: performance.now() };
      this.onInteract?.({ action: "sabotage", planetId: structure.planet.state.id, structure: structure.structure, active: true });
      return;
    }
    const shoveTarget = this.nearbyPlayer();
    if (shoveTarget) {
      const localPlayer = this.players.get(this.localId);
      if (localPlayer && localPlayer.state.shoveCooldownUntil <= Date.now()) localPlayer.shoveUntil = performance.now() + 280;
      this.onInteract?.({ action: "shove", targetPlayerId: shoveTarget.state.id });
      return;
    }
    const local = this.players.get(this.localId);
    const ownPlanet = local ? this.planets.get(local.state.planetId) : undefined;
    const now = Date.now();
    if (local && ownPlanet && this.nearOwnCannon()) {
      if (local.state.overchargeUntil <= now && local.state.scrap >= BALANCE.utilities.overcharge.cost && ownPlanet.state.cannonDisabledUntil <= now) {
        this.onInteract?.({ action: "utility", planetId: ownPlanet.state.id, utility: "overcharge" });
      } else this.audio.denied();
      return;
    }
    if (local && ownPlanet && distance(plain(this.localPosition), repairPosition(ownPlanet.state)) <= BALANCE.utilities.shield.range) {
      if (this.room.phase !== "overtime" && local.state.scrap >= BALANCE.utilities.shield.cost
        && ownPlanet.state.repairDisabledUntil <= now && ownPlanet.state.shieldUntil <= now && ownPlanet.state.shieldCooldownUntil <= now) {
        this.onInteract?.({ action: "utility", planetId: ownPlanet.state.id, utility: "shield" });
      } else this.audio.denied();
      return;
    }
    const pad = this.nearbyLaunchPad();
    if (pad && local) {
      const target = this.selectLaunchTarget(pad.state.id);
      if (local.state.launchCooldownUntil <= now && target) {
        this.launchAiming = true;
        this.launchSourcePlanetId = pad.state.id;
        this.launchTargetPlanetId = target.state.id;
        this.launchTargetOffset = 0;
        this.launchTargetCycled = false;
        this.audio.click();
      } else this.audio.denied();
    }
  }

  private cancelLaunchAim(): void {
    this.launchAiming = false;
    this.launchSourcePlanetId = null;
    this.launchTargetPlanetId = null;
    this.launchTargetOffset = 0;
    this.launchTargetCycled = false;
    this.trajectory.visible = false;
    for (const planet of this.planets.values()) planet.launchHighlight.visible = false;
  }

  private nearbyEnemyStructure(): { planet: PlanetVisual; structure: StructureType; distance: number; disabledUntil: number; immuneUntil: number } | null {
    let nearest: { planet: PlanetVisual; structure: StructureType; distance: number; disabledUntil: number; immuneUntil: number } | null = null;
    for (const planet of this.planets.values()) {
      if (!planet.state.alive || planet.state.ownerId === this.localId) continue;
      for (const structure of ["cannon", "repair"] as const) {
        const disabledUntil = structure === "cannon" ? planet.state.cannonDisabledUntil : planet.state.repairDisabledUntil;
        const immuneUntil = structure === "cannon" ? planet.state.cannonSabotageImmuneUntil : planet.state.repairSabotageImmuneUntil;
        const position = structure === "cannon" ? cannonPosition(planet.state) : repairPosition(planet.state);
        const d = distance(plain(this.localPosition), position);
        if (d <= BALANCE.sabotage.range && (!nearest || d < nearest.distance)) nearest = { planet, structure, distance: d, disabledUntil, immuneUntil };
      }
    }
    return nearest;
  }

  private nearbyPlayer(): PlayerVisual | null {
    const local = this.players.get(this.localId);
    const surfacePlanetId = this.localSurfacePlanetId ?? local?.state.surfacePlanetId ?? null;
    const planet = surfacePlanetId ? this.planets.get(surfacePlanetId) : undefined;
    if (!local || !planet) return null;
    let nearest: PlayerVisual | null = null;
    let nearestDistance: number = BALANCE.shove.range;
    for (const player of this.players.values()) {
      if (!player.state.alive || player.state.id === this.localId || player.state.surfacePlanetId !== surfacePlanetId) continue;
      const d = player.group.position.distanceTo(this.localPosition);
      if (d <= nearestDistance && isShoveTarget(
        plain(this.localPosition), plain(player.group.position), planet.state.position, plain(this.cameraForward)
      )) { nearest = player; nearestDistance = d; }
    }
    return nearest;
  }

  private nearbyLaunchPad(): PlanetVisual | null {
    let nearest: PlanetVisual | null = null;
    let nearestDistance: number = BALANCE.launch.range;
    for (const planet of this.planets.values()) {
      if (!planet.state.alive) continue;
      const d = distance(plain(this.localPosition), launchPadPosition(planet.state));
      if (d <= nearestDistance) { nearest = planet; nearestDistance = d; }
    }
    return nearest;
  }

  private selectLaunchTarget(sourcePlanetId: string): PlanetVisual | null {
    const targets = [...this.planets.values()].filter((planet) => planet.state.alive && planet.state.id !== sourcePlanetId);
    targets.sort((a, b) => {
      const directionA = a.group.position.clone().sub(this.localPosition).normalize();
      const directionB = b.group.position.clone().sub(this.localPosition).normalize();
      return directionB.dot(this.cameraForward) - directionA.dot(this.cameraForward);
    });
    return targets[0] ?? null;
  }

  private cycleLaunchTarget(direction: number): void {
    if (!this.launchSourcePlanetId) return;
    const targets = [...this.planets.values()].filter((planet) => planet.state.alive && planet.state.id !== this.launchSourcePlanetId);
    if (!targets.length) return;
    const current = targets.findIndex((planet) => planet.state.id === this.launchTargetPlanetId);
    this.launchTargetOffset = (current + direction + targets.length) % targets.length;
    this.launchTargetPlanetId = targets[this.launchTargetOffset].state.id;
    this.launchTargetCycled = true;
    this.audio.click();
  }

  private updateLaunchTrajectory(source: PlanetVisual, target: PlanetVisual): void {
    const points: THREE.Vector3[] = [this.localPosition.clone()];
    const position = this.localPosition.clone();
    let velocity = launchVelocity(plain(position), source.state, target.state);
    let gravityPlanetId: string | null = source.state.id;
    const planetStates = [...this.planets.values()].map((visual) => visual.state);
    const step = 0.075;
    for (let index = 0; index < 48; index++) {
      const elapsed = index * step * 1000;
      gravityPlanetId = selectGravityPlanetId(plain(position), planetStates, gravityPlanetId, target.state.id);
      const gravityPlanet = gravityPlanetId ? this.planets.get(gravityPlanetId) : undefined;
      if (!gravityPlanet) break;
      const gravity = elapsed < BALANCE.launch.assistMs
        ? launchGravityAcceleration(plain(position), source.state, target.state, this.rules.gravity)
        : gravityAcceleration(plain(position), gravityPlanet.state, this.rules.gravity);
      velocity = add(velocity, scale(gravity, step));
      if (elapsed < BALANCE.launch.assistMs) velocity = applyLaunchGuidance(velocity, plain(position), source.state, target.state, step);
      const next = add(plain(position), scale(velocity, step));
      position.copy(vec(next));
      points.push(position.clone());
      if (position.distanceTo(target.group.position) <= BALANCE.planetRadius + 1) break;
    }
    this.trajectory.geometry.setFromPoints(points);
    (this.trajectory as THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>).computeLineDistances();
    this.trajectory.visible = true;
  }

  private updateSpectator(dt: number): void {
    const targets = [...this.planets.values()].filter((p) => p.state.alive);
    if (!targets.length) return;
    const index = ((this.spectatorIndex % targets.length) + targets.length) % targets.length;
    const target = targets[index].group.position;
    this.yaw += this.lookYawDelta + dt * 0.06;
    this.lookYawDelta = 0;
    const desired = target.clone().add(new THREE.Vector3(Math.cos(this.yaw) * 20, 10 + (this.pitch + .28) * 7, Math.sin(this.yaw) * 20));
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 3));
    this.camera.up.lerp(new THREE.Vector3(0, 1, 0), .05);
    this.camera.lookAt(target);
    this.onPrompt?.(`SPECTATING  ·  ${this.label("previousTarget")} ${this.label("nextTarget")} CYCLE`, false);
  }

  private updateEffects(dt: number): void {
    const wallNow = Date.now();
    const animationNow = performance.now();
    if (this.mode === "match" && this.room?.activeModifier === "low-gravity" && animationNow >= this.nextChaosParticleAt) {
      this.nextChaosParticleAt = animationNow + 240;
      const local = this.players.get(this.localId);
      if (local) {
        const mesh = new THREE.Mesh(particleGeometry, this.particleMaterial(Math.random() > .5 ? 0x70f5ff : 0xb67cff));
        mesh.userData.sharedParticleMaterial = true;
        mesh.position.copy(local.group.position).add(new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 3));
        mesh.scale.setScalar(.45); this.scene.add(mesh);
        this.particles.push({ mesh, velocity: new THREE.Vector3(0, .3, 0), life: 1.1, maxLife: 1.1, spin: .6 });
      }
    }
    for (const [id, projectile] of this.projectiles) {
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      projectile.mesh.rotation.z += dt * (projectile.weapon === "asteroid" ? 2.2 : .55);
      if (projectile.weapon === "asteroid") {
        projectile.mesh.rotation.x += dt * 1.4;
        const rock = projectile.mesh.userData.rock as THREE.Mesh | undefined;
        if (rock) rock.scale.set(1.18 + Math.sin(this.demoTime * 13) * .035, .92, 1.05);
      } else {
        const flame = projectile.mesh.userData.flame as THREE.Mesh | undefined;
        const innerFlame = projectile.mesh.userData.innerFlame as THREE.Mesh | undefined;
        if (flame) flame.scale.set(1 + Math.sin(this.demoTime * 28) * .16, 1 + Math.sin(this.demoTime * 21) * .28, 1);
        if (innerFlame) innerFlame.scale.setScalar(.82 + Math.sin(this.demoTime * 34) * .12);
      }
      projectile.trailPoints.unshift(projectile.mesh.position.clone());
      projectile.trailPoints.length = Math.min(projectile.trailPoints.length, projectile.maxTrailPoints);
      const positionAttribute = projectile.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
      projectile.trailPoints.forEach((point, index) => positionAttribute.setXYZ(index, point.x, point.y, point.z));
      positionAttribute.needsUpdate = true;
      projectile.trail.geometry.setDrawRange(0, projectile.trailPoints.length);
      const trailMaterial = projectile.trail.material as THREE.LineBasicMaterial;
      trailMaterial.opacity = .48 + Math.sin(this.demoTime * 15) * .12;
      if (projectile.mesh.position.length() > 170) { this.disposeProjectile(projectile); this.projectiles.delete(id); }
    }
    for (const mesh of this.scraps.values()) {
      mesh.rotation.y += dt * 1.8; mesh.rotation.x += dt * .62;
      const age = (animationNow - Number(mesh.userData.spawnedAt ?? 0)) / 260;
      const spawnScale = clamp(age, 0, 1);
      mesh.scale.setScalar(spawnScale * (1 + Math.sin(this.demoTime * 4 + mesh.position.x) * .08));
      const ring = mesh.userData.ring as THREE.Mesh | undefined;
      if (ring) ring.rotation.z += dt * 2.3;
    }
    for (const visual of this.planets.values()) {
      this.updatePlanetLabel(visual);
      const cameraDistance = this.camera.position.distanceTo(visual.group.position);
      visual.label.visible = visual.state.alive && this.mode === "match" && cameraDistance > 16;
      visual.structureLabels.cannon.visible = this.shouldShowStructureLabel(visual, visual.structureLabels.cannon);
      visual.structureLabels.repair.visible = this.shouldShowStructureLabel(visual, visual.structureLabels.repair);
      visual.structureLabels.launch.visible = this.shouldShowStructureLabel(visual, visual.structureLabels.launch);
      const propBudget = cameraDistance < 24 ? Math.min(visual.props.children.length, this.quality.nearPropLimit) : cameraDistance < 45 ? this.quality.midPropLimit : this.quality.farPropLimit;
      visual.props.children.forEach((prop, index) => {
        const survivedDamage = visual.state.damageStage < 2 || index % (visual.state.damageStage === 2 ? 4 : 2) !== 0;
        prop.visible = visual.state.alive && index < propBudget && survivedDamage;
      });
      const patchBudget = cameraDistance < 30 ? visual.surfacePatches.children.length : 5;
      visual.surfacePatches.children.forEach((patch, index) => { patch.visible = visual.state.alive && index < patchBudget; });
      const cannonJammed = visual.state.cannonDisabledUntil > wallNow;
      const repairJammed = visual.state.repairDisabledUntil > wallNow;
      const structureColor = this.players.get(visual.state.ownerId)?.state.color ?? "#70f5ff";
      updateWorldLabel(visual.structureLabels.cannon, cannonJammed ? "CANNON · JAMMED" : "CANNON", cannonJammed ? "#ff5d8f" : structureColor);
      updateWorldLabel(visual.structureLabels.repair, repairJammed ? "REPAIR · JAMMED" : "REPAIR", repairJammed ? "#ff5d8f" : structureColor);
      const localLaunchCooldown = Math.max(0, (this.players.get(this.localId)?.state.launchCooldownUntil ?? 0) - wallNow);
      updateWorldLabel(visual.structureLabels.launch, localLaunchCooldown > 0 ? `LAUNCH · ${Math.ceil(localLaunchCooldown / 1000)}s` : "LAUNCH PAD", localLaunchCooldown > 0 ? "#7d89ae" : "#70f5ff");
      if (!cannonJammed) visual.cannon.rotation.y += Math.sin(this.demoTime + visual.group.position.x) * dt * .065;
      visual.repairRings.children.forEach((ring, index) => {
        ring.rotation.z += dt * (index % 2 ? -1.15 : .8) * (repairJammed ? .18 : 1);
      });
      visual.repairCore.rotation.y += dt * (repairJammed ? .35 : 1.35);
      visual.recoil *= Math.pow(.045, dt);
      visual.barrel.position.z = visual.recoil * .72;
      (visual.muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + visual.recoil * 4;
      visual.repairPulse *= Math.pow(.03, dt);
      visual.repair.scale.setScalar(1 + visual.repairPulse * .35);
      visual.launchPulse *= Math.pow(.025, dt);
      const padRate = this.room?.activeModifier === "launch-party" ? 7.2 : 3.2;
      const idlePulse = 1 + Math.sin(this.demoTime * padRate + visual.state.palette) * (this.room?.activeModifier === "launch-party" ? .07 : .035);
      const padOwner = this.players.get(visual.state.ownerId);
      const cannonOvercharged = Boolean(padOwner && padOwner.state.overchargeUntil > wallNow);
      visual.cannonAccent.emissiveIntensity = cannonOvercharged ? 1.55 + Math.max(0, Math.sin(this.demoTime * 10)) * .65 : .22;
      const cooldownRemaining = Math.max(0, (this.players.get(this.localId)?.state.launchCooldownUntil ?? 0) - wallNow);
      const recharge = cooldownRemaining > 0 ? 1 - cooldownRemaining / Math.max(1, this.rules.launchCooldownMs) : 1;
      visual.launchRing.scale.setScalar((.74 + recharge * .26) * idlePulse + visual.launchPulse * .42);
      const launchMaterial = visual.launchRing.material as THREE.MeshStandardMaterial;
      launchMaterial.emissiveIntensity = cooldownRemaining > 0 ? .22 + recharge * 1.1 : 2.1 + (this.room?.activeModifier === "launch-party" ? .8 : 0);
      const localBoost = (this.players.get(this.localId)?.state.launchBoostUntil ?? 0) > wallNow;
      launchMaterial.color.setHex(localBoost ? 0xff8bd9 : 0x70f5ff);
      launchMaterial.emissive.setHex(localBoost ? 0x8a3154 : 0x16708a);
      visual.launchPad.scale.set(1 + visual.launchPulse * .12, 1 - visual.launchPulse * .28, 1 + visual.launchPulse * .12);
      visual.launchArms.children.forEach((arm, index) => {
        arm.rotation.z = (index ? -.2 : .2) + visual.launchPulse * (index ? -.42 : .42);
      });
      visual.launchHighlight.rotation.y += dt * 0.35;
      visual.launchHighlight.scale.setScalar(1 + Math.sin(this.demoTime * 4) * .015);
      visual.cannonJam.visible = cannonJammed;
      visual.repairJam.visible = repairJammed;
      if (visual.cannonJam.visible) {
        visual.cannonJam.rotation.y += dt * 5; visual.cannonJam.rotation.z += dt * 2.2;
        (visual.muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = .15 + Math.sin(this.demoTime * 23) * .1;
      }
      if (visual.repairJam.visible) {
        visual.repairJam.rotation.y -= dt * 4.2; visual.repairJam.rotation.x += dt * 1.8;
        visual.repairCore.material.emissiveIntensity = .28 + Math.max(0, Math.sin(this.demoTime * 19)) * .7;
      } else visual.repairCore.material.emissiveIntensity = 1.5;
      if ((visual.cannonJam.visible || visual.repairJam.visible) && animationNow >= visual.nextJamSparkAt) {
        visual.nextJamSparkAt = animationNow + 360 + Math.random() * 340;
        const jammed = visual.cannonJam.visible ? visual.cannon : visual.repair;
        this.spawnBurst(jammed.getWorldPosition(new THREE.Vector3()), [0xff5d8f, 0xb67cff, 0x70f5ff], 3, 2.4);
      }
      const critical = visual.state.alive && visual.state.integrity <= 25;
      const shielded = visual.state.shieldUntil > wallNow;
      const atmosphereUniforms = visual.atmosphere.material.uniforms as { glowColor: { value: THREE.Color }; intensity: { value: number } };
      atmosphereUniforms.intensity.value = (shielded ? .9 + Math.sin(this.demoTime * 8) * .1 : critical ? .62 + Math.max(0, Math.sin(this.demoTime * 3 + visual.state.palette)) * .3 : .42 + visual.state.damageStage * .07) * this.quality.atmosphereScale;
      atmosphereUniforms.glowColor.value.set(shielded ? 0x70f5ff : critical ? 0xff5d67 : PLANET_PALETTES[visual.state.palette % PLANET_PALETTES.length].accent);
      if (critical) {
        visual.shell.material.emissive.setHex(0x711624);
        visual.shell.material.emissiveIntensity = .22 + Math.max(0, Math.sin(this.demoTime * 4.2 + visual.state.palette)) * .35;
        if (animationNow >= visual.nextDamagePulseAt) {
          visual.nextDamagePulseAt = animationNow + 1700 + Math.random() * 900;
          const fragment = visual.damageDebris.children[Math.floor(Math.random() * Math.max(1, visual.damageDebris.children.length))];
          if (fragment) this.spawnBurst(fragment.getWorldPosition(new THREE.Vector3()), [0xff714d, 0x5a2549], 3, 1.5);
        }
      } else if (visual.shell.material.emissive.getHex() === 0x711624) {
        visual.shell.material.emissive.setHex(0x000000); visual.shell.material.emissiveIntensity = 1;
      }
      visual.damageDebris.rotation.y += dt * (.08 + visual.state.damageStage * .06);
      visual.damageDebris.rotation.x += dt * .025;
      visual.props.children.forEach((prop, index) => {
        if (prop.userData.vent) prop.scale.y = 1 + Math.max(0, Math.sin(this.demoTime * 3.8 + index)) * .08;
        if (prop.userData.bulb) prop.scale.setScalar(1 + Math.sin(this.demoTime * 1.8 + index) * .035);
        if (prop.userData.cosmic) { prop.rotation.y += dt * .45; const floater = prop.children[2]; if (floater) floater.position.y = 1.02 + Math.sin(this.demoTime * 2.4 + index) * .12; }
      });
    }
    for (const visual of this.players.values()) {
      const playerDistance = visual.group.position.distanceTo(this.camera.position);
      const showMascotDetails = visual.state.id === this.localId || playerDistance < 10;
      for (const detail of visual.lodDetails) detail.visible = showMascotDetails;
      const velocity = visual.state.id === this.localId ? this.localVelocity : vec(visual.state.velocity);
      const speed = velocity.length();
      const stride = Math.sin(this.demoTime * (5 + Math.min(speed, 7))) * Math.min(.62, speed * .09);
      visual.leftLeg.rotation.x = stride; visual.rightLeg.rotation.x = -stride;
      visual.leftArm.rotation.x = -stride * .72; visual.rightArm.rotation.x = stride * .72;
      visual.leftArm.rotation.z = .17; visual.rightArm.rotation.z = -.17;
      visual.torso.rotation.z = 0;
      if (animationNow < visual.emoteUntil && visual.emote) this.applyEmotePose(visual, visual.emote, animationNow);
      if (animationNow < visual.shoveUntil) { visual.rightArm.rotation.x = -1.7; visual.rightArm.rotation.z = -0.7; }
      if (visual.state.id === this.localId && this.grappleHeld) visual.rightArm.rotation.x = -2.15;
      else if (visual.state.id === this.localId && this.activeSabotage) {
        visual.leftArm.rotation.x = -1.6; visual.rightArm.rotation.x = -1.35;
        visual.leftArm.rotation.z = .44; visual.rightArm.rotation.z = -.44;
      }
      else if (!(visual.state.id === this.localId ? this.localSurfacePlanetId : visual.state.surfacePlanetId) && speed > 10) {
        visual.leftArm.rotation.x = -1.35; visual.rightArm.rotation.x = -1.35;
        visual.leftLeg.rotation.x = .35; visual.rightLeg.rotation.x = .35;
      }
      visual.torso.position.y = .72 + Math.abs(stride) * .045;
      const burstLean = visual.state.id === this.localId && animationNow - this.lastLocalBurst < 220 ? .16 : 0;
      const grappleLean = visual.state.id === this.localId ? Math.min(.13, this.grappleTension * .012) : 0;
      visual.torso.rotation.x = clamp(-speed * .018 - burstLean - grappleLean, -.38, 0);
      visual.helmet.position.y = 1.46 + Math.abs(stride) * .025;
      visual.helmet.rotation.z = Math.sin(this.demoTime * 2.2 + visual.group.position.x) * (speed < .25 ? .025 : .01) + visual.hitPulse * .14;
      visual.backpack.rotation.x = clamp(speed * .012, 0, .12);
      visual.hitPulse *= Math.pow(.025, dt);
      visual.landingPulse *= Math.pow(.018, dt);
      const idleScale = 1 + (speed < .25 ? Math.sin(this.demoTime * 2.4 + visual.group.position.x) * .018 : 0);
      visual.group.scale.set(
        idleScale + visual.hitPulse * .12 + visual.landingPulse * .14,
        idleScale - visual.hitPulse * .09 - visual.landingPulse * .18,
        idleScale + visual.hitPulse * .12 + visual.landingPulse * .14
      );
      visual.intruderMarker.position.y = Math.sin(this.demoTime * 4 + visual.group.position.x) * .08;
      const minimumLabelDistance = visual.state.id === this.localId ? 8 : 2.7;
      visual.nameLabel.visible = playerDistance > minimumLabelDistance && playerDistance < 54;
      const labelScale = clamp(playerDistance / 14, .78, 1.35) * (visual.state.id === this.localId ? .86 : 1);
      visual.nameLabel.scale.set(3.2 * labelScale, .8 * labelScale, 1);
      (visual.nameLabel.material as THREE.SpriteMaterial).opacity = visual.state.id === this.localId ? .68 : clamp((56 - playerDistance) / 18, .48, .94);
      if (this.mode === "results" && visual.state.id === this.room?.winnerId) {
        const pose = visual.state.equippedCosmetics.victory;
        if (pose === "hero") { visual.leftArm.rotation.x = -2.25; visual.rightArm.rotation.x = -2.25; }
        if (pose === "double-pump") {
          const pump = Math.sin(this.demoTime * 9) * .28;
          visual.leftArm.rotation.x = -2.1 + pump; visual.rightArm.rotation.x = -2.1 - pump;
        }
      }
      visual.localMarker.scale.setScalar(1 + Math.sin(this.demoTime * 4.5) * .045);
      if (visual.state.id === this.localId) {
        const burstReady = animationNow - this.lastLocalBurst >= BALANCE.burstCooldownMs;
        const ring = visual.localMarker.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
        if (ring?.material) ring.material.opacity = burstReady ? .58 + Math.max(0, Math.sin(this.demoTime * 5)) * .18 : .2;
      }
      if (visual.state.isBot) visual.group.rotation.z += Math.sin(this.demoTime * 1.7 + visual.group.position.x) * dt * .025;
      const visualSurfacePlanetId = visual.state.id === this.localId ? this.localSurfacePlanetId : visual.state.surfacePlanetId;
      const inFlight = visual.state.alive && !visualSurfacePlanetId && speed > 10;
      visual.flightTrail.visible = inFlight && this.mode === "match";
      if (visual.flightTrail.visible) {
        const point = visual.group.position.clone().addScaledVector(velocity.clone().normalize(), -0.8);
        if (!visual.flightTrailPoints.length || point.distanceTo(visual.flightTrailPoints[0]) > .45) visual.flightTrailPoints.unshift(point);
        visual.flightTrailPoints.length = Math.min(visual.flightTrailPoints.length, Math.max(6, Math.round(12 * this.quality.trailScale)));
        const attribute = visual.flightTrail.geometry.getAttribute("position") as THREE.BufferAttribute;
        visual.flightTrailPoints.forEach((trailPoint, index) => attribute.setXYZ(index, trailPoint.x, trailPoint.y, trailPoint.z));
        attribute.needsUpdate = true; visual.flightTrail.geometry.setDrawRange(0, visual.flightTrailPoints.length);
      } else {
        visual.flightTrailPoints.length = 0; visual.flightTrail.geometry.setDrawRange(0, 0);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life -= dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.velocity.multiplyScalar(Math.pow(.18, dt));
      particle.mesh.rotation.x += dt * (particle.spin ?? 2); particle.mesh.rotation.y += dt * (particle.spin ?? 1.4);
      if (particle.growth) particle.mesh.scale.addScalar(particle.growth * dt);
      const material = particle.mesh.material as THREE.Material & { opacity?: number };
      if (material.opacity !== undefined && !particle.mesh.userData.sharedParticleMaterial) material.opacity = clamp(particle.life / Math.min(1, particle.maxLife), 0, 1);
      if (particle.mesh.userData.sharedParticleMaterial) particle.mesh.scale.multiplyScalar(clamp(particle.life / Math.min(.32, particle.maxLife), .76, 1));
      if (particle.life <= 0) { this.disposeParticle(particle); this.particles.splice(i, 1); }
    }
    while (this.particles.length > this.quality.particleCap) this.disposeParticle(this.particles.shift()!);
    if (animationNow - this.lastIndicatorUpdate > 100) {
      this.lastIndicatorUpdate = animationNow;
      this.updateIndicators(animationNow);
    }
    this.shake *= Math.pow(0.02, dt);
  }

  private shouldShowStructureLabel(planet: PlanetVisual, label: THREE.Sprite): boolean {
    const labelDistance = this.camera.position.distanceTo(label.getWorldPosition(this.labelPosition));
    return planet.state.alive && this.mode === "match" && labelDistance > 7 && labelDistance < 46;
  }

  private spawnBurst(position: THREE.Vector3, colors: number[], count: number, speed: number): void {
    const effectiveCount = Math.max(1, Math.round(count * this.quality.particleScale));
    for (let i = 0; i < effectiveCount; i++) {
      const mesh = new THREE.Mesh(particleGeometry, this.particleMaterial(colors[i % colors.length]));
      mesh.userData.sharedParticleMaterial = true;
      mesh.position.copy(position); mesh.scale.setScalar(.55 + Math.random() * 1.25); this.scene.add(mesh);
      const life = .42 + Math.random() * .45;
      this.particles.push({ mesh, velocity: new THREE.Vector3().randomDirection().multiplyScalar(speed * (.4 + Math.random())), life, maxLife: life, spin: 1.2 + Math.random() * 3 });
    }
  }

  private spawnPulse(position: THREE.Vector3, color: number, size: number): void {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(.55, .06, 5, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false }));
    mesh.position.copy(position); mesh.lookAt(this.camera.position); mesh.scale.setScalar(size); this.scene.add(mesh);
    this.particles.push({ mesh, velocity: new THREE.Vector3(), life: .55, maxLife: .55, growth: size * 2.2 });
  }

  private spawnShockwave(position: THREE.Vector3, color: number, targetSize: number): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(.55, 12, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .34, wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    mesh.position.copy(position); mesh.scale.setScalar(.2); this.scene.add(mesh);
    this.particles.push({ mesh, velocity: new THREE.Vector3(), life: .5, maxLife: .5, growth: targetSize * 3.4 });
  }

  private spawnThruster(position: THREE.Vector3, direction: THREE.Vector3, count: number): void {
    const origin = position.clone().addScaledVector(direction.clone().normalize(), .4);
    const effectiveCount = Math.max(1, Math.round(count * this.quality.particleScale));
    for (let i = 0; i < effectiveCount; i++) {
      const mesh = new THREE.Mesh(particleGeometry, this.particleMaterial(i % 2 ? 0x70f5ff : 0xffffff));
      mesh.userData.sharedParticleMaterial = true;
      mesh.position.copy(origin); mesh.scale.setScalar(.45 + Math.random() * .5); this.scene.add(mesh);
      const velocity = direction.clone().normalize().multiplyScalar(2 + Math.random() * 4).add(new THREE.Vector3().randomDirection().multiplyScalar(1.2));
      this.particles.push({ mesh, velocity, life: .25 + Math.random() * .25, maxLife: .5 });
    }
  }

  private particleMaterial(color: number): THREE.MeshBasicMaterial {
    let material = this.particleMaterials.get(color);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      this.particleMaterials.set(color, material);
    }
    return material;
  }

  private nearOwnCannon(): boolean {
    const local = this.players.get(this.localId);
    const planet = local ? this.planets.get(local.state.planetId) : undefined;
    if (!planet) return false;
    const cannon = cannonPosition(planet.state);
    return distance(plain(this.localPosition), cannon) < BALANCE.cannonRange;
  }

  private findGrapplePoint(): THREE.Vector3 | null {
    let closest: THREE.Vector3 | null = null;
    let best: number = BALANCE.grappleRange;
    const origin = this.camera.position;
    const direction = this.cameraForward.clone().normalize();
    for (const planet of this.planets.values()) {
      if (!planet.state.alive) continue;
      const oc = origin.clone().sub(planet.group.position);
      const b = oc.dot(direction);
      const c = oc.lengthSq() - BALANCE.planetRadius ** 2;
      const discriminant = b * b - c;
      if (discriminant < 0) continue;
      const t = -b - Math.sqrt(discriminant);
      if (t > 0 && t < best) { best = t; closest = origin.clone().addScaledVector(direction, t); }
    }
    return closest;
  }

  private nearestPlanet(position: THREE.Vector3, aliveOnly: boolean): PlanetVisual | undefined {
    let nearest: PlanetVisual | undefined;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const planet of this.planets.values()) {
      if (aliveOnly && !planet.state.alive) continue;
      const candidateDistanceSquared = position.distanceToSquared(planet.group.position);
      if (candidateDistanceSquared < nearestDistanceSquared) {
        nearest = planet;
        nearestDistanceSquared = candidateDistanceSquared;
      }
    }
    return nearest;
  }

  private threatensLocalPlanet(projectile: ProjectileState): boolean {
    const local = this.players.get(this.localId);
    const planet = local ? this.planets.get(local.state.planetId) : undefined;
    if (!planet?.state.alive || projectile.ownerId === this.localId) return false;
    const origin = vec(projectile.position);
    const velocity = vec(projectile.velocity);
    const speedSquared = velocity.lengthSq();
    if (speedSquared < .01) return false;
    const time = planet.group.position.clone().sub(origin).dot(velocity) / speedSquared;
    if (time < .08 || time > 7) return false;
    const closest = origin.addScaledVector(velocity, time);
    return closest.distanceTo(planet.group.position) < BALANCE.planetRadius + (projectile.weapon === "asteroid" ? 4.5 : 2.5);
  }

  private updateIndicators(now: number): void {
    if (this.mode !== "match" || !this.room) return this.onIndicators?.([]);
    const local = this.players.get(this.localId);
    const ownPlanet = local ? this.planets.get(local.state.planetId) : undefined;
    if (!local || !ownPlanet) return this.onIndicators?.([]);
    type Candidate = { id: string; label: string; color: string; world: THREE.Vector3; danger?: boolean; priority: number };
    const ownWasHit = (this.recentDamage.get(ownPlanet.state.id) ?? 0) > now;
    const candidates: Candidate[] = [{
      id: "home", label: ownWasHit ? "PLANET HIT" : "HOME", color: local.state.color,
      world: ownPlanet.group.position, danger: ownWasHit, priority: ownWasHit ? 6 : 1
    }];
    const targetId = this.launchTargetPlanetId ?? this.localLaunchTargetPlanetId;
    const target = targetId ? this.planets.get(targetId) : undefined;
    if (target) {
      const owner = this.room.players.find((player) => player.id === target.state.ownerId);
      candidates.push({ id: "target", label: owner?.name.toUpperCase() ?? "TARGET", color: owner?.color ?? "#70f5ff", world: target.group.position, priority: 5 });
    }
    const intruder = [...this.players.values()]
      .filter((player) => player.state.alive && player.state.id !== this.localId && player.state.surfacePlanetId === ownPlanet.state.id)
      .sort((a, b) => a.group.position.distanceTo(this.localPosition) - b.group.position.distanceTo(this.localPosition))[0];
    if (intruder) candidates.push({ id: "intruder", label: "INTRUDER", color: intruder.state.color, world: intruder.group.position, danger: true, priority: 6 });
    for (const [id, projectile] of this.projectiles) if (projectile.threatening) {
      candidates.push({ id: `incoming-${id}`, label: projectile.weapon === "asteroid" ? "ASTEROID" : "INCOMING", color: projectile.weapon === "asteroid" ? "#ff784d" : "#ff5d8f", world: projectile.mesh.position, danger: true, priority: projectile.weapon === "asteroid" ? 8 : 7 });
    }
    for (const [planetId, expiresAt] of this.recentDamage) {
      if (expiresAt <= now) { this.recentDamage.delete(planetId); continue; }
      if (planetId === ownPlanet.state.id) continue;
      const damaged = this.planets.get(planetId);
      if (damaged) {
        const owner = this.room.players.find((player) => player.id === damaged.state.ownerId);
        candidates.push({ id: `hit-${planetId}`, label: "PLANET HIT", color: owner?.color ?? "#ffdc4f", world: damaged.group.position, danger: true, priority: 4 });
      }
    }
    const cameraForward = new THREE.Vector3(); this.camera.getWorldDirection(cameraForward);
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const cameraUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const indicators: EdgeIndicator[] = [];
    const used = new Set<string>();
    for (const candidate of candidates.sort((a, b) => b.priority - a.priority)) {
      if (used.has(candidate.id) || indicators.length >= 4) continue;
      used.add(candidate.id);
      const toTarget = candidate.world.clone().sub(this.camera.position).normalize();
      const projected = candidate.world.clone().project(this.camera);
      const visible = toTarget.dot(cameraForward) > 0 && Math.abs(projected.x) < .86 && Math.abs(projected.y) < .8 && projected.z > -1 && projected.z < 1;
      if (visible) continue;
      let screenX = toTarget.dot(cameraRight);
      let screenY = -toTarget.dot(cameraUp);
      if (Math.abs(screenX) + Math.abs(screenY) < .01) screenY = -1;
      const angle = Math.atan2(screenY, screenX);
      const margin = 58;
      const x = innerWidth / 2 + Math.cos(angle) * Math.max(20, innerWidth / 2 - margin);
      let y = innerHeight / 2 + Math.sin(angle) * Math.max(20, innerHeight / 2 - margin);
      if (indicators.some((item) => Math.hypot(item.x - x, item.y - y) < 58)) y = clamp(y + 30, margin, innerHeight - margin);
      indicators.push({ id: candidate.id, label: candidate.label, color: candidate.color, x, y, angle: angle * 180 / Math.PI + 135, danger: candidate.danger });
    }
    this.onIndicators?.(indicators);
  }

  private preventCameraClip(desired: THREE.Vector3, target: THREE.Vector3, planetCenter: THREE.Vector3): THREE.Vector3 {
    const radius = BALANCE.planetRadius + 0.45;
    let result = desired.clone();
    if (result.distanceTo(planetCenter) < radius) result = planetCenter.clone().add(result.sub(planetCenter).normalize().multiplyScalar(radius)).lerp(target, 0.08);
    const direction = result.clone().sub(target);
    const distanceToCamera = direction.length();
    if (distanceToCamera < .1) return result;
    direction.divideScalar(distanceToCamera);
    let nearestHit = distanceToCamera;
    for (const planet of this.planets.values()) {
      if (!planet.state.alive) continue;
      const obstructionRadius = BALANCE.planetRadius + .38;
      const offset = target.clone().sub(planet.group.position);
      const b = offset.dot(direction);
      const c = offset.lengthSq() - obstructionRadius * obstructionRadius;
      const discriminant = b * b - c;
      if (discriminant < 0) continue;
      const hit = -b - Math.sqrt(discriminant);
      if (hit > .3 && hit < nearestHit) nearestHit = hit;
    }
    return nearestHit < distanceToCamera ? target.clone().addScaledVector(direction, Math.max(.8, nearestHit - .3)) : result;
  }

  private orientPlayer(group: THREE.Group, up: THREE.Vector3, forward: THREE.Vector3, dt: number): void {
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const correctedForward = new THREE.Vector3().crossVectors(right, up).normalize();
    const matrix = new THREE.Matrix4().makeBasis(right, up, correctedForward);
    const target = new THREE.Quaternion().setFromRotationMatrix(matrix);
    group.quaternion.slerp(target, 1 - Math.exp(-dt * 15));
  }

  private applyEmotePose(visual: PlayerVisual, emote: EmoteType, now: number): void {
    const phase = now * .012;
    if (emote === "wave") {
      visual.rightArm.rotation.x = -2.25; visual.rightArm.rotation.z = -.45 + Math.sin(phase * 1.8) * .45;
    } else if (emote === "laugh") {
      visual.leftArm.rotation.x = -1.3; visual.leftArm.rotation.z = .62;
      visual.torso.rotation.z = Math.sin(phase * 2.3) * .1;
    } else if (emote === "point") {
      visual.rightArm.rotation.x = -1.55; visual.rightArm.rotation.z = -.08;
    } else if (emote === "panic") {
      visual.leftArm.rotation.x = -1.7 + Math.sin(phase * 2.4) * .55;
      visual.rightArm.rotation.x = -1.7 - Math.sin(phase * 2.4) * .55;
      visual.leftArm.rotation.z = .72; visual.rightArm.rotation.z = -.72;
    } else if (emote === "taunt") {
      visual.leftArm.rotation.x = -1.1; visual.rightArm.rotation.x = -1.1;
      visual.torso.rotation.z = Math.sin(phase) * .13;
    } else {
      visual.leftArm.rotation.x = -2.45; visual.rightArm.rotation.x = -2.45;
      visual.leftArm.rotation.z = .45; visual.rightArm.rotation.z = -.45;
      visual.torso.position.y += Math.max(0, Math.sin(phase)) * .08;
    }
  }

  private toggleWeapon(): void {
    const index = WEAPON_ORDER.indexOf(this.weapon);
    this.weapon = WEAPON_ORDER[(index + 1) % WEAPON_ORDER.length];
    this.audio.click(); this.onWeaponChange?.(this.weapon);
  }

  private availableEmotes(player: PlayerState): EmoteType[] {
    const unlocked = SHOP_CATALOG
      .filter((item) => item.category === "emote" && item.emote && player.ownedCosmetics.includes(item.id))
      .map((item) => item.emote!);
    return [...new Set<EmoteType>([...FREE_EMOTES, ...unlocked])];
  }

  private label(action: InputAction): string {
    return inputLabel(action as Parameters<typeof inputLabel>[0], this.input.method);
  }

  private isSpectating(): boolean { return Boolean(this.players.get(this.localId) && !this.players.get(this.localId)!.state.alive); }

  private disposeProjectile(projectile: ProjectileVisual): void {
    this.scene.remove(projectile.mesh, projectile.trail);
    this.disposeObject(projectile.mesh);
    projectile.trail.geometry.dispose();
    this.disposeMaterial(projectile.trail.material);
  }

  private disposeParticle(particle: Particle): void {
    this.scene.remove(particle.mesh);
    if (particle.mesh.geometry !== particleGeometry) particle.mesh.geometry.dispose();
    if (!particle.mesh.userData.sharedParticleMaterial) this.disposeMaterial(particle.mesh.material);
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      const renderable = child as THREE.Mesh | THREE.Line | THREE.Points;
      renderable.geometry?.dispose();
      if (renderable.material) this.disposeMaterial(renderable.material);
    });
  }

  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else {
      const textured = material as THREE.Material & { map?: THREE.Texture | null };
      textured.map?.dispose();
      material.dispose();
    }
  }

  private resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pixelRatioCap));
  }
}
