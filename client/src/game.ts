import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  BALANCE,
  PLANET_PALETTES,
  add,
  cannonPosition,
  clamp,
  cross,
  distance,
  dot,
  length,
  launchLandingPosition,
  launchPadNormal,
  launchPadPosition,
  launchVelocity,
  normalize,
  projectOnPlane,
  repairPosition,
  scale,
  sub,
  type PlanetState,
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

type PlanetVisual = {
  group: THREE.Group;
  shell: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  cracks: THREE.Group;
  props: THREE.Group;
  damageDebris: THREE.Group;
  cannon: THREE.Group;
  barrel: THREE.Group;
  muzzle: THREE.Mesh;
  repair: THREE.Group;
  launchPad: THREE.Group;
  launchRing: THREE.Mesh;
  launchHighlight: THREE.Group;
  cannonJam: THREE.Group;
  repairJam: THREE.Group;
  baseColor: THREE.Color;
  recoil: number;
  repairPulse: number;
  launchPulse: number;
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
  flightTrail: THREE.Line;
  flightTrailPoints: THREE.Vector3[];
  intruderMarker: THREE.Group;
  shoveUntil: number;
  hitPulse: number;
};
type ProjectileVisual = { mesh: THREE.Group; velocity: THREE.Vector3; weapon: WeaponType; trail: THREE.Line; trailPoints: THREE.Vector3[]; maxTrailPoints: number };
type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number };

const vec = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z);
const plain = (v: THREE.Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
const particleGeometry = new THREE.IcosahedronGeometry(0.12, 0);

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
  onPrompt?: (text: string, aiming: boolean, label?: string) => void;

  private physics!: RAPIER.World;
  private room: RoomView | null = null;
  private localId = "";
  private planets = new Map<string, PlanetVisual>();
  private players = new Map<string, PlayerVisual>();
  private scraps = new Map<string, THREE.Group>();
  private projectiles = new Map<string, ProjectileVisual>();
  private particles: Particle[] = [];
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0.2;
  private inputSequence = 0;
  private inputAccumulator = 0;
  private cameraForward = new THREE.Vector3(0, 0, -1);
  private localPosition = new THREE.Vector3();
  private localVelocity = new THREE.Vector3();
  private correction = new THREE.Vector3();
  private localInitialized = false;
  private jumpLatch = false;
  private burstLatch = false;
  private grappleHeld = false;
  private grapplePoint: THREE.Vector3 | null = null;
  private launchAiming = false;
  private launchSourcePlanetId: string | null = null;
  private launchTargetPlanetId: string | null = null;
  private activeSabotage: { planetId: string; structure: StructureType; startedAt: number } | null = null;
  private localLaunchTargetPlanetId: string | null = null;
  private localLaunchSourcePlanetId: string | null = null;
  private localLaunchAssistUntil = 0;
  private lastLocalBurst = 0;
  private lastFrame = performance.now();
  private demo = new THREE.Group();
  private demoTime = 0;
  private rope: THREE.Line;
  private trajectory: THREE.Line;
  private shake = 0;
  private spectatorIndex = 0;
  private wasGrounded = false;
  private mode: "home" | "lobby" | "match" | "results" = "home";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
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
    this.scene.add(this.rope);
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
      this.trajectory.visible = false;
      this.rope.visible = false;
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

  setLocalId(id: string): void { this.localId = id; this.localInitialized = false; }

  setRoom(room: RoomView): void {
    this.room = room;
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
    scraps: RoomView["scraps"];
    launchPads: { planetId: string; position: Vec3 }[];
    cannons: { planetId: string; position: Vec3 }[];
    repairs: { planetId: string; position: Vec3 }[];
  } {
    return {
      localId: this.localId,
      localPosition: plain(this.localPosition),
      cameraForward: plain(this.cameraForward),
      players: this.room?.players.map((player) => ({ ...player, position: { ...player.position }, velocity: { ...player.velocity }, rotation: { ...player.rotation } })) ?? [],
      planets: this.room?.planets.map((planet) => ({ ...planet, position: { ...planet.position } })) ?? [],
      scraps: this.room?.scraps.map((scrap) => ({ ...scrap, position: { ...scrap.position } })) ?? [],
      launchPads: this.room?.planets.map((planet) => ({ planetId: planet.id, position: launchPadPosition(planet) })) ?? [],
      cannons: this.room?.planets.map((planet) => ({ planetId: planet.id, position: cannonPosition(planet) })) ?? [],
      repairs: this.room?.planets.map((planet) => ({ planetId: planet.id, position: repairPosition(planet) })) ?? []
    };
  }

  applySnapshot(snapshot: ServerSnapshot): void {
    if (!this.room) return;
    this.room.phase = snapshot.phase;
    this.room.matchEndsAt = snapshot.matchEndsAt;
    this.room.players = snapshot.players;
    this.room.planets = snapshot.planets;
    this.room.scraps = snapshot.scraps;
    this.syncPlanets(snapshot.planets);
    this.syncPlayers(snapshot.players);
    this.syncScraps(snapshot.scraps);
  }

  spawnProjectile(projectile: ProjectileState): void {
    if (this.projectiles.has(projectile.id)) return;
    const group = this.makeProjectile(projectile.weapon);
    group.position.copy(vec(projectile.position));
    group.lookAt(group.position.clone().add(vec(projectile.velocity)));
    this.scene.add(group);
    const maxTrailPoints = projectile.weapon === "asteroid" ? 9 : 13;
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxTrailPoints * 3), 3).setUsage(THREE.DynamicDrawUsage));
    trailGeometry.setDrawRange(0, 1);
    const trail = new THREE.Line(
      trailGeometry,
      new THREE.LineBasicMaterial({ color: projectile.weapon === "rocket" ? 0x70f5ff : 0xff7b4d, transparent: true, opacity: 0.72 })
    );
    this.scene.add(trail);
    this.projectiles.set(projectile.id, { mesh: group, velocity: vec(projectile.velocity), weapon: projectile.weapon, trail, trailPoints: [group.position.clone()], maxTrailPoints });
    const ownerPlanet = [...this.planets.values()].find((planet) => planet.state.ownerId === projectile.ownerId);
    if (ownerPlanet) {
      ownerPlanet.recoil = 1;
      (ownerPlanet.muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 5;
      const muzzlePosition = ownerPlanet.muzzle.getWorldPosition(new THREE.Vector3());
      this.spawnBurst(muzzlePosition, [0xffdc4f, 0xffffff, 0x9fb4ca], projectile.weapon === "asteroid" ? 14 : 9, projectile.weapon === "asteroid" ? 5 : 3.5);
    }
    projectile.weapon === "rocket" ? this.audio.rocket() : this.audio.asteroid();
    this.shake = Math.max(this.shake, 0.18);
  }

  explode(payload: { id: string; position: Vec3; weapon: WeaponType }): void {
    const projectile = this.projectiles.get(payload.id);
    if (projectile) this.disposeProjectile(projectile);
    this.projectiles.delete(payload.id);
    const position = vec(payload.position);
    const count = payload.weapon === "asteroid" ? 34 : 22;
    const colors = payload.weapon === "asteroid" ? [0xff794c, 0xffcf57, 0xb67cff] : [0xff496c, 0xffd45c, 0x70f5ff];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
      mesh.scale.setScalar(Math.random() * 1.7 + 0.65);
      mesh.position.copy(position);
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 9 + 3), life: 0.55 + Math.random() * 0.55, maxLife: 1.1 });
    }
    this.audio.explosion(payload.weapon === "asteroid");
    this.shake = payload.weapon === "asteroid" ? 0.8 : 0.48;
    this.spawnPulse(position, colors[1], payload.weapon === "asteroid" ? 2.6 : 1.8);
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

  launchPlayer(payload: { playerId: string; sourcePlanetId: string; targetPlanetId: string; position: Vec3; velocity: Vec3; cooldownUntil: number }): void {
    const player = this.players.get(payload.playerId);
    if (player) {
      player.state.velocity = { ...payload.velocity };
      player.state.surfacePlanetId = null;
      player.state.launchCooldownUntil = payload.cooldownUntil;
    }
    const source = this.planets.get(payload.sourcePlanetId);
    if (source) {
      source.launchPulse = 1;
      const pad = vec(launchPadPosition(source.state));
      this.spawnBurst(pad, [0x70f5ff, 0xffdc4f, 0xffffff], 22, 7);
      this.spawnPulse(pad, 0x70f5ff, 1.45);
    }
    if (payload.playerId === this.localId) {
      this.localPosition.copy(vec(payload.position));
      this.localVelocity.copy(vec(payload.velocity));
      this.correction.set(0, 0, 0);
      this.localLaunchTargetPlanetId = payload.targetPlanetId;
      this.localLaunchSourcePlanetId = payload.sourcePlanetId;
      this.localLaunchAssistUntil = performance.now() + BALANCE.launch.assistMs;
      this.audio.launch();
      this.shake = Math.max(this.shake, 0.52);
    }
  }

  landPlayer(payload: { playerId: string; planetId: string; ownerId: string; intruder: boolean }): void {
    const player = this.players.get(payload.playerId);
    const planet = this.planets.get(payload.planetId);
    if (player) player.state.surfacePlanetId = payload.planetId;
    if (player && planet) {
      const outward = player.group.position.clone().sub(planet.group.position).normalize();
      this.spawnBurst(player.group.position.clone().addScaledVector(outward, -0.65), [0xd7e5ff, 0x9fb4ca, 0x70f5ff], 12, 3.2);
    }
    if (payload.playerId === this.localId) {
      this.localLaunchTargetPlanetId = null;
      this.localLaunchSourcePlanetId = null;
      this.localLaunchAssistUntil = 0;
      this.audio.land();
      this.shake = Math.max(this.shake, 0.24);
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
      this.spawnBurst(target.group.position.clone().add(new THREE.Vector3(0, 1, 0)), [0xffdc4f, 0xffffff, 0xff6b8a], 11, 4.2);
      this.spawnPulse(target.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffdc4f, 0.65);
    }
    if (payload.targetId === this.localId) {
      this.localVelocity.copy(vec(payload.velocity));
      this.correction.set(0, 0, 0);
      this.shake = Math.max(this.shake, 0.38);
    }
    if (payload.attackerId === this.localId || payload.targetId === this.localId) this.audio.shove();
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
  }

  destroyPlanet(planetId: string): void {
    const visual = this.planets.get(planetId);
    if (!visual) return;
    visual.shell.material.emissive.setHex(0xffffff);
    visual.shell.material.emissiveIntensity = 3;
    visual.group.scale.setScalar(1.04);
    visual.shell.visible = false;
    visual.cannon.visible = false;
    visual.repair.visible = false;
    visual.launchPad.visible = false;
    visual.launchHighlight.visible = false;
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(Math.random() * 1.4 + 0.55, 0),
        new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0xff794c : visual.shell.material.color, roughness: 0.9, flatShading: true })
      );
      mesh.position.copy(visual.group.position).add(new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 4));
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 7 + 2), life: 4 + Math.random() * 2, maxLife: 6 });
    }
    this.audio.explosion(true);
    this.shake = 1.4;
    this.spawnPulse(visual.group.position, 0xffd25c, 4.5);
  }

  resetVisualEffects(): void {
    for (const particle of this.particles) this.disposeParticle(particle);
    this.particles = [];
    for (const shot of this.projectiles.values()) this.disposeProjectile(shot);
    this.projectiles.clear();
    for (const planet of this.planets.values()) {
      for (const child of [...planet.cracks.children]) if (!child.userData.stageMark) { planet.cracks.remove(child); this.disposeObject(child); }
      planet.shell.visible = true; planet.cannon.visible = true; planet.repair.visible = true; planet.launchPad.visible = true; planet.props.visible = true;
      planet.launchHighlight.visible = false;
      planet.group.scale.setScalar(1); planet.shell.material.emissive.setHex(0x000000);
    }
  }

  private setupScene(): void {
    const ambient = new THREE.HemisphereLight(0xb9e2ff, 0x35245c, 2.55);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff0d0, 3.2);
    sun.position.set(-35, 46, 28);
    this.scene.add(sun);
    const rim = new THREE.PointLight(0x8d5cff, 90, 110, 2);
    rim.position.set(30, -8, -35);
    this.scene.add(rim);

    const starCount = 1500;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const p = new THREE.Vector3().randomDirection().multiplyScalar(90 + Math.random() * 190);
      positions.set([p.x, p.y, p.z], i * 3);
      const c = new THREE.Color(i % 7 === 0 ? 0xffb3e7 : i % 5 === 0 ? 0x83eaff : 0xffffff);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.32, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true }));
    this.scene.add(stars);

    const dustPositions = new Float32Array(360 * 3);
    for (let i = 0; i < 360; i++) {
      const point = new THREE.Vector3().randomDirection().multiplyScalar(45 + Math.random() * 60);
      dustPositions.set([point.x, point.y, point.z], i * 3);
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    this.scene.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0x7a64c9, size: 0.8, transparent: true, opacity: 0.16, depthWrite: false })));

    for (const [position, color, radius] of [
      [new THREE.Vector3(-62, 28, -95), 0x6f45c7, 13],
      [new THREE.Vector3(78, -22, -120), 0x1aa5b8, 18],
      [new THREE.Vector3(10, 58, -150), 0xe05491, 9]
    ] as const) {
      const distant = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, fog: false }));
      distant.position.copy(position); this.scene.add(distant);
    }
  }

  private createDemo(): void {
    const a = this.makePlanet({ id: "demo-a", ownerId: "", position: { x: 13, y: -2, z: -4 }, integrity: 100, alive: true, palette: 0, damageStage: 0, cannonDisabledUntil: 0, repairDisabledUntil: 0 });
    a.group.scale.setScalar(1.25);
    const b = this.makePlanet({ id: "demo-b", ownerId: "", position: { x: -12, y: 3, z: -18 }, integrity: 58, alive: true, palette: 3, damageStage: 2, cannonDisabledUntil: 0, repairDisabledUntil: 0 });
    b.group.scale.setScalar(0.7);
    this.demo.add(a.group, b.group);
    const astronaut = this.makePlayer({ id: "demo", name: "", isBot: false, color: "#ffdc4f", planetId: "", connected: true, ready: true, alive: true, scrap: 0, position: { x: 13, y: 9.5, z: -4 }, velocity: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, lastInputSequence: 0, surfacePlanetId: "demo-a", launchCooldownUntil: 0, shoveCooldownUntil: 0 });
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
      const variation = Math.sin(point.x * 11 + point.z * 7) * .065
        + Math.sin(point.y * 13 - point.x * 5) * .045
        + Math.cos((point.x + point.y + point.z) * 17) * .025;
      point.multiplyScalar(BALANCE.planetRadius + variation);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    shellGeometry.computeVertexNormals();
    const baseColor = new THREE.Color(palette.ground);
    const shell = new THREE.Mesh(
      shellGeometry,
      new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.82, metalness: 0.02, flatShading: true })
    );
    shell.castShadow = false; shell.receiveShadow = false;
    group.add(shell);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(BALANCE.planetRadius * 1.035, 32, 18),
      new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.1, side: THREE.BackSide, depthWrite: false })
    );
    group.add(atmosphere);
    const cracks = new THREE.Group(); group.add(cracks);
    for (let stage = 1; stage <= 3; stage++) {
      const scar = new THREE.Mesh(
        new THREE.TorusGeometry(BALANCE.planetRadius + 0.05, 0.035 + stage * 0.015, 4, 28, Math.PI * (0.55 + stage * 0.12)),
        new THREE.MeshBasicMaterial({ color: stage === 3 ? 0xff6c4c : 0x372039, transparent: true, opacity: 0.72, depthWrite: false })
      );
      scar.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      scar.visible = state.damageStage >= stage;
      scar.userData.stageMark = stage;
      cracks.add(scar);
    }

    const cannon = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0x30375c, metalness: 0.45, roughness: 0.5, flatShading: true }));
    const barrelRig = new THREE.Group(); barrelRig.position.y = 1.4;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.58, 3.4, 10), new THREE.MeshStandardMaterial({ color: 0x697399, metalness: 0.55, roughness: 0.35 }));
    barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.8;
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.15, 6, 12), new THREE.MeshStandardMaterial({ color: 0xffdc4f, emissive: 0x7a3b00, emissiveIntensity: 1.1 }));
    muzzle.position.set(0, 0, -2.45); muzzle.rotation.x = Math.PI / 2;
    const braceMaterial = new THREE.MeshStandardMaterial({ color: 0x485173, metalness: 0.55, roughness: 0.42 });
    const leftBrace = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.45, 0.28), braceMaterial); leftBrace.position.set(-0.72, 0.68, 0);
    const rightBrace = leftBrace.clone(); rightBrace.position.x = 0.72;
    barrelRig.add(barrel, muzzle);
    cannon.add(base, leftBrace, rightBrace, barrelRig); cannon.position.set(0, BALANCE.planetRadius + 0.15, 0); group.add(cannon);

    const repair = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), new THREE.MeshStandardMaterial({ color: 0x70f5ff, emissive: 0x247a91, emissiveIntensity: 1.5, metalness: 0.25 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 8, 20), new THREE.MeshStandardMaterial({ color: 0xa4b2e6, metalness: 0.5 }));
    ring.rotation.y = Math.PI / 2; repair.add(core, ring); repair.position.set(BALANCE.planetRadius + 0.65, 0, 0); repair.rotation.z = -Math.PI / 2; group.add(repair);

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
    for (const x of [-0.88, 0.88]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.3), armMaterial);
      arm.position.set(x, 0.28, 0.05); arm.rotation.z = x * -0.22; launchPad.add(arm);
    }
    launchPad.add(platform, launchRing, arrowStem, arrowHead);
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

    const props = new THREE.Group(); group.add(props);
    const damageDebris = new THREE.Group(); group.add(damageDebris);
    const propMaterial = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.85, flatShading: true, emissive: state.palette === 3 || state.palette === 5 ? palette.rock : 0x000000, emissiveIntensity: 0.18 });
    const rockMaterial = new THREE.MeshStandardMaterial({ color: palette.rock, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 22; i++) {
      const normal = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
      if (Math.abs(normal.y) > 0.82 || normal.x > 0.88 || normal.dot(padNormal) > 0.86) continue;
      let prop: THREE.Object3D;
      let height = 0.22;
      if (state.palette === 0 || state.palette === 4) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.68, 6), rockMaterial); trunk.position.y = 0.34;
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + random() * 0.2, 1), propMaterial); crown.position.y = 0.9;
        tree.add(trunk, crown); prop = tree; height = 0.08;
      } else if (state.palette === 1) {
        prop = i % 3 === 0 ? new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 1.15, 6), propMaterial) : new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + random() * 0.38, 0), rockMaterial);
        height = i % 3 === 0 ? 0.56 : 0.2;
      } else if (state.palette === 2 || state.palette === 5) {
        prop = new THREE.Mesh(new THREE.ConeGeometry(0.24 + random() * 0.22, 1 + random() * 1.1, 5), i % 3 === 0 ? propMaterial : rockMaterial); height = 0.62;
      } else {
        prop = i % 4 === 0 ? new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.1, 5, 10), propMaterial) : new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + random() * 0.42, 0), rockMaterial); height = 0.22;
      }
      prop.position.copy(normal.clone().multiplyScalar(BALANCE.planetRadius + height));
      prop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      prop.rotateY(random() * Math.PI * 2);
      prop.traverse((child) => { child.castShadow = true; }); props.add(prop);
    }
    for (let i = 0; i < 7; i++) {
      const fragment = new THREE.Mesh(new THREE.DodecahedronGeometry(.13 + random() * .18, 0), rockMaterial);
      fragment.position.set((random() * 2 - 1) * 10, (random() * 2 - 1) * 10, (random() * 2 - 1) * 10).normalize().multiplyScalar(BALANCE.planetRadius + 1.15 + random() * .75);
      fragment.visible = false; fragment.userData.damageLevel = 1 + i % 3; damageDebris.add(fragment);
    }
    return {
      group, shell, cracks, props, damageDebris, cannon, barrel: barrelRig, muzzle, repair,
      launchPad, launchRing, launchHighlight, cannonJam, repairJam,
      baseColor, recoil: 0, repairPulse: 0, launchPulse: 0, state
    };
  }

  private makePlayer(state: PlayerState): PlayerVisual {
    const group = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: state.color, roughness: 0.65, flatShading: true });
    const white = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, roughness: 0.55 });
    const visor = new THREE.MeshStandardMaterial({ color: 0x14294b, metalness: 0.75, roughness: 0.2, emissive: 0x0b3760, emissiveIntensity: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.55, 5, 9), suit); body.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), white); head.position.y = 1.45;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.39, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), visor); face.position.set(0, 1.46, 0.28); face.scale.set(0.94, 0.74, 0.42);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.3), suit); pack.position.set(0, 0.85, -0.43);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x70f5ff, emissive: 0x174c64, emissiveIntensity: 0.8 })); tank.position.set(0.22, 0.85, -0.61);
    const limbGeometry = new THREE.CapsuleGeometry(0.115, 0.42, 3, 6);
    const bootGeometry = new THREE.SphereGeometry(0.23, 8, 6);
    const makeLeg = (x: number) => { const rig = new THREE.Group(); rig.position.set(x, 0.48, 0); const leg = new THREE.Mesh(limbGeometry, suit); leg.position.y = -0.24; const boot = new THREE.Mesh(bootGeometry, white); boot.position.set(0, -0.57, 0.1); boot.scale.set(1, .7, 1.4); rig.add(leg, boot); return rig; };
    const makeArm = (x: number) => { const rig = new THREE.Group(); rig.position.set(x, 1.02, 0); const arm = new THREE.Mesh(limbGeometry, suit); arm.position.y = -0.24; const glove = new THREE.Mesh(new THREE.SphereGeometry(.15, 7, 5), white); glove.position.y = -.55; rig.add(arm, glove); rig.rotation.z = x > 0 ? -.16 : .16; return rig; };
    const leftLeg = makeLeg(-0.25); const rightLeg = makeLeg(0.25); const leftArm = makeArm(-0.55); const rightArm = makeArm(0.55);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .42, 5), white); antenna.position.set(.3, 1.95, -.05); antenna.rotation.z = -.2;
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 4), new THREE.MeshBasicMaterial({ color: state.isBot ? 0xff7f9b : 0x70f5ff })); antennaTip.position.set(.34, 2.16, -.05);
    for (const mesh of [body, head, face, pack, tank, antenna, antennaTip]) { mesh.castShadow = true; group.add(mesh); }
    group.add(leftLeg, rightLeg, leftArm, rightArm);
    const intruderMarker = new THREE.Group();
    const markerDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: state.color }));
    markerDiamond.position.y = 2.75; intruderMarker.add(markerDiamond);
    const labelCanvas = document.createElement("canvas"); labelCanvas.width = 256; labelCanvas.height = 64;
    const labelContext = labelCanvas.getContext("2d")!;
    labelContext.fillStyle = "rgba(7,9,30,.82)"; labelContext.fillRect(0, 7, 256, 50);
    labelContext.strokeStyle = state.color; labelContext.lineWidth = 4; labelContext.strokeRect(2, 9, 252, 46);
    labelContext.fillStyle = "#ffffff"; labelContext.font = "bold 27px Trebuchet MS"; labelContext.textAlign = "center"; labelContext.textBaseline = "middle";
    labelContext.fillText(state.name.toUpperCase(), 128, 33, 230);
    const labelTexture = new THREE.CanvasTexture(labelCanvas); labelTexture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }));
    label.position.y = 3.25; label.scale.set(3.2, 0.8, 1); intruderMarker.add(label); intruderMarker.visible = false; group.add(intruderMarker);
    group.position.copy(vec(state.position));
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    trailGeometry.setDrawRange(0, 0);
    const flightTrail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: state.color, transparent: true, opacity: 0.72 }));
    flightTrail.visible = false;
    return {
      group, target: group.position.clone(), state, leftArm, rightArm, leftLeg, rightLeg,
      flightTrail, flightTrailPoints: [], intruderMarker, shoveUntil: 0, hitPulse: 0
    };
  }

  private makeScrap(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0xffdc4f, emissive: 0xa84d00, emissiveIntensity: 1.2, metalness: 0.55, roughness: 0.25 });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.43, 0), material);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 5, 12), new THREE.MeshBasicMaterial({ color: 0xffed9b }));
    ring.rotation.x = Math.PI / 2;
    group.add(crystal, ring);
    return group;
  }

  private makeProjectile(weapon: WeaponType): THREE.Group {
    const group = new THREE.Group();
    if (weapon === "rocket") {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.45, 8), new THREE.MeshStandardMaterial({ color: 0xf1f5ff, metalness: 0.3, roughness: 0.4 }));
      body.rotation.x = Math.PI / 2;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.52, 8), new THREE.MeshStandardMaterial({ color: 0xff547d, emissive: 0x55111f }));
      nose.rotation.x = -Math.PI / 2; nose.position.z = -0.98;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 7), new THREE.MeshBasicMaterial({ color: 0x70f5ff, transparent: true, opacity: 0.85 }));
      flame.rotation.x = Math.PI / 2; flame.position.z = 1.05;
      group.add(body, nose, flame);
    } else {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: 0x8e5779, emissive: 0x59223b, emissiveIntensity: 0.8, roughness: 0.9, flatShading: true }));
      const glow = new THREE.PointLight(0xff704c, 15, 8); group.add(rock, glow);
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
      visual.shell.material.color.copy(visual.baseColor).lerp(new THREE.Color(0x33243c), state.damageStage * 0.13);
      for (const mark of visual.cracks.children) if (mark.userData.stageMark) mark.visible = state.damageStage >= mark.userData.stageMark;
      visual.props.children.forEach((prop, index) => { prop.visible = state.alive && (state.damageStage < 2 || index % (state.damageStage === 2 ? 4 : 2) !== 0); });
      visual.damageDebris.children.forEach((fragment) => { fragment.visible = state.alive && state.damageStage >= fragment.userData.damageLevel; });
      visual.props.rotation.z = state.damageStage >= 3 ? Math.sin(this.demoTime * 2 + state.palette) * 0.007 : 0;
      visual.props.visible = state.alive;
      if (!state.alive) { visual.shell.visible = false; visual.cannon.visible = false; visual.repair.visible = false; visual.launchPad.visible = false; visual.launchHighlight.visible = false; }
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
      visual.target.copy(vec(state.position));
      visual.group.visible = state.alive && (this.mode === "match" || this.mode === "results");
      visual.intruderMarker.visible = Boolean(state.alive && state.surfacePlanetId && state.surfacePlanetId !== state.planetId && this.mode === "match");
      if (state.id === this.localId) {
        if (!this.localInitialized) {
          this.localPosition.copy(visual.target); this.localVelocity.copy(vec(state.velocity)); this.localInitialized = true;
        } else {
          const error = visual.target.clone().sub(this.localPosition);
          if (error.length() > 5) this.localPosition.copy(visual.target);
          else this.correction.copy(error).multiplyScalar(0.15);
          this.localVelocity.lerp(vec(state.velocity), 0.08);
        }
      }
    }
    for (const [id, visual] of this.players) if (!states.some((s) => s.id === id)) {
      this.scene.remove(visual.group, visual.flightTrail); this.disposeObject(visual.group);
      visual.flightTrail.geometry.dispose(); this.disposeMaterial(visual.flightTrail.material); this.players.delete(id);
    }
  }

  private syncScraps(states: RoomView["scraps"]): void {
    for (const state of states) {
      if (!this.scraps.has(state.id)) { const mesh = this.makeScrap(); mesh.position.copy(vec(state.position)); this.scene.add(mesh); this.scraps.set(state.id, mesh); }
    }
    for (const [id, mesh] of this.scraps) if (!states.some((s) => s.id === id)) { this.scene.remove(mesh); this.disposeObject(mesh); this.scraps.delete(id); }
  }

  private bindControls(): void {
    addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (event.code === "Space") { event.preventDefault(); this.jumpLatch = true; }
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") this.burstLatch = true;
      if (event.code === "KeyQ" && !this.launchAiming) this.toggleWeapon();
      if (event.code === "KeyR" && this.mode === "match") this.onRepair?.();
      if (event.code === "KeyE" && this.mode === "match" && !event.repeat) this.handleInteractDown();
      if (event.code === "Escape" && this.launchAiming) this.cancelLaunchAim();
      if ((event.code === "ArrowLeft" || event.code === "ArrowRight") && this.isSpectating()) this.spectatorIndex += event.code === "ArrowLeft" ? -1 : 1;
    });
    addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      if (event.code === "KeyE" && this.activeSabotage) {
        this.onInteract?.({ action: "sabotage", planetId: this.activeSabotage.planetId, structure: this.activeSabotage.structure, active: false });
        this.activeSabotage = null;
      }
    });
    addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas || this.mode !== "match") return;
      this.yaw -= event.movementX * 0.0022;
      this.pitch = clamp(this.pitch - event.movementY * 0.0018, -0.28, 1.02);
    });
    this.canvas.addEventListener("click", () => {
      this.audio.unlock();
      if (this.mode === "match" && document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock();
    });
    this.canvas.addEventListener("mousedown", (event) => {
      if (this.mode !== "match" || document.pointerLockElement !== this.canvas) return;
      if (event.button === 0 && !this.launchAiming && this.nearOwnCannon()) this.onFire?.(this.weapon, plain(this.cameraForward));
      if (event.button === 2) { this.grappleHeld = true; this.grapplePoint = this.findGrapplePoint(); if (this.grapplePoint) this.audio.grapple(); }
    });
    addEventListener("mouseup", (event) => { if (event.button === 2) { this.grappleHeld = false; this.grapplePoint = null; } });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  private frame(now: number): void {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.demoTime += dt;
    if (this.mode === "home" || this.mode === "lobby") this.updateDemo(dt);
    else this.updateMatch(dt, now);
    this.updateEffects(dt);
    if (this.physics) this.physics.step();
    this.renderer.render(this.scene, this.camera);
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

  private updateMatch(dt: number, now: number): void {
    const local = this.players.get(this.localId);
    if (!local || !this.room) return;
    if (!local.state.alive) { this.updateSpectator(dt); return; }
    this.predictLocal(dt, now);
    local.group.position.copy(this.localPosition);
    const planet = this.nearestPlanet(this.localPosition, true);
    if (!planet) return;
    const outward = this.localPosition.clone().sub(planet.group.position).normalize();
    const yawAxis = outward;
    const reference = Math.abs(outward.y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const baseForward = new THREE.Vector3().crossVectors(reference, outward).normalize();
    this.cameraForward.copy(baseForward.applyAxisAngle(yawAxis, this.yaw));
    const right = new THREE.Vector3().crossVectors(this.cameraForward, outward).normalize();
    this.cameraForward.applyAxisAngle(right, this.pitch).normalize();

    const planarForward = this.cameraForward.clone().projectOnPlane(outward).normalize();
    const facing = this.localVelocity.clone().projectOnPlane(outward);
    const modelForward = facing.lengthSq() > 0.2 ? facing.normalize() : planarForward;
    this.orientPlayer(local.group, outward, modelForward);
    const flightAmount = clamp((this.localVelocity.length() - 8) / 12, 0, 1) * (local.state.surfacePlanetId ? 0.35 : 1);
    const destination = this.localLaunchTargetPlanetId ? this.planets.get(this.localLaunchTargetPlanetId) : undefined;
    const destinationDirection = destination ? destination.group.position.clone().sub(this.localPosition).normalize() : new THREE.Vector3();
    const desired = this.localPosition.clone().addScaledVector(outward, 4.1 + flightAmount * 2.2).addScaledVector(this.cameraForward, -8.6 - flightAmount * 4.5);
    const cameraCollision = this.preventCameraClip(desired, this.localPosition, planet.group.position);
    this.camera.position.lerp(cameraCollision, 1 - Math.exp(-dt * (flightAmount > 0.15 ? 5 : 8)));
    this.camera.up.lerp(outward, 1 - Math.exp(-dt * 10)).normalize();
    const shakeOffset = new THREE.Vector3().randomDirection().multiplyScalar(this.shake * 0.25);
    this.camera.position.add(shakeOffset);
    this.camera.lookAt(this.localPosition.clone().addScaledVector(outward, 1.1).addScaledVector(planarForward, 1.6).addScaledVector(destinationDirection, flightAmount * 2.7));
    const targetFov = 58 + flightAmount * 8;
    if (Math.abs(this.camera.fov - targetFov) > 0.02) { this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-dt * 5)); this.camera.updateProjectionMatrix(); }

    for (const [id, player] of this.players) {
      if (id === this.localId) continue;
      player.group.position.lerp(player.target, 1 - Math.exp(-dt * 12));
      const nearest = this.nearestPlanet(player.group.position, true);
      if (nearest) {
        const up = player.group.position.clone().sub(nearest.group.position).normalize();
        const velocity = vec(player.state.velocity).projectOnPlane(up);
        this.orientPlayer(player.group, up, velocity.lengthSq() > 0.1 ? velocity.normalize() : new THREE.Vector3(0, 0, 1).projectOnPlane(up).normalize());
      }
    }
    this.updateContext();
  }

  private predictLocal(dt: number, now: number): void {
    const planet = this.nearestPlanet(this.localPosition, true);
    if (!planet) return;
    const outward = this.localPosition.clone().sub(planet.group.position).normalize();
    const altitude = this.localPosition.distanceTo(planet.group.position) - BALANCE.planetRadius;
    const grounded = altitude <= 1.25;
    const tangentCamera = this.cameraForward.clone().projectOnPlane(outward).normalize();
    const right = new THREE.Vector3().crossVectors(tangentCamera, outward).normalize();
    const moveX = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const moveY = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const move = right.multiplyScalar(moveX).add(tangentCamera.multiplyScalar(moveY));
    if (move.lengthSq() > 1) move.normalize();
    const tangentVelocity = this.localVelocity.clone().projectOnPlane(outward);
    const desired = move.multiplyScalar(BALANCE.moveSpeed);
    tangentVelocity.lerp(desired, clamp(BALANCE.acceleration * (grounded ? 1 : BALANCE.airControl) * dt / BALANCE.moveSpeed, 0, 1));
    let radialSpeed = this.localVelocity.dot(outward) - BALANCE.gravity * dt;
    if (this.jumpLatch && grounded) { radialSpeed = BALANCE.jumpSpeed; this.audio.jump(); this.spawnThruster(this.localPosition, outward, 8); }
    this.localVelocity.copy(tangentVelocity).addScaledVector(outward, radialSpeed);
    if (this.burstLatch && now - this.lastLocalBurst > BALANCE.burstCooldownMs) {
      this.lastLocalBurst = now;
      this.localVelocity.addScaledVector(desired.lengthSq() ? desired.clone().normalize() : this.cameraForward, BALANCE.burstSpeed);
      this.audio.burst(); this.spawnThruster(this.localPosition, desired.lengthSq() ? desired.clone().normalize().negate() : this.cameraForward.clone().negate(), 14);
    }
    if (this.grappleHeld && this.grapplePoint) {
      const rope = this.grapplePoint.clone().sub(this.localPosition);
      const ropeLength = rope.length();
      this.localVelocity.addScaledVector(rope.normalize(), BALANCE.grapplePull * dt * clamp(ropeLength / 8, .5, 2));
    }
    const launchTarget = this.localLaunchTargetPlanetId ? this.planets.get(this.localLaunchTargetPlanetId) : undefined;
    const launchSource = this.localLaunchSourcePlanetId ? this.planets.get(this.localLaunchSourcePlanetId) : undefined;
    if (launchTarget && launchSource && now < this.localLaunchAssistUntil) {
      const guide = vec(launchLandingPosition(launchSource.state, launchTarget.state)).sub(this.localPosition).normalize();
      this.localVelocity.addScaledVector(guide, BALANCE.launch.assist * dt);
      const maxLaunchSpeed = BALANCE.launch.speed * 1.12;
      if (this.localVelocity.length() > maxLaunchSpeed) this.localVelocity.setLength(maxLaunchSpeed);
    }
    this.localPosition.addScaledVector(this.localVelocity, dt).add(this.correction);
    this.correction.multiplyScalar(0.7);
    const nextUp = this.localPosition.clone().sub(planet.group.position).normalize();
    const minDistance = BALANCE.planetRadius + 0.95;
    if (this.localPosition.distanceTo(planet.group.position) < minDistance) {
      this.localPosition.copy(planet.group.position).addScaledVector(nextUp, minDistance);
      const inward = this.localVelocity.dot(nextUp);
      if (inward < 0) this.localVelocity.addScaledVector(nextUp, -inward);
    }
    if (grounded && !this.wasGrounded && this.localVelocity.length() > 2.5) { this.audio.land(); this.shake = Math.max(this.shake, .12); }
    this.wasGrounded = grounded;
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
    if (this.rope.visible && this.grapplePoint) {
      this.rope.geometry.setFromPoints([this.localPosition.clone().addScaledVector(nextUp, 1), this.grapplePoint]);
    }
  }

  private updateContext(): void {
    const local = this.players.get(this.localId);
    const ownPlanet = local ? this.planets.get(local.state.planetId) : undefined;
    if (!local || !ownPlanet) return;
    for (const planet of this.planets.values()) planet.launchHighlight.visible = false;
    if (this.room?.phase === "countdown") {
      this.trajectory.visible = false;
      this.onPrompt?.("Get ready", false);
      return;
    }

    if (this.activeSabotage) {
      const planet = this.planets.get(this.activeSabotage.planetId);
      const position = planet ? vec(this.activeSabotage.structure === "cannon" ? cannonPosition(planet.state) : repairPosition(planet.state)) : null;
      if (!planet || !this.keys.has("KeyE") || !position || position.distanceTo(this.localPosition) > BALANCE.sabotage.range + 0.2) {
        this.onInteract?.({ action: "sabotage", planetId: this.activeSabotage.planetId, structure: this.activeSabotage.structure, active: false });
        this.activeSabotage = null;
      } else {
        this.trajectory.visible = false;
        const progress = clamp((performance.now() - this.activeSabotage.startedAt) / BALANCE.sabotage.channelMs, 0, 1);
        this.onPrompt?.(`HOLD E · JAMMING ${Math.round(progress * 100)}%`, false);
        return;
      }
    }

    if (this.launchAiming) {
      const source = this.launchSourcePlanetId ? this.planets.get(this.launchSourcePlanetId) : undefined;
      if (!source?.state.alive || this.localPosition.distanceTo(vec(launchPadPosition(source.state))) > BALANCE.launch.range + 0.8) {
        this.cancelLaunchAim();
      } else {
        const target = this.selectLaunchTarget(source.state.id);
        this.launchTargetPlanetId = target?.state.id ?? null;
        if (target) {
          target.launchHighlight.visible = true;
          this.updateLaunchTrajectory(source, target);
          const owner = this.room?.players.find((player) => player.id === target.state.ownerId);
          this.onPrompt?.(`E · Launch to ${owner?.name ?? "planet"}   Esc · Cancel`, true, `LAUNCH · ${owner?.name?.toUpperCase() ?? "TARGET"}`);
          return;
        }
      }
    }

    this.trajectory.visible = false;
    const enemyStructure = this.nearbyEnemyStructure();
    if (enemyStructure) {
      this.onPrompt?.(`HOLD E · JAM ${enemyStructure.structure === "cannon" ? "CANNON" : "REPAIR CORE"}`, false);
      return;
    }
    const shoveTarget = this.nearbyPlayer();
    if (shoveTarget) {
      this.onPrompt?.(`E · Shove ${shoveTarget.state.name}`, false);
      return;
    }
    const launchPad = this.nearbyLaunchPad();
    if (launchPad) {
      const cooldown = Math.max(0, (local.state.launchCooldownUntil - Date.now()) / 1000);
      this.onPrompt?.(cooldown > 0 ? `Launch recharging · ${cooldown.toFixed(1)}s` : "E · Launch", false);
      return;
    }

    const nearCannon = this.nearOwnCannon();
    const nearRepair = distance(plain(this.localPosition), repairPosition(ownPlanet.state)) < 4;
    if (nearCannon && ownPlanet.state.cannonDisabledUntil > Date.now()) {
      this.onPrompt?.(`CANNON JAMMED · ${Math.ceil((ownPlanet.state.cannonDisabledUntil - Date.now()) / 1000)}s`, false);
    } else if (nearRepair && ownPlanet.state.repairDisabledUntil > Date.now()) {
      this.onPrompt?.(`REPAIR CORE JAMMED · ${Math.ceil((ownPlanet.state.repairDisabledUntil - Date.now()) / 1000)}s`, false);
    } else if (nearCannon) {
      const origin = vec(cannonPosition(ownPlanet.state)).addScaledVector(this.cameraForward, 1.8);
      const points = Array.from({ length: 20 }, (_, i) => origin.clone().addScaledVector(this.cameraForward, i * 1.25));
      this.trajectory.geometry.setFromPoints(points);
      (this.trajectory as THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>).computeLineDistances();
      const flatAim = this.cameraForward.clone().projectOnPlane(new THREE.Vector3(0, 1, 0)).normalize();
      if (flatAim.lengthSq() > 0.1) ownPlanet.cannon.rotation.y = Math.atan2(-flatAim.x, -flatAim.z);
      this.trajectory.visible = true;
      this.onPrompt?.("LMB · Fire cannon", true, `${this.weapon === "rocket" ? "ROCKET" : "ASTEROID"} · ${BALANCE.weapons[this.weapon].cost} SCRAP`);
    } else if (nearRepair) this.onPrompt?.(`R · Repair ${BALANCE.repair.heal} integrity for ${BALANCE.repair.cost} scrap`, false);
    else if (document.pointerLockElement !== this.canvas) this.onPrompt?.("Click the arena to take control", false);
    else this.onPrompt?.("Collect scrap · Raid rival planets · Defend your world", false);
  }

  private handleInteractDown(): void {
    if (!this.room || (this.room.phase !== "playing" && this.room.phase !== "overtime")) return;
    if (this.launchAiming) {
      if (this.launchTargetPlanetId) this.onInteract?.({ action: "launch", targetPlanetId: this.launchTargetPlanetId });
      this.cancelLaunchAim();
      return;
    }
    const structure = this.nearbyEnemyStructure();
    if (structure) {
      this.activeSabotage = { planetId: structure.planet.state.id, structure: structure.structure, startedAt: performance.now() };
      this.onInteract?.({ action: "sabotage", planetId: structure.planet.state.id, structure: structure.structure, active: true });
      return;
    }
    const shoveTarget = this.nearbyPlayer();
    if (shoveTarget) {
      this.onInteract?.({ action: "shove", targetPlayerId: shoveTarget.state.id });
      return;
    }
    const pad = this.nearbyLaunchPad();
    const local = this.players.get(this.localId);
    if (pad && local && local.state.launchCooldownUntil <= Date.now()) {
      this.launchAiming = true;
      this.launchSourcePlanetId = pad.state.id;
      this.launchTargetPlanetId = this.selectLaunchTarget(pad.state.id)?.state.id ?? null;
      this.audio.click();
    }
  }

  private cancelLaunchAim(): void {
    this.launchAiming = false;
    this.launchSourcePlanetId = null;
    this.launchTargetPlanetId = null;
    this.trajectory.visible = false;
    for (const planet of this.planets.values()) planet.launchHighlight.visible = false;
  }

  private nearbyEnemyStructure(): { planet: PlanetVisual; structure: StructureType; distance: number } | null {
    let nearest: { planet: PlanetVisual; structure: StructureType; distance: number } | null = null;
    const now = Date.now();
    for (const planet of this.planets.values()) {
      if (!planet.state.alive || planet.state.ownerId === this.localId) continue;
      for (const structure of ["cannon", "repair"] as const) {
        const disabledUntil = structure === "cannon" ? planet.state.cannonDisabledUntil : planet.state.repairDisabledUntil;
        if (disabledUntil > now) continue;
        const position = structure === "cannon" ? cannonPosition(planet.state) : repairPosition(planet.state);
        const d = distance(plain(this.localPosition), position);
        if (d <= BALANCE.sabotage.range && (!nearest || d < nearest.distance)) nearest = { planet, structure, distance: d };
      }
    }
    return nearest;
  }

  private nearbyPlayer(): PlayerVisual | null {
    let nearest: PlayerVisual | null = null;
    let nearestDistance: number = BALANCE.shove.range;
    for (const player of this.players.values()) {
      if (!player.state.alive || player.state.id === this.localId) continue;
      const d = player.group.position.distanceTo(this.localPosition);
      if (d <= nearestDistance) { nearest = player; nearestDistance = d; }
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

  private updateLaunchTrajectory(source: PlanetVisual, target: PlanetVisual): void {
    const points: THREE.Vector3[] = [this.localPosition.clone()];
    const position = this.localPosition.clone();
    const velocity = vec(launchVelocity(plain(position), source.state, target.state));
    const landing = vec(launchLandingPosition(source.state, target.state));
    const step = 0.075;
    for (let index = 0; index < 48; index++) {
      const nearest = this.nearestPlanet(position, true);
      if (!nearest) break;
      const outward = position.clone().sub(nearest.group.position).normalize();
      velocity.addScaledVector(outward, -BALANCE.gravity * step);
      if (index * step * 1000 < BALANCE.launch.assistMs) velocity.addScaledVector(landing.clone().sub(position).normalize(), BALANCE.launch.assist * step);
      if (velocity.length() > BALANCE.launch.speed * 1.12) velocity.setLength(BALANCE.launch.speed * 1.12);
      position.addScaledVector(velocity, step);
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
    this.yaw += dt * 0.12;
    const desired = target.clone().add(new THREE.Vector3(Math.cos(this.yaw) * 20, 12, Math.sin(this.yaw) * 20));
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 3));
    this.camera.up.lerp(new THREE.Vector3(0, 1, 0), .05);
    this.camera.lookAt(target);
    this.onPrompt?.("Spectating · ← → cycle surviving planets", false);
  }

  private updateEffects(dt: number): void {
    const wallNow = Date.now();
    const animationNow = performance.now();
    for (const [id, projectile] of this.projectiles) {
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      projectile.mesh.rotation.z += dt * (projectile.weapon === "asteroid" ? 2.2 : 0);
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
    for (const mesh of this.scraps.values()) { mesh.rotation.y += dt * 1.8; mesh.rotation.x += dt * 0.7; mesh.scale.setScalar(1 + Math.sin(this.demoTime * 4 + mesh.position.x) * .08); }
    for (const visual of this.planets.values()) {
      visual.cannon.rotation.y += Math.sin(this.demoTime + visual.group.position.x) * dt * .08;
      visual.repair.rotation.y += dt * 1.1;
      visual.recoil *= Math.pow(.045, dt);
      visual.barrel.position.z = visual.recoil * .72;
      (visual.muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + visual.recoil * 4;
      visual.repairPulse *= Math.pow(.03, dt);
      visual.repair.scale.setScalar(1 + visual.repairPulse * .35);
      visual.launchPulse *= Math.pow(.025, dt);
      const idlePulse = 1 + Math.sin(this.demoTime * 3.2 + visual.state.palette) * .035;
      visual.launchRing.scale.setScalar(idlePulse + visual.launchPulse * .42);
      visual.launchPad.scale.set(1 + visual.launchPulse * .12, 1 - visual.launchPulse * .28, 1 + visual.launchPulse * .12);
      visual.launchHighlight.rotation.y += dt * 0.35;
      visual.launchHighlight.scale.setScalar(1 + Math.sin(this.demoTime * 4) * .015);
      visual.cannonJam.visible = visual.state.cannonDisabledUntil > wallNow;
      visual.repairJam.visible = visual.state.repairDisabledUntil > wallNow;
      if (visual.cannonJam.visible) { visual.cannonJam.rotation.y += dt * 5; visual.cannonJam.rotation.z += dt * 2.2; }
      if (visual.repairJam.visible) { visual.repairJam.rotation.y -= dt * 4.2; visual.repairJam.rotation.x += dt * 1.8; }
      visual.damageDebris.rotation.y += dt * (.08 + visual.state.damageStage * .06);
      visual.damageDebris.rotation.x += dt * .025;
    }
    for (const visual of this.players.values()) {
      const velocity = visual.state.id === this.localId ? this.localVelocity : vec(visual.state.velocity);
      const speed = velocity.length();
      const stride = Math.sin(this.demoTime * (5 + Math.min(speed, 7))) * Math.min(.62, speed * .09);
      visual.leftLeg.rotation.x = stride; visual.rightLeg.rotation.x = -stride;
      visual.leftArm.rotation.x = -stride * .72; visual.rightArm.rotation.x = stride * .72;
      if (animationNow < visual.shoveUntil) { visual.rightArm.rotation.x = -1.7; visual.rightArm.rotation.z = -0.7; }
      else visual.rightArm.rotation.z = -.16;
      if (visual.state.id === this.localId && this.grappleHeld) visual.rightArm.rotation.x = -2.15;
      else if (!visual.state.surfacePlanetId && speed > 10) {
        visual.leftArm.rotation.x = -1.35; visual.rightArm.rotation.x = -1.35;
        visual.leftLeg.rotation.x = .35; visual.rightLeg.rotation.x = .35;
      }
      visual.group.children[0].position.y = .7 + Math.abs(stride) * .045;
      visual.hitPulse *= Math.pow(.025, dt);
      const idleScale = 1 + (speed < .25 ? Math.sin(this.demoTime * 2.4 + visual.group.position.x) * .018 : 0);
      visual.group.scale.set(idleScale + visual.hitPulse * .12, idleScale - visual.hitPulse * .09, idleScale + visual.hitPulse * .12);
      visual.intruderMarker.position.y = Math.sin(this.demoTime * 4 + visual.group.position.x) * .08;
      if (visual.state.isBot) visual.group.rotation.z += Math.sin(this.demoTime * 1.7 + visual.group.position.x) * dt * .025;
      const inFlight = visual.state.alive && !visual.state.surfacePlanetId && speed > 10;
      visual.flightTrail.visible = inFlight && this.mode === "match";
      if (visual.flightTrail.visible) {
        const point = visual.group.position.clone().addScaledVector(velocity.clone().normalize(), -0.8);
        if (!visual.flightTrailPoints.length || point.distanceTo(visual.flightTrailPoints[0]) > .45) visual.flightTrailPoints.unshift(point);
        visual.flightTrailPoints.length = Math.min(visual.flightTrailPoints.length, 12);
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
      particle.mesh.rotation.x += dt * 2; particle.mesh.rotation.y += dt * 1.4;
      const material = particle.mesh.material as THREE.Material & { opacity?: number };
      if (material.opacity !== undefined) material.opacity = clamp(particle.life / Math.min(1, particle.maxLife), 0, 1);
      if (particle.life <= 0) { this.disposeParticle(particle); this.particles.splice(i, 1); }
    }
    while (this.particles.length > 180) this.disposeParticle(this.particles.shift()!);
    this.shake *= Math.pow(0.02, dt);
  }

  private spawnBurst(position: THREE.Vector3, colors: number[], count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 1 }));
      mesh.position.copy(position); mesh.scale.setScalar(.55 + Math.random() * 1.25); this.scene.add(mesh);
      const life = .42 + Math.random() * .45;
      this.particles.push({ mesh, velocity: new THREE.Vector3().randomDirection().multiplyScalar(speed * (.4 + Math.random())), life, maxLife: life });
    }
  }

  private spawnPulse(position: THREE.Vector3, color: number, size: number): void {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(.55, .06, 5, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false }));
    mesh.position.copy(position); mesh.lookAt(this.camera.position); mesh.scale.setScalar(size); this.scene.add(mesh);
    this.particles.push({ mesh, velocity: new THREE.Vector3(), life: .55, maxLife: .55 });
  }

  private spawnThruster(position: THREE.Vector3, direction: THREE.Vector3, count: number): void {
    const origin = position.clone().addScaledVector(direction.clone().normalize(), .4);
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x70f5ff : 0xffffff, transparent: true }));
      mesh.position.copy(origin); mesh.scale.setScalar(.45 + Math.random() * .5); this.scene.add(mesh);
      const velocity = direction.clone().normalize().multiplyScalar(2 + Math.random() * 4).add(new THREE.Vector3().randomDirection().multiplyScalar(1.2));
      this.particles.push({ mesh, velocity, life: .25 + Math.random() * .25, maxLife: .5 });
    }
  }

  private nearOwnCannon(): boolean {
    const local = this.players.get(this.localId);
    const planet = local ? this.planets.get(local.state.planetId) : undefined;
    if (!planet) return false;
    const cannon = cannonPosition(planet.state);
    return distance(plain(this.localPosition), cannon) < 5;
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
    return [...this.planets.values()].filter((p) => !aliveOnly || p.state.alive).sort((a, b) => position.distanceTo(a.group.position) - position.distanceTo(b.group.position))[0];
  }

  private preventCameraClip(desired: THREE.Vector3, target: THREE.Vector3, planetCenter: THREE.Vector3): THREE.Vector3 {
    const radius = BALANCE.planetRadius + 0.45;
    if (desired.distanceTo(planetCenter) >= radius) return desired;
    return planetCenter.clone().add(desired.clone().sub(planetCenter).normalize().multiplyScalar(radius)).lerp(target, 0.08);
  }

  private orientPlayer(group: THREE.Group, up: THREE.Vector3, forward: THREE.Vector3): void {
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const correctedForward = new THREE.Vector3().crossVectors(right, up).normalize();
    const matrix = new THREE.Matrix4().makeBasis(right, up, correctedForward);
    const target = new THREE.Quaternion().setFromRotationMatrix(matrix);
    group.quaternion.slerp(target, 0.22);
  }

  private toggleWeapon(): void {
    this.weapon = this.weapon === "rocket" ? "asteroid" : "rocket";
    this.audio.click(); this.onWeaponChange?.(this.weapon);
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
    this.disposeMaterial(particle.mesh.material);
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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  }
}
