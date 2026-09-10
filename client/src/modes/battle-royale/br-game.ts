import * as THREE from "three";
import {
  BR_BALANCE, BR_HEALS, BR_MAP, BR_MAP_BLOCKS, BR_POIS, BR_TRAVERSAL, BR_WEAPONS, isBrHeal, isBrWeapon, isInsideBrIsland, seededRandom, stepBrMovement,
  type BrCrateState, type BrInput, type BrLootState, type BrPlayerSnapshotState, type BrPlayerState, type BrProjectileState, type BrRoomView,
  type BrMotionState, type BrSnapshot, type BrWeaponId, type EmoteType, type Vec3
} from "@planetfall/shared";
import type { GameAudio } from "../../audio";
import { inputLabel, type GameInput, type InputFrame, type InputMethod } from "../../input";
import type { UserSettings } from "../../settings";

type PlayerVisual = { group: THREE.Group; target: THREE.Vector3; label: THREE.Sprite; body: THREE.Mesh; limbs: THREE.Group[]; wings: THREE.Group; weapon: THREE.Mesh; state: BrPlayerSnapshotState; relevant: boolean; emote: EmoteType | null; emoteEndsAt: number };
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
  private aiming = false;
  private predictedMotion: BrMotionState | null = null;
  private readonly temp = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly island = new THREE.Group();
  private readonly stormWall = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 150, 64, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x8d52ff, transparent: true, opacity: .13, side: THREE.DoubleSide, depthWrite: false })
  );

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
    this.input.onMethodChange = (method) => this.onInputMethod?.(method);
    this.buildScene();
    this.canvas.addEventListener("click", () => { if (this.active && !this.mapVisible && document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock().catch(() => undefined); });
    addEventListener("resize", () => this.resize());
  }

  start(room: BrRoomView, localId: string): void {
    this.room = room; this.localId = localId; this.localState = room.players.find((player) => player.id === localId) ?? null; this.active = true; this.lastFrame = performance.now(); this.syncPlayers(room.players);
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  stop(): void { this.active = false; this.renderer.setAnimationLoop(null); document.exitPointerLock?.(); }
  resetMatchVisuals(): void {
    for (const visual of this.players.values()) { this.scene.remove(visual.group); this.disposeObject(visual.group); }
    for (const visual of this.loot.values()) { this.scene.remove(visual.group); this.disposeObject(visual.group); }
    for (const visual of this.crates.values()) { this.scene.remove(visual.group); this.disposeObject(visual.group); }
    for (const visual of this.projectiles.values()) { this.scene.remove(visual.mesh, visual.trail); this.disposeObject(visual.mesh); this.disposeObject(visual.trail); }
    for (const ping of this.pings) { this.scene.remove(ping.group); this.disposeObject(ping.group); }
    this.players.clear(); this.loot.clear(); this.crates.clear(); this.projectiles.clear(); this.pings = []; this.localState = null; this.predictedMotion = null; this.spectatorTargetId = null;
    this.reloadEndsAt = 0; this.useEndsAt = 0; this.lastFireRequestAt = 0;
  }
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
  }

  spawnLoot(states: BrLootState[]): void {
    for (const state of states) {
      if (this.loot.has(state.id)) continue;
      const group = this.makeLoot(state); group.position.copy(vec(state.position)); this.scene.add(group);
      this.loot.set(state.id, { group, state, baseY: state.position.y });
    }
  }
  removeLoot(ids: string[]): void { for (const id of ids) { const visual = this.loot.get(id); if (!visual) continue; this.scene.remove(visual.group); this.disposeObject(visual.group); this.loot.delete(id); } }

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
    const flash = new THREE.PointLight(color, 4, 13, 2); flash.position.copy(vec(payload.origin)); this.scene.add(flash); setTimeout(() => this.scene.remove(flash), 70);
    if (payload.playerId === this.localId) {
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

  damaged(payload: { playerId: string; amount: number; shieldBroken: boolean }): void {
    const visual = this.players.get(payload.playerId); if (visual) { const material = visual.body.material as THREE.MeshStandardMaterial; material.emissive.set(payload.shieldBroken ? 0xffffff : 0x70f5ff); material.emissiveIntensity = 1.4; setTimeout(() => { if (this.players.has(payload.playerId)) { material.emissive.set(visual.state.color); material.emissive.multiplyScalar(.09); material.emissiveIntensity = 1; } }, 95); }
    if (payload.playerId === this.localId) { this.audio.incoming(payload.amount >= 35); this.input.vibrate(120, Math.min(.7, payload.amount / 80)); }
  }

  eliminated(playerId: string): void { const visual = this.players.get(playerId); if (visual) visual.group.visible = false; }

  private frame(now: number): void {
    if (!this.active) return;
    const dt = Math.min(.05, (now - this.lastFrame) / 1000); this.lastFrame = now;
    const frame = this.input.sample(); this.processInput(frame, dt, now);
    this.updatePlayers(dt, now); this.updateLoot(now); this.updateCrates(now); this.updateProjectiles(); this.updatePings(now); this.updateCamera(dt); this.updateShip(); this.updateStorm();
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
    if (frame.fire.held && local.deployment === "grounded" && !local.downed && selectedItem && isBrWeapon(selectedItem.itemId)) {
      const interval = BR_WEAPONS[selectedItem.itemId].fireIntervalMs;
      if (now - this.lastFireRequestAt >= interval * .88) { this.lastFireRequestAt = now; this.onFire?.({ x: local.position.x, y: local.position.y + .72, z: local.position.z }, { x: lookDirection.x, y: lookDirection.y, z: lookDirection.z }, Date.now()); }
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
      visual.group.visible = visual.state.alive && visual.relevant;
      const displayTarget = visual.state.id === this.localId && this.predictedMotion ? this.temp.set(this.predictedMotion.position.x, this.predictedMotion.position.y, this.predictedMotion.position.z) : visual.target;
      visual.group.position.lerp(displayTarget, visual.state.id === this.localId ? Math.min(1, dt * 22) : Math.min(1, dt * 10));
      visual.group.rotation.y = THREE.MathUtils.lerp(visual.group.rotation.y, visual.state.yaw, Math.min(1, dt * 10));
      const speed = Math.hypot(visual.state.velocity.x, visual.state.velocity.z); const run = Math.sin(now * .012 * Math.max(1, speed));
      visual.limbs.forEach((limb, index) => { limb.rotation.x = run * .65 * (index % 2 ? -1 : 1) * Math.min(1, speed / 5); limb.rotation.z = THREE.MathUtils.lerp(limb.rotation.z, 0, Math.min(1, dt * 15)); });
      visual.body.rotation.z = THREE.MathUtils.lerp(visual.body.rotation.z, 0, Math.min(1, dt * 12));
      visual.body.rotation.y = THREE.MathUtils.lerp(visual.body.rotation.y, 0, Math.min(1, dt * 12));
      if (visual.emote && now < visual.emoteEndsAt) this.animateEmote(visual, now);
      else visual.emote = null;
      visual.group.scale.y = visual.state.downed ? .55 : 1;
      visual.wings.visible = visual.state.deployment === "chute";
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
    ship.visible = Boolean(this.room?.ship); if (this.room?.ship) { ship.position.copy(vec(this.room.ship.position)); ship.lookAt(vec(this.room.ship.end)); }
  }

  private updateCamera(dt: number): void {
    const localPlayer = this.players.get(this.localId); if (!localPlayer) return;
    const local = localPlayer.state.alive ? localPlayer : this.getSpectatorTarget() ?? localPlayer;
    if (local.state.deployment === "attached" && this.room?.ship) {
      const shipPosition = vec(this.room.ship.position);
      const route = vec(this.room.ship.end).sub(vec(this.room.ship.start)); route.y = 0; route.normalize();
      const focus = shipPosition.clone().add(new THREE.Vector3(0, -1.4, 0)).addScaledVector(route, 4);
      const desired = shipPosition.clone().addScaledVector(route, -36).add(new THREE.Vector3(0, 21, 0));
      this.camera.position.lerp(desired, Math.min(1, dt * 5)); this.camera.up.set(0, 1, 0); this.camera.lookAt(focus);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 70, Math.min(1, dt * 4)); this.camera.updateProjectionMatrix();
      return;
    }
    const airborne = local.state.deployment === "freefall" || local.state.deployment === "chute" || local.state.deployment === "attached";
    const distance = airborne ? 10.5 : local.state.downed ? 5.5 : this.aiming ? 5.4 : 6.8;
    const look = this.lookDirection(); const focus = local.group.position.clone().add(new THREE.Vector3(0, .85, 0));
    const desired = focus.clone().addScaledVector(look, -distance).add(new THREE.Vector3(0, airborne ? 2.2 : 1.1, 0));
    if (desired.y < .45 && isInsideBrIsland(desired)) desired.y = .45;
    this.camera.position.lerp(desired, Math.min(1, dt * 9)); this.camera.up.set(0, 1, 0); this.camera.lookAt(focus.clone().addScaledVector(look, 5));
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
    const wings = new THREE.Group(); wings.position.set(0, 1.05, .28);
    for (const side of [-1, 1]) { const wing = new THREE.Mesh(new THREE.ConeGeometry(.22, 1.35, 3), new THREE.MeshBasicMaterial({ color: 0x70f5ff, transparent: true, opacity: .78, side: THREE.DoubleSide })); wing.rotation.z = side * 1.12; wing.position.x = side * .72; wings.add(wing); }
    wings.visible = false; group.add(wings);
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(.75, .18, .18), new THREE.MeshStandardMaterial({ color: 0x7fe9ff, emissive: 0x164f66, emissiveIntensity: .65, metalness: .55, roughness: .22 })); weapon.position.set(.5, .92, -.42); weapon.visible = false; group.add(weapon);
    return { group, target: vec(state.position), label, body, limbs, wings, weapon, state, relevant: true, emote: null, emoteEndsAt: 0 };
  }

  private playerMaterial(state: BrPlayerSnapshotState): THREE.Material { return new THREE.MeshStandardMaterial({ color: state.color, emissive: new THREE.Color(state.color).multiplyScalar(.09), roughness: .55, metalness: .08 }); }

  private makeLabel(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128; const context = canvas.getContext("2d")!; context.font = "900 42px Arial"; context.textAlign = "center"; context.textBaseline = "middle"; context.strokeStyle = "#020616"; context.lineWidth = 12; context.strokeText(text.toUpperCase(), 256, 64); context.fillStyle = color; context.fillText(text.toUpperCase(), 256, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })); sprite.renderOrder = 15; return sprite;
  }

  private makeLoot(state: BrLootState): THREE.Group {
    const group = new THREE.Group(); const color = rarityColor[state.rarity] ?? 0xffffff;
    const core = new THREE.Mesh(state.itemId && isBrWeapon(state.itemId) ? new THREE.BoxGeometry(.85, .25, .28) : new THREE.OctahedronGeometry(.33, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .28, metalness: .35, roughness: .25 })); group.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.55, .025, 5, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .55 })); ring.rotation.x = Math.PI / 2; ring.position.y = -.24; group.add(ring); return group;
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
  private aimPoint(): THREE.Vector3 { this.raycaster.set(this.camera.position, this.lookDirection()); const hit = this.raycaster.intersectObject(this.island, true)[0]; return hit?.point ?? this.camera.position.clone().addScaledVector(this.lookDirection(), 80); }
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
    this.predictedMotion = stepBrMovement(this.predictedMotion, { moveX: frame.moveX, moveY: frame.moveY, yaw: this.yaw, jump: frame.jump.held, sprint: frame.burst.held, crouch: frame.crouch.held }, dt, now);
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
    return { position: { ...player.position }, velocity: { ...player.velocity }, yaw: player.yaw, grounded: player.grounded, deployment: player.deployment, downed: player.downed, lastJumpSignal: false, lastCrouchSignal: false, slideEndsAt: 0, traversalCooldownUntil: 0 };
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
    if (!item || !isBrWeapon(item.itemId)) return;
    const material = visual.weapon.material as THREE.MeshStandardMaterial;
    material.color.set(rarityColor[item.rarity] ?? 0xffffff);
    if (item.itemId === "energy-saber") visual.weapon.scale.set(.22, .22, 2.4);
    else if (item.itemId === "photon-shotgun") visual.weapon.scale.set(1.15, 1.45, 1.15);
    else if (item.itemId === "rail-laser") visual.weapon.scale.set(1.6, .8, .8);
    else if (item.itemId === "plasma-launcher") visual.weapon.scale.set(1.25, 1.8, 1.8);
    else visual.weapon.scale.set(1, 1, 1);
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

  private updateStorm(): void {
    if (!this.room || this.room.phase !== "combat") { this.stormWall.visible = false; return; }
    this.stormWall.visible = true; this.stormWall.position.set(this.room.storm.center.x, 55, this.room.storm.center.z);
    this.stormWall.scale.set(this.room.storm.radius, 1, this.room.storm.radius);
    const material = this.stormWall.material as THREE.MeshBasicMaterial;
    material.opacity = this.room.storm.stage === "closing" ? .2 + Math.sin(performance.now() * .006) * .035 : .12;
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
    const hemi = new THREE.HemisphereLight(0x9ecfff, 0x080a20, 1.5); const sun = new THREE.DirectionalLight(0xfff0d4, 2.2); sun.position.set(-120, 210, 80); this.scene.add(hemi, sun);
    const starGeometry = new THREE.BufferGeometry(); const stars = new Float32Array(2700); const random = seededRandom(4821); for (let i = 0; i < stars.length; i += 3) { const radius = 650 + random() * 600; const theta = random() * Math.PI * 2; const phi = Math.acos(2 * random() - 1); stars[i] = Math.sin(phi) * Math.cos(theta) * radius; stars[i + 1] = Math.cos(phi) * radius; stars[i + 2] = Math.sin(phi) * Math.sin(theta) * radius; } starGeometry.setAttribute("position", new THREE.BufferAttribute(stars, 3)); this.scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xb9ddff, size: 1.3, sizeAttenuation: true })));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(BR_MAP.radius, BR_MAP.radius * .88, 16, 64, 1), new THREE.MeshStandardMaterial({ color: 0x172a47, roughness: .82, metalness: .26 })); top.position.y = -8; this.island.add(top);
    const underside = new THREE.Mesh(new THREE.ConeGeometry(BR_MAP.radius * .87, 120, 32, 5, true), new THREE.MeshStandardMaterial({ color: 0x10182e, roughness: .55, metalness: .6, side: THREE.DoubleSide })); underside.position.y = -75; underside.rotation.x = Math.PI; this.island.add(underside);
    for (const poi of BR_POIS) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(48, 52, .65, 18), new THREE.MeshStandardMaterial({ color: new THREE.Color(poi.color).multiplyScalar(.28), roughness: .72, metalness: .25 })); pad.position.set(poi.position.x, .05, poi.position.z); this.island.add(pad);
      const label = this.makeLabel(poi.name, poi.color); label.position.set(poi.position.x, 21, poi.position.z); label.scale.set(18, 4.5, 1); this.island.add(label);
    }
    for (const block of BR_MAP_BLOCKS) {
      const group = new THREE.Group(); group.position.copy(vec(block.position));
      const shell = new THREE.Mesh(new THREE.BoxGeometry(block.size.x, block.size.y, block.size.z), new THREE.MeshStandardMaterial({ color: block.color, emissive: new THREE.Color(block.color).multiplyScalar(.06), roughness: .54, metalness: .3 })); group.add(shell);
      if (block.kind === "building") { const inset = new THREE.Mesh(new THREE.BoxGeometry(block.size.x * .76, block.size.y * .55, block.size.z * 1.012), new THREE.MeshBasicMaterial({ color: 0x091329 })); inset.position.y = -block.size.y * .12; group.add(inset); for (let floor = 0; floor < 2; floor++) { const window = new THREE.Mesh(new THREE.BoxGeometry(block.size.x * .65, .8, block.size.z * 1.02), new THREE.MeshBasicMaterial({ color: 0x70f5ff, transparent: true, opacity: .42 })); window.position.y = floor * 3.1 - 1; group.add(window); } }
      if (block.kind === "wall") { const strip = new THREE.Mesh(new THREE.BoxGeometry(block.size.x * 1.012, .16, block.size.z * 1.012), new THREE.MeshBasicMaterial({ color: block.color })); strip.position.y = block.size.y * .22; group.add(strip); }
      this.island.add(group);
    }
    for (const traversal of BR_TRAVERSAL) { const color = traversal.kind === "grav-lift" ? 0x70f5ff : 0xffd84d; const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.3, .5, 16), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .6 })); pad.position.copy(vec(traversal.position)); this.island.add(pad); }
    for (let index = 0; index < 16; index++) { const angle = index / 16 * Math.PI * 2; const thruster = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 18, 10), new THREE.MeshStandardMaterial({ color: 0x222c49, metalness: .65 })); thruster.position.set(Math.cos(angle) * 330, -36, Math.sin(angle) * 330); const glow = new THREE.Mesh(new THREE.CircleGeometry(6, 12), new THREE.MeshBasicMaterial({ color: index % 2 ? 0x70f5ff : 0xa766ff })); glow.rotation.x = Math.PI / 2; glow.position.y = -9.1; thruster.add(glow); this.island.add(thruster); }
    this.scene.add(this.island);
    this.stormWall.visible = false; this.scene.add(this.stormWall);
    const ship = new THREE.Group(); ship.name = "starliner";
    const shipWhite = new THREE.MeshStandardMaterial({ color: 0xe9f3ff, metalness: .65, roughness: .22 });
    const shipBlue = new THREE.MeshStandardMaterial({ color: 0x4868c9, emissive: 0x152761, emissiveIntensity: .28, metalness: .55, roughness: .28 });
    const shipGlow = new THREE.MeshBasicMaterial({ color: 0x70f5ff, transparent: true, opacity: .86 });
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(7, 28, 8, 16), shipWhite); hull.rotation.x = Math.PI / 2; hull.position.y = -5.1; ship.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(20, .8, 17), shipBlue); deck.position.y = -.55; ship.add(deck);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(5.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), shipGlow); cockpit.rotation.x = Math.PI / 2; cockpit.position.set(0, -.6, -11.5); ship.add(cockpit);
    for (const x of [-10.5, 10.5]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(10, .75, 13), shipBlue); wing.position.set(x, -3.1, 1.5); ship.add(wing);
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.1, 8, 10), shipWhite); engine.rotation.x = Math.PI / 2; engine.position.set(x, -3.1, 9); ship.add(engine);
      const engineGlow = new THREE.Mesh(new THREE.CircleGeometry(2.25, 12), shipGlow); engineGlow.position.set(x, -3.1, 13.05); ship.add(engineGlow);
    }
    for (const x of [-9.5, 9.5]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(.35, 2.1, 17), shipGlow); rail.position.set(x, .8, 0); ship.add(rail); }
    ship.visible = false; this.scene.add(ship);
    this.resize();
  }

  private resize(): void { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.settings.graphicsQuality === "low" ? 1 : this.settings.graphicsQuality === "medium" ? 1.35 : 1.8)); this.renderer.setSize(innerWidth, innerHeight); }
}
