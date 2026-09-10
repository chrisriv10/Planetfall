import * as THREE from "three";
import {
  BR_BALANCE, BR_HEALS, BR_ISLAND_OUTLINE, BR_MAP, BR_MAP_BLOCKS, BR_POIS, BR_ROADS, BR_STRUCTURES, BR_TERRAIN_PATCHES, BR_TRAVERSAL, BR_WEAPONS, isBrHeal, isBrWeapon, isInsideBrIsland, seededRandom, stepBrMovement,
  type BrCrateState, type BrInput, type BrLootState, type BrMapBlock, type BrPoi, type BrPlayerSnapshotState, type BrPlayerState, type BrProjectileState, type BrRoomView,
  type BrMotionState, type BrSnapshot, type BrWeaponId, type EmoteType, type Vec3
} from "@planetfall/shared";
import type { GameAudio } from "../../audio";
import { inputLabel, type GameInput, type InputFrame, type InputMethod } from "../../input";
import type { UserSettings } from "../../settings";
import { BrPredictionPhysics } from "./br-physics";

type PlayerVisual = { group: THREE.Group; target: THREE.Vector3; label: THREE.Sprite; body: THREE.Mesh; limbs: THREE.Group[]; wings: THREE.Group; weapon: THREE.Group; weaponId: BrWeaponId | null; state: BrPlayerSnapshotState; relevant: boolean; emote: EmoteType | null; emoteEndsAt: number };
type LootVisual = { group: THREE.Group; state: BrLootState; baseY: number };
type CrateVisual = { group: THREE.Group; state: BrCrateState; baseY: number };
type ProjectileVisual = { mesh: THREE.Mesh; target: THREE.Vector3; state: BrProjectileState; trail: THREE.Line; points: THREE.Vector3[] };

const vec = (value: Vec3) => new THREE.Vector3(value.x, value.y, value.z);
const rarityColor: Record<string, number> = { common: 0xb8c4dc, rare: 0x54b8ff, epic: 0xc565ff, legendary: 0xffc84f };

export interface BrHudState {
  player: BrPlayerState;
  players: BrPlayerState[];
  playersRemaining: number;
  teamsRemaining: number;
  storm: BrSnapshot["storm"];
  phase: BrSnapshot["phase"];
  prompt: string;
  reloadProgress: number;
  useProgress: number;
}

export class BattleRoyaleGame {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, .1, 1600);
  onInput?: (input: BrInput) => void;
  onJumpShip?: () => void;
  onDeploy?: () => void;
  onFire?: (origin: Vec3, direction: Vec3, clientTime: number) => void;
  onReload?: () => void;
  onUseItem?: () => void;
  onPickup?: (lootId: string, replaceSlot?: number) => void;
  onOpenCrate?: (crateId: string) => void;
  onSelectSlot?: (slot: number) => void;
  onRevive?: (targetId: string, active: boolean) => void;
  onSpectateCycle?: (direction: -1 | 1) => void;
  onPing?: (position: Vec3) => void;
  onEmote?: (emote: EmoteType, direction: Vec3) => void;
  onHud?: (state: BrHudState) => void;
  onInputMethod?: (method: InputMethod) => void;
  onPause?: () => void;
  onMap?: (visible: boolean) => void;
  onMenuNavigate?: (action: "up" | "down" | "left" | "right" | "confirm" | "back") => void;

  private room: BrRoomView | null = null;
  private localId = "";
  private localState: BrPlayerState | null = null;
  private players = new Map<string, PlayerVisual>();
  private loot = new Map<string, LootVisual>();
  private crates = new Map<string, CrateVisual>();
  private projectiles = new Map<string, ProjectileVisual>();
  private pings: Array<{ group: THREE.Group; expiresAt: number }> = [];
  private lastFrame = performance.now();
  private inputAccumulator = 0;
  private sequence = 0;
  private yaw = 0;
  private pitch = .28;
  private settings: UserSettings;
  private active = false;
  private uiCaptured = false;
  private mapVisible = false;
  private prompt = "";
  private reloadStartedAt = 0;
  private reloadEndsAt = 0;
  private useStartedAt = 0;
  private useEndsAt = 0;
  private spectatorTargetId: string | null = null;
  private emoteIndex = -1;
  private lastFireRequestAt = 0;
  private lastAnticipatedFireAt = 0;
  private aiming = false;
  private predictedMotion: BrMotionState | null = null;
  private readonly temp = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly island = new THREE.Group();
  private readonly islandMeshes: THREE.Mesh[] = [];
  private readonly poiLabels: Array<{ sprite: THREE.Sprite; position: THREE.Vector3 }> = [];
  private readonly physics = new BrPredictionPhysics();
  private disposed = false;
  private readonly handleCanvasClick = () => { if (this.active && !this.mapVisible && document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock().catch(() => undefined); };
  private readonly handleResize = () => this.resize();
  private readonly unsubscribeInputMethod: () => void;
  private readonly stormWall = new THREE.Group();

  constructor(
    private canvas: HTMLCanvasElement,
    private renderer: THREE.WebGLRenderer,
    private input: GameInput,
    private audio: GameAudio,
    settings: UserSettings
  ) {
    this.settings = settings;
    this.scene.background = new THREE.Color(0x020512);
    this.scene.fog = new THREE.FogExp2(0x07112c, .0014);
    this.unsubscribeInputMethod = this.input.subscribeMethodChange((method) => { if (this.active) this.onInputMethod?.(method); });
    this.buildScene();
    this.island.traverse((object) => { if (object instanceof THREE.Mesh) this.islandMeshes.push(object); });
    this.canvas.addEventListener("click", this.handleCanvasClick);
    addEventListener("resize", this.handleResize);
  }

  activate(room: BrRoomView, localId: string): void {
    if (this.disposed) return;
    this.room = room; this.localId = localId; this.localState = room.players.find((player) => player.id === localId) ?? null; this.active = true; this.lastFrame = performance.now(); this.syncPlayers(room.players);
    this.onInputMethod?.(this.input.method);
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  deactivate(): void { this.active = false; this.renderer.setAnimationLoop(null); this.uiCaptured = false; this.mapVisible = false; document.exitPointerLock?.(); }
  reset(): void {
    for (const visual of this.players.values()) { this.scene.remove(visual.group); this.disposeObject(visual.group); }
    for (const visual of this.loot.values()) { this.scene.remove(visual.group); this.disposeObject(visual.group); }
    for (const visual of this.crates.values()) { this.scene.remove(visual.group); this.disposeObject(visual.group); }
    for (const visual of this.projectiles.values()) { this.scene.remove(visual.mesh, visual.trail); this.disposeObject(visual.mesh); this.disposeObject(visual.trail); }
    for (const ping of this.pings) { this.scene.remove(ping.group); this.disposeObject(ping.group); }
    this.players.clear(); this.loot.clear(); this.crates.clear(); this.projectiles.clear(); this.pings = []; this.localState = null; this.predictedMotion = null; this.spectatorTargetId = null;
    this.reloadEndsAt = 0; this.useEndsAt = 0; this.lastFireRequestAt = 0;this.lastAnticipatedFireAt=0;
    this.physics.reset();
  }
  dispose(): void { if (this.disposed) return; this.deactivate(); this.reset(); this.canvas.removeEventListener("click",this.handleCanvasClick); removeEventListener("resize",this.handleResize); this.unsubscribeInputMethod(); this.scene.remove(this.island,this.stormWall); this.disposeObject(this.island); this.disposeObject(this.stormWall); this.physics.dispose(); this.disposed=true; }
  /** Compatibility aliases retained while callers migrate to the explicit lifecycle. */
  start(room: BrRoomView, localId: string): void { this.activate(room,localId); }
  stop(): void { this.deactivate(); }
  resetMatchVisuals(): void { this.reset(); }
  setSettings(settings: UserSettings): void { this.settings = settings; }
  setUiCaptured(captured: boolean): void { this.uiCaptured = captured; if (captured) document.exitPointerLock?.(); }
  setMapVisible(visible: boolean): void { this.mapVisible = visible; this.setUiCaptured(visible); }
  setRoom(room: BrRoomView): void { this.room = room; this.syncPlayers(room.players); }
  getInputMethod(): InputMethod { return this.input.method; }
  debugState(): object {
    return {
      localId: this.localId,
      phase: this.room?.phase ?? "lobby",
      localPlayer: this.localState ? { ...this.localState, position: { ...this.localState.position }, velocity: { ...this.localState.velocity } } : null,
      players: [...this.players.values()].map((visual) => ({ id: visual.state.id, teamId: visual.state.teamId, alive: visual.state.alive, deployment: visual.state.deployment, position: { ...visual.state.position } })),
      lootCount: this.loot.size,
      crateCount: this.crates.size,
      projectileCount: this.projectiles.size,
      spectatorTargetId: this.spectatorTargetId,
      storm: this.room ? { ...this.room.storm, center: { ...this.room.storm.center }, nextCenter: { ...this.room.storm.nextCenter } } : null,
      camera:{position:{x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z},fov:this.camera.fov},
      world:{islandObjects:this.island.children.length,shipVisible:Boolean(this.scene.getObjectByName("starliner")?.visible)},
      renderer: { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }
    };
  }

  applySnapshot(snapshot: BrSnapshot): void {
    this.localState = snapshot.localPlayer;
    this.reconcilePrediction(snapshot.localPlayer);
    if (!this.room) return;
    this.room.phase = snapshot.phase; this.room.storm = snapshot.storm; this.room.ship = snapshot.ship; this.room.playersRemaining = snapshot.playersRemaining; this.room.teamsRemaining = snapshot.teamsRemaining;
    const currentPlayers = new Map(this.room.players.map((player) => [player.id, player]));
    for (const update of snapshot.players) { const player = currentPlayers.get(update.id); if (player) Object.assign(player, update); }
    currentPlayers.set(snapshot.localPlayer.id, snapshot.localPlayer);
    this.room.players = [...currentPlayers.values()];
    this.spectatorTargetId = snapshot.spectatorTargetId;
    this.syncPlayers(snapshot.players, true);
    this.syncProjectiles(snapshot.projectiles);
    this.syncLoot(snapshot.loot);
  }

  spawnLoot(states: BrLootState[]): void {
    for (const state of states) {
      if (this.loot.has(state.id)) continue;
      const group = this.makeLoot(state); group.position.copy(vec(state.position)); this.scene.add(group);
      this.loot.set(state.id, { group, state, baseY: state.position.y });
    }
  }
  removeLoot(ids: string[]): void { for (const id of ids) { const visual = this.loot.get(id); if (!visual) continue; this.scene.remove(visual.group); this.disposeObject(visual.group); this.loot.delete(id); } }
  private syncLoot(states:BrLootState[]):void {const ids=new Set(states.map((entry)=>entry.id));this.spawnLoot(states);for(const [id,visual] of this.loot)if(!ids.has(id)){this.scene.remove(visual.group);this.disposeObject(visual.group);this.loot.delete(id);}}

  spawnCrates(states: BrCrateState[]): void {
    for (const state of states) {
      if (state.opened || this.crates.has(state.id)) continue;
      const group = this.makeCrate(); group.position.copy(vec(state.position)); this.scene.add(group);
      this.crates.set(state.id, { group, state, baseY: state.position.y });
    }
  }

  openCrate(crateId: string, drops: BrLootState[]): void {
    const visual = this.crates.get(crateId);
    if (visual) { this.scene.remove(visual.group); this.disposeObject(visual.group); this.crates.delete(crateId); }
    this.spawnLoot(drops); this.audio.pickup();
  }

  playEmote(playerId: string, emote: EmoteType, startedAt: number): void {
    const visual = this.players.get(playerId); if (!visual) return;
    visual.emote = emote; visual.emoteEndsAt = startedAt + 1600;
  }

  showPing(name: string, position: Vec3, color: string): void {
    const group = new THREE.Group(); group.position.copy(vec(position));
    const marker = new THREE.Mesh(new THREE.ConeGeometry(.32, .8, 6), new THREE.MeshBasicMaterial({ color, depthTest: false })); marker.position.y = 1.2; marker.rotation.z = Math.PI; group.add(marker);
    const label = this.makeLabel(`${name} · MOVE`, color); label.position.y = 2.1; label.scale.set(3.4, .85, 1); group.add(label);
    this.scene.add(group); this.pings.push({ group, expiresAt: performance.now() + 6000 });
    while (this.pings.length > 8) { const old = this.pings.shift()!; this.scene.remove(old.group); }
  }

  weaponFired(payload: { playerId: string; weaponId: BrWeaponId; origin: Vec3; direction: Vec3; projectile?: BrProjectileState }): void {
    const color = payload.weaponId === "plasma-launcher" ? 0xff62d7 : payload.weaponId === "arc-blaster" ? 0x70f5ff : payload.weaponId === "energy-saber" ? 0x8affbf : 0xffe06b;
    const shooter=this.players.get(payload.playerId);if(shooter){shooter.weapon.userData.recoil=1;shooter.body.rotation.x=-.08;}
    const flash = new THREE.PointLight(color, 4, 13, 2); flash.position.copy(vec(payload.origin)); this.scene.add(flash); setTimeout(() => this.scene.remove(flash), 70);
    if (payload.playerId === this.localId && performance.now()-this.lastAnticipatedFireAt>180) {
      if (payload.weaponId === "plasma-launcher") this.audio.asteroid(); else if (payload.weaponId === "photon-shotgun" || payload.weaponId === "rail-laser") this.audio.rocket(); else this.audio.cannonTrigger(false);
    }
    if (!payload.projectile && payload.weaponId !== "energy-saber") {
      const length = payload.weaponId === "rail-laser" ? 190 : payload.weaponId === "photon-shotgun" ? 42 : 85;
      const geometry = new THREE.BufferGeometry().setFromPoints([vec(payload.origin), vec(payload.origin).addScaledVector(vec(payload.direction), length)]);
      const tracer = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: payload.weaponId === "rail-laser" ? .95 : .6 })); this.scene.add(tracer);
      setTimeout(() => { this.scene.remove(tracer); geometry.dispose(); (tracer.material as THREE.Material).dispose(); }, payload.weaponId === "rail-laser" ? 125 : 55);
    }
    if (payload.projectile && !this.projectiles.has(payload.projectile.id)) this.addProjectile(payload.projectile);
  }

  damaged(payload: { playerId: string; attackerId?:string; amount: number; shieldBroken: boolean; direction?:Vec3 }): void {
    const visual = this.players.get(payload.playerId); if (visual) { const material = visual.body.material as THREE.MeshStandardMaterial; material.emissive.set(payload.shieldBroken ? 0xffffff : 0x70f5ff); material.emissiveIntensity = 1.4; setTimeout(() => { if (this.players.has(payload.playerId)) { material.emissive.set(visual.state.color); material.emissive.multiplyScalar(.09); material.emissiveIntensity = 1; } }, 95); }
    if(payload.attackerId===this.localId){const crosshair=document.getElementById("br-crosshair");crosshair?.classList.toggle("shield-break",payload.shieldBroken);crosshair?.classList.add("hit");setTimeout(()=>crosshair?.classList.remove("hit","shield-break"),110);}
    if (payload.playerId === this.localId) { this.audio.incoming(payload.amount >= 35); this.input.vibrate(120, Math.min(.7, payload.amount / 80)); const indicator=document.getElementById("br-damage-direction");if(indicator&&payload.direction){const angle=Math.atan2(payload.direction.x,-payload.direction.z)-this.yaw;indicator.style.setProperty("--damage-angle",`${angle}rad`);indicator.classList.add("visible");setTimeout(()=>indicator.classList.remove("visible"),520);} }
  }

  eliminated(playerId: string): void { const visual = this.players.get(playerId); if (visual) visual.group.visible = false; }

  private frame(now: number): void {
    if (!this.active) return;
    const dt = Math.min(.05, (now - this.lastFrame) / 1000); this.lastFrame = now;
    const frame = this.input.sample(); this.processInput(frame, dt, now);
    this.updatePlayers(dt, now); this.updateLoot(now); this.updateCrates(now); this.updateProjectiles(); this.updatePings(now); this.updateCamera(dt); this.updateShip(); this.updateStorm(now); this.updateWorldPresentation(now);
    this.renderer.render(this.scene, this.camera);
  }

  private processInput(frame: InputFrame, dt: number, now: number): void {
    const local = this.localState; if (!local) return;
    if (this.uiCaptured) {
      if (frame.map.pressed && this.mapVisible) { this.setMapVisible(false); this.onMap?.(false); return; }
      if (frame.menuY) this.onMenuNavigate?.(frame.menuY < 0 ? "up" : "down");
      if (frame.menuX) this.onMenuNavigate?.(frame.menuX < 0 ? "left" : "right");
      if (frame.confirm.pressed) this.onMenuNavigate?.("confirm");
      if (frame.cancel.pressed) this.onMenuNavigate?.("back");
      this.onHud?.({ player: local, players: this.room?.players ?? [], playersRemaining: this.room?.playersRemaining ?? 0, teamsRemaining: this.room?.teamsRemaining ?? 0, storm: this.room!.storm, phase: this.room!.phase, prompt: "", reloadProgress: 0, useProgress: 0 }); return;
    }
    if (!local.alive) {
      if (frame.nextTarget.pressed || frame.switchWeapon.pressed) { this.cycleSpectator(1); this.onSpectateCycle?.(1); }
      if (frame.previousTarget.pressed) { this.cycleSpectator(-1); this.onSpectateCycle?.(-1); }
      if (frame.pause.pressed || frame.cancel.pressed) this.onPause?.();
      this.prompt = `${inputLabel("nextTarget", frame.method)}  CYCLE SPECTATOR`;
      this.onHud?.({ player: local, players: this.room?.players ?? [], playersRemaining: this.room?.playersRemaining ?? 0, teamsRemaining: this.room?.teamsRemaining ?? 0, storm: this.room!.storm, phase: this.room!.phase, prompt: this.prompt, reloadProgress: 0, useProgress: 0 });
      return;
    }
    const mouseScale = .0022 * this.settings.mouseSensitivity; const padScale = 2.2 * this.settings.controllerSensitivity * dt * this.controllerAimFriction();
    const scale = frame.method === "gamepad" ? padScale : mouseScale;
    this.yaw -= frame.lookX * scale; this.pitch -= frame.lookY * scale * (this.settings.invertY ? -1 : 1); this.pitch = THREE.MathUtils.clamp(this.pitch, -.75, 1.15);
    this.aiming = frame.grapple.held;
    if (frame.pause.pressed || frame.cancel.pressed) this.onPause?.();
    this.predictLocal(frame, dt, now);
    if (frame.map.pressed) { this.setMapVisible(!this.mapVisible); this.onMap?.(this.mapVisible); }
    if (frame.directSlot !== null) this.selectSlot(frame.directSlot);
    if (frame.switchWeapon.pressed || (frame.nextTarget.pressed && !frame.repair.pressed)) this.selectSlot((local.selectedSlot + 1) % BR_BALANCE.inventorySlots);
    if (frame.previousTarget.pressed) this.selectSlot((local.selectedSlot + BR_BALANCE.inventorySlots - 1) % BR_BALANCE.inventorySlots);
    if (frame.repair.pressed) { const item = local.inventory[local.selectedSlot]; if (item && isBrWeapon(item.itemId)) { this.reloadStartedAt = now; this.reloadEndsAt = now + BR_WEAPONS[item.itemId].reloadMs; this.onReload?.(); } }
    if (frame.jump.pressed) {
      if (local.deployment === "attached") this.onJumpShip?.(); else if (local.deployment === "freefall") this.onDeploy?.();
    }
    const lookDirection = this.lookDirection();
    const selectedItem = local.inventory[local.selectedSlot];
    const reticle=document.getElementById("br-crosshair");
    if(reticle){const weapon=selectedItem&&isBrWeapon(selectedItem.itemId)?BR_WEAPONS[selectedItem.itemId]:null;const speed=Math.hypot(local.velocity.x,local.velocity.z);const spread=weapon?weapon.spread*150+(weapon.pellets>1?5:0):3;const gap=THREE.MathUtils.clamp(4+spread+speed*.28+(this.aiming?-2:0),3,18);reticle.style.setProperty("--reticle-gap",`${gap}px`);reticle.classList.toggle("aiming",this.aiming);reticle.classList.toggle("blocked",Boolean(this.reloadEndsAt>now||this.useEndsAt>now));}
    if (frame.fire.held && local.deployment === "grounded" && !local.downed && selectedItem && isBrWeapon(selectedItem.itemId)) {
      const interval = BR_WEAPONS[selectedItem.itemId].fireIntervalMs;
      if (now - this.lastFireRequestAt >= interval * .88) { this.lastFireRequestAt = now;this.lastAnticipatedFireAt=now;const shooter=this.players.get(this.localId);if(shooter)shooter.weapon.userData.recoil=.65;if(selectedItem.itemId==="plasma-launcher")this.audio.asteroid();else if(selectedItem.itemId==="photon-shotgun"||selectedItem.itemId==="rail-laser")this.audio.rocket();else this.audio.cannonTrigger(false); this.onFire?.({ x: local.position.x, y: local.position.y + .72, z: local.position.z }, { x: lookDirection.x, y: lookDirection.y, z: lookDirection.z }, Date.now()); }
    }
    const interactionPosition = this.predictedMotion?.position ?? local.position;
    const nearbyLoot = this.nearestLoot(interactionPosition);
    const nearbyCrate = this.nearestCrate(interactionPosition);
    const downedTeammate = this.nearestDownedTeammate(local);
    if (frame.interact.pressed && !downedTeammate) {
      if (nearbyLoot) this.onPickup?.(nearbyLoot.state.id);
      else if (nearbyCrate) this.onOpenCrate?.(nearbyCrate.state.id);
      else if (selectedItem && isBrHeal(selectedItem.itemId)) { this.useStartedAt = now; this.useEndsAt = now + BR_HEALS[selectedItem.itemId].durationMs; this.onUseItem?.(); }
    }
    if (downedTeammate) this.onRevive?.(downedTeammate.id, frame.interact.held); else if (frame.interact.released) this.onRevive?.("", false);
    if (frame.ping.pressed) { const point = this.aimPoint(); this.onPing?.({ x: point.x, y: point.y, z: point.z }); }
    if (frame.emote.pressed) {
      const emotes: EmoteType[] = ["wave", "point", "celebrate", "laugh", "panic", "taunt"];
      this.emoteIndex = (this.emoteIndex + 1) % emotes.length;
      this.onEmote?.(emotes[this.emoteIndex], { x: lookDirection.x, y: lookDirection.y, z: lookDirection.z });
      this.playEmote(this.localId, emotes[this.emoteIndex], Date.now());
    }
    const jumpKey = inputLabel("jump", frame.method); const interactKey = inputLabel("interact", frame.method);
    this.prompt = local.deployment === "attached" ? `${jumpKey}  JUMP` : local.deployment === "freefall" ? `${jumpKey}  DEPLOY ION WINGS` : downedTeammate ? `HOLD ${interactKey}  REVIVE` : nearbyLoot ? `${interactKey}  PICK UP ${this.lootName(nearbyLoot.state)}` : nearbyCrate ? `${interactKey}  OPEN STAR CRATE` : selectedItem && isBrHeal(selectedItem.itemId) ? `${interactKey}  USE ${BR_HEALS[selectedItem.itemId].name}` : selectedItem && isBrWeapon(selectedItem.itemId) && selectedItem.itemId !== "energy-saber" && selectedItem.magazine === 0 ? `${inputLabel("repair", frame.method)}  RELOAD` : "";
    this.inputAccumulator += dt;
    if (this.inputAccumulator >= 1 / BR_BALANCE.inputRate) {
      this.inputAccumulator %= 1 / BR_BALANCE.inputRate;
      this.onInput?.({ sequence: ++this.sequence, dt: Math.min(.1, dt), moveX: frame.moveX, moveY: frame.moveY, yaw: this.yaw, pitch: this.pitch, jump: frame.jump.held, sprint: frame.burst.held, crouch: frame.crouch.held, fire: frame.fire.held, aim: frame.grapple.held, reload: frame.repair.held });
    }
    this.onHud?.({ player: local, players: this.room?.players ?? [], playersRemaining: this.room?.playersRemaining ?? 0, teamsRemaining: this.room?.teamsRemaining ?? 0, storm: this.room?.storm ?? ({ phaseIndex: 0, center: { x: 0, z: 0 }, radius: 0, nextCenter: { x: 0, z: 0 }, nextRadius: 0, stage: "waiting", stageEndsAt: null, damagePerSecond: 0 }), phase: this.room?.phase ?? "lobby", prompt: this.prompt, reloadProgress: this.reloadEndsAt > now ? 1 - (this.reloadEndsAt - now) / Math.max(1, this.reloadEndsAt - this.reloadStartedAt) : 0, useProgress: this.useEndsAt > now ? 1 - (this.useEndsAt - now) / Math.max(1, this.useEndsAt - this.useStartedAt) : 0 });
  }

  private selectSlot(slot: number): void { this.reloadEndsAt = 0; this.useEndsAt = 0; this.onSelectSlot?.(slot); if (this.localState) this.localState.selectedSlot = slot; }

  private updatePlayers(dt: number, now: number): void {
    for (const visual of this.players.values()) {
      visual.group.visible = visual.state.alive && visual.relevant && this.room?.phase!=="lobby" && this.room?.phase!=="countdown";
      const displayTarget = visual.state.id === this.localId && this.predictedMotion ? this.temp.set(this.predictedMotion.position.x, this.predictedMotion.position.y, this.predictedMotion.position.z) : visual.target;
      visual.group.position.lerp(displayTarget, visual.state.id === this.localId ? Math.min(1, dt * 22) : Math.min(1, dt * 10));
      visual.group.rotation.y = THREE.MathUtils.lerp(visual.group.rotation.y, visual.state.yaw, Math.min(1, dt * 10));
      const speed = Math.hypot(visual.state.velocity.x, visual.state.velocity.z); const run = Math.sin(now * .012 * Math.max(1, speed));
      visual.limbs.forEach((limb, index) => { limb.rotation.x = run * .65 * (index % 2 ? -1 : 1) * Math.min(1, speed / 5); limb.rotation.z = THREE.MathUtils.lerp(limb.rotation.z, 0, Math.min(1, dt * 15)); });
      visual.body.rotation.z = THREE.MathUtils.lerp(visual.body.rotation.z, 0, Math.min(1, dt * 12));
      visual.body.rotation.y = THREE.MathUtils.lerp(visual.body.rotation.y, 0, Math.min(1, dt * 12));
      if (visual.emote && now < visual.emoteEndsAt) this.animateEmote(visual, now);
      else visual.emote = null;
      visual.group.scale.y = visual.state.downed ? .48 : 1;
      visual.wings.visible = visual.state.deployment === "chute";
      if(visual.wings.visible){visual.wings.scale.x=1+Math.sin(now*.008)*.045;visual.wings.rotation.z=Math.sin(now*.004)*.025;}
      this.updateHeldWeapon(visual);
      visual.label.visible = visual.state.id !== this.localId && this.camera.position.distanceTo(visual.group.position) < 145;
      const labelScale = THREE.MathUtils.clamp(this.camera.position.distanceTo(visual.group.position) * .012, 1.5, 3.8); visual.label.scale.set(labelScale * 2.6, labelScale, 1);
    }
  }

  private updateLoot(now: number): void { for (const visual of this.loot.values()) { visual.group.rotation.y += .012; visual.group.position.y = visual.baseY + Math.sin(now * .002 + this.hash(visual.state.id)) * .15; } }
  private updateCrates(now: number): void { for (const visual of this.crates.values()) { visual.group.rotation.y = Math.sin(now * .0007 + this.hash(visual.state.id)) * .08; visual.group.position.y = visual.baseY + Math.sin(now * .0015 + this.hash(visual.state.id)) * .05; } }
  private updateProjectiles(): void {
    for (const visual of this.projectiles.values()) {
      visual.mesh.position.lerp(visual.target, .45); visual.points.push(visual.mesh.position.clone()); if (visual.points.length > 14) visual.points.shift();
      const positions = visual.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
      visual.points.forEach((point, index) => positions.setXYZ(index, point.x, point.y, point.z));
      positions.needsUpdate = true; visual.trail.geometry.setDrawRange(0, visual.points.length);
    }
  }
  private updatePings(now: number): void { for (let index = this.pings.length - 1; index >= 0; index--) { const ping = this.pings[index]; if (now < ping.expiresAt) { ping.group.position.y += Math.sin(now * .01) * .0015; continue; } this.scene.remove(ping.group); this.pings.splice(index, 1); } }
  private updateShip(): void {
    const ship = this.scene.getObjectByName("starliner"); if (!ship) return;
    ship.visible = Boolean(this.room?.ship); if (this.room?.ship) { ship.position.copy(vec(this.room.ship.position)); ship.lookAt(vec(this.room.ship.end)); ship.rotateY(Math.PI); }
  }

  private updateCamera(dt: number): void {
    if(this.room?.phase==="lobby"||this.room?.phase==="countdown"){
      const time=performance.now()*.000035;const focus=new THREE.Vector3(-25,0,15);const desired=new THREE.Vector3(Math.sin(time)*570,330,Math.cos(time)*570);this.camera.position.lerp(desired,Math.min(1,dt*2.2));this.camera.up.set(0,1,0);this.camera.lookAt(focus);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,58,Math.min(1,dt*3));this.camera.updateProjectionMatrix();return;
    }
    const localPlayer = this.players.get(this.localId);
    if (this.room?.phase === "ship" && this.room.ship && (!localPlayer || localPlayer.state.deployment === "attached")) {
      const shipPosition = vec(this.room.ship.position); const route = vec(this.room.ship.end).sub(vec(this.room.ship.start)); route.y = 0; route.normalize();
      const side = new THREE.Vector3(-route.z, 0, route.x); const focus = shipPosition.clone().addScaledVector(route, 30).addScaledVector(side,-24).add(new THREE.Vector3(0,-10,0));
      const desired = shipPosition.clone().addScaledVector(route,-104).addScaledVector(side,32).add(new THREE.Vector3(0,46,0));
      this.camera.position.lerp(desired,Math.min(1,dt*5));this.camera.up.set(0,1,0);this.camera.lookAt(focus);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,67,Math.min(1,dt*4));this.camera.updateProjectionMatrix();return;
    }
    if (!localPlayer) return;
    const local = localPlayer.state.alive ? localPlayer : this.getSpectatorTarget() ?? localPlayer;
    const airborne = local.state.deployment === "freefall" || local.state.deployment === "chute" || local.state.deployment === "attached";
    const distance = airborne ? 10.5 : local.state.downed ? 5.5 : this.aiming ? 5.4 : 6.8;
    const look = this.lookDirection(); const focus = local.group.position.clone().add(new THREE.Vector3(0, .85, 0));
    const right = new THREE.Vector3(-look.z,0,look.x).normalize();
    const desired = focus.clone().addScaledVector(look, -distance).addScaledVector(right,this.aiming ? 1.05 : .32).add(new THREE.Vector3(0, airborne ? 2.2 : 1.1, 0));
    if (desired.y < .45 && isInsideBrIsland(desired)) desired.y = .45;
    const cameraRay=desired.clone().sub(focus);const cameraDistance=cameraRay.length();cameraRay.normalize();this.raycaster.set(focus,cameraRay);this.raycaster.far=cameraDistance;
    const obstruction=this.raycaster.intersectObjects(this.islandMeshes,false).find((hit)=>hit.distance>.35);
    const safeDesired=obstruction?focus.clone().addScaledVector(cameraRay,Math.max(.45,obstruction.distance-.28)):desired;
    this.camera.position.lerp(safeDesired, Math.min(1, dt * (obstruction?15:9))); this.camera.up.set(0, 1, 0); this.camera.lookAt(focus.clone().addScaledVector(look, 5));
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, airborne ? 74 : this.aiming ? 61 : local.state.velocity && Math.hypot(local.state.velocity.x, local.state.velocity.z) > 9 ? 70 : 66, Math.min(1, dt * 4)); this.camera.updateProjectionMatrix();
  }

  private syncPlayers(states: Array<BrPlayerSnapshotState | BrPlayerState>, relevanceSnapshot = false): void {
    if (relevanceSnapshot) for (const visual of this.players.values()) visual.relevant = visual.state.id === this.localId;
    for (const source of states) {
      const state = this.renderState(source);
      let visual = this.players.get(state.id);
      if (!visual) { visual = this.makePlayer(state); this.players.set(state.id, visual); this.scene.add(visual.group); }
      visual.state = state; visual.relevant = true; visual.target.copy(vec(state.position)); const material = visual.body.material as THREE.MeshStandardMaterial; material.color.set(state.color);
    }
  }

  private syncProjectiles(states: BrProjectileState[]): void {
    const ids = new Set(states.map((state) => state.id));
    for (const state of states) { let visual = this.projectiles.get(state.id); if (!visual) { this.addProjectile(state); visual = this.projectiles.get(state.id)!; } visual.state = state; visual.target.copy(vec(state.position)); }
    for (const [id, visual] of this.projectiles) if (!ids.has(id)) { this.scene.remove(visual.mesh, visual.trail); this.disposeObject(visual.mesh); this.disposeObject(visual.trail); this.projectiles.delete(id); }
  }

  private addProjectile(state: BrProjectileState): void {
    const color = state.weaponId === "plasma-launcher" ? 0xff5fd7 : 0x70f5ff;
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(state.weaponId === "plasma-launcher" ? .42 : .24, 1), new THREE.MeshBasicMaterial({ color })); mesh.position.copy(vec(state.position));
    const trailGeometry = new THREE.BufferGeometry(); trailGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(14 * 3), 3)); trailGeometry.setDrawRange(0, 1);
    const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .7 })); this.scene.add(mesh, trail);
    this.projectiles.set(state.id, { mesh, target: vec(state.position), state, trail, points: [mesh.position.clone()] });
  }

  private makePlayer(state: BrPlayerSnapshotState): PlayerVisual {
    const group = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42, .72, 4, 8), this.playerMaterial(state)); body.position.y = .72; group.add(body);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2f7ff, roughness: .28 })); helmet.position.y = 1.42; helmet.scale.z = .92; group.add(helmet);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(.31, 10, 7, 0, Math.PI * 2, 0, Math.PI * .55), new THREE.MeshStandardMaterial({ color: 0x102956, emissive: 0x123a66, emissiveIntensity: .65, metalness: .55, roughness: .1 })); visor.position.set(0, 1.45, -.27); visor.rotation.x = Math.PI; group.add(visor);
    const limbs: THREE.Group[] = [];
    for (const [x, z, arm] of [[-.52,0,true],[.52,0,true],[-.24,0,false],[.24,0,false]] as [number,number,boolean][]) { const pivot = new THREE.Group(); pivot.position.set(x, arm ? 1.03 : .45, z); const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(arm ? .11 : .14, arm ? .42 : .5, 3, 6), new THREE.MeshStandardMaterial({ color: arm ? state.color : 0xe7efff, roughness: .65 })); mesh.position.y = arm ? -.25 : -.32; pivot.add(mesh); group.add(pivot); limbs.push(pivot); }
    const label = this.makeLabel(`${state.name}${state.isBot ? "  BOT" : ""}`, state.color); label.position.y = 2.25; group.add(label); group.position.copy(vec(state.position));
    const wings = new THREE.Group(); wings.position.set(0, 1.04, .34);const wingMaterial=new THREE.MeshBasicMaterial({color:0x70f5ff,transparent:true,opacity:.72,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
    const pack=new THREE.Mesh(new THREE.BoxGeometry(.58,.68,.24),new THREE.MeshStandardMaterial({color:0x263b5b,emissive:0x145a78,emissiveIntensity:.45,metalness:.7,roughness:.25}));pack.position.z=.04;wings.add(pack);
    for (const side of [-1, 1]) for(const upper of [0,1]){const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(side*(upper?1.35:1.05),upper?.72:-.62);shape.lineTo(side*(upper?1.7:1.48),upper?.2:-.28);shape.closePath();const wing=new THREE.Mesh(new THREE.ShapeGeometry(shape),wingMaterial);wing.position.set(side*.26,upper?.15:-.12,.12);wings.add(wing);const emitter=new THREE.Mesh(new THREE.SphereGeometry(.13,6,5),new THREE.MeshBasicMaterial({color:0xffffff}));emitter.position.set(side*.29,upper?.18:-.16,.15);wings.add(emitter);}
    wings.visible = false; group.add(wings);
    const weapon = new THREE.Group(); weapon.position.set(.46, 1.02, -.34); weapon.visible = false; group.add(weapon);
    return { group, target: vec(state.position), label, body, limbs, wings, weapon, weaponId:null, state, relevant: true, emote: null, emoteEndsAt: 0 };
  }

  private playerMaterial(state: BrPlayerSnapshotState): THREE.Material { return new THREE.MeshStandardMaterial({ color: state.color, emissive: new THREE.Color(state.color).multiplyScalar(.09), roughness: .55, metalness: .08 }); }

  private makeLabel(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128; const context = canvas.getContext("2d")!; context.font = "900 42px Arial"; context.textAlign = "center"; context.textBaseline = "middle"; context.strokeStyle = "#020616"; context.lineWidth = 12; context.strokeText(text.toUpperCase(), 256, 64); context.fillStyle = color; context.fillText(text.toUpperCase(), 256, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })); sprite.renderOrder = 15; return sprite;
  }

  private makeLoot(state: BrLootState): THREE.Group {
    const group = new THREE.Group(); const color = rarityColor[state.rarity] ?? 0xffffff;
    if(state.itemId&&isBrWeapon(state.itemId)){this.buildWeaponModel(group,state.itemId,color);group.scale.setScalar(.92);}
    else if(state.ammoType){const ammoColor=state.ammoType==="light"?0x70f5ff:state.ammoType==="heavy"?0xffd84d:0xff6bba;const cell=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.58,8),new THREE.MeshStandardMaterial({color:0x23344d,emissive:ammoColor,emissiveIntensity:.75,metalness:.6,roughness:.23}));cell.rotation.z=Math.PI/2;group.add(cell);for(const side of [-1,1]){const cap=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.08,8),new THREE.MeshBasicMaterial({color:ammoColor}));cap.rotation.z=Math.PI/2;cap.position.x=side*.32;group.add(cap);}}
    else if(state.itemId&&isBrHeal(state.itemId)){const shield=state.itemId.startsWith("shield");const shell=new THREE.Mesh(shield?new THREE.CapsuleGeometry(.18,.38,4,8):new THREE.BoxGeometry(.58,.18,.42),new THREE.MeshStandardMaterial({color:shield?0x5adfff:0xf2f6ff,emissive:shield?0x176b8a:0x4a1723,emissiveIntensity:.45,metalness:.25,roughness:.34}));shell.rotation.z=shield?Math.PI/2:0;group.add(shell);if(!shield){const cross=new THREE.Mesh(new THREE.BoxGeometry(.32,.06,.1),new THREE.MeshBasicMaterial({color:0xff5f70}));cross.position.y=.13;group.add(cross);const crossB=cross.clone();crossB.rotation.y=Math.PI/2;group.add(crossB);}}
    else{const core=new THREE.Mesh(new THREE.OctahedronGeometry(.33,0),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.28,metalness:.35,roughness:.25}));group.add(core);}
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.55, .025, 5, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72 })); ring.rotation.x = Math.PI / 2; ring.position.y = -.24; group.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.12,2.2,6,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending}));beam.position.y=1;group.add(beam);return group;
  }

  private makeCrate(): THREE.Group {
    const group = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(1.55, .9, 1.05), new THREE.MeshStandardMaterial({ color: 0x334d82, emissive: 0x17356f, emissiveIntensity: .55, metalness: .7, roughness: .25 })); shell.position.y = .48; group.add(shell);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(1.62, .13, 1.1), new THREE.MeshBasicMaterial({ color: 0xffd84d })); seam.position.y = .57; group.add(seam);
    const lock = new THREE.Mesh(new THREE.OctahedronGeometry(.18, 0), new THREE.MeshBasicMaterial({ color: 0x70f5ff })); lock.position.set(0, .55, -.56); group.add(lock);
    return group;
  }

  private nearestLoot(position: Vec3): LootVisual | null { let best: LootVisual | null = null; let distance: number = BR_BALANCE.pickupRange; for (const visual of this.loot.values()) { const next = visual.group.position.distanceTo(vec(position)); if (next < distance) { best = visual; distance = next; } } return best; }
  private nearestCrate(position: Vec3): CrateVisual | null { let best: CrateVisual | null = null; let distance = 2.7; for (const visual of this.crates.values()) { const next = visual.group.position.distanceTo(vec(position)); if (next < distance) { best = visual; distance = next; } } return best; }
  private nearestDownedTeammate(local: BrPlayerState): BrPlayerSnapshotState | null { let best: BrPlayerSnapshotState | null = null; let distance: number = BR_BALANCE.reviveRange; for (const visual of this.players.values()) { const state = visual.state; if (!state.downed || state.teamId !== local.teamId || state.id === local.id) continue; const next = visual.group.position.distanceTo(vec(local.position)); if (next < distance) { best = state; distance = next; } } return best; }
  private lootName(state: BrLootState): string { if (state.itemId) return `${state.rarity.toUpperCase()} ${state.itemId.replaceAll("-", " ").toUpperCase()}`; return `${state.ammoType?.toUpperCase()} CELLS`; }
  private lookDirection(): THREE.Vector3 { return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize(); }
  private aimPoint(): THREE.Vector3 { this.raycaster.set(this.camera.position, this.lookDirection()); this.raycaster.far=500; const hit = this.raycaster.intersectObjects(this.islandMeshes, false)[0]; return hit?.point ?? this.camera.position.clone().addScaledVector(this.lookDirection(), 80); }
  private hash(value: string): number { let hash = 0; for (let i = 0; i < value.length; i++) hash = Math.imul(31, hash) + value.charCodeAt(i) | 0; return hash; }

  private cycleSpectator(direction: number): void {
    const candidates = [...this.players.values()].filter((visual) => visual.state.alive && visual.relevant);
    if (!candidates.length) { this.spectatorTargetId = null; return; }
    const current = candidates.findIndex((visual) => visual.state.id === this.spectatorTargetId);
    this.spectatorTargetId = candidates[(current + direction + candidates.length) % candidates.length].state.id;
  }

  private getSpectatorTarget(): PlayerVisual | null {
    const selected = this.spectatorTargetId ? this.players.get(this.spectatorTargetId) : null;
    if (selected?.state.alive && selected.relevant) return selected;
    const local = this.players.get(this.localId)?.state;
    const teammate = [...this.players.values()].find((visual) => visual.state.alive && visual.relevant && visual.state.teamId === local?.teamId);
    const fallback = teammate ?? [...this.players.values()].find((visual) => visual.state.alive && visual.relevant) ?? null;
    this.spectatorTargetId = fallback?.state.id ?? null; return fallback;
  }

  private animateEmote(visual: PlayerVisual, now: number): void {
    const phase = Math.sin(now * .014);
    if (visual.emote === "wave") visual.limbs[1].rotation.z = -.9 + phase * .45;
    else if (visual.emote === "point") visual.limbs[1].rotation.x = -1.35;
    else if (visual.emote === "laugh") visual.body.rotation.z = phase * .12;
    else if (visual.emote === "panic") { visual.limbs[0].rotation.z = .8 + phase * .5; visual.limbs[1].rotation.z = -.8 - phase * .5; }
    else if (visual.emote === "taunt") visual.body.rotation.y += .08;
    else if (visual.emote === "celebrate") { visual.limbs[0].rotation.z = .9; visual.limbs[1].rotation.z = -.9; }
  }

  private predictLocal(frame: InputFrame, dt: number, now: number): void {
    const local = this.localState; if (!local?.alive) return;
    if (!this.predictedMotion) this.predictedMotion = this.motionFromPlayer(local);
    this.predictedMotion = stepBrMovement(this.predictedMotion, { moveX: frame.moveX, moveY: frame.moveY, yaw: this.yaw, jump: frame.jump.held, sprint: frame.burst.held, crouch: frame.crouch.held }, dt, now, (position,desired,options)=>this.physics.move(position,desired,options.jumping,options.crouched));
  }

  private reconcilePrediction(authoritative: BrPlayerState): void {
    if (!authoritative.alive) { this.predictedMotion = null; return; }
    if (!this.predictedMotion) { this.predictedMotion = this.motionFromPlayer(authoritative); return; }
    const prediction = this.predictedMotion; const dx = authoritative.position.x - prediction.position.x; const dy = authoritative.position.y - prediction.position.y; const dz = authoritative.position.z - prediction.position.z; const error = Math.hypot(dx, dy, dz);
    const hardStateChange = prediction.deployment !== authoritative.deployment && (authoritative.deployment === "attached" || authoritative.deployment === "grounded" || authoritative.deployment === "eliminated");
    if (error > 4.5 || hardStateChange) { this.predictedMotion = this.motionFromPlayer(authoritative); return; }
    const correction = error > 1.25 ? .48 : error > .2 ? .22 : .08;
    prediction.position.x += dx * correction; prediction.position.y += dy * correction; prediction.position.z += dz * correction;
    prediction.velocity.x += (authoritative.velocity.x - prediction.velocity.x) * .25; prediction.velocity.y += (authoritative.velocity.y - prediction.velocity.y) * .25; prediction.velocity.z += (authoritative.velocity.z - prediction.velocity.z) * .25;
    prediction.grounded = authoritative.grounded; prediction.deployment = authoritative.deployment; prediction.downed = authoritative.downed;
  }

  private motionFromPlayer(player: BrPlayerState): BrMotionState {
    return { position: { ...player.position }, velocity: { ...player.velocity }, yaw: player.yaw, grounded: player.grounded, deployment: player.deployment, downed: player.downed, lastJumpSignal: false, lastCrouchSignal: false, slideEndsAt: 0, traversalCooldownUntil: 0, lastGroundedAt: player.grounded ? performance.now() : Number.NEGATIVE_INFINITY, jumpBufferedUntil: 0 };
  }

  private controllerAimFriction(): number {
    if (this.input.method !== "gamepad" || !this.localState || this.localState.deployment !== "grounded") return 1;
    const look = this.lookDirection(); const origin = this.predictedMotion?.position ?? this.localState.position; let best = -1;
    for (const visual of this.players.values()) {
      if (!visual.relevant || !visual.state.alive || visual.state.teamId === this.localState.teamId) continue;
      const dx = visual.state.position.x - origin.x; const dy = visual.state.position.y + .7 - (origin.y + .7); const dz = visual.state.position.z - origin.z; const distance = Math.hypot(dx, dy, dz);
      if (distance > 140 || distance < .001) continue;
      best = Math.max(best, (dx * look.x + dy * look.y + dz * look.z) / distance);
    }
    return best > .995 ? .58 : best > .982 ? .8 : 1;
  }

  private updateHeldWeapon(visual: PlayerVisual): void {
    const item = visual.state.heldItem;
    visual.weapon.visible = Boolean(item && isBrWeapon(item.itemId));
    if (!item || !isBrWeapon(item.itemId)) { visual.weaponId=null; return; }
    if(visual.weaponId!==item.itemId){for(const child of [...visual.weapon.children]){visual.weapon.remove(child);this.disposeObject(child);}this.buildWeaponModel(visual.weapon,item.itemId,rarityColor[item.rarity]??0xffffff);visual.weaponId=item.itemId;}
    const recoil=Number(visual.weapon.userData.recoil??0);visual.weapon.position.z=-.34+recoil*.16;visual.weapon.userData.recoil=Math.max(0,recoil-.15);
    visual.limbs[0].rotation.x=THREE.MathUtils.lerp(visual.limbs[0].rotation.x,-.7,.45);visual.limbs[1].rotation.x=THREE.MathUtils.lerp(visual.limbs[1].rotation.x,-.92,.45);
  }

  private buildWeaponModel(group:THREE.Group,id:BrWeaponId,accent:number):void {
    const dark=new THREE.MeshStandardMaterial({color:0x17243c,metalness:.68,roughness:.22});const glow=new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.8,metalness:.4,roughness:.18});
    const box=(x:number,y:number,z:number,px:number,py:number,pz:number,material:THREE.Material=dark)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),material);mesh.position.set(px,py,pz);group.add(mesh);return mesh;};
    if(id==="energy-saber"){const hilt=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.42,8),dark);hilt.rotation.x=Math.PI/2;group.add(hilt);const blade=new THREE.Mesh(new THREE.CapsuleGeometry(.055,1.15,4,8),glow);blade.rotation.x=Math.PI/2;blade.position.z=-.82;group.add(blade);return;}
    const long=id==="rail-laser"?1.35:id==="photon-shotgun"?1.02:id==="plasma-launcher"?.94:.78;box(.22,.24,long,0,0,-long/2);
    box(.16,.34,.2,-.02,-.2,-.2,dark);box(.18,.14,.35,0,.03,-long-.12,glow);
    if(id==="nova-smg"){box(.42,.18,.34,.18,.02,-.32,glow);box(.12,.28,.18,-.08,-.18,-.42);}
    else if(id==="photon-shotgun"){for(const x of [-.11,.11]){const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.75,8),dark);barrel.rotation.x=Math.PI/2;barrel.position.set(x,.03,-.95);group.add(barrel);}box(.48,.16,.22,0,.02,-.45,glow);}
    else if(id==="rail-laser"){box(.08,.08,1.55,.16,.1,-.72,glow);box(.36,.3,.35,0,0,-.5);}
    else if(id==="plasma-launcher"){const chamber=new THREE.Mesh(new THREE.SphereGeometry(.24,9,7),glow);chamber.position.z=-.42;group.add(chamber);const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,.65,10),dark);barrel.rotation.x=Math.PI/2;barrel.position.z=-.86;group.add(barrel);}
    else if(id==="arc-blaster"){for(const x of [-.14,.14])box(.08,.09,.62,x,.03,-.75,glow);}
    else box(.13,.17,.46,.17,.02,-.58,glow);
  }

  private renderState(source: BrPlayerSnapshotState | BrPlayerState): BrPlayerSnapshotState {
    if ("heldItem" in source) return source;
    const heldItem = source.inventory[source.selectedSlot];
    return {
      id: source.id, name: source.name, isBot: source.isBot, connected: source.connected, color: source.color, teamId: source.teamId,
      alive: source.alive, downed: source.downed, deployment: source.deployment, hp: source.hp, shield: source.shield,
      downedHp: source.downedHp, bleedoutEndsAt: source.bleedoutEndsAt, position: { ...source.position }, velocity: { ...source.velocity },
      rotation: { ...source.rotation }, yaw: source.yaw, pitch: source.pitch, grounded: source.grounded, selectedSlot: source.selectedSlot,
      heldItem: heldItem ? { ...heldItem } : null, kills: source.kills, damageDealt: source.damageDealt, revives: source.revives,
      placement: source.placement, equippedCosmetics: { ...source.equippedCosmetics }
    };
  }

  private updateStorm(now:number): void {
    if (!this.room || this.room.phase !== "combat") { this.stormWall.visible = false; return; }
    this.stormWall.visible = true; this.stormWall.position.set(this.room.storm.center.x, 55, this.room.storm.center.z);
    this.stormWall.scale.set(this.room.storm.radius, 1, this.room.storm.radius);
    this.stormWall.rotation.y=now*.000035;
    this.stormWall.children.forEach((child,index)=>{const material=(child as THREE.Mesh).material as THREE.MeshBasicMaterial;if(material){material.opacity=(this.room!.storm.stage==="closing"?.17:.09)+Math.sin(now*.004+index)*.025;}child.rotation.y=(index%2?1:-1)*now*.00004;});
  }

  private updateWorldPresentation(now:number):void {
    const local=this.localState;const airborne=local&&(local.deployment==="attached"||local.deployment==="freefall"||local.deployment==="chute");
    for(const label of this.poiLabels){const distance=local?Math.hypot(local.position.x-label.position.x,local.position.z-label.position.z):999;label.sprite.visible=Boolean(airborne||distance>72)&&this.camera.position.distanceTo(label.position)<780;const scale=THREE.MathUtils.clamp(this.camera.position.distanceTo(label.position)*.032,12,28);label.sprite.scale.set(scale*3.5,scale,1);label.sprite.material.opacity=THREE.MathUtils.clamp((distance-58)/55,.32,.92);}
    const core=this.island.getObjectByName("zero-energy-core");if(core){core.rotation.y=now*.00055;core.position.y=17+Math.sin(now*.002)*1.2;}
    for(const lift of this.island.children.filter((child)=>child.name.startsWith("grav-column")))lift.scale.y=.94+Math.sin(now*.004+lift.position.x)*.06;
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      const renderable = child as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
      if ("geometry" in renderable && renderable.geometry instanceof THREE.BufferGeometry) renderable.geometry.dispose();
      const materials = renderable.material ? Array.isArray(renderable.material) ? renderable.material : [renderable.material] : [];
      for (const material of materials) {
        const spriteMaterial = material as THREE.SpriteMaterial;
        spriteMaterial.map?.dispose();
        material.dispose();
      }
    });
  }

  private buildScene(): void {
    this.scene.background=new THREE.Color(0x030817);this.scene.fog=new THREE.FogExp2(0x07142a,.00055);
    const hemi = new THREE.HemisphereLight(0xc8e6ff, 0x15142e, 2.15); const sun = new THREE.DirectionalLight(0xfff0d4, 3.05); sun.position.set(-180, 260, 120);const rim=new THREE.DirectionalLight(0x7b7cff,1.25);rim.position.set(260,90,-220);this.scene.add(hemi, sun,rim);
    const starGeometry = new THREE.BufferGeometry(); const stars = new Float32Array(3600); const random = seededRandom(4821); for (let i = 0; i < stars.length; i += 3) { const radius = 650 + random() * 650; const theta = random() * Math.PI * 2; const phi = Math.acos(2 * random() - 1); stars[i] = Math.sin(phi) * Math.cos(theta) * radius; stars[i + 1] = Math.cos(phi) * radius; stars[i + 2] = Math.sin(phi) * Math.sin(theta) * radius; } starGeometry.setAttribute("position", new THREE.BufferAttribute(stars, 3)); this.scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xcde7ff, size: 1.55, sizeAttenuation: true })));
    for(const [x,y,z,size,color] of [[-720,260,-650,85,0x472b72],[760,90,-590,58,0x173f6a],[620,-120,760,110,0x54263f]] as const){const planet=new THREE.Mesh(new THREE.IcosahedronGeometry(size,2),new THREE.MeshStandardMaterial({color,roughness:.88,emissive:new THREE.Color(color).multiplyScalar(.12)}));planet.position.set(x,y,z);this.scene.add(planet);}
    const islandShape = new THREE.Shape(); BR_ISLAND_OUTLINE.forEach(([x,z],index)=>index ? islandShape.lineTo(x,z) : islandShape.moveTo(x,z)); islandShape.closePath();
    const top = new THREE.Mesh(new THREE.ExtrudeGeometry(islandShape,{depth:20,bevelEnabled:true,bevelSize:3.5,bevelThickness:2.2,bevelSegments:2}),new THREE.MeshStandardMaterial({color:0x1c3b5b,emissive:0x071529,emissiveIntensity:.38,roughness:.72,metalness:.3})); top.rotation.x=Math.PI/2; top.position.y=-2.2; this.island.add(top);
    const deckMatrices:[THREE.Matrix4[],THREE.Matrix4[]]=[[],[]];for(let x=-440;x<=440;x+=52)for(let z=-430;z<=430;z+=52)if(isInsideBrIsland({x,y:0,z},9)){const matrix=new THREE.Matrix4();matrix.compose(new THREE.Vector3(x+(Math.abs(z/52)%2)*9,.12,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),((x+z)/52)%2*.08),new THREE.Vector3(47,.06,47));deckMatrices[(Math.abs(Math.round(x/52)+Math.round(z/52)))%2].push(matrix);}for(let variant=0;variant<2;variant++){const panels=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:variant?0x264967:0x203e5b,metalness:.38,roughness:.72}),deckMatrices[variant].length);deckMatrices[variant].forEach((matrix,index)=>panels.setMatrixAt(index,matrix));panels.instanceMatrix.needsUpdate=true;this.island.add(panels);}
    const rimCurve=new THREE.CatmullRomCurve3(BR_ISLAND_OUTLINE.map(([x,z])=>new THREE.Vector3(x,.2,z)),true,"catmullrom",.08);const deckRim=new THREE.Mesh(new THREE.TubeGeometry(rimCurve,BR_ISLAND_OUTLINE.length*7,1.7,6,true),new THREE.MeshBasicMaterial({color:0x70f5ff,transparent:true,opacity:.85}));this.island.add(deckRim);
    for(const patch of BR_TERRAIN_PATCHES){const material=new THREE.MeshStandardMaterial({color:patch.color,emissive:new THREE.Color(patch.color).multiplyScalar(patch.kind==="coolant"?.32:.08),emissiveIntensity:patch.kind==="coolant"?.8:.35,metalness:patch.kind==="park"?.04:.42,roughness:patch.kind==="park"?.9:.48});const deck=new THREE.Mesh(new THREE.BoxGeometry(patch.size.x,patch.size.y,patch.size.z),material);deck.position.copy(vec(patch.position));deck.rotation.y=patch.rotation;this.island.add(deck);const border=new THREE.LineSegments(new THREE.EdgesGeometry(deck.geometry),new THREE.LineBasicMaterial({color:patch.kind==="coolant"?0x70f5ff:0x6c91ad,transparent:true,opacity:.7}));border.position.y=patch.size.y/2+.025;deck.add(border);}
    const undersideMaterial=new THREE.MeshStandardMaterial({color:0x111d34,roughness:.42,metalness:.78,side:THREE.DoubleSide});
    const underside = new THREE.Mesh(new THREE.ConeGeometry(BR_MAP.radius*.74,118,18,5,true),undersideMaterial); underside.position.y=-74; underside.rotation.x=Math.PI; this.island.add(underside);
    for(let index=0;index<12;index++){const angle=index/12*Math.PI*2;const rib=new THREE.Mesh(new THREE.BoxGeometry(9,12,345),undersideMaterial);rib.position.set(Math.cos(angle)*170,-30,Math.sin(angle)*170);rib.rotation.y=-angle;rib.rotation.x=.12;this.island.add(rib);}
    const underCore=new THREE.Mesh(new THREE.CylinderGeometry(34,52,88,16),new THREE.MeshStandardMaterial({color:0x162643,emissive:0x165f80,emissiveIntensity:.45,metalness:.7,roughness:.28}));underCore.position.y=-68;this.island.add(underCore);const underGlow=new THREE.Mesh(new THREE.TorusGeometry(45,3.2,8,32),new THREE.MeshBasicMaterial({color:0x70f5ff}));underGlow.rotation.x=Math.PI/2;underGlow.position.y=-47;this.island.add(underGlow);
    const rocketMetal=new THREE.MeshStandardMaterial({color:0x283957,metalness:.82,roughness:.25});const rocketGlow=new THREE.MeshBasicMaterial({color:0x70f5ff,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false});
    const rocketSpine=new THREE.Mesh(new THREE.CylinderGeometry(30,45,122,16),rocketMetal);rocketSpine.position.y=-128;this.island.add(rocketSpine);const spineBand=new THREE.Mesh(new THREE.TorusGeometry(38,2.6,8,24),new THREE.MeshBasicMaterial({color:0xa969ff}));spineBand.rotation.x=Math.PI/2;spineBand.position.y=-120;this.island.add(spineBand);
    for(let index=0;index<6;index++){const angle=index/6*Math.PI*2;const x=Math.cos(angle)*78,z=Math.sin(angle)*78;const mount=new THREE.Mesh(new THREE.BoxGeometry(12,58,12),rocketMetal);mount.position.set(x,-93,z);mount.rotation.y=-angle;this.island.add(mount);const engine=new THREE.Mesh(new THREE.CylinderGeometry(13,19,38,12),rocketMetal);engine.position.set(x,-156,z);this.island.add(engine);const nozzle=new THREE.Mesh(new THREE.ConeGeometry(16,28,12,1,true),new THREE.MeshStandardMaterial({color:0x111b2e,metalness:.9,roughness:.2,side:THREE.DoubleSide}));nozzle.position.set(x,-187,z);nozzle.rotation.x=Math.PI;this.island.add(nozzle);const flame=new THREE.Mesh(new THREE.ConeGeometry(10,58,12,1,true),rocketGlow);flame.position.set(x,-225,z);flame.rotation.x=Math.PI;this.island.add(flame);}
    for(const road of BR_ROADS){const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz);const pavedWidth=road.width*1.7;const mesh=new THREE.Mesh(new THREE.BoxGeometry(length,.28,pavedWidth),new THREE.MeshBasicMaterial({color:road.id.startsWith("ring")?0x34465b:0x405a70}));mesh.position.set((road.from.x+road.to.x)/2,.46,(road.from.z+road.to.z)/2);mesh.rotation.y=-Math.atan2(dz,dx);this.island.add(mesh);const stripe=new THREE.Mesh(new THREE.BoxGeometry(length,.06,1.8),new THREE.MeshBasicMaterial({color:road.id.startsWith("ring")?0xffcf58:0x70f5ff}));stripe.position.y=.18;mesh.add(stripe);for(const side of [-1,1]){const curb=new THREE.Mesh(new THREE.BoxGeometry(length,.18,.75),new THREE.MeshBasicMaterial({color:0xe0edf3}));curb.position.set(0,.17,side*(pavedWidth*.49));mesh.add(curb);const lane=new THREE.Mesh(new THREE.BoxGeometry(length,.05,.46),new THREE.MeshBasicMaterial({color:0x70d8ff}));lane.position.set(0,.19,side*(pavedWidth*.28));mesh.add(lane);}}
    for (const poi of BR_POIS) {
      const districtColor=new THREE.Color(poi.color).lerp(new THREE.Color(poi.style==="farm"?0x315f52:poi.style==="dock"||poi.style==="industrial"?0x4c535c:0x45617f),.62);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(poi.style==="city"||poi.style==="mall"?72:58,poi.style==="city"||poi.style==="mall"?76:63,.38,12),new THREE.MeshStandardMaterial({color:districtColor,emissive:new THREE.Color(poi.color).multiplyScalar(.045),roughness:poi.style==="farm"?.86:.65,metalness:poi.style==="farm"?.08:.28}));pad.position.set(poi.position.x,.16,poi.position.z);this.island.add(pad);
      const ring=new THREE.Mesh(new THREE.RingGeometry(poi.style==="city"||poi.style==="mall"?66:53,poi.style==="city"||poi.style==="mall"?68:55,40),new THREE.MeshBasicMaterial({color:poi.color,transparent:true,opacity:.5,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(poi.position.x,.41,poi.position.z);this.island.add(ring);
      const label = this.makeLabel(poi.name, poi.color); label.position.set(poi.position.x, 36, poi.position.z); label.scale.set(24, 6, 1); this.island.add(label);this.poiLabels.push({sprite:label,position:new THREE.Vector3(poi.position.x,36,poi.position.z)});
      this.island.add(this.buildPoiLandmark(poi));
    }
    const blockGroups=new Map<string,BrMapBlock[]>();
    for(const block of BR_MAP_BLOCKS){const key=`${block.kind}:${block.color}`;const list=blockGroups.get(key);if(list)list.push(block);else blockGroups.set(key,[block]);}
    for(const [key,blocks] of blockGroups){const color=key.slice(key.indexOf(":")+1);const geometry=new THREE.BoxGeometry(1,1,1);const material=new THREE.MeshStandardMaterial({color,emissive:new THREE.Color(color).multiplyScalar(.055),roughness:.5,metalness:.34});const batch=new THREE.InstancedMesh(geometry,material,blocks.length);const matrix=new THREE.Matrix4();blocks.forEach((block,index)=>{const rotation=block.rotation?new THREE.Quaternion().setFromEuler(new THREE.Euler(block.rotation.x,block.rotation.y,block.rotation.z)):new THREE.Quaternion();matrix.compose(vec(block.position),rotation,vec(block.size));batch.setMatrixAt(index,matrix);});batch.instanceMatrix.needsUpdate=true;this.island.add(batch);}
    for(const structure of BR_STRUCTURES){
      const accent=new THREE.Group();accent.position.set(structure.position.x,0,structure.position.z);
      const dark=new THREE.MeshStandardMaterial({color:0x071126,emissive:structure.color,emissiveIntensity:.5,roughness:.22,metalness:.55});
      const side=structure.entrance==="east"||structure.entrance==="west"?structure.size.z:structure.size.x;
      for(let floor=0;floor<structure.floors;floor++){const y=(floor+.55)*(structure.size.y/structure.floors);for(const face of [-1,1]){const windows=new THREE.Mesh(new THREE.BoxGeometry(side*.62,.72,.12),dark);windows.position.set(0,y,face*structure.size.z/2+face*.36);if(structure.entrance==="east"||structure.entrance==="west"){windows.rotation.y=Math.PI/2;windows.position.set(face*structure.size.x/2+face*.36,y,0);}accent.add(windows);}}
      const roofUnit=new THREE.Mesh(new THREE.BoxGeometry(Math.min(6,structure.size.x*.25),1.2,Math.min(5,structure.size.z*.24)),new THREE.MeshStandardMaterial({color:0xd7e9f4,roughness:.45,metalness:.42}));roofUnit.position.set(-structure.size.x*.18,structure.size.y+.8,structure.size.z*.12);accent.add(roofUnit);
      const beaconMast=new THREE.Mesh(new THREE.CylinderGeometry(.16,.23,3,6),dark);beaconMast.position.set(structure.size.x*.24,structure.size.y+1.5,-structure.size.z*.2);accent.add(beaconMast);
      if(structure.style==="reactor"||structure.style==="nexus"){const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(2.1,1),new THREE.MeshBasicMaterial({color:structure.color}));beacon.position.y=structure.size.y+3;accent.add(beacon);}
      if(structure.style==="farm"){for(const sideX of [-1,1]){const planter=new THREE.Mesh(new THREE.SphereGeometry(2.3,7,5),new THREE.MeshStandardMaterial({color:0x4bd18a,roughness:.9}));planter.scale.y=.55;planter.position.set(sideX*structure.size.x*.28,1.1,structure.size.z*.38);accent.add(planter);}}
      this.island.add(accent);
    }
    this.addDistrictProps();
    for (const traversal of BR_TRAVERSAL) { const color = traversal.kind === "grav-lift" ? 0x70f5ff : 0xffd84d; const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.8, .62, 16), new THREE.MeshStandardMaterial({ color:0x263c5d,emissive:color, emissiveIntensity: .45,metalness:.7,roughness:.22 })); pad.position.copy(vec(traversal.position)); this.island.add(pad);const ring=new THREE.Mesh(new THREE.TorusGeometry(2.8,.16,6,20),new THREE.MeshBasicMaterial({color}));ring.rotation.x=Math.PI/2;ring.position.y=.55;pad.add(ring);if(traversal.kind==="grav-lift"){const column=new THREE.Mesh(new THREE.CylinderGeometry(2.35,2.35,traversal.target.y-traversal.position.y,18,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));column.name=`grav-column-${traversal.id}`;column.position.set(traversal.position.x,(traversal.position.y+traversal.target.y)/2,traversal.position.z);this.island.add(column);}else{const arrow=new THREE.Mesh(new THREE.ConeGeometry(.9,2.6,5),new THREE.MeshBasicMaterial({color}));arrow.rotation.x=Math.PI/2;arrow.position.y=.8;const heading=Math.atan2(traversal.target.x-traversal.position.x,-(traversal.target.z-traversal.position.z));arrow.rotation.y=heading;pad.add(arrow);}}
    for (let index = 0; index < 16; index++) { const angle = index / 16 * Math.PI * 2; const thruster = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 18, 10), new THREE.MeshStandardMaterial({ color: 0x222c49, metalness: .65 })); thruster.position.set(Math.cos(angle) * 330, -36, Math.sin(angle) * 330); const glow = new THREE.Mesh(new THREE.CircleGeometry(6, 12), new THREE.MeshBasicMaterial({ color: index % 2 ? 0x70f5ff : 0xa766ff })); glow.rotation.x = Math.PI / 2; glow.position.y = -9.1; thruster.add(glow); this.island.add(thruster); }
    this.scene.add(this.island);
    for(let index=0;index<3;index++){const layer=new THREE.Mesh(new THREE.CylinderGeometry(1+index*.012,1+index*.012,160-index*8,64,3,true),new THREE.MeshBasicMaterial({color:index===1?0x4f8cff:0x9c55ff,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,wireframe:index===2}));layer.position.y=index*2;this.stormWall.add(layer);}this.stormWall.visible = false; this.scene.add(this.stormWall);
    const ship = new THREE.Group(); ship.name = "starliner";
    const shipWhite = new THREE.MeshStandardMaterial({ color: 0xe9f3ff, metalness: .65, roughness: .22 });
    const shipBlue = new THREE.MeshStandardMaterial({ color: 0x4868c9, emissive: 0x152761, emissiveIntensity: .28, metalness: .55, roughness: .28 });
    const shipGlow = new THREE.MeshBasicMaterial({ color: 0x70f5ff, transparent: true, opacity: .86 });
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(7.5, 32, 8, 16), shipWhite); hull.rotation.x = Math.PI / 2; hull.position.y = -5.1; ship.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(22, .9, 20), shipBlue); deck.position.y = -.55; ship.add(deck);
    const cargoSpine=new THREE.Mesh(new THREE.BoxGeometry(13,5.2,23),shipBlue);cargoSpine.position.set(0,-4.2,1.5);ship.add(cargoSpine);for(const side of [-1,1]){const hullBand=new THREE.Mesh(new THREE.BoxGeometry(.65,3.8,25),shipGlow);hullBand.position.set(side*6.7,-4.1,0);ship.add(hullBand);}
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(5.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), shipGlow); cockpit.rotation.x = Math.PI / 2; cockpit.position.set(0, -.6, -11.5); ship.add(cockpit);
    for (const x of [-10.5, 10.5]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(10, .75, 13), shipBlue); wing.position.set(x, -3.1, 1.5); ship.add(wing);
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.1, 8, 10), shipWhite); engine.rotation.x = Math.PI / 2; engine.position.set(x, -3.1, 9); ship.add(engine);
      const engineGlow = new THREE.Mesh(new THREE.CircleGeometry(2.25, 12), shipGlow); engineGlow.position.set(x, -3.1, 13.05); ship.add(engineGlow);
      const trail=new THREE.Mesh(new THREE.ConeGeometry(2.25,20,10,1,true),new THREE.MeshBasicMaterial({color:0x70f5ff,transparent:true,opacity:.45,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));trail.rotation.x=-Math.PI/2;trail.position.set(x,-3.1,22);ship.add(trail);
    }
    for (const x of [-9.5, 9.5]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(.35, 2.1, 19), shipGlow); rail.position.set(x, .8, 0); ship.add(rail); }
    for(const z of [-7,0,7]){const windowBand=new THREE.Mesh(new THREE.BoxGeometry(22.3,.55,2.4),new THREE.MeshBasicMaterial({color:0x78e9ff,transparent:true,opacity:.76}));windowBand.position.set(0,1.15,z);ship.add(windowBand);}const fin=new THREE.Mesh(new THREE.BoxGeometry(1.1,8,10),shipBlue);fin.position.set(0,1.1,12);fin.rotation.x=-.18;ship.add(fin);
    ship.scale.setScalar(.96); ship.visible = false; this.scene.add(ship);
    this.resize();
  }

  private addDistrictProps():void {
    const composite=new THREE.MeshStandardMaterial({color:0xd9e8ee,metalness:.28,roughness:.42});const unitBox=new THREE.BoxGeometry(1,1,1);const pillars=new THREE.InstancedMesh(unitBox,composite,BR_STRUCTURES.length*4);const roofTrim=new THREE.InstancedMesh(unitBox,composite,BR_STRUCTURES.length*4);let pillarIndex=0,trimIndex=0;const matrix=new THREE.Matrix4();
    for(const structure of BR_STRUCTURES){for(const [sx,sz] of [[-1,-1],[-1,1],[1,-1],[1,1]] as const){matrix.compose(new THREE.Vector3(structure.position.x+sx*(structure.size.x/2-.38),structure.size.y/2,structure.position.z+sz*(structure.size.z/2-.38)),new THREE.Quaternion(),new THREE.Vector3(.7,structure.size.y,.7));pillars.setMatrixAt(pillarIndex++,matrix);}for(const [horizontal,side] of [[true,-1],[true,1],[false,-1],[false,1]] as const){const position=horizontal?new THREE.Vector3(structure.position.x,structure.size.y+.72,structure.position.z+side*structure.size.z/2):new THREE.Vector3(structure.position.x+side*structure.size.x/2,structure.size.y+.72,structure.position.z);const scale=horizontal?new THREE.Vector3(structure.size.x,.52,.34):new THREE.Vector3(.34,.52,structure.size.z);matrix.compose(position,new THREE.Quaternion(),scale);roofTrim.setMatrixAt(trimIndex++,matrix);}}
    pillars.instanceMatrix.needsUpdate=true;roofTrim.instanceMatrix.needsUpdate=true;this.island.add(pillars,roofTrim);
    const postGeometry=new THREE.CylinderGeometry(.13,.2,3.8,6);const postMaterial=new THREE.MeshStandardMaterial({color:0x23334c,metalness:.72,roughness:.3});
    const bulbGeometry=new THREE.SphereGeometry(.24,6,5);const bulbMaterial=new THREE.MeshBasicMaterial({color:0x70f5ff});const lightPositions:THREE.Vector3[]=[];
    for(const road of BR_ROADS){const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz),steps=Math.max(1,Math.floor(length/58));for(let i=1;i<steps;i++){const t=i/steps;const px=road.from.x+dx*t,pz=road.from.z+dz*t;const nx=-dz/length,nz=dx/length;for(const side of [-1,1])lightPositions.push(new THREE.Vector3(px+nx*road.width*.58,1.9,pz+nz*road.width*.58));}}
    const posts=new THREE.InstancedMesh(postGeometry,postMaterial,lightPositions.length),bulbs=new THREE.InstancedMesh(bulbGeometry,bulbMaterial,lightPositions.length);lightPositions.forEach((position,index)=>{matrix.makeTranslation(position.x,position.y,position.z);posts.setMatrixAt(index,matrix);matrix.makeTranslation(position.x,position.y+2,position.z);bulbs.setMatrixAt(index,matrix);});posts.instanceMatrix.needsUpdate=true;bulbs.instanceMatrix.needsUpdate=true;this.island.add(posts,bulbs);

    const treeTrunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.35,.5,2.5,6),new THREE.MeshStandardMaterial({color:0x6d4f3f,roughness:.9}),30);const treeTop=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.65,1),new THREE.MeshStandardMaterial({color:0x53c889,roughness:.86}),30);const farm=BR_POIS.find((poi)=>poi.id==="orbital-farms")!;const academy=BR_POIS.find((poi)=>poi.id==="astra-academy")!;for(let i=0;i<30;i++){const base=i<18?farm.position:academy.position;const angle=i*2.39996,radius=32+(i%5)*6;const x=base.x+Math.cos(angle)*radius,z=base.z+Math.sin(angle)*radius;matrix.makeTranslation(x,1.25,z);treeTrunk.setMatrixAt(i,matrix);matrix.compose(new THREE.Vector3(x,3.2,z),new THREE.Quaternion(),new THREE.Vector3(1+(i%3)*.12,.85+(i%2)*.14,1));treeTop.setMatrixAt(i,matrix);}treeTrunk.instanceMatrix.needsUpdate=true;treeTop.instanceMatrix.needsUpdate=true;this.island.add(treeTrunk,treeTop);

    const dock=BR_POIS.find((poi)=>poi.id==="dockyard-7")!;const cargo=new THREE.InstancedMesh(new THREE.BoxGeometry(8,3.2,3.8),new THREE.MeshStandardMaterial({color:0xef8d45,metalness:.45,roughness:.52}),16);for(let i=0;i<16;i++){const row=Math.floor(i/4),column=i%4;matrix.compose(new THREE.Vector3(dock.position.x-42+column*12,1.65,dock.position.z+28+row*6),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),row%2?Math.PI/2:0),new THREE.Vector3(1,1,1));cargo.setMatrixAt(i,matrix);}cargo.instanceMatrix.needsUpdate=true;this.island.add(cargo);

    const panelMaterial=new THREE.MeshStandardMaterial({color:0x285f8a,emissive:0x0c2945,emissiveIntensity:.5,metalness:.62,roughness:.18});const panels=new THREE.InstancedMesh(new THREE.BoxGeometry(6,.18,3.3),panelMaterial,12);for(let i=0;i<12;i++){const x=farm.position.x-40+(i%4)*18,z=farm.position.z-48+Math.floor(i/4)*12;matrix.compose(new THREE.Vector3(x,1.4,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(-.22,0,0)),new THREE.Vector3(1,1,1));panels.setMatrixAt(i,matrix);}panels.instanceMatrix.needsUpdate=true;this.island.add(panels);
  }

  private buildPoiLandmark(poi:BrPoi):THREE.Group {
    const group=new THREE.Group();group.position.set(poi.position.x,.4,poi.position.z);const glow=new THREE.MeshStandardMaterial({color:poi.color,emissive:poi.color,emissiveIntensity:.75,metalness:.55,roughness:.2});const metal=new THREE.MeshStandardMaterial({color:0x243653,metalness:.72,roughness:.3});
    if(poi.style==="nexus"){for(const [radius,y] of [[11,7],[8,13],[5,19]] as const){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.42,7,28),glow);ring.rotation.x=Math.PI/2;ring.position.y=y;group.add(ring);}const core=new THREE.Mesh(new THREE.OctahedronGeometry(4.8,1),glow);core.name="zero-energy-core";core.position.y=13;group.add(core);}
    else if(poi.style==="city"){for(const x of [-12,12]){const sign=new THREE.Mesh(new THREE.BoxGeometry(9,4,.22),glow);sign.position.set(x,8,-4);group.add(sign);}}
    else if(poi.style==="dock"){for(const x of [-17,17]){const mast=new THREE.Mesh(new THREE.BoxGeometry(1.2,15,1.2),metal);mast.position.set(x,7.5,7);const arm=new THREE.Mesh(new THREE.BoxGeometry(11,1,1),glow);arm.position.set(x+(x<0?5:-5),14.5,7);mast.add(arm);group.add(mast);}}
    else if(poi.style==="reactor"){const core=new THREE.Mesh(new THREE.CylinderGeometry(4.5,6,15,12),glow);core.position.y=8;group.add(core);for(const y of [3,8,13]){const ring=new THREE.Mesh(new THREE.TorusGeometry(7,.4,8,24),metal);ring.rotation.x=Math.PI/2;ring.position.y=y;group.add(ring);}}
    else if(poi.style==="academy"){const dome=new THREE.Mesh(new THREE.SphereGeometry(8,16,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:poi.color,transparent:true,opacity:.42,metalness:.25,roughness:.12}));dome.position.y=.2;group.add(dome);}
    else if(poi.style==="mall"){const arch=new THREE.Mesh(new THREE.TorusGeometry(11,1.2,8,22,Math.PI),glow);arch.position.y=.5;group.add(arch);}
    else if(poi.style==="farm"){for(const x of [-13,0,13]){const dome=new THREE.Mesh(new THREE.SphereGeometry(7,12,6,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x63ef8b,transparent:true,opacity:.34,roughness:.18}));dome.position.x=x;group.add(dome);}}
    else if(poi.style==="wreck"){const hull=new THREE.Mesh(new THREE.CapsuleGeometry(4.2,22,7,12),metal);hull.rotation.z=1.2;hull.position.y=5;group.add(hull);const ember=new THREE.PointLight(0xff795f,7,32);ember.position.set(4,3,0);group.add(ember);}
    else {for(const x of [-9,9]){const pipe=new THREE.Mesh(new THREE.TorusGeometry(7,1.1,8,18,Math.PI),metal);pipe.rotation.y=Math.PI/2;pipe.position.set(x,1,0);group.add(pipe);}const pulse=new THREE.PointLight(poi.color,6,35);pulse.position.y=5;group.add(pulse);}
    group.scale.setScalar(poi.style==="nexus"?1.35:poi.style==="reactor"?1.5:poi.style==="wreck"?1.45:1.18);return group;
  }

  private resize(): void { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.settings.graphicsQuality === "low" ? 1 : this.settings.graphicsQuality === "medium" ? 1.35 : 1.8)); this.renderer.setSize(innerWidth, innerHeight); }
}
