import * as THREE from "three";
import {
  BR_BALANCE, BR_HEALS, BR_POIS, BR_WEAPONS, FREE_EMOTES, SHOP_CATALOG, brMuzzlePosition, isBrHeal, isBrWeapon, isInsideBrIsland, stepBrMovement,
  type BrCrateState, type BrInput, type BrLootState, type BrPoi, type BrPlayerSnapshotState, type BrPlayerState, type BrProjectileState, type BrRoomView,
  type BrMotionState, type BrSnapshot, type BrWeaponId, type EmoteType, type Vec3
} from "@planetfall/shared";
import type { GameAudio } from "../../audio";
import { createAstronautVisual } from "../../astronaut";
import { inputLabel, type GameInput, type InputFrame, type InputMethod } from "../../input";
import type { UserSettings } from "../../settings";
import { ReconciliationTracker } from "../../reconciliation";
import { BrPredictionPhysics } from "./br-physics";
import { brCameraGeometry, brCameraMode } from "./br-camera";
import { createBrBackdrop, createStarliner, createVoidStorm, updateStarliner, updateVoidStorm } from "./br-presentation";
import { BrWorldRenderer, type BrPoiLabel } from "./br-world";
import { brWeaponAccent, buildBrWeaponModel } from "./br-weapons";

type PlayerVisual = { group: THREE.Group; rig: THREE.Group; target: THREE.Vector3; label: THREE.Sprite; body: THREE.Mesh; helmet: THREE.Group; backpack: THREE.Group; suitMaterial: THREE.MeshStandardMaterial; lodDetails: THREE.Object3D[]; limbs: THREE.Group[]; wings: THREE.Group; weapon: THREE.Group; weaponId: BrWeaponId | null; state: BrPlayerSnapshotState; relevant: boolean; emote: EmoteType | null; emoteEndsAt: number };
type LootVisual = { group: THREE.Group; state: BrLootState; baseY: number };
type CrateVisual = { group: THREE.Group; state: BrCrateState; baseY: number };
type ProjectileVisual = { mesh: THREE.Mesh; target: THREE.Vector3; state: BrProjectileState; trail: THREE.Line; points: THREE.Vector3[] };

const vec = (value: Vec3) => new THREE.Vector3(value.x, value.y, value.z);
const rarityColor: Record<string, number> = { common: 0xb8c4dc, rare: 0x54b8ff, epic: 0xc565ff, legendary: 0xffc84f };
const cosmeticColor = (itemId: string, fallback: string): string => SHOP_CATALOG.find((item) => item.id === itemId)?.color ?? fallback;

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
  private pitch = -.08;
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
  private readonly cameraFocus = new THREE.Vector3();
  private readonly cameraDesired = new THREE.Vector3();
  private readonly cameraRay = new THREE.Vector3();
  private readonly cameraRight = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3(0, 1, 0);
  private readonly cameraProbeOrigin = new THREE.Vector3();
  private readonly cameraProbeTarget = new THREE.Vector3();
  private cameraBoom = 6.15;
  private cameraInitialized = false;
  private readonly reconciliationTracker = new ReconciliationTracker();
  private readonly raycaster = new THREE.Raycaster();
  private readonly world: BrWorldRenderer;
  private readonly island: THREE.Group;
  private readonly islandMeshes: THREE.Mesh[];
  private readonly poiLabels: BrPoiLabel[];
  private readonly backdrop = createBrBackdrop();
  private readonly starliner = createStarliner();
  private readonly sun = new THREE.DirectionalLight(0xffe4bd, 3.15);
  private readonly sunTarget = new THREE.Object3D();
  private readonly physics = new BrPredictionPhysics();
  private readonly visitedPois = new Set<string>();
  private currentPoiId = "";
  private debugCameraView: { position: THREE.Vector3; focus: THREE.Vector3 } | null = null;
  private shipCameraStartedAt = 0;
  private disposed = false;
  private readonly handleCanvasClick = () => { if (this.active && !this.mapVisible && document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock().catch(() => undefined); };
  private readonly handleResize = () => this.resize();
  private readonly unsubscribeInputMethod: () => void;
  private readonly stormWall = createVoidStorm();

  constructor(
    private canvas: HTMLCanvasElement,
    private renderer: THREE.WebGLRenderer,
    private input: GameInput,
    private audio: GameAudio,
    settings: UserSettings
  ) {
    this.settings = settings;
    this.world = new BrWorldRenderer(settings.graphicsQuality);
    this.island = this.world.root;
    this.islandMeshes = this.world.collidableMeshes;
    this.poiLabels = this.world.poiLabels;
    this.scene.background = new THREE.Color(0x020512);
    this.scene.fog = new THREE.FogExp2(0x07112c, .0014);
    this.unsubscribeInputMethod = this.input.subscribeMethodChange((method) => { if (this.active) this.onInputMethod?.(method); });
    this.buildScene();
    if (import.meta.env.DEV) this.setDebugView(new URLSearchParams(location.search).get("brView"));
    this.canvas.addEventListener("click", this.handleCanvasClick);
    addEventListener("resize", this.handleResize);
  }

  activate(room: BrRoomView, localId: string): void {
    if (this.disposed) return;
    this.room = room; this.localId = localId; this.localState = room.players.find((player) => player.id === localId) ?? null; this.active = true; this.lastFrame = performance.now(); if (room.phase === "ship") this.shipCameraStartedAt = performance.now(); this.syncPlayers(room.players);
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
    this.players.clear(); this.loot.clear(); this.crates.clear(); this.projectiles.clear(); this.pings = []; this.localState = null; this.predictedMotion = null; this.spectatorTargetId = null; this.cameraInitialized=false;this.cameraBoom=6.15;
    this.reloadEndsAt = 0; this.useEndsAt = 0; this.lastFireRequestAt = 0;this.lastAnticipatedFireAt=0;
    this.physics.reset(); this.reconciliationTracker.reset(); this.visitedPois.clear(); this.currentPoiId = ""; document.body.classList.remove("br-in-void");
  }
  dispose(): void { if (this.disposed) return; this.deactivate(); this.reset(); this.canvas.removeEventListener("click",this.handleCanvasClick); removeEventListener("resize",this.handleResize); this.unsubscribeInputMethod(); this.scene.remove(this.island,this.stormWall,this.backdrop,this.starliner,this.sun,this.sunTarget); this.world.dispose(); this.disposeObject(this.stormWall); this.disposeObject(this.backdrop); this.disposeObject(this.starliner); this.physics.dispose(); this.disposed=true; }
  /** Compatibility aliases retained while callers migrate to the explicit lifecycle. */
  start(room: BrRoomView, localId: string): void { this.activate(room,localId); }
  stop(): void { this.deactivate(); }
  resetMatchVisuals(): void { this.reset(); }
  setSettings(settings: UserSettings): void {
    this.settings = settings;
    this.world.setQuality(settings.graphicsQuality);
    this.sun.castShadow = settings.graphicsQuality === "high";
    this.renderer.shadowMap.enabled = settings.graphicsQuality !== "low";
    this.resize();
  }
  setUiCaptured(captured: boolean): void { this.uiCaptured = captured; if (captured) document.exitPointerLock?.(); }
  setMapVisible(visible: boolean): void { this.mapVisible = visible; this.setUiCaptured(visible); }
  setRoom(room: BrRoomView): void { this.room = room; this.syncPlayers(room.players); }
  getInputMethod(): InputMethod { return this.input.method; }
  setDebugView(poiId: string | null): void {
    if (!import.meta.env.DEV || !poiId) { this.debugCameraView = null; return; }
    const poi = BR_POIS.find((entry) => entry.id === poiId); if (!poi) return;
    const landmark = poi.style === "reactor" || poi.style === "nexus";
    const urban = poi.style === "city" || poi.style === "mall";
    const focus = new THREE.Vector3(poi.position.x, landmark ? 40 : urban ? 3.5 : 5, poi.position.z);
    if (poi.style === "wreck") {
      this.debugCameraView = {
        focus: focus.clone().add(new THREE.Vector3(0, 3, 0)),
        position: focus.clone().add(new THREE.Vector3(-58, 22, 40))
      };
      return;
    }
    const distance = landmark ? 112 : urban ? 48 : 58;
    this.debugCameraView = { focus, position: focus.clone().add(new THREE.Vector3(distance, landmark ? 38 : urban ? 5.5 : 12, distance)) };
  }
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
      reconciliation: this.reconciliationTracker.summary(performance.now()),
      world:{islandObjects:this.island.children.length,shipVisible:this.starliner.visible,...this.world.debugStats()},
      renderer: { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }
    };
  }

  applySnapshot(snapshot: BrSnapshot): void {
    this.localState = snapshot.localPlayer;
    this.reconcilePrediction(snapshot.localPlayer);
    if (!this.room) return;
    if (snapshot.phase === "ship" && this.room.phase !== "ship") this.shipCameraStartedAt = performance.now();
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
    if (visual) {
      const lid=visual.group.getObjectByName("crate-lid");if(lid){lid.rotation.x=-.82;lid.position.y+=.42;lid.position.z+=.28;}
      const seam=visual.group.getObjectByName("crate-seam") as THREE.Mesh|undefined;if(seam&&(seam.material as THREE.MeshBasicMaterial).opacity!==undefined)(seam.material as THREE.MeshBasicMaterial).opacity=1;
      this.playEnergyBurst(visual.group.position, 0xffd84d, 1.6);this.crates.delete(crateId);
      setTimeout(()=>{this.scene.remove(visual.group);this.disposeObject(visual.group);},190);
    }
    this.spawnLoot(drops); this.audio.pickup();
  }

  playEmote(playerId: string, emote: EmoteType, _startedAt: number): void {
    const visual = this.players.get(playerId); if (!visual) return;
    visual.emote = emote; visual.emoteEndsAt = performance.now() + 1600;
  }

  showPing(name: string, position: Vec3, color: string): void {
    const group = new THREE.Group(); group.position.copy(vec(position));
    const marker = new THREE.Mesh(new THREE.ConeGeometry(.32, .8, 6), new THREE.MeshBasicMaterial({ color, depthTest: false })); marker.position.y = 1.2; marker.rotation.z = Math.PI; group.add(marker);
    const label = this.makeLabel(`${name} · MOVE`, color, false); label.position.y = 2.1; label.scale.set(3.4, .85, 1); group.add(label);
    this.scene.add(group); this.pings.push({ group, expiresAt: performance.now() + 6000 });
    while (this.pings.length > 8) { const old = this.pings.shift()!; this.scene.remove(old.group); }
  }

  weaponFired(payload: { playerId: string; weaponId: BrWeaponId; origin: Vec3; direction: Vec3; projectile?: BrProjectileState }): void {
    const color = brWeaponAccent(payload.weaponId);
    const shooter=this.players.get(payload.playerId);if(shooter){shooter.weapon.userData.recoil=1;shooter.body.rotation.x=-.08;}
    const flash = new THREE.PointLight(color, 4, 13, 2); flash.position.copy(vec(payload.origin)); this.scene.add(flash); setTimeout(() => this.scene.remove(flash), 70);
    const burst = new THREE.Mesh(
      payload.weaponId === "rail-laser" ? new THREE.CylinderGeometry(.045, .13, 2.4, 8) : payload.weaponId === "photon-shotgun" ? new THREE.IcosahedronGeometry(.46, 1) : new THREE.IcosahedronGeometry(.2, 1),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .86, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    burst.position.copy(vec(payload.origin)); burst.scale.setScalar(payload.weaponId === "plasma-launcher" ? 1.8 : 1); this.scene.add(burst);
    setTimeout(() => { this.scene.remove(burst); this.disposeObject(burst); }, payload.weaponId === "rail-laser" ? 130 : 85);
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
    const visual = this.players.get(payload.playerId); if (visual) {
      const material = visual.suitMaterial; material.emissive.set(payload.shieldBroken ? 0xffffff : 0x70f5ff); material.emissiveIntensity = 1.4;
      const ripple = new THREE.Mesh(new THREE.SphereGeometry(.82, 14, 10), new THREE.MeshBasicMaterial({ color: payload.shieldBroken ? 0xffffff : 0x65eaff, transparent: true, opacity: payload.shieldBroken ? .52 : .3, wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      ripple.position.y = .82; ripple.scale.set(1.15, 1.35, 1.15); visual.group.add(ripple);
      setTimeout(() => { visual.group.remove(ripple); this.disposeObject(ripple); }, payload.shieldBroken ? 180 : 110);
      setTimeout(() => { if (this.players.has(payload.playerId)) { material.emissive.setHex(0x000000); material.emissiveIntensity = 1; } }, 95);
    }
    if(payload.attackerId===this.localId){const crosshair=document.getElementById("br-crosshair");crosshair?.classList.toggle("shield-break",payload.shieldBroken);crosshair?.classList.add("hit");setTimeout(()=>crosshair?.classList.remove("hit","shield-break"),110);}
    if (payload.playerId === this.localId) { this.audio.incoming(payload.amount >= 35); this.input.vibrate(120, Math.min(.7, payload.amount / 80)); const indicator=document.getElementById("br-damage-direction");if(indicator&&payload.direction){const angle=Math.atan2(payload.direction.x,-payload.direction.z)-this.yaw;indicator.style.setProperty("--damage-angle",`${angle}rad`);indicator.classList.add("visible");setTimeout(()=>indicator.classList.remove("visible"),520);} }
  }

  eliminated(playerId: string): void { const visual = this.players.get(playerId); if (visual) { this.playEnergyBurst(visual.group.position, new THREE.Color(visual.state.color).getHex(), 1.9); visual.group.visible = false; } }

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
    if (this.room?.phase === "lobby" || this.room?.phase === "countdown" || this.room?.phase === "results") {
      if (frame.menuY) this.onMenuNavigate?.(frame.menuY < 0 ? "up" : "down");
      if (frame.menuX) this.onMenuNavigate?.(frame.menuX < 0 ? "left" : "right");
      if (frame.confirm.pressed) this.onMenuNavigate?.("confirm");
      if (frame.cancel.pressed) this.onMenuNavigate?.("back");
      if (frame.emote.pressed) this.triggerEmote(local);
      return;
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
    if (frame.repair.pressed) { const item = local.inventory[local.selectedSlot]; if (item && isBrWeapon(item.itemId)) { const weapon=BR_WEAPONS[item.itemId];if(weapon.ammo&&item.magazine<weapon.magazine&&local.ammo[weapon.ammo]>0&&this.reloadEndsAt<=now&&this.useEndsAt<=now){this.reloadStartedAt = now; this.reloadEndsAt = now + weapon.reloadMs; this.onReload?.();} } }
    if (frame.jump.pressed) {
      if (local.deployment === "attached") this.onJumpShip?.(); else if (local.deployment === "freefall") this.onDeploy?.();
    }
    const lookDirection = this.lookDirection();
    const shot = this.shotSolution(local);
    const selectedItem = local.inventory[local.selectedSlot];
    const reticle=document.getElementById("br-crosshair");
    if(reticle){const weapon=selectedItem&&isBrWeapon(selectedItem.itemId)?BR_WEAPONS[selectedItem.itemId]:null;const speed=Math.hypot(local.velocity.x,local.velocity.z);const spread=weapon?weapon.spread*150+(weapon.pellets>1?5:0):3;const gap=THREE.MathUtils.clamp(4+spread+speed*.28+(this.aiming?-2:0),3,18);reticle.style.setProperty("--reticle-gap",`${gap}px`);reticle.dataset.weapon=weapon?.id??"none";reticle.classList.toggle("aiming",this.aiming);reticle.classList.toggle("blocked",Boolean(this.reloadEndsAt>now||this.useEndsAt>now||shot.blocked));}
    if (frame.fire.held && !shot.blocked && local.deployment === "grounded" && !local.downed && selectedItem && isBrWeapon(selectedItem.itemId) && this.reloadEndsAt <= now && this.useEndsAt <= now) {
      const weapon = BR_WEAPONS[selectedItem.itemId]; const interval = weapon.fireIntervalMs;
      if ((!weapon.ammo || selectedItem.magazine > 0) && now - this.lastFireRequestAt >= interval * .88) { this.lastFireRequestAt = now;this.lastAnticipatedFireAt=now;const shooter=this.players.get(this.localId);if(shooter)shooter.weapon.userData.recoil=.65;if(selectedItem.itemId==="plasma-launcher")this.audio.asteroid();else if(selectedItem.itemId==="photon-shotgun"||selectedItem.itemId==="rail-laser")this.audio.rocket();else this.audio.cannonTrigger(false); this.onFire?.(shot.origin, shot.direction, Date.now()); }
    }
    const interactionPosition = this.predictedMotion?.position ?? local.position;
    const nearbyLoot = this.nearestLoot(interactionPosition);
    const nearbyCrate = this.nearestCrate(interactionPosition);
    const downedTeammate = this.nearestDownedTeammate(local);
    if (frame.interact.pressed && !downedTeammate) {
      if (nearbyLoot) this.onPickup?.(nearbyLoot.state.id);
      else if (nearbyCrate) this.onOpenCrate?.(nearbyCrate.state.id);
      else if (selectedItem && isBrHeal(selectedItem.itemId)) { const heal=BR_HEALS[selectedItem.itemId];const usable=heal.hp>0?local.hp<BR_BALANCE.hp:local.shield<BR_BALANCE.shield;if(usable&&this.useEndsAt<=now&&this.reloadEndsAt<=now){this.useStartedAt = now; this.useEndsAt = now + heal.durationMs; this.onUseItem?.();} }
    }
    if (downedTeammate) this.onRevive?.(downedTeammate.id, frame.interact.held); else if (frame.interact.released) this.onRevive?.("", false);
    if (frame.ping.pressed) { const point = this.aimPoint(); this.onPing?.({ x: point.x, y: point.y, z: point.z }); }
    if (frame.emote.pressed) {
      this.triggerEmote(local, lookDirection);
    }
    const jumpKey = inputLabel("jump", frame.method); const interactKey = inputLabel("interact", frame.method);
    const selectedHeal=selectedItem&&isBrHeal(selectedItem.itemId)?BR_HEALS[selectedItem.itemId]:null;const healUsable=Boolean(selectedHeal&&(selectedHeal.hp>0?local.hp<BR_BALANCE.hp:local.shield<BR_BALANCE.shield));
    this.prompt = local.deployment === "attached" ? `${jumpKey}  JUMP` : local.deployment === "freefall" ? `${jumpKey}  DEPLOY ION WINGS` : downedTeammate ? `HOLD ${interactKey}  REVIVE` : nearbyLoot ? `${interactKey}  PICK UP ${this.lootName(nearbyLoot.state)}` : nearbyCrate ? `${interactKey}  OPEN STAR CRATE` : selectedHeal&&healUsable ? `${interactKey}  USE ${selectedHeal.name}` : selectedItem && isBrWeapon(selectedItem.itemId) && selectedItem.itemId !== "energy-saber" && selectedItem.magazine === 0 ? `${inputLabel("repair", frame.method)}  RELOAD` : "";
    this.inputAccumulator += dt;
    if (this.inputAccumulator >= 1 / BR_BALANCE.inputRate) {
      this.inputAccumulator %= 1 / BR_BALANCE.inputRate;
      this.onInput?.({ sequence: ++this.sequence, dt: Math.min(.1, dt), moveX: frame.moveX, moveY: frame.moveY, yaw: this.yaw, pitch: this.pitch, jump: frame.jump.held, sprint: frame.burst.held, crouch: frame.crouch.held, fire: frame.fire.held, aim: frame.grapple.held, reload: frame.repair.held });
    }
    this.onHud?.({ player: local, players: this.room?.players ?? [], playersRemaining: this.room?.playersRemaining ?? 0, teamsRemaining: this.room?.teamsRemaining ?? 0, storm: this.room?.storm ?? ({ phaseIndex: 0, center: { x: 0, z: 0 }, radius: 0, nextCenter: { x: 0, z: 0 }, nextRadius: 0, stage: "waiting", stageEndsAt: null, damagePerSecond: 0 }), phase: this.room?.phase ?? "lobby", prompt: this.prompt, reloadProgress: this.reloadEndsAt > now ? 1 - (this.reloadEndsAt - now) / Math.max(1, this.reloadEndsAt - this.reloadStartedAt) : 0, useProgress: this.useEndsAt > now ? 1 - (this.useEndsAt - now) / Math.max(1, this.useEndsAt - this.useStartedAt) : 0 });
  }

  private triggerEmote(local: BrPlayerState, direction = this.lookDirection()): void {
    const unlocked = SHOP_CATALOG.filter((item) => item.emote && local.ownedCosmetics.includes(item.id)).map((item) => item.emote!);
    const emotes = [...new Set<EmoteType>([...FREE_EMOTES, ...unlocked])];
    if (!emotes.length) return;
    this.emoteIndex = (this.emoteIndex + 1) % emotes.length;
    const emote = emotes[this.emoteIndex];
    this.onEmote?.(emote, { x: direction.x, y: direction.y, z: direction.z });
    this.playEmote(this.localId, emote, Date.now());
  }

  private selectSlot(slot: number): void { this.reloadEndsAt = 0; this.useEndsAt = 0; this.onSelectSlot?.(slot); if (this.localState) this.localState.selectedSlot = slot; }

  private updatePlayers(dt: number, now: number): void {
    for (const visual of this.players.values()) {
      visual.group.visible = visual.state.alive && visual.relevant && visual.state.deployment !== "attached" && this.room?.phase!=="lobby" && this.room?.phase!=="countdown";
      visual.rig.visible = true;
      const displayTarget = visual.state.id === this.localId && this.predictedMotion ? this.temp.set(this.predictedMotion.position.x, this.predictedMotion.position.y, this.predictedMotion.position.z) : visual.target;
      visual.group.position.lerp(displayTarget, visual.state.id === this.localId ? Math.min(1, dt * 22) : Math.min(1, dt * 10));
      visual.group.rotation.y = THREE.MathUtils.lerp(visual.group.rotation.y, visual.state.yaw, Math.min(1, dt * 10));
      const speed = Math.hypot(visual.state.velocity.x, visual.state.velocity.z); const run = Math.sin(now * .012 * Math.max(1, speed));
      visual.limbs.forEach((limb, index) => { limb.rotation.x = run * .65 * (index % 2 ? -1 : 1) * Math.min(1, speed / 5); limb.rotation.z = THREE.MathUtils.lerp(limb.rotation.z, 0, Math.min(1, dt * 15)); });
      if (visual.state.deployment === "freefall") { visual.limbs[0].rotation.z = .72; visual.limbs[1].rotation.z = -.72; visual.limbs[2].rotation.x = .34; visual.limbs[3].rotation.x = .34; }
      else if (visual.state.deployment === "chute") { visual.limbs[0].rotation.z = .42; visual.limbs[1].rotation.z = -.42; visual.limbs[2].rotation.x = -.16; visual.limbs[3].rotation.x = -.16; }
      else if (visual.state.downed) { visual.limbs[0].rotation.x = -.9 + run * .25; visual.limbs[1].rotation.x = -.9 - run * .25; visual.limbs[2].rotation.x = .65; visual.limbs[3].rotation.x = .65; }
      else if (visual.state.crouched) { visual.limbs[2].rotation.x = .62 + run * .16; visual.limbs[3].rotation.x = .62 - run * .16; }
      visual.body.rotation.x = THREE.MathUtils.lerp(visual.body.rotation.x, 0, Math.min(1, dt * 16));
      visual.body.rotation.z = THREE.MathUtils.lerp(visual.body.rotation.z, 0, Math.min(1, dt * 12));
      visual.body.rotation.y = THREE.MathUtils.lerp(visual.body.rotation.y, 0, Math.min(1, dt * 12));
      if (visual.emote && now < visual.emoteEndsAt) this.animateEmote(visual, now);
      else visual.emote = null;
      const airborne = visual.state.deployment === "freefall" || visual.state.deployment === "chute";
      const targetLean = visual.state.downed ? -1.12 : visual.state.deployment === "freefall" ? .72 : visual.state.deployment === "chute" ? -.14 : visual.state.crouched && speed > 5 ? .3 : Math.min(.2, speed * .016);
      visual.rig.rotation.x = THREE.MathUtils.lerp(visual.rig.rotation.x, targetLean, Math.min(1, dt * 9));
      visual.rig.position.y = THREE.MathUtils.lerp(visual.rig.position.y, visual.state.downed ? .28 : airborne ? .05 : visual.state.crouched ? -.3 : 0, Math.min(1, dt * 10));
      const squash = visual.state.grounded && Math.abs(visual.state.velocity.y) < .2 ? 1 + Math.sin(now * .01) * .008 : 1;
      visual.rig.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      visual.wings.visible = visual.state.deployment === "chute";
      if(visual.wings.visible){visual.wings.scale.x=1+Math.sin(now*.008)*.045;visual.wings.rotation.z=Math.sin(now*.004)*.025;}
      const playerDistance=this.camera.position.distanceTo(visual.group.position);const detailDistance=this.settings.graphicsQuality==="low"?18:this.settings.graphicsQuality==="medium"?36:58;for(const detail of visual.lodDetails)detail.visible=visual.state.id===this.localId||playerDistance<detailDistance;
      this.updateHeldWeapon(visual);
      visual.label.visible = visual.state.id !== this.localId && playerDistance < 145;
      const labelScale = THREE.MathUtils.clamp(playerDistance * .012, 1.5, 3.8); visual.label.scale.set(labelScale * 2.6, labelScale, 1);
    }
  }

  private updateLoot(now: number): void { for (const visual of this.loot.values()) { visual.group.rotation.y += .012; visual.group.position.y = visual.baseY + Math.sin(now * .002 + this.hash(visual.state.id)) * .15; const beam=visual.group.getObjectByName("loot-beam");if(beam)beam.visible=this.camera.position.distanceTo(visual.group.position)<(this.settings.graphicsQuality==="low"?26:this.settings.graphicsQuality==="medium"?48:72); } }
  private updateCrates(now: number): void { for (const visual of this.crates.values()) { visual.group.rotation.y = Math.sin(now * .0007 + this.hash(visual.state.id)) * .08; visual.group.position.y = visual.baseY + Math.sin(now * .0015 + this.hash(visual.state.id)) * .05; } }
  private updateProjectiles(): void {
    for (const visual of this.projectiles.values()) {
      visual.mesh.position.lerp(visual.target, .45);
      if (visual.points.length < 14) visual.points.push(visual.mesh.position.clone());
      else { const recycled = visual.points.shift()!; recycled.copy(visual.mesh.position); visual.points.push(recycled); }
      const positions = visual.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
      visual.points.forEach((point, index) => positions.setXYZ(index, point.x, point.y, point.z));
      positions.needsUpdate = true; visual.trail.geometry.setDrawRange(0, visual.points.length);
    }
  }
  private updatePings(now: number): void { for (let index = this.pings.length - 1; index >= 0; index--) { const ping = this.pings[index]; if (now < ping.expiresAt) { ping.group.position.y += Math.sin(now * .01) * .0015; continue; } this.scene.remove(ping.group); this.pings.splice(index, 1); } }
  private updateShip(): void {
    updateStarliner(this.starliner, this.room, performance.now());
    if (!this.starliner.visible || this.localState?.deployment === "attached") return;
    // Once a player has jumped, the very large transport can cross the camera
    // boom and completely hide the island. Keep it in the wider aerial view,
    // but cull it while it is inside the player's immediate camera envelope.
    if (this.starliner.position.distanceToSquared(this.camera.position) < 62 * 62) this.starliner.visible = false;
  }

  private updateCamera(dt: number): void {
    if (this.debugCameraView) { this.cameraInitialized=false;this.camera.position.lerp(this.debugCameraView.position, Math.min(1, dt * 4)); this.camera.up.set(0, 1, 0); this.camera.lookAt(this.debugCameraView.focus); this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 60, Math.min(1, dt * 4)); this.camera.updateProjectionMatrix(); return; }
    if(this.room?.phase==="lobby"||this.room?.phase==="countdown"){
      this.cameraInitialized=false;const time=performance.now()*.000035;const focus=new THREE.Vector3(-25,0,15);const desired=new THREE.Vector3(Math.sin(time)*570,330,Math.cos(time)*570);this.camera.position.lerp(desired,Math.min(1,dt*2.2));this.camera.up.set(0,1,0);this.camera.lookAt(focus);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,58,Math.min(1,dt*3));this.camera.updateProjectionMatrix();return;
    }
    const localPlayer = this.players.get(this.localId);
    if (this.room?.phase === "ship" && this.room.ship && (!localPlayer || localPlayer.state.deployment === "attached")) {
      this.cameraInitialized=false;const shipPosition = vec(this.room.ship.position); const route = vec(this.room.ship.end).sub(vec(this.room.ship.start)); route.y = 0; route.normalize();
      const side = new THREE.Vector3(-route.z, 0, route.x); const establishing = performance.now() - this.shipCameraStartedAt < 1650;
      const focus = shipPosition.clone().addScaledVector(route, establishing ? 12 : 24).add(new THREE.Vector3(0, establishing ? 0 : -5, 0));
      const desired = shipPosition.clone().addScaledVector(route, establishing ? -58 : -108).addScaledVector(side,establishing ? 55 : 34).add(new THREE.Vector3(0,establishing ? 38 : 46,0));
      this.camera.position.lerp(desired,Math.min(1,dt*5));this.camera.up.set(0,1,0);this.camera.lookAt(focus);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,70,Math.min(1,dt*4));this.camera.updateProjectionMatrix();return;
    }
    if (!localPlayer) return;
    const local = localPlayer.state.alive ? localPlayer : this.getSpectatorTarget() ?? localPlayer;
    const spectator=!localPlayer.state.alive&&local.state.id!==localPlayer.state.id;
    const speed=Math.hypot(local.state.velocity.x,local.state.velocity.z);
    const mode=brCameraMode(local.state.deployment,local.state.downed,this.aiming,spectator);
    const rig=brCameraGeometry({x:local.group.position.x,y:local.group.position.y,z:local.group.position.z},this.yaw,this.pitch,mode,speed);
    this.cameraFocus.set(rig.focus.x,rig.focus.y,rig.focus.z);
    this.cameraDesired.set(rig.desired.x,rig.desired.y,rig.desired.z);
    this.cameraRight.set(rig.right.x,0,rig.right.z);
    if(this.cameraDesired.y<.42&&isInsideBrIsland(this.cameraDesired))this.cameraDesired.y=.42;
    const obstructionDistance=this.cameraObstructionDistance(this.cameraFocus,this.cameraDesired,this.cameraRight);
    const targetBoom=Math.min(rig.boom,Math.max(.55,obstructionDistance-.32));
    const obstructionClosing=targetBoom<this.cameraBoom;
    this.cameraBoom=THREE.MathUtils.lerp(this.cameraBoom,targetBoom,1-Math.exp(-(obstructionClosing?26:7)*dt));
    const boomRatio=rig.boom>0?this.cameraBoom/rig.boom:1;
    this.cameraProbeTarget.copy(this.cameraFocus).lerp(this.cameraDesired,boomRatio);
    if(!this.cameraInitialized){this.camera.position.copy(this.cameraProbeTarget);this.cameraInitialized=true;}
    else this.camera.position.lerp(this.cameraProbeTarget,1-Math.exp(-(obstructionClosing?24:18)*dt));
    this.camera.up.set(0,1,0);
    this.cameraProbeOrigin.set(rig.aimDirection.x,rig.aimDirection.y,rig.aimDirection.z).multiplyScalar(80).add(this.camera.position);
    this.camera.lookAt(this.cameraProbeOrigin);
    this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,rig.fov,1-Math.exp(-7*dt));this.camera.updateProjectionMatrix();
    // When a wall must shorten the boom to first-person distance, hiding only
    // the local rig avoids filling the screen with helmet/boots while retaining
    // collision-correct visibility. It returns immediately as the boom clears.
    if(local.state.id===this.localId)local.rig.visible=this.cameraBoom>1.2;
  }

  private cameraObstructionDistance(focus:THREE.Vector3,desired:THREE.Vector3,right:THREE.Vector3):number {
    this.cameraRay.copy(desired).sub(focus);const maximum=this.cameraRay.length();if(maximum<.001)return maximum;this.cameraRay.divideScalar(maximum);
    let nearest=maximum;
    const lateral=[0,.22,-.22,0,0];const vertical=[0,0,0,.18,-.18];
    for(let index=0;index<lateral.length;index++){
      this.cameraProbeOrigin.copy(focus).addScaledVector(right,lateral[index]).addScaledVector(this.cameraUp,vertical[index]);
      this.raycaster.set(this.cameraProbeOrigin,this.cameraRay);this.raycaster.far=maximum;
      const hit=this.raycaster.intersectObjects(this.islandMeshes,false).find((candidate)=>candidate.distance>.25);
      if(hit)nearest=Math.min(nearest,hit.distance);
    }
    return nearest;
  }

  private syncPlayers(states: Array<BrPlayerSnapshotState | BrPlayerState>, relevanceSnapshot = false): void {
    if (relevanceSnapshot) for (const visual of this.players.values()) visual.relevant = visual.state.id === this.localId;
    for (const source of states) {
      const state = this.renderState(source);
      let visual = this.players.get(state.id);
      if (!visual) { visual = this.makePlayer(state); this.players.set(state.id, visual); this.scene.add(visual.group); }
      visual.state = state; visual.relevant = true; visual.target.copy(vec(state.position)); visual.suitMaterial.color.set(cosmeticColor(state.equippedCosmetics.suit, state.color));
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
    const group = new THREE.Group();
    const astronaut = createAstronautVisual({
      identityColor: state.color,
      suitAccent: cosmeticColor(state.equippedCosmetics.suit, state.color),
      isBot: state.isBot,
      castShadow: true
    });
    const rig = astronaut.group;
    rig.rotation.y = Math.PI;
    group.add(rig);
    const body = astronaut.torso;
    const limbs = [astronaut.leftArm, astronaut.rightArm, astronaut.leftLeg, astronaut.rightLeg];
    const label = this.makeLabel(`${state.name}${state.isBot ? "  BOT" : ""}`, state.color); label.position.y = 2.25; group.add(label); group.position.copy(vec(state.position));
    const wings = new THREE.Group(); wings.position.set(0, .16, -.12);const wingColor=cosmeticColor(state.equippedCosmetics.trail,"#70f5ff");const wingMaterial=new THREE.MeshBasicMaterial({color:wingColor,transparent:true,opacity:.72,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
    const packMaterial=new THREE.MeshStandardMaterial({color:0x263b5b,emissive:0x145a78,emissiveIntensity:.45,metalness:.7,roughness:.25});
    const pack=new THREE.Mesh(new THREE.BoxGeometry(.58,.68,.24),packMaterial);pack.position.z=.04;wings.add(pack);
    const packCore=new THREE.Mesh(new THREE.OctahedronGeometry(.19,1),new THREE.MeshBasicMaterial({color:wingColor}));packCore.position.set(0,.08,-.16);wings.add(packCore);
    for (const side of [-1, 1]) for(const upper of [0,1]){
      const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(side*(upper?1.35:1.05),upper?.72:-.62);shape.lineTo(side*(upper?1.7:1.48),upper?.2:-.28);shape.closePath();
      const wingGeometry=new THREE.ShapeGeometry(shape);const wing=new THREE.Mesh(wingGeometry,wingMaterial);wing.position.set(side*.26,upper?.15:-.12,-.08);wings.add(wing);
      const outline=new THREE.LineSegments(new THREE.EdgesGeometry(wingGeometry),new THREE.LineBasicMaterial({color:0xe9fdff,transparent:true,opacity:.82}));outline.position.copy(wing.position);wings.add(outline);
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,upper?1.25:1.05,6),packMaterial);arm.position.set(side*(upper?.66:.55),upper?.38:-.31,-.035);arm.rotation.z=side*(upper?-.93:-1.02);wings.add(arm);
      const emitter=new THREE.Mesh(new THREE.SphereGeometry(.13,6,5),new THREE.MeshBasicMaterial({color:0xffffff}));emitter.position.set(side*.29,upper?.18:-.16,-.02);wings.add(emitter);
    }
    wings.visible = false; astronaut.backpack.add(wings);
    const weapon = new THREE.Group(); weapon.position.set(.46, 1.02, .34); weapon.rotation.y = Math.PI; weapon.visible = false; rig.add(weapon);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.48, 18), new THREE.MeshBasicMaterial({ color: 0x02050b, transparent: true, opacity: .38, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .025; group.add(shadow);
    return { group, rig, target: vec(state.position), label, body, helmet: astronaut.helmet, backpack: astronaut.backpack, suitMaterial: astronaut.suitMaterial, lodDetails: astronaut.lodDetails, limbs, wings, weapon, weaponId:null, state, relevant: true, emote: null, emoteEndsAt: 0 };
  }

  private makeLabel(text: string, color: string, depthTest = true): THREE.Sprite {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128; const context = canvas.getContext("2d")!; context.font = "900 42px Arial"; context.textAlign = "center"; context.textBaseline = "middle"; context.strokeStyle = "#020616"; context.lineWidth = 12; context.strokeText(text.toUpperCase(), 256, 64); context.fillStyle = color; context.fillText(text.toUpperCase(), 256, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest, depthWrite: false })); sprite.renderOrder = 15; return sprite;
  }

  private makeLoot(state: BrLootState): THREE.Group {
    const group = new THREE.Group(); const color = rarityColor[state.rarity] ?? 0xffffff;
    if(state.itemId&&isBrWeapon(state.itemId)){this.buildWeaponModel(group,state.itemId,color);group.scale.setScalar(.92);}
    else if(state.ammoType){const ammoColor=state.ammoType==="light"?0x70f5ff:state.ammoType==="heavy"?0xffd84d:0xff6bba;const cell=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.58,8),new THREE.MeshStandardMaterial({color:0x23344d,emissive:ammoColor,emissiveIntensity:.75,metalness:.6,roughness:.23}));cell.rotation.z=Math.PI/2;group.add(cell);for(const side of [-1,1]){const cap=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.08,8),new THREE.MeshBasicMaterial({color:ammoColor}));cap.rotation.z=Math.PI/2;cap.position.x=side*.32;group.add(cap);}}
    else if(state.itemId&&isBrHeal(state.itemId)){const shield=state.itemId.startsWith("shield");const shell=new THREE.Mesh(shield?new THREE.CapsuleGeometry(.18,.38,4,8):new THREE.BoxGeometry(.58,.18,.42),new THREE.MeshStandardMaterial({color:shield?0x5adfff:0xf2f6ff,emissive:shield?0x176b8a:0x4a1723,emissiveIntensity:.45,metalness:.25,roughness:.34}));shell.rotation.z=shield?Math.PI/2:0;group.add(shell);if(!shield){const cross=new THREE.Mesh(new THREE.BoxGeometry(.32,.06,.1),new THREE.MeshBasicMaterial({color:0xff5f70}));cross.position.y=.13;group.add(cross);const crossB=cross.clone();crossB.rotation.y=Math.PI/2;group.add(crossB);}}
    else{const core=new THREE.Mesh(new THREE.OctahedronGeometry(.33,0),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.28,metalness:.35,roughness:.25}));group.add(core);}
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.55, .025, 5, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72 })); ring.rotation.x = Math.PI / 2; ring.position.y = -.24; group.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.12,2.2,6,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending}));beam.name="loot-beam";beam.position.y=1;group.add(beam);const shadow=new THREE.Mesh(new THREE.CircleGeometry(.42,14),new THREE.MeshBasicMaterial({color:0x02050b,transparent:true,opacity:.22,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.28;group.add(shadow);return group;
  }

  private makeCrate(): THREE.Group {
    const group = new THREE.Group();
    const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x273a61, emissive: 0x112856, emissiveIntensity: .48, metalness: .76, roughness: .24 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c7d1, metalness: .82, roughness: .2 });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(1.65, .92, 1.12), shellMaterial); shell.position.y = .5; shell.castShadow = true; group.add(shell);
    for (const x of [-.74, .74]) for (const z of [-.48, .48]) { const corner = new THREE.Mesh(new THREE.BoxGeometry(.15, 1.02, .15), trimMaterial); corner.position.set(x, .5, z); group.add(corner); }
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.72, .2, 1.18), trimMaterial); lid.name="crate-lid";lid.position.y = 1.01; group.add(lid);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(1.76, .1, 1.2), new THREE.MeshBasicMaterial({ color: 0xffd84d,transparent:true,opacity:.76 })); seam.name="crate-seam";seam.position.y = .72; group.add(seam);
    const lockBase = new THREE.Mesh(new THREE.BoxGeometry(.42, .35, .12), trimMaterial); lockBase.position.set(0, .61, -.62); group.add(lockBase);
    const lock = new THREE.Mesh(new THREE.OctahedronGeometry(.18, 1), new THREE.MeshBasicMaterial({ color: 0x70f5ff })); lock.position.set(0, .63, -.7); group.add(lock);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.05, 18), new THREE.MeshBasicMaterial({ color: 0x02050b, transparent: true, opacity: .28, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; group.add(shadow);
    return group;
  }

  private playEnergyBurst(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group(); group.position.copy(at);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .82, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(.3, .42, 24), material); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(scale); group.add(ring);
    for (let index = 0; index < 8; index++) { const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(.12), material); const angle = index / 8 * Math.PI * 2; shard.position.set(Math.cos(angle) * scale, .45 + index % 2 * .28, Math.sin(angle) * scale); group.add(shard); }
    this.scene.add(group);
    setTimeout(() => { this.scene.remove(group); this.disposeObject(group); }, 230);
  }

  private nearestLoot(position: Vec3): LootVisual | null { let best: LootVisual | null = null; let distance: number = BR_BALANCE.pickupRange; for (const visual of this.loot.values()) { const next = visual.group.position.distanceTo(vec(position)); if (next < distance) { best = visual; distance = next; } } return best; }
  private nearestCrate(position: Vec3): CrateVisual | null { let best: CrateVisual | null = null; let distance = 2.7; for (const visual of this.crates.values()) { const next = visual.group.position.distanceTo(vec(position)); if (next < distance) { best = visual; distance = next; } } return best; }
  private nearestDownedTeammate(local: BrPlayerState): BrPlayerSnapshotState | null { let best: BrPlayerSnapshotState | null = null; let distance: number = BR_BALANCE.reviveRange; for (const visual of this.players.values()) { const state = visual.state; if (!state.downed || state.teamId !== local.teamId || state.id === local.id) continue; const next = visual.group.position.distanceTo(vec(local.position)); if (next < distance) { best = state; distance = next; } } return best; }
  private lootName(state: BrLootState): string { if (state.itemId) return `${state.rarity.toUpperCase()} ${state.itemId.replaceAll("-", " ").toUpperCase()}`; return `${state.ammoType?.toUpperCase()} CELLS`; }
  private lookDirection(): THREE.Vector3 { return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize(); }
  private aimPoint(): THREE.Vector3 { this.raycaster.set(this.camera.position, this.lookDirection()); this.raycaster.far=500; const hit = this.raycaster.intersectObjects(this.islandMeshes, false)[0]; return hit?.point ?? this.camera.position.clone().addScaledVector(this.lookDirection(), 80); }
  private shotSolution(player: BrPlayerState): { origin: Vec3; direction: Vec3; blocked: boolean } {
    const shotPosition=player.id===this.localId&&this.predictedMotion?this.predictedMotion.position:player.position;
    const origin = brMuzzlePosition(shotPosition, this.yaw, this.pitch);
    const aimPoint = this.aimPoint();
    const direction = aimPoint.sub(vec(origin));
    const distance = Math.max(.001, direction.length());
    direction.divideScalar(distance);
    this.raycaster.set(vec(origin), direction);
    this.raycaster.far = distance;
    const obstruction = this.raycaster.intersectObjects(this.islandMeshes, false)[0];
    return { origin, direction: { x: direction.x, y: direction.y, z: direction.z }, blocked: Boolean(obstruction && obstruction.distance < distance - .16) };
  }
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
    const snapped = error > 4.5 || hardStateChange;
    if (import.meta.env.DEV) this.reconciliationTracker.record(error, snapped, performance.now());
    if (snapped) { this.predictedMotion = this.motionFromPlayer(authoritative); return; }
    const correction = error > 1.25 ? .48 : error > .2 ? .22 : .08;
    prediction.position.x += dx * correction; prediction.position.y += dy * correction; prediction.position.z += dz * correction;
    prediction.velocity.x += (authoritative.velocity.x - prediction.velocity.x) * .25; prediction.velocity.y += (authoritative.velocity.y - prediction.velocity.y) * .25; prediction.velocity.z += (authoritative.velocity.z - prediction.velocity.z) * .25;
    prediction.grounded = authoritative.grounded; prediction.deployment = authoritative.deployment; prediction.downed = authoritative.downed;
  }

  private motionFromPlayer(player: BrPlayerState): BrMotionState {
    return { position: { ...player.position }, velocity: { ...player.velocity }, yaw: player.yaw, grounded: player.grounded, crouched: player.crouched, deployment: player.deployment, downed: player.downed, lastJumpSignal: false, lastCrouchSignal: false, slideEndsAt: 0, traversalCooldownUntil: 0, lastGroundedAt: player.grounded ? performance.now() : Number.NEGATIVE_INFINITY, jumpBufferedUntil: 0 };
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
    buildBrWeaponModel(group, id, accent);
  }

  private renderState(source: BrPlayerSnapshotState | BrPlayerState): BrPlayerSnapshotState {
    if ("heldItem" in source) return source;
    const heldItem = source.inventory[source.selectedSlot];
    return {
      id: source.id, name: source.name, isBot: source.isBot, connected: source.connected, color: source.color, teamId: source.teamId,
      alive: source.alive, downed: source.downed, deployment: source.deployment, hp: source.hp, shield: source.shield,
      downedHp: source.downedHp, bleedoutEndsAt: source.bleedoutEndsAt, position: { ...source.position }, velocity: { ...source.velocity },
      rotation: { ...source.rotation }, yaw: source.yaw, pitch: source.pitch, grounded: source.grounded, crouched: source.crouched, selectedSlot: source.selectedSlot,
      heldItem: heldItem ? { ...heldItem } : null, kills: source.kills, damageDealt: source.damageDealt, revives: source.revives,
      placement: source.placement, equippedCosmetics: { ...source.equippedCosmetics }
    };
  }

  private updateStorm(now:number): void {
    if (!this.room || this.room.phase !== "combat") { this.stormWall.visible = false; document.body.classList.remove("br-in-void"); return; }
    updateVoidStorm(this.stormWall, this.room, now);
    const local = this.localState;
    const outside = Boolean(local?.alive && Math.hypot(local.position.x - this.room.storm.center.x, local.position.z - this.room.storm.center.z) > this.room.storm.radius);
    document.body.classList.toggle("br-in-void", outside);
  }

  private updateWorldPresentation(now:number):void {
    this.world.update(this.camera, now);
    const local=this.localState;const airborne=local&&(local.deployment==="attached"||local.deployment==="freefall"||local.deployment==="chute");
    if(local?.deployment==="grounded"){this.temp.set(local.position.x,0,local.position.z);this.sunTarget.position.lerp(this.temp,.08);this.sun.position.set(this.sunTarget.position.x-105,this.sunTarget.position.y+190,this.sunTarget.position.z+82);}
    for(const label of this.poiLabels){const distance=local?Math.hypot(local.position.x-label.position.x,local.position.z-label.position.z):999;label.sprite.visible=Boolean(airborne||distance>82)&&this.camera.position.distanceTo(label.position)<780;const scale=THREE.MathUtils.clamp(this.camera.position.distanceTo(label.position)*.021,7.5,16);label.sprite.scale.set(scale*2.35,scale*.62,1);label.sprite.material.opacity=THREE.MathUtils.clamp((distance-70)/65,.24,.82);}
    if (local?.alive && local.deployment === "grounded") {
      let nearest: BrPoi | null = null; let nearestDistance = 82;
      for (const poi of BR_POIS) { const distance = Math.hypot(local.position.x - poi.position.x, local.position.z - poi.position.z); if (distance < nearestDistance) { nearest = poi; nearestDistance = distance; } }
      if (nearest && nearest.id !== this.currentPoiId) { this.currentPoiId = nearest.id; if (!this.visitedPois.has(nearest.id)) { this.visitedPois.add(nearest.id); this.showPoiTitle(nearest); } }
      else if (!nearest) this.currentPoiId = "";
    }
  }

  private showPoiTitle(poi: BrPoi): void {
    const title = document.createElement("div"); title.className = "br-poi-arrival"; title.style.setProperty("--poi-accent", poi.color);
    title.innerHTML = `<span>NOW ENTERING</span><b>${poi.name}</b>`; document.body.append(title);
    setTimeout(() => title.remove(), 2600);
  }

  private disposeObject(object: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    object.traverse((child) => {
      const renderable = child as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
      if ("geometry" in renderable && renderable.geometry instanceof THREE.BufferGeometry) geometries.add(renderable.geometry);
      const objectMaterials = renderable.material ? Array.isArray(renderable.material) ? renderable.material : [renderable.material] : [];
      for (const material of objectMaterials) { materials.add(material); const map = (material as THREE.SpriteMaterial).map; if (map) textures.add(map); }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
  }

  private buildScene(): void {
    this.scene.background = new THREE.Color(0x020612);
    this.scene.fog = new THREE.FogExp2(0x0a1930, .00046);
    const hemisphere = new THREE.HemisphereLight(0xbadfff, 0x171529, 1.72);
    this.sun.position.set(-230, 330, 155);
    this.sun.target = this.sunTarget;
    this.sun.castShadow = this.settings.graphicsQuality === "high";
    this.sun.shadow.mapSize.set(1536, 1536);
    this.sun.shadow.camera.left = -105;
    this.sun.shadow.camera.right = 105;
    this.sun.shadow.camera.top = 105;
    this.sun.shadow.camera.bottom = -105;
    this.sun.shadow.camera.near = 25;
    this.sun.shadow.camera.far = 430;
    this.sun.shadow.bias = -.00018;
    const rim = new THREE.DirectionalLight(0x756dff, 1.05);
    rim.position.set(310, 100, -260);
    this.scene.add(hemisphere, this.sun, this.sunTarget, rim, this.backdrop, this.island, this.stormWall, this.starliner);
    this.renderer.shadowMap.enabled = this.settings.graphicsQuality !== "low";
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.resize();
  }

  /** Kept temporarily as a visual-reference implementation while the authored renderer is validated. */
  private resize(): void { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.settings.graphicsQuality === "low" ? 1 : this.settings.graphicsQuality === "medium" ? 1.35 : 1.8)); this.renderer.setSize(innerWidth, innerHeight); }
}
