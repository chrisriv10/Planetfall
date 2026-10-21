import {brShotDirectionAllowed,brVehicleSeatIndex,BR_VEHICLE_DEFINITIONS} from "@planetfall/shared";
import {createBrTeamVehicle,updateBrTeamVehicle,type BrTeamVehicleVisual} from "./br-team-vehicles";
import { brWeaponStats, isBrUtility, BR_UTILITIES, type BrWorldEffect } from "@planetfall/shared";
import { BrUtilityEffects } from "./br-utility-effects";
import {BrBeamEffects,type BrBeamPresentation} from "./br-beam-effects";
import {BrUtilityModelLibrary} from "./br-utilities";
import {BrScanMarkers} from "./br-scan-markers";
import {brProjectileStyle} from "./br-projectile-style";
import * as THREE from "three";
import { frameDeltaSeconds } from "../../frame-time";
import { BrNeonRenderer } from "./br-neon";
import {brWorldDrawDue,brLobbyPresentationDue,brShadowDrawDue,withBrShadowRefresh} from "./br-render-cadence";
import { brBaseDeckHeight } from "@planetfall/shared";
import {
  BR_BALANCE, BR_HEALS, BR_POIS, BR_SECONDARY_LOCATIONS, BR_WEAPONS, FREE_EMOTES, SHOP_CATALOG, brDropVelocity,brFloorHeightAt, brMuzzlePosition, brPlayerHitDistance, brPickupDisposition, brSpectatorPriority, isBrHeal, isBrWeapon, isInsideBrIsland, stepBrMovement,stepBrVehicle,
  type BrCrateState, type BrUtilityId, type BrHealId, type BrInput, type BrLootState, type BrPoi, type BrPlayerSnapshotState, type BrPlayerState, type BrProjectileState, type BrRoomView,type BrVehicleState,
  type BrMotionState, type BrSnapshot, type BrWeaponId, type EmoteType, type Vec3
} from "@planetfall/shared";
import type { GameAudio } from "../../audio";
import { brShotFlybyPoint } from "../../br-spatial-audio";
import { createAstronautVisual } from "../../astronaut";
import { createCosmeticFlightTrail, configureCosmeticFlightTrail, updateCosmeticFlightTrail } from "../../cosmetic-flight-trail";
import { inputLabel, type GameInput, type InputFrame, type InputMethod } from "../../input";
import { QUALITY_PRESETS, type RuntimeSettings as UserSettings } from "../../settings";
import { ReconciliationTracker } from "../../reconciliation";
import { BrPredictionPhysics } from "./br-physics";
import { brLocalRigCameraVisible, brAimProfile, brCameraGeometry, brCameraMode, brDropEntryPitch, brForcedDropLookYaw, brLookAngles, brShipCameraFrame, brShipLookState, brVehicleEntryYaw } from "./br-camera";
import { createBrBackdrop, createStarliner, createVoidStorm, updateStarliner, updateVoidStorm } from "./br-presentation";
import { applyBrDeploymentPose } from "./br-deployment-pose";
import { BrWorldRenderer, type BrPoiLabel } from "./br-world";
import { BrWeaponModelLibrary } from "./br-weapon-model-library";
import { BrShotEffects } from "./br-shot-effects";
import { BR_ASTRONAUT_FLOOR_OFFSET, brActionTimer, brAstronautFacingRotation, brAstronautRigHeight, brDamageBearing, brFireRequestDue, brLandingFeedback, brMovementFacingYaw, brPredictionCorrectionStrength, brPreservePendingJump, brRecoilAfter, brWeaponRecoilImpulse, brSmoothFacing } from "./br-feedback";
import { createBrReview } from "./br-review";
import { shouldHideStarlinerNearCamera, shouldKeepStarlinerInDropView } from "./br-starliner-visibility";
import { BrLootLod } from "./br-loot-lod";
import { BR_LOOT_RARITY_COLORS, BrLootRarityResources, BrLootRarityVisual } from "./br-loot-rarity";
import { brReviveInput, brReviveRetryDue } from "./br-revive-input";
import { BrDamageFeedback, brDamageFeedbackFade } from "./br-damage-feedback";
import { createBrIonWings } from "./br-ion-wings";
import { nextOccupiedBrSlot } from "./br-inventory-selection";
import { brPoiLabelPresentation } from "./br-poi-label-presentation";
import { resolveBrOptimisticSelection, type BrPendingSelection } from "./br-optimistic-selection";
import { brHeldUtilityTransform,brHeldWeaponTransform,brLootCategory,brLootModelSupportLift,brLootSurfaceOffset,brLootWeaponTransform } from "./br-item-presentation";
import { useBrPlayerImpostor } from "./br-player-lod";
import { BrDamageNumbers } from "./br-damage-numbers";
import { BrInputEdgeLatch } from "./br-input-latch";
import { BrHealModelLibrary } from "./br-heal-models";
import { BR_REVIEW_CAMERAS } from "./br-review-cameras";
import {createBrHoverSkimmer,disposeBrHoverSkimmer,updateBrHoverSkimmer,type BrHoverSkimmerVisual} from "./br-hover-skimmer";
import { createBrNameplatePlacement } from "./br-nameplate-placement";
import { createAstronautMotion, anchorAstronautHeldItem } from "../../astronaut-motion";
import { createBrSkimmerDistanceLod } from "./br-skimmer-distance-lod";
import { useFarBrVehicle } from "./br-vehicle-lod";
import {createBrHeldPresentation,type BrHeldPresentationFrame} from "./br-held-presentation";
import {createBrHeldAimFrame,brHeldAimFacing} from "./br-held-aim-frame";
import {isBrSupportWeaponId} from "./br-held-weapon-support";

type PlayerVisual = { supported:ReturnType<typeof createBrHeldPresentation>|null; supportedModel:THREE.Group|null; heldAimFrame:ReturnType<typeof createBrHeldAimFrame>; heldFrame:BrHeldPresentationFrame; lastShotAt:number; motion: ReturnType<typeof createAstronautMotion>; upperBody: THREE.Group; motionYaw: number | null; motionX: number; motionY: number; motionZ: number; nameplatePlacement: ReturnType<typeof createBrNameplatePlacement>; flightTrail:THREE.Line; flightTrailPoints:THREE.Vector3[]; trailSampleAt:number; group: THREE.Group; rig: THREE.Group; target: THREE.Vector3; label: THREE.Sprite; shadow:THREE.Mesh; body: THREE.Mesh; helmet: THREE.Group; cameraHelmetBounds: THREE.Box3; backpack: THREE.Group; suitMaterial: THREE.MeshStandardMaterial; lodDetails: THREE.Object3D[]; limbs: THREE.Group[]; wings: THREE.Group; weapon: THREE.Group; weaponId: BrWeaponId | null; actionDevice:THREE.Group; actionHealId:BrHealId|BrUtilityId|null; actionHealModel:THREE.Group|null; state: BrPlayerSnapshotState; relevant: boolean; emote: EmoteType | null; emoteEndsAt: number; damageFeedback:BrDamageFeedback; damageRipple:THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial> };
type LootVisual = { group: BrLootLod; state: BrLootState };
type CrateVisual = { group: THREE.Group; state: BrCrateState; baseY: number };
type ProjectileVisual = { mesh: THREE.Mesh; target: THREE.Vector3; state: BrProjectileState; trail: THREE.Line; points: THREE.Vector3[] };
type VehicleVisual={visual:BrHoverSkimmerVisual;lod:ReturnType<typeof createBrSkimmerDistanceLod>;far:boolean;state:BrVehicleState;target:THREE.Vector3;renderYaw:number;renderVelocity:Vec3};

const vec = (value: Vec3) => new THREE.Vector3(value.x, value.y, value.z);
const rarityColor = BR_LOOT_RARITY_COLORS;
const cosmeticColor = (itemId: string, fallback: string): string => SHOP_CATALOG.find((item) => item.id === itemId)?.color ?? fallback;

export interface BrHudState {
  player: BrPlayerState;
  players: BrPlayerState[];
  teamMode: BrRoomView["teamMode"];
  playersRemaining: number;
  teamsRemaining: number;
  storm: BrSnapshot["storm"];
  phase: BrSnapshot["phase"];
  prompt: string;
  reloadProgress: number;
  useProgress: number;
  reviveProgress: number;
  spectatorTarget: Pick<BrPlayerSnapshotState,"id"|"name"|"color"|"kills"> | null;
  dropAltitude: { meters:number; verticalSpeed:number; deployment:"freefall"|"chute" } | null;
  targetedLoot: BrLootState | null;
}

export class BattleRoyaleGame {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, .1, 1600);
  onInput?: (input: BrInput) => void;
  onJumpShip?: () => void;
  onDeploy?: () => void;
  onToggleVehicle?:()=>void;
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
  onInventory?: () => void;
  onMenuNavigate?: (action: "up" | "down" | "left" | "right" | "confirm" | "back") => void;

  private readonly heldResources={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,8),material:new THREE.MeshStandardMaterial({color:0x202747,roughness:.72})};
  private readonly heldDirection=new THREE.Vector3();
  private room: BrRoomView | null = null;
  private localId = "";
  private localState: BrPlayerState | null = null;
  private players = new Map<string, PlayerVisual>();
  private loot = new Map<string, LootVisual>();
  private crates = new Map<string, CrateVisual>();
  private projectiles = new Map<string, ProjectileVisual>();
  private vehicles=new Map<string,VehicleVisual>();
  private pings: Array<{ group: THREE.Group; expiresAt: number }> = [];
  private transients:Array<{group:THREE.Group;expiresAt:number}>=[];
  private lastFrame = performance.now();
  private lastWorldDrawAt=Number.NEGATIVE_INFINITY;
  private lastShadowDrawAt=Number.NEGATIVE_INFINITY;
  private lastLobbyPresentationAt=Number.NEGATIVE_INFINITY;
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
  private reloadConfirmed = false;
  private useConfirmed = false;
  private useStartedAt = 0;
  private useEndsAt = 0;
  private activeReviveTargetId: string | null = null;
  private confirmedReviveTargetId: string | null = null;
  private reviveConfirmedDuringHold = false;
  private lastReviveRequestAt = 0;
  private reviveStartedAt = 0;
  private spectatorTargetId: string | null = null;
  private pendingSelectedSlot: BrPendingSelection<number> | null = null;
  private pendingSpectatorTarget: BrPendingSelection<string | null> | null = null;
  private emoteIndex = -1;
  private lastFireRequestAt = 0;
  private lastAnticipatedFireAt = 0;
  private firingPoseHeld = false;
  private aiming = false;
  private vehicleInput={moveX:0,moveY:0};
  private predictedMotion: BrMotionState | null = null;
  private readonly temp = new THREE.Vector3();
  private readonly weaponHand = new THREE.Vector3();
  private readonly cameraFocus = new THREE.Vector3();
  private readonly cameraDesired = new THREE.Vector3();
  private readonly cameraRay = new THREE.Vector3();
  private readonly cameraRight = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3(0, 1, 0);
  private readonly cameraProbeOrigin = new THREE.Vector3();
  private readonly cameraProbeTarget = new THREE.Vector3();
  private cameraBoom = 6.15;
  private localRigCameraVisible = true;
  private readonly cameraHelmetPoint = new THREE.Vector3();
  private cameraInitialized = false;
  private cameraVehicleId:string|null=null;
  private shipLookInitialized = false;
  private serverClockOffsetMs = 0;
  private dropPredictionStartedAt = 0;
  private jumpPredictionStartedAt = 0;
  private jumpInputSequence = 0;
  private shipJumpRequestCount = 0;
  private readonly jumpInputLatch = new BrInputEdgeLatch();
  private readonly reconciliationTracker = new ReconciliationTracker();
  private readonly raycaster = new THREE.Raycaster();
  private readonly flashMuzzle = new THREE.Vector3();
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
  private poiTitle: HTMLElement | null = null;
  private poiTitleUntil = 0;
  private debugCameraView: { position: THREE.Vector3; focus: THREE.Vector3 } | null = null;
  private shipCameraStartedAt = 0;
  private disposed = false;
  private readonly handleCanvasClick = () => {
    if (this.active && !this.uiCaptured && !this.mapVisible && (this.room?.phase === "ship" || this.room?.phase === "combat") && document.pointerLockElement !== this.canvas)
      void this.canvas.requestPointerLock().catch(() => undefined);
  };
  private readonly handleResize = () => this.resize();
  private readonly unsubscribeInputMethod: () => void;
  private readonly stormWall = createVoidStorm();
  private readonly shotEffects = new BrShotEffects();
  private readonly utilityEffects=new BrUtilityEffects();
  private utilityFields:BrWorldEffect[]=[];
  private readonly beamEffects=new BrBeamEffects();
  private beamStates:BrBeamPresentation[]=[];
  private readonly utilityModels=new BrUtilityModelLibrary();
  private readonly weaponModels=new BrWeaponModelLibrary();
  private readonly scanMarkers=new BrScanMarkers();
  private scanStates:NonNullable<BrSnapshot["scanMarkers"]>=[];
  private readonly hitMarkerFeedback = new BrDamageFeedback();
  private readonly lootRarity = new BrLootRarityResources();
  private readonly healModels = new BrHealModelLibrary();
  private readonly damageNumbers = new BrDamageNumbers();
  private readonly crateBoxGeometry = new THREE.BoxGeometry(1,1,1);
  private readonly crateLockGeometry = new THREE.OctahedronGeometry(1,1);
  private readonly crateShadowGeometry = new THREE.CircleGeometry(1,18);
  private readonly crateShellMaterial = new THREE.MeshStandardMaterial({color:0x273a61,emissive:0x112856,emissiveIntensity:.48,metalness:.76,roughness:.24});
  private readonly crateTrimMaterial = new THREE.MeshStandardMaterial({color:0xb9c7d1,metalness:.82,roughness:.2});
  private readonly crateSeamMaterial = new THREE.MeshBasicMaterial({color:0xffd84d,transparent:true,opacity:.76});
  private readonly crateLockMaterial = new THREE.MeshBasicMaterial({color:0x70f5ff});
  private readonly crateShadowMaterial = new THREE.MeshBasicMaterial({color:0x02050b,transparent:true,opacity:.28,depthWrite:false});
  private readonly crateSharedGeometries = new Set<THREE.BufferGeometry>([this.crateBoxGeometry,this.crateLockGeometry,this.crateShadowGeometry]);
  private readonly crateSharedMaterials = new Set<THREE.Material>([this.crateShellMaterial,this.crateTrimMaterial,this.crateSeamMaterial,this.crateLockMaterial,this.crateShadowMaterial]);
  private readonly farPlayerBodyGeometry = new THREE.CapsuleGeometry(.37,.52,3,7);
  private readonly farPlayerHelmetGeometry = new THREE.SphereGeometry(.48,8,6);
  private readonly farPlayerBodyMaterial = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.58,flatShading:true});
  private readonly farPlayerHelmetMaterial = new THREE.MeshStandardMaterial({color:0xf0f6ff,roughness:.5,flatShading:true});
  private readonly farPlayerBodies = new THREE.InstancedMesh(this.farPlayerBodyGeometry,this.farPlayerBodyMaterial,BR_BALANCE.maxPlayers);
  private readonly farPlayerHelmets = new THREE.InstancedMesh(this.farPlayerHelmetGeometry,this.farPlayerHelmetMaterial,BR_BALANCE.maxPlayers);
  private readonly farPlayerMatrix = new THREE.Matrix4();
  private readonly farPlayerQuaternion = new THREE.Quaternion();
  private readonly farPlayerScale = new THREE.Vector3(1,1,1);
  private readonly farPlayerPosition = new THREE.Vector3();
  private damageIndicatorUntil = 0;
  private lastLandingFeedbackAt = Number.NEGATIVE_INFINITY;
  private lastFootstepAt=0;
  private review: ReturnType<typeof createBrReview> | null = null;
  private neon:BrNeonRenderer|null=null;

  constructor(
    private canvas: HTMLCanvasElement,
    private renderer: THREE.WebGLRenderer,
    private input: GameInput,
    private audio: GameAudio,
    settings: UserSettings
  ) {
    this.settings = settings;
    document.getElementById("br-hud")?.append(this.scanMarkers.element);
    this.world = new BrWorldRenderer(settings.graphicsQuality, true);
    this.neon=new BrNeonRenderer(this.renderer,this.scene,this.camera);
    this.island = this.world.root;
    this.islandMeshes = this.world.collidableMeshes;
    this.poiLabels = this.world.poiLabels;
    this.scene.background = new THREE.Color(0x020512);
    this.scene.fog = new THREE.FogExp2(0x07112c, .0014);
    this.unsubscribeInputMethod = this.input.subscribeMethodChange((method) => { if (this.active) this.onInputMethod?.(method); });
    this.buildScene();
    this.scene.add(this.damageNumbers);
    for(const impostor of [this.farPlayerBodies,this.farPlayerHelmets]){
      impostor.count=0;impostor.instanceMatrix.setUsage(THREE.DynamicDrawUsage);impostor.frustumCulled=false;
      this.scene.add(impostor);
    }
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("brView")) {
      this.setDebugView(new URLSearchParams(location.search).get("brView"));
      this.review=createBrReview(id=>this.setDebugView(id),quality=>this.setSettings({...this.settings,graphicsQuality:quality}));
    }
    this.canvas.addEventListener("click", this.handleCanvasClick);
    addEventListener("resize", this.handleResize);
  }

  activate(room: BrRoomView, localId: string): void {
    if (this.disposed) return;
    const takingRenderer = !this.active;
    this.room = room; this.localId = localId; this.localState = room.players.find((player) => player.id === localId) ?? null; this.active = true; this.lastFrame = performance.now(); if (room.phase === "ship") this.shipCameraStartedAt = performance.now(); this.syncPlayers(room.players);this.syncVehicles(room.vehicles);
    if (takingRenderer) {
      this.lastShadowDrawAt=Number.NEGATIVE_INFINITY;
      this.renderer.shadowMap.enabled = this.settings.graphicsQuality !== "low";
      this.neon?.setQuality(this.settings.graphicsQuality);
      this.resize();
    }
    this.onInputMethod?.(this.input.method);
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  deactivate(): void {
    // An inactive mode must not release the other mode's shared renderer or cursor.
    if (!this.active) return;
    for(const visual of this.players.values())this.clearHeldSupport(visual);
    this.neon?.dispose(); this.active = false; this.firingPoseHeld=false; this.audio.stopBrLoops();this.renderer.setAnimationLoop(null); this.scanStates=[];this.scanMarkers.clear();this.beamStates=[];this.beamEffects.clear();this.utilityEffects.clear();this.utilityFields=[];this.shotEffects.clear();this.clearTransients();this.clearPoiTitle(); this.uiCaptured = false; this.mapVisible = false; this.review?.dispose();this.review=null;document.body.classList.remove("br-in-void");document.getElementById("br-crosshair")?.classList.remove("hit","shield-break","blocked","aiming");document.getElementById("br-damage-direction")?.classList.remove("visible");const scope=document.getElementById("br-scope-overlay");if(scope)scope.hidden=true; document.exitPointerLock?.(); }
  reset(): void {
    this.lastShadowDrawAt=Number.NEGATIVE_INFINITY;
    this.lastLobbyPresentationAt=Number.NEGATIVE_INFINITY;
    this.cameraVehicleId=null;
    this.room = null; this.localId = ""; this.aiming = false;
    this.scanStates=[];this.scanMarkers.clear();this.beamStates=[];this.beamEffects.clear();this.utilityEffects.clear();this.utilityFields=[];this.shotEffects.clear();this.clearTransients();
    for (const visual of this.players.values()) { this.clearHeldSupport(visual); this.scene.remove(visual.group,visual.flightTrail); this.disposeObject(visual.group); this.disposeObject(visual.flightTrail); }
    for (const visual of this.loot.values()) this.releaseLootVisual(visual);
    for (const visual of this.crates.values()) { this.scene.remove(visual.group); this.disposeObject(visual.group); }
    for (const visual of this.projectiles.values()) { this.scene.remove(visual.mesh, visual.trail); this.disposeObject(visual.mesh); this.disposeObject(visual.trail); }
    for(const entry of this.vehicles.values()){entry.lod.dispose();disposeBrHoverSkimmer(entry.visual);}
    for (const ping of this.pings) { this.scene.remove(ping.group); this.disposeObject(ping.group); }
    this.players.clear(); this.loot.clear(); this.crates.clear(); this.projectiles.clear();this.vehicles.clear(); this.pings = []; this.localState = null; this.predictedMotion = null; this.spectatorTargetId = null; this.pendingSelectedSlot=null;this.pendingSpectatorTarget=null;this.cameraInitialized=false;this.shipLookInitialized=false;this.cameraBoom=6.15;this.localRigCameraVisible=true;this.serverClockOffsetMs=0;this.dropPredictionStartedAt=0;this.jumpPredictionStartedAt=0;this.jumpInputSequence=0;this.shipJumpRequestCount=0;this.jumpInputLatch.reset();
    this.reloadEndsAt = 0; this.useEndsAt = 0; this.activeReviveTargetId=null;this.confirmedReviveTargetId=null;this.reviveConfirmedDuringHold=false;this.lastReviveRequestAt=0;this.reviveStartedAt=0;this.lastFireRequestAt = 0;this.lastAnticipatedFireAt=0;this.firingPoseHeld=false;
    this.reloadConfirmed = false; this.useConfirmed = false; this.hitMarkerFeedback.clear();this.damageNumbers.clearNumbers();this.damageIndicatorUntil=0;this.lastLandingFeedbackAt=Number.NEGATIVE_INFINITY;document.getElementById("br-damage-direction")?.classList.remove("visible");
    this.physics.reset(); this.reconciliationTracker.reset(); this.visitedPois.clear(); this.currentPoiId = "";this.clearPoiTitle(); document.body.classList.remove("br-in-void");
  }
  dispose(): void { if (this.disposed) return; this.deactivate(); this.reset(); this.scanMarkers.dispose();this.weaponModels.dispose();this.utilityModels.dispose();this.beamEffects.dispose();this.utilityEffects.dispose();this.shotEffects.dispose();this.lootRarity.dispose();this.healModels.dispose();this.damageNumbers.dispose(); this.heldResources.box.dispose();this.heldResources.cylinder.dispose();this.heldResources.material.dispose(); this.canvas.removeEventListener("click",this.handleCanvasClick); removeEventListener("resize",this.handleResize); this.unsubscribeInputMethod(); this.scene.remove(this.island,this.stormWall,this.backdrop,this.starliner,this.sun,this.sunTarget,this.farPlayerBodies,this.farPlayerHelmets,this.damageNumbers); this.world.dispose(); this.disposeObject(this.stormWall); this.disposeObject(this.backdrop); this.disposeObject(this.starliner); for(const geometry of this.crateSharedGeometries)geometry.dispose();for(const material of this.crateSharedMaterials)material.dispose();this.farPlayerBodyGeometry.dispose();this.farPlayerHelmetGeometry.dispose();this.farPlayerBodyMaterial.dispose();this.farPlayerHelmetMaterial.dispose();this.physics.dispose(); this.disposed=true; }
  /** Compatibility aliases retained while callers migrate to the explicit lifecycle. */
  start(room: BrRoomView, localId: string): void { this.activate(room,localId); }
  stop(): void { this.deactivate(); }
  resetMatchVisuals(): void { this.reset(); }
  setSettings(settings: UserSettings): void {
    this.lastShadowDrawAt=Number.NEGATIVE_INFINITY;
    this.settings = settings;
    this.world.setQuality(settings.graphicsQuality);
    if(this.active)this.neon?.setQuality(settings.graphicsQuality);
    this.sun.castShadow = settings.graphicsQuality === "high";
    if (this.active) this.renderer.shadowMap.enabled = settings.graphicsQuality !== "low";
    this.resize();
  }
  setUiCaptured(captured: boolean): void {
    this.uiCaptured = captured;
    if (captured) {
      this.aiming = false;
      this.firingPoseHeld = false;
      const scope = document.getElementById("br-scope-overlay"); if (scope) scope.hidden = true;
      document.exitPointerLock?.();
    }
  }
  setMapVisible(visible: boolean): void { this.mapVisible = visible; this.setUiCaptured(visible); }
  setRoom(room: BrRoomView): void { const enteringShip=this.room?.phase!=="ship"&&room.phase==="ship";this.room = room;if(enteringShip){this.shipLookInitialized=false;this.shipCameraStartedAt=performance.now();} this.syncPlayers(room.players);this.syncVehicles(room.vehicles); }

  shipJumped(payload:{playerId:string;position:Vec3;velocity:Vec3;forced:boolean}):void {
    if(payload.playerId!==this.localId||!payload.forced)return;
    this.yaw=brForcedDropLookYaw(payload.velocity,this.yaw);
    this.pitch=brDropEntryPitch(this.pitch);
    const local=this.localState;
    if(local){
      const predicted=this.motionFromPlayer(local);
      predicted.position={...payload.position};predicted.velocity={...payload.velocity};predicted.yaw=this.yaw;
      predicted.deployment="freefall";predicted.grounded=false;
      this.predictedMotion=predicted;this.dropPredictionStartedAt=performance.now();
    }
    this.audio.brJumpShip();
  }
  getInputMethod(): InputMethod { return this.input.method; }
  setDebugView(poiId: string | null): void {
    this.debugStormPreview = import.meta.env.DEV && poiId === "storm-boundary" ? {center:{x:-184,z:-80},radius:55} : import.meta.env.DEV && poiId === "storm-final" ? {center:{x:-184,z:-109},radius:25} : null;
    if (!import.meta.env.DEV || !poiId) { this.debugCameraView = null; return; }
    // Repeatable review cameras live in clear streets/interiors, not inside a
    // neighboring building. These never move the authoritative player.
    const review = BR_REVIEW_CAMERAS[poiId];
    if (review) { this.debugCameraView = {position:new THREE.Vector3(...review.position),focus:new THREE.Vector3(...review.focus)}; return; }
    const poi = [...BR_POIS,...BR_SECONDARY_LOCATIONS].find((entry) => entry.id === poiId); if (!poi) return;
    const landmark = poi.style === "reactor" || poi.style === "nexus";
    const urban = poi.style === "city" || poi.style === "mall";
    const focus = new THREE.Vector3(poi.position.x, poi.position.y + (landmark ? 40 : urban ? 3.5 : 5), poi.position.z);
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
      active: this.active,
      phase: this.room?.phase ?? null,
      localPlayer: this.localState ? { ...this.localState, position: { ...this.localState.position }, velocity: { ...this.localState.velocity } } : null,
      players: [...this.players.values()].map((visual) => ({ id: visual.state.id, teamId: visual.state.teamId, relevant: visual.relevant, alive: visual.state.alive, deployment: visual.state.deployment, position: { ...visual.state.position } })),
      lootCount: this.loot.size,
      crateCount: this.crates.size,
      projectileCount: this.projectiles.size,
      spectatorTargetId: this.spectatorTargetId,
      storm: this.room ? { ...this.room.storm, center: { ...this.room.storm.center }, nextCenter: { ...this.room.storm.nextCenter } } : null,
      camera:{position:{x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z},fov:this.camera.fov},
      input:{jumpInputSequence:this.jumpInputSequence,shipJumpRequestCount:this.shipJumpRequestCount},
      reconciliation: this.reconciliationTracker.summary(performance.now()),
      world:{islandObjects:this.island.children.length,shipVisible:this.starliner.visible,...this.world.debugStats()},
      renderer: { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }
    };
  }

  applySnapshot(snapshot: BrSnapshot): void {
    if(snapshot.localPlayer.weaponStatus?.chargeStartedAt&&snapshot.localPlayer.weaponStatus.chargeStartedAt!==this.localState?.weaponStatus?.chargeStartedAt)this.audio.brCharge();
    this.scanStates=snapshot.scanMarkers??[];
    this.beamStates=snapshot.beams??[];
    const listener=this.audioListenerPosition();
    if(listener)for(const field of snapshot.effects??[])if(field.kind==="pulse-scanner"&&snapshot.serverTime-field.createdAt<500&&!this.utilityFields.some(previous=>previous.id===field.id))this.audio.brScannerPulse(field.position,listener,this.yaw);
    this.utilityFields=snapshot.effects??[];
    const measuredOffset=snapshot.serverTime-Date.now();
    this.serverClockOffsetMs=this.serverClockOffsetMs===0?measuredOffset:THREE.MathUtils.lerp(this.serverClockOffsetMs,measuredOffset,.12);
    if(snapshot.localPlayer.deployment!=="attached")this.dropPredictionStartedAt=0;
    const now=performance.now();
    const slot=resolveBrOptimisticSelection(snapshot.localPlayer.selectedSlot,this.pendingSelectedSlot,now);
    this.pendingSelectedSlot=slot.pending;
    this.localState=slot.value===snapshot.localPlayer.selectedSlot?snapshot.localPlayer:{...snapshot.localPlayer,selectedSlot:slot.value};
    if (snapshot.actions) {
      const now = performance.now();
      const item = snapshot.localPlayer.inventory[snapshot.localPlayer.selectedSlot];
      const reloadDuration = item && isBrWeapon(item.itemId) ? BR_WEAPONS[item.itemId].reloadMs : 0;
      const useDuration = item && isBrHeal(item.itemId) ? BR_HEALS[item.itemId].durationMs : 0;
      const eligible = snapshot.localPlayer.alive && !snapshot.localPlayer.downed && snapshot.localPlayer.deployment === "grounded";
      const reload = brActionTimer(eligible ? snapshot.actions.reloadEndsAt : 0,snapshot.serverTime,now,this.reloadStartedAt,this.reloadEndsAt,reloadDuration,this.reloadConfirmed || !eligible);
      const use = brActionTimer(eligible ? snapshot.actions.useEndsAt : 0,snapshot.serverTime,now,this.useStartedAt,this.useEndsAt,useDuration,this.useConfirmed || !eligible);
      this.reloadStartedAt=reload.startedAt;this.reloadEndsAt=reload.endsAt;this.reloadConfirmed=reload.confirmed;
      this.useStartedAt=use.startedAt;this.useEndsAt=use.endsAt;this.useConfirmed=use.confirmed;
      this.reviveStartedAt=snapshot.actions.reviveTargetId
        ? now-Math.max(0,snapshot.serverTime-snapshot.actions.reviveStartedAt)
        : 0;
      this.confirmedReviveTargetId=snapshot.actions.reviveTargetId;
      if(snapshot.actions.reviveTargetId&&snapshot.actions.reviveTargetId===this.activeReviveTargetId)this.reviveConfirmedDuringHold=true;
    }
    this.reconcilePrediction(snapshot.localPlayer);
    if (!this.room) return;
    if (snapshot.phase === "ship" && this.room.phase !== "ship") this.shipCameraStartedAt = performance.now();
    this.room.phase = snapshot.phase; this.room.storm = snapshot.storm; this.room.ship = snapshot.ship;this.room.vehicles=snapshot.vehicles; this.room.playersRemaining = snapshot.playersRemaining; this.room.teamsRemaining = snapshot.teamsRemaining;
    const currentPlayers = new Map(this.room.players.map((player) => [player.id, player]));
    for (const update of snapshot.players) { const player = currentPlayers.get(update.id); if (player) Object.assign(player, update); }
    currentPlayers.set(snapshot.localPlayer.id, snapshot.localPlayer);
    this.room.players = [...currentPlayers.values()];
    const spectator=resolveBrOptimisticSelection(snapshot.spectatorTargetId,this.pendingSpectatorTarget,now);
    this.pendingSpectatorTarget=spectator.pending;this.spectatorTargetId=spectator.value;
    this.syncPlayers(snapshot.players, true);
    this.syncVehicles(snapshot.vehicles);
    this.syncProjectiles(snapshot.projectiles);
    this.syncLoot(snapshot.loot);
  }

  spawnLoot(states: BrLootState[]): void {
    for (const state of states) {
      const existing = this.loot.get(state.id);
      if (existing) { existing.state = state; existing.group.position.copy(vec(state.position)); continue; }
      const group = this.makeLoot(state); group.position.copy(vec(state.position)); this.scene.add(group);
      this.loot.set(state.id, { group, state });
    }
  }
  lootRarityFor(lootId:string):BrLootState["rarity"]|undefined{return this.loot.get(lootId)?.state.rarity;}
  removeLoot(ids: string[]): void { for (const id of ids) { const visual = this.loot.get(id); if (!visual) continue; this.releaseLootVisual(visual); this.loot.delete(id); } }
  private syncLoot(states:BrLootState[]):void {const ids=new Set(states.map((entry)=>entry.id));this.spawnLoot(states);for(const [id,visual] of this.loot)if(!ids.has(id)){this.releaseLootVisual(visual);this.loot.delete(id);}}
  private releaseLootVisual(visual: LootVisual): void {
    if (visual.group.detail instanceof BrLootRarityVisual) visual.group.detail.release();
    this.scene.remove(visual.group); this.disposeObject(visual.group);
  }

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
      this.transients.push({group:visual.group,expiresAt:performance.now()+190});
    }
    this.spawnLoot(drops);
    const listener = this.audioListenerPosition();
    if (visual && listener && visual.group.position.distanceToSquared(vec(listener)) < 18 * 18) this.audio.brLoot(true);
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
    while (this.pings.length > 8) { const old = this.pings.shift()!; this.scene.remove(old.group); this.disposeObject(old.group); }
  }

  weaponFired(payload: { playerId: string; weaponId: BrWeaponId; origin: Vec3; direction: Vec3; projectile?: BrProjectileState }): void {
    const shooter=this.players.get(payload.playerId);if(shooter){shooter.lastShotAt=performance.now();const item=payload.playerId===this.localId?this.localState?.inventory[this.localState.selectedSlot]:shooter.state.heldItem;shooter.weapon.userData.recoil=brWeaponRecoilImpulse(item?.itemId===payload.weaponId?item.rarity:"common");shooter.body.rotation.x=-.08;}
    const locallyAnticipated=payload.playerId===this.localId&&performance.now()-this.lastAnticipatedFireAt<=180;
    if (payload.playerId === this.localId && !locallyAnticipated) {
      this.audio.brWeapon(payload.weaponId);
    } else if (payload.playerId !== this.localId) {
      const listener = this.audioListenerPosition();
      if (listener) this.audio.brRemoteWeapon(payload.weaponId, payload.origin, listener, this.yaw);
    }
    // The local muzzle flash was already rendered on input. Confirmation owns
    // damage/projectile state, but must not visually fire the same shot twice.
    if(!locallyAnticipated){
      const length=this.shotTraceLength(payload.weaponId,payload.origin,payload.direction,Boolean(payload.projectile));
      this.shotEffects.fire(payload.weaponId,payload.origin,payload.direction,length,performance.now(),this.muzzleFlashOrigin(shooter,payload.weaponId,payload.origin));
      const listener=this.audioListenerPosition();
      if(length!==null&&listener){
        const endpoint={x:payload.origin.x+payload.direction.x*length,y:payload.origin.y+payload.direction.y*length,z:payload.origin.z+payload.direction.z*length};
        const cap=Math.min(BR_WEAPONS[payload.weaponId].range,payload.weaponId==="rail-laser"?190:payload.weaponId==="photon-shotgun"?42:85);
        if(length<cap-.01)this.audio.brImpact(endpoint,listener,this.yaw);
        if(payload.playerId!==this.localId){const point=brShotFlybyPoint(payload.origin,payload.direction,length,{...listener,y:listener.y+1});if(point)this.audio.brFlyby(point,listener,this.yaw);}
      }
    }
    if (payload.projectile && !this.projectiles.has(payload.projectile.id)) this.addProjectile(payload.projectile);
  }

  private shotTraceLength(weaponId:BrWeaponId,origin:Vec3,direction:Vec3,projectile=false):number|null {
    if(projectile||weaponId==="energy-saber")return null;
    let length=Math.min(BR_WEAPONS[weaponId].range,weaponId==="rail-laser"?190:weaponId==="photon-shotgun"?42:85);
    this.raycaster.set(vec(origin),vec(direction));this.raycaster.far=length;
    const impact=this.raycaster.intersectObjects(this.islandMeshes,false)[0];
    if(impact)length=Math.min(length,impact.distance);
    return length;
  }

  /** Animated barrel attachment affects the flash only. Traces, beams and
   * projectile collision continue to use the authoritative shot origin. */
  private muzzleFlashOrigin(visual:PlayerVisual|undefined,weaponId:BrWeaponId,fallback:Vec3):Vec3 {
    if(!visual?.group.visible||!visual.rig.visible||!visual.weapon.visible||visual.weaponId!==weaponId)return fallback;
    const muzzle=visual.weapon.userData.muzzle;
    if(!(muzzle instanceof THREE.Vector3))return fallback;
    visual.weapon.updateWorldMatrix(true,false);
    this.flashMuzzle.copy(muzzle).applyMatrix4(visual.weapon.matrixWorld);
    return Number.isFinite(this.flashMuzzle.x)&&Number.isFinite(this.flashMuzzle.y)&&Number.isFinite(this.flashMuzzle.z)?this.flashMuzzle:fallback;
  }

  damaged(payload: { playerId: string; attackerId?:string; amount: number; hpDamage:number;shieldDamage:number;hp:number; shield:number; shieldBroken: boolean;headshot:boolean; direction?:Vec3 }): void {
    const previous=this.players.get(payload.playerId)?.state;
    const visual = this.players.get(payload.playerId); if (visual) {
      visual.damageFeedback.hit(payload,performance.now(),{hp:visual.state.hp,shield:visual.state.shield});
    }
    if(payload.attackerId===this.localId){this.hitMarkerFeedback.hit(payload,performance.now(),previous?{hp:previous.hp,shield:previous.shield}:undefined);this.audio.hitConfirm(payload.headshot?"headshot":payload.shieldBroken?"break":payload.shieldDamage>0?"shield":"hp");if(visual)this.damageNumbers.hit({targetId:payload.playerId,position:{x:visual.group.position.x,y:visual.group.position.y,z:visual.group.position.z},shieldDamage:payload.shieldDamage,hpDamage:payload.hpDamage,shieldBroken:payload.shieldBroken,headshot:payload.headshot},performance.now());}
    if(visual){visual.state.hp=payload.hp;visual.state.shield=payload.shield;}
    if(this.localState?.id===payload.playerId){this.localState.hp=payload.hp;this.localState.shield=payload.shield;}
    if (payload.playerId === this.localId) {
      this.audio.incoming(payload.amount >= 35); this.input.vibrate(120, Math.min(.7, payload.amount / 80));
      const indicator=document.getElementById("br-damage-direction");
      const angle=payload.direction?brDamageBearing(payload.direction,this.yaw):null;
      if(indicator&&angle!==null){indicator.style.setProperty("--damage-angle",`${angle}rad`);indicator.classList.add("visible");this.damageIndicatorUntil=performance.now()+520;}
    }
  }

  eliminated(playerId: string, placement?: number): void { const visual = this.players.get(playerId); if (visual) { this.playEnergyBurst(visual.group.position, new THREE.Color(visual.state.color).getHex(), 1.9); visual.state.alive=false;visual.state.placement=placement??visual.state.placement;visual.group.visible = false; } if(this.localState?.id===playerId){this.localState.alive=false;this.localState.placement=placement??this.localState.placement;document.exitPointerLock?.();} }

  private frame(now: number): void {
    if (!this.active) return;
    let dt = frameDeltaSeconds(now, this.lastFrame); this.lastFrame = now;
    const frame = this.input.sample(); this.processInput(frame, dt, now);
    if(this.room?.phase==="lobby"||this.room?.phase==="results"){
      if(!brLobbyPresentationDue(now,this.lastLobbyPresentationAt,this.room.phase))return;
      dt=frameDeltaSeconds(now,this.lastLobbyPresentationAt);this.lastLobbyPresentationAt=now;
    }else this.lastLobbyPresentationAt=Number.NEGATIVE_INFINITY;
    this.updateVehicles(dt,now);this.updatePlayers(dt, now); this.updateLoot(now); this.updateCrates(now); this.updateProjectiles(); this.updatePings(now);this.updateTransients(now); this.updateShip();this.updateBrAudio(); this.updateCamera(dt); this.updateStorm(now); this.updateWorldPresentation(now);
    this.updateNameplates();
    this.scanMarkers.update(this.scanStates,this.camera,Date.now()+this.serverClockOffsetMs,this.canvas.clientWidth,this.canvas.clientHeight);this.beamEffects.update(this.beamStates,Date.now()+this.serverClockOffsetMs,this.settings.graphicsQuality);this.shotEffects.update(now);this.utilityEffects.update(this.utilityFields,Date.now()+this.serverClockOffsetMs,this.settings.graphicsQuality);this.damageNumbers.update(now,this.camera,this.renderer.domElement.clientHeight);this.updateHitMarker(now);
    // Keep simulation and HUD above running on every RAF. The full tactical
    // map needs a readable live UI, not an uncapped covered WebGL workload.
    if(brWorldDrawDue(now,this.lastWorldDrawAt,this.mapVisible)){
      if(this.settings.graphicsQuality==="high"){
        const refresh=this.renderer.shadowMap.needsUpdate||brShadowDrawDue(now,this.lastShadowDrawAt);
        withBrShadowRefresh(this.renderer.shadowMap,refresh,()=>this.neon?.render());
        if(refresh)this.lastShadowDrawAt=now;
      }else this.neon?.render();
      this.lastWorldDrawAt=now;
    }
    this.review?.frame(now,()=>{
      const stats=this.world.debugStats();
      return {calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,materials:stats.materials,instances:stats.visibleInstances,districts:stats.visibleDistricts};
    });
  }

  private processInput(frame: InputFrame, dt: number, now: number): void {
    this.firingPoseHeld = false;
    const local = this.localState; if (!local) return;
    this.vehicleInput.moveX=local.vehicleId?frame.moveX:0;this.vehicleInput.moveY=local.vehicleId?frame.moveY:0;
    if (this.uiCaptured) {
      if (frame.map.pressed && this.mapVisible) { this.setMapVisible(false); this.onMap?.(false); return; }
      if(frame.inventory.pressed){this.onInventory?.();return;}
      if (frame.menuY) this.onMenuNavigate?.(frame.menuY < 0 ? "up" : "down");
      if (frame.menuX) this.onMenuNavigate?.(frame.menuX < 0 ? "left" : "right");
      if (frame.confirm.pressed) this.onMenuNavigate?.("confirm");
      if (frame.cancel.pressed) this.onMenuNavigate?.("back");
      this.syncReviveInput(null,false,now);
      this.onHud?.({ player: local, players: this.room?.players ?? [], teamMode:this.room?.teamMode??"solo", playersRemaining: this.room?.playersRemaining ?? 0, teamsRemaining: this.room?.teamsRemaining ?? 0, storm: this.room!.storm, phase: this.room!.phase, prompt: "", reloadProgress: 0, useProgress: 0, reviveProgress: 0, spectatorTarget:null,dropAltitude:this.dropAltitude(local),targetedLoot:null }); return;
    }
    if (this.room?.phase === "lobby" || this.room?.phase === "countdown" || this.room?.phase === "results") {
      this.aiming = false;
      const scope=document.getElementById("br-scope-overlay");if(scope)scope.hidden=true;
      this.syncReviveInput(null,false,now);
      if (frame.menuY) this.onMenuNavigate?.(frame.menuY < 0 ? "up" : "down");
      if (frame.menuX) this.onMenuNavigate?.(frame.menuX < 0 ? "left" : "right");
      if (frame.confirm.pressed) this.onMenuNavigate?.("confirm");
      if (frame.cancel.pressed) this.onMenuNavigate?.("back");
      if (frame.emote.pressed) this.triggerEmote(local);
      return;
    }
    const currentItem=local.inventory[local.selectedSlot];
    const currentWeaponId=currentItem&&isBrWeapon(currentItem.itemId)?currentItem.itemId:null;
    this.aiming=frame.grapple.held&&local.alive&&!local.downed&&!local.vehicleId&&local.deployment==="grounded"&&this.reloadEndsAt<=now&&this.useEndsAt<=now&&!this.activeReviveTargetId&&!this.confirmedReviveTargetId;
    const aimProfile=brAimProfile(currentWeaponId,this.aiming);
    const scope=document.getElementById("br-scope-overlay");if(scope){scope.hidden=!aimProfile.scope;scope.dataset.scope=aimProfile.scope??"";}
    const mouseScale = .0022 * this.settings.mouseSensitivity*aimProfile.sensitivity; const padScale = 2.2 * this.settings.controllerSensitivity * dt * (local.alive ? this.controllerAimFriction() : 1)*aimProfile.sensitivity;
    const scale = frame.method === "gamepad" ? padScale : mouseScale;
    const look=brLookAngles(this.yaw,this.pitch,frame.lookX,frame.lookY,scale,this.settings.invertY);
    this.yaw=look.yaw;this.pitch=look.pitch;
    if (!local.alive) {
      this.syncReviveInput(null,false,now);
      this.aiming = false;
      if (frame.nextTarget.pressed || frame.switchWeapon.pressed) { this.cycleSpectator(1); this.onSpectateCycle?.(1); }
      if (frame.previousTarget.pressed) { this.cycleSpectator(-1); this.onSpectateCycle?.(-1); }
      if(frame.menuY<0){this.cycleSpectator(-1);this.onSpectateCycle?.(-1);}
      else if(frame.menuY>0){this.cycleSpectator(1);this.onSpectateCycle?.(1);}
      if (frame.pause.pressed || frame.cancel.pressed) this.onPause?.();
      this.prompt = `${inputLabel("nextTarget", frame.method)} / ↑ ↓  CYCLE SPECTATOR`;
      const target=this.getSpectatorTarget()?.state??null;
      this.onHud?.({ player: local, players: this.room?.players ?? [], teamMode:this.room?.teamMode??"solo", playersRemaining: this.room?.playersRemaining ?? 0, teamsRemaining: this.room?.teamsRemaining ?? 0, storm: this.room!.storm, phase: this.room!.phase, prompt: this.prompt, reloadProgress: 0, useProgress: 0, reviveProgress: 0, spectatorTarget:target,dropAltitude:null,targetedLoot:null });
      return;
    }
    if (frame.pause.pressed || frame.cancel.pressed) this.onPause?.();
    this.predictLocal(frame, dt, now);
    if (frame.map.pressed) { this.setMapVisible(!this.mapVisible); this.onMap?.(this.mapVisible); }
    if(frame.inventory.pressed){this.onInventory?.();return;}
    if (frame.directSlot !== null) this.selectSlot(frame.directSlot);
    if (frame.switchWeapon.pressed || (frame.nextTarget.pressed && !frame.repair.pressed)) this.selectSlot(nextOccupiedBrSlot(local.inventory,local.selectedSlot,1));
    if (frame.previousTarget.pressed) this.selectSlot(nextOccupiedBrSlot(local.inventory,local.selectedSlot,-1));
    if (frame.repair.pressed && !local.vehicleId && !local.downed && local.deployment === "grounded") {
      const item = local.inventory[local.selectedSlot];
      if (item && isBrWeapon(item.itemId)) {
        const weapon=brWeaponStats(item.itemId,item.rarity);
        if(weapon.ammo&&item.magazine<weapon.magazine&&local.ammo[weapon.ammo]>0&&this.reloadEndsAt<=now&&this.useEndsAt<=now&&!this.activeReviveTargetId&&!this.confirmedReviveTargetId){
          this.reloadConfirmed=false;this.reloadStartedAt=now;this.reloadEndsAt=now+weapon.reloadMs;this.audio.brReload(item.itemId);this.onReload?.();
          this.aiming=false;if(scope)scope.hidden=true;
        }
      }
    }
    this.jumpInputLatch.observe(frame.jump.pressed);
    if (frame.jump.pressed) {
      // Do not wait for a snapshot to acknowledge the jump before accepting a
      // chute deployment. Fast jump-then-deploy input used to resend jump.
      const activeDeployment=this.predictedMotion?.deployment??local.deployment;
      if(activeDeployment==="attached"&&this.room?.ship){
        const predicted=this.motionFromPlayer(local);
        predicted.position={x:this.starliner.position.x,y:this.starliner.position.y,z:this.starliner.position.z};
        predicted.velocity=brDropVelocity(this.room.ship,this.yaw);predicted.deployment="freefall";predicted.grounded=false;
        this.pitch=brDropEntryPitch(this.pitch);
        this.predictedMotion=predicted;this.dropPredictionStartedAt=now;this.shipJumpRequestCount++;this.audio.brJumpShip();this.onJumpShip?.();
      }else if(activeDeployment==="freefall"){
        if(this.predictedMotion)this.predictedMotion.deployment="chute";
        this.audio.wings();this.onDeploy?.();
      }
    }
    const lookDirection = this.lookDirection();
    const selectedItem = local.inventory[local.selectedSlot];
    // Aim obstruction matters only when a weapon can be used. The previous
    // unconditional pair of whole-world raycasts also ran while empty-handed,
    // healing, riding and gliding, spending gameplay frame time on no shot.
    const shot = selectedItem&&isBrWeapon(selectedItem.itemId)&&local.deployment==="grounded"&&!local.vehicleId&&!local.downed?this.shotSolution(local):null;
    const reticle=document.getElementById("br-crosshair");
    if(reticle){const weapon=selectedItem&&isBrWeapon(selectedItem.itemId)?BR_WEAPONS[selectedItem.itemId]:null;const speed=Math.hypot(local.velocity.x,local.velocity.z);const spread=weapon?weapon.spread*150+(weapon.pellets>1?5:0):3;const gap=THREE.MathUtils.clamp(4+spread+speed*.28+(this.aiming?-2:0),3,18);reticle.style.setProperty("--reticle-gap",`${gap}px`);reticle.dataset.weapon=weapon?.id??"none";reticle.classList.toggle("aiming",this.aiming);reticle.classList.toggle("blocked",Boolean(this.reloadEndsAt>now||this.useEndsAt>now||this.activeReviveTargetId||this.confirmedReviveTargetId||shot?.blocked));}
    if (frame.fire.held && shot && !shot.blocked && !this.activeReviveTargetId && !this.confirmedReviveTargetId && selectedItem && isBrWeapon(selectedItem.itemId) && this.reloadEndsAt <= now && this.useEndsAt <= now) {
      const weapon = brWeaponStats(selectedItem.itemId,selectedItem.rarity); const interval = weapon.fireIntervalMs;
      this.firingPoseHeld = !weapon.ammo || selectedItem.magazine > 0;
      if ((weapon.fireMode!=="semi"||frame.fire.pressed) && (!weapon.ammo || selectedItem.magazine > 0) && brFireRequestDue(now,this.lastFireRequestAt,interval)) {
        this.lastFireRequestAt=now;
        if(!weapon.fireMode)this.lastAnticipatedFireAt=now;
        const shooter=this.players.get(this.localId);if(shooter){shooter.lastShotAt=now;shooter.weapon.userData.recoil=brWeaponRecoilImpulse(selectedItem.rarity,true);}
        if(!weapon.fireMode)this.audio.brWeapon(selectedItem.itemId);
        // Presentation is immediate; the server remains authoritative for
        // ammo, obstruction, hit registration, damage and projectile spawn.
        if(!weapon.fireMode)this.shotEffects.fire(selectedItem.itemId,shot.origin,shot.direction,this.shotTraceLength(selectedItem.itemId,shot.origin,shot.direction,weapon.model==="projectile"),now,this.muzzleFlashOrigin(shooter,selectedItem.itemId,shot.origin));
        this.onFire?.(shot.origin, shot.direction, Date.now());
      }
      else if(weapon.ammo&&selectedItem.magazine<=0&&frame.fire.pressed)this.audio.brEmpty();
    }
    const interactionPosition = this.predictedMotion?.position ?? local.position;
    const nearbyLoot = this.nearestLoot(interactionPosition,local);
    const swapLoot = nearbyLoot && brPickupDisposition(local.inventory,local.ammo,nearbyLoot.state)==="swap";
    const nearbyCrate = this.nearestCrate(interactionPosition);
    const downedTeammate = this.nearestDownedTeammate(local,interactionPosition);
    const nearbyVehicle = local.vehicleId ? this.vehicles.get(local.vehicleId) ?? null : this.nearestVehicle(interactionPosition);
    const aircraft=nearbyVehicle&&BR_VEHICLE_DEFINITIONS[nearbyVehicle.state.kind].flight;
    const airborneAircraft=Boolean(aircraft&&nearbyVehicle!.state.position.y-brFloorHeightAt(nearbyVehicle!.state.position,nearbyVehicle!.state.position.y)>3);
    if (frame.interact.pressed && !downedTeammate) {
      if (local.vehicleId) this.onToggleVehicle?.();
      else if (nearbyLoot) this.onPickup?.(nearbyLoot.state.id, swapLoot ? local.selectedSlot : undefined);
      else if (nearbyCrate) this.onOpenCrate?.(nearbyCrate.state.id);
      else if (nearbyVehicle) this.onToggleVehicle?.();
      else if(selectedItem&&isBrUtility(selectedItem.itemId)&&!local.downed&&local.deployment==="grounded"&&this.reloadEndsAt<=now&&this.useEndsAt<=now)this.onUseItem?.();
      else if (selectedItem && isBrHeal(selectedItem.itemId) && !local.downed && local.deployment === "grounded") { const heal=BR_HEALS[selectedItem.itemId];const usable=heal.hp>0?local.hp<BR_BALANCE.hp:local.shield<BR_BALANCE.shield;if(usable&&this.useEndsAt<=now&&this.reloadEndsAt<=now){this.useConfirmed=false;this.useStartedAt = now; this.useEndsAt = now + heal.durationMs;this.audio.brUseItem(heal.shield>0); this.onUseItem?.();} }
    }
    this.syncReviveInput(downedTeammate?.id??null,frame.interact.held,now);
    if (frame.ping.pressed) { const point = this.aimPoint(); this.onPing?.({ x: point.x, y: point.y, z: point.z }); }
    if (frame.emote.pressed) {
      this.triggerEmote(local, lookDirection);
    }
    const jumpKey = inputLabel("jump", frame.method); const interactKey = inputLabel("interact", frame.method);
    const selectedHeal=selectedItem&&isBrHeal(selectedItem.itemId)?BR_HEALS[selectedItem.itemId]:null;const healUsable=Boolean(selectedHeal&&(selectedHeal.hp>0?local.hp<BR_BALANCE.hp:local.shield<BR_BALANCE.shield));
    const promptDeployment=this.predictedMotion?.deployment??local.deployment;
    this.prompt = promptDeployment === "attached" ? `${jumpKey}  JUMP`
      : promptDeployment === "freefall" ? `${jumpKey}  DEPLOY ION WINGS`
        : this.confirmedReviveTargetId || (this.activeReviveTargetId && this.reviveStartedAt) ? "REVIVING TEAMMATE"
          : this.reloadEndsAt > now ? "RELOADING"
            : this.useEndsAt > now ? `USING ${selectedHeal?.name ?? "ITEM"}`
              : local.vehicleId ? aircraft?`${nearbyVehicle!.state.driverId===local.id?`${jumpKey} UP · CTRL DOWN · `:""}${airborneAircraft?"LAND TO EXIT":`${interactKey} EXIT`}`:`${interactKey}  EXIT VEHICLE`
                : downedTeammate ? `HOLD ${interactKey}  REVIVE`
                : nearbyLoot ? ""
                  : nearbyCrate ? `${interactKey}  OPEN STAR CRATE`
                    : nearbyVehicle ? `${interactKey}  ${nearbyVehicle.state.driverId?"BOARD":"PILOT"} ${BR_VEHICLE_DEFINITIONS[nearbyVehicle.state.kind].name}`
                      : selectedItem&&isBrUtility(selectedItem.itemId)?`${interactKey}  USE ${BR_UTILITIES[selectedItem.itemId].name}`
                      : selectedHeal&&healUsable ? `${interactKey}  USE ${selectedHeal.name}`
                      : selectedItem && isBrWeapon(selectedItem.itemId) && selectedItem.itemId !== "energy-saber" && selectedItem.magazine === 0 ? `${inputLabel("repair", frame.method)}  RELOAD` : "";
    this.inputAccumulator += dt;
    if (this.inputAccumulator >= 1 / BR_BALANCE.inputRate) {
      this.inputAccumulator %= 1 / BR_BALANCE.inputRate;
      const jump=this.jumpInputLatch.consume(frame.jump.held);const sequence=++this.sequence;
      this.onInput?.({ sequence, dt: Math.min(.1, dt), moveX: frame.moveX, moveY: frame.moveY, yaw: this.yaw, pitch: this.pitch, jump, sprint: frame.burst.held, crouch: frame.crouch.held, fire: frame.fire.held&&!shot?.blocked, shotDirection:shot?.direction, aim: frame.grapple.held, reload: frame.repair.held });
    }
    this.onHud?.({ player: local, players: this.room?.players ?? [], teamMode:this.room?.teamMode??"solo", playersRemaining: this.room?.playersRemaining ?? 0, teamsRemaining: this.room?.teamsRemaining ?? 0, storm: this.room?.storm ?? ({ phaseIndex: 0, center: { x: 0, z: 0 }, radius: 0, nextCenter: { x: 0, z: 0 }, nextRadius: 0, stage: "waiting", stageEndsAt: null, damagePerSecond: 0 }), phase: this.room?.phase ?? "lobby", prompt: this.prompt, reloadProgress: this.reloadEndsAt > now ? 1 - (this.reloadEndsAt - now) / Math.max(1, this.reloadEndsAt - this.reloadStartedAt) : 0, useProgress: this.useEndsAt > now ? 1 - (this.useEndsAt - now) / Math.max(1, this.useEndsAt - this.useStartedAt) : 0, reviveProgress: this.reviveStartedAt ? THREE.MathUtils.clamp((now-this.reviveStartedAt)/BR_BALANCE.reviveMs,0,1) : 0, spectatorTarget:null,dropAltitude:this.dropAltitude(local),targetedLoot:!local.vehicleId&&nearbyLoot?{...nearbyLoot.state,position:{...nearbyLoot.state.position}}:null });
  }

  private dropAltitude(player:BrPlayerState):BrHudState["dropAltitude"] {
    const motion=this.predictedMotion;const deployment=motion?.deployment??player.deployment;
    if(deployment!=="freefall"&&deployment!=="chute")return null;
    const position=motion?.position??player.position,velocity=motion?.velocity??player.velocity;
    return {meters:this.physics.supportDistance(position),verticalSpeed:velocity.y,deployment};
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

  private selectSlot(slot: number): void {
    if (this.localState?.selectedSlot === slot) return;
    this.reloadEndsAt = 0; this.useEndsAt = 0; this.reloadConfirmed=false;this.useConfirmed=false;
    this.pendingSelectedSlot={value:slot,expiresAt:performance.now()+900};
    this.onSelectSlot?.(slot); if (this.localState) this.localState.selectedSlot = slot;
  }

  private updatePlayers(dt: number, now: number): void {
    let farPlayerCount=0;
    for (const visual of this.players.values()) {
      visual.supported?.beforeMotion();
      const vehicleEntry=visual.state.vehicleId?this.vehicles.get(visual.state.vehicleId):undefined;
      const localMotion=visual.state.id===this.localId&&!vehicleEntry?this.predictedMotion:null;
      visual.group.visible=visual.state.alive&&visual.relevant&&(localMotion?.deployment??visual.state.deployment)!=="attached"&&this.room?.phase!=="lobby"&&this.room?.phase!=="countdown";
      const displayTarget=localMotion?this.temp.set(localMotion.position.x,localMotion.position.y,localMotion.position.z):visual.target;
      // Prediction and reconciliation already smooth local corrections. The old
      // second lerp made the astronaut and following camera visibly trail input.
      if(vehicleEntry){vehicleEntry.visual.group.updateMatrixWorld(true);const seat=brVehicleSeatIndex(vehicleEntry.state,visual.state.id);const anchor="seatAnchors" in vehicleEntry.visual?(vehicleEntry.visual as BrTeamVehicleVisual).seatAnchors[seat]??vehicleEntry.visual.driverAnchor:vehicleEntry.visual.driverAnchor;anchor.getWorldPosition(this.weaponHand);visual.group.position.copy(this.weaponHand);}
      else if(localMotion)visual.group.position.copy(displayTarget);else visual.group.position.lerp(displayTarget,Math.min(1,dt*10));
      const cameraYaw=localMotion?this.yaw:visual.state.yaw;
      const velocity=localMotion?.velocity??visual.state.velocity;
      // Confirmed shots also face aim for remote pilots and new firing modes;
      // legacy flash anticipation is a separate deduplication clock.
      const firingPose=now-visual.lastShotAt<240||(visual.state.id===this.localId&&this.firingPoseHeld);
      const gameplayYaw=brMovementFacingYaw(cameraYaw,velocity,localMotion?this.aiming:Boolean(visual.state.aiming),firingPose,-visual.group.rotation.y);
      visual.group.rotation.y=vehicleEntry?brAstronautFacingRotation(vehicleEntry.renderYaw):brSmoothFacing(visual.group.rotation.y,brAstronautFacingRotation(gameplayYaw),dt);
      const deployment=localMotion?.deployment??visual.state.deployment;
      const downed=localMotion?.downed??visual.state.downed;
      const crouched=localMotion?.crouched??visual.state.crouched;
      const grounded=localMotion?.grounded??visual.state.grounded;
      const speed=vehicleEntry?0:Math.hypot(velocity.x,velocity.z);
      if(visual.state.id===this.localId&&grounded&&speed>1.6&&now-this.lastFootstepAt>(speed>BR_BALANCE.walkSpeed?285:390)){this.lastFootstepAt=now;this.audio.footstep(speed>BR_BALANCE.walkSpeed);}
      if (visual.state.id !== this.localId && visual.group.visible && grounded && speed > 1.6 && !vehicleEntry) {
        const listener = this.audioListenerPosition();
        const last = Number(visual.group.userData.lastFootstepAt ?? 0);
        if (listener && now - last > (speed > BR_BALANCE.walkSpeed ? 285 : 390)) {
          visual.group.userData.lastFootstepAt = now;
          this.audio.brRemoteFootstep(visual.group.position, listener, this.yaw, speed > BR_BALANCE.walkSpeed);
        }
      }
      const playerDistance=this.camera.position.distanceTo(visual.group.position);
      const impostor=visual.group.visible&&farPlayerCount<BR_BALANCE.maxPlayers&&useBrPlayerImpostor(playerDistance,this.settings.graphicsQuality,visual.state.id===this.localId,deployment,downed);
      visual.rig.visible=!impostor;
      if(impostor){
        this.farPlayerQuaternion.setFromAxisAngle(this.cameraUp,visual.group.rotation.y);
        this.farPlayerPosition.set(visual.group.position.x,visual.group.position.y+.68,visual.group.position.z);
        this.farPlayerMatrix.compose(this.farPlayerPosition,this.farPlayerQuaternion,this.farPlayerScale);this.farPlayerBodies.setMatrixAt(farPlayerCount,this.farPlayerMatrix);this.farPlayerBodies.setColorAt(farPlayerCount,visual.suitMaterial.color);
        this.farPlayerPosition.y=visual.group.position.y+1.46;
        this.farPlayerMatrix.compose(this.farPlayerPosition,this.farPlayerQuaternion,this.farPlayerScale);this.farPlayerHelmets.setMatrixAt(farPlayerCount,this.farPlayerMatrix);farPlayerCount++;
      }
      const held = visual.state.id===this.localId ? this.localState?.inventory[this.localState.selectedSlot] : visual.state.heldItem;
      const id=held?.itemId;
      const motion=visual.motion,input=motion.input;
      const modelYaw=visual.group.rotation.y+visual.rig.rotation.y;
      const teleported=(visual.group.position.x-visual.motionX)**2+(visual.group.position.y-visual.motionY)**2+(visual.group.position.z-visual.motionZ)**2>64;
      const yawDelta=teleported||visual.motionYaw===null?0:Math.atan2(Math.sin(modelYaw-visual.motionYaw),Math.cos(modelYaw-visual.motionYaw));
      if(teleported)motion.reset();
      input.dt=dt;input.timeSeconds=now/1000;
      input.forwardSpeed=velocity.x*Math.sin(modelYaw)+velocity.z*Math.cos(modelYaw);
      input.lateralSpeed=velocity.x*Math.cos(modelYaw)-velocity.z*Math.sin(modelYaw);
      input.verticalSpeed=velocity.y;input.turnRate=yawDelta/Math.max(.001,dt);
      input.grounded=grounded;input.walkSpeed=BR_BALANCE.walkSpeed;input.runSpeed=BR_BALANCE.sprintSpeed;
      input.floorOffset=visual.rig.position.y+.035;
      input.aiming=visual.state.id===this.localId?this.aiming:Boolean(visual.state.aiming);input.crouched=crouched;
      input.item=id==='energy-saber'?'melee':id==='comet-hand-cannon'?'one-hand':id==='plasma-launcher'||id==='vortex-cannon'?'heavy':id&&isBrWeapon(id)?'two-hand':id&&(isBrHeal(id)||isBrUtility(id))?'utility':'none';
      const detailDistance=this.settings.graphicsQuality==="low"?10:this.settings.graphicsQuality==="medium"?18:28;
      input.detail=impostor||!visual.group.visible?'skip':visual.state.id===this.localId||playerDistance<detailDistance?'near':'far';
      input.special=Boolean(vehicleEntry||downed||deployment!=='grounded'||visual.emote&&now<visual.emoteEndsAt);
      motion.update();visual.motionYaw=modelYaw;visual.motionX=visual.group.position.x;visual.motionY=visual.group.position.y;visual.motionZ=visual.group.position.z;
      const run=Math.sin(downed?now*.008:motion.state.phase);
      if(deployment==='freefall'){visual.limbs[0].rotation.set(0,0,.72);visual.limbs[1].rotation.set(0,0,-.72);visual.limbs[2].rotation.set(.34,0,0);visual.limbs[3].rotation.set(.34,0,0);}
      else if(downed){visual.limbs[0].rotation.set(-.9+run*.25,0,.17);visual.limbs[1].rotation.set(-.9-run*.25,0,-.17);visual.limbs[2].rotation.set(.65,0,0);visual.limbs[3].rotation.set(.65,0,0);}
      visual.body.rotation.x = THREE.MathUtils.lerp(visual.body.rotation.x, 0, Math.min(1, dt * 16));
      visual.body.rotation.z = THREE.MathUtils.lerp(visual.body.rotation.z, 0, Math.min(1, dt * 12));
      visual.body.rotation.y = THREE.MathUtils.lerp(visual.body.rotation.y, 0, Math.min(1, dt * 12));
      if (visual.emote && now < visual.emoteEndsAt) this.animateEmote(visual, now);
      else visual.emote = null;
      const airborne=deployment==="freefall"||deployment==="chute";
      visual.flightTrail.visible=visual.group.visible&&airborne&&playerDistance<(this.settings.graphicsQuality==="low"?65:135);
      if(visual.flightTrail.visible){
        if(now-visual.trailSampleAt>=33){
          visual.trailSampleAt=now;
          if(visual.flightTrailPoints[0]&&visual.flightTrailPoints[0].distanceToSquared(visual.group.position)>400)visual.flightTrailPoints.length=0;
          const point=visual.flightTrailPoints.length===12?visual.flightTrailPoints.pop()!:new THREE.Vector3();
          point.copy(visual.group.position);point.y+=.9;visual.flightTrailPoints.unshift(point);
          // The pilot's history otherwise passes through the following camera,
          // expanding a narrow ribbon into a screen-wide near-plane streak.
          // Remote pilots keep their full trail; only our own tail ends ahead
          // of the camera boom, including when an obstruction shortens it.
          updateCosmeticFlightTrail(visual.flightTrail,visual.flightTrailPoints,visual.state.id===this.localId?Math.min(6,Math.max(.3,this.cameraBoom*.55)):Infinity);
        }
      }else visual.flightTrailPoints.length=0;
      const targetLean=downed?-1.12:deployment==="freefall"?.72:deployment==="chute"?.38:crouched&&speed>5?.12:0;
      if(deployment!=="chute")visual.rig.rotation.x = THREE.MathUtils.lerp(visual.rig.rotation.x, targetLean, Math.min(1, dt * 9));
      visual.rig.position.y=THREE.MathUtils.lerp(visual.rig.position.y,brAstronautRigHeight(downed,airborne,crouched),Math.min(1,dt*10));
      const squash=grounded&&Math.abs(velocity.y)<.2?1+Math.sin(now*.01)*.008:1;
      visual.rig.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      applyBrDeploymentPose(visual, deployment, now, dt);
      for(const detail of visual.lodDetails)detail.visible=visual.state.id===this.localId||playerDistance<detailDistance;
      this.updateHeldWeapon(visual, dt);
      visual.shadow.visible=!vehicleEntry;
      if(vehicleEntry){visual.limbs[0].rotation.set(-.85,0,.22);visual.limbs[1].rotation.set(-.85,0,-.22);visual.limbs[2].rotation.set(-1.05,0,.08);visual.limbs[3].rotation.set(-1.05,0,-.08);visual.rig.rotation.x=0;}
      this.updateActionPresentation(visual,now);
      this.anchorHeldPresentation(visual,now,dt);
      this.updateDamageFeedback(visual,now);
      visual.label.visible = visual.state.id !== this.localId && playerDistance < 145;
      const labelScale = THREE.MathUtils.clamp(playerDistance * .012, 1.5, 3.8); visual.label.scale.set(labelScale * 2.6, labelScale, 1);
    }
    this.farPlayerBodies.count=farPlayerCount;this.farPlayerHelmets.count=farPlayerCount;
    this.farPlayerBodies.instanceMatrix.needsUpdate=true;this.farPlayerHelmets.instanceMatrix.needsUpdate=true;
    if(this.farPlayerBodies.instanceColor)this.farPlayerBodies.instanceColor.needsUpdate=true;
  }

  private updateNameplates():void {
    for(const visual of this.players.values()){
      if(visual.group.visible&&visual.label.visible)visual.nameplatePlacement.update(visual.label,this.camera);
    }
  }

  private updateVehicles(dt:number,now:number):void {
    const blend=1-Math.exp(-14*dt);
    for(const entry of this.vehicles.values()){
      const locallyDriven=entry.state.driverId===this.localId;
      if(locallyDriven&&!BR_VEHICLE_DEFINITIONS[entry.state.kind].flight){
        // Predict only the cosmetic kinematic shell. The server still owns
        // collision and corrects the target each snapshot, while input feels
        // immediate instead of moving in large network-rate steps.
        entry.visual.group.position.lerp(entry.target,1-Math.exp(-4*dt));
        const predicted=stepBrVehicle({...entry.state,position:{x:entry.visual.group.position.x,y:entry.visual.group.position.y,z:entry.visual.group.position.z},velocity:{...entry.renderVelocity},yaw:entry.renderYaw},this.vehicleInput,dt);
        predicted.position.y=brFloorHeightAt(predicted.position,entry.visual.group.position.y+2.5)+BR_VEHICLE_DEFINITIONS[entry.state.kind].hoverHeight;
        entry.visual.group.position.copy(vec(predicted.position));entry.renderYaw=predicted.yaw;entry.renderVelocity={...predicted.velocity};
      }else{
        entry.visual.group.position.lerp(entry.target,blend);
        const delta=Math.atan2(Math.sin(entry.state.yaw-entry.renderYaw),Math.cos(entry.state.yaw-entry.renderYaw));
        entry.renderYaw+=delta*blend;entry.renderVelocity={...entry.state.velocity};
      }
      const steeringDelta=Math.atan2(Math.sin(entry.state.yaw-entry.renderYaw),Math.cos(entry.state.yaw-entry.renderYaw));
      entry.visual.group.rotation.y=Math.PI-entry.renderYaw;
      const speed=Math.hypot(entry.renderVelocity.x,entry.renderVelocity.z);
      (entry.state.kind==="hover-skimmer"?updateBrHoverSkimmer:(visual:BrHoverSkimmerVisual,frame:Parameters<typeof updateBrHoverSkimmer>[1])=>updateBrTeamVehicle(visual as BrTeamVehicleVisual,frame))(entry.visual,{time:now/1000,speed,steering:THREE.MathUtils.clamp(steeringDelta/Math.max(.001,dt),-1,1),occupied:Boolean(entry.state.driverId)});
      const far=useFarBrVehicle(entry.visual.group.position.distanceTo(this.camera.position),this.settings.graphicsQuality,entry.far,locallyDriven);
      if(far!==entry.far){entry.lod.setFar(far);entry.far=far;}
      else if(far)entry.lod.sync();
    }
  }

  private updateLoot(now: number): void {
    for (const visual of this.loot.values()) {
      visual.group.updateDetail(this.camera.position, this.settings.graphicsQuality);
      const rarityVisual = visual.group.detail;
      if (rarityVisual instanceof BrLootRarityVisual) rarityVisual.update(
        now,
        this.settings.graphicsQuality,
        visual.group.position.distanceTo(this.camera.position),
      );
    }
  }
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
  private updatePings(now: number): void { for (let index = this.pings.length - 1; index >= 0; index--) { const ping = this.pings[index]; if (now < ping.expiresAt) { ping.group.position.y += Math.sin(now * .01) * .0015; continue; } this.scene.remove(ping.group); this.disposeObject(ping.group); this.pings.splice(index, 1); } }
  private updateShip(): void {
    updateStarliner(this.starliner,this.room,performance.now(),Date.now()+this.serverClockOffsetMs);
    const renderedDeployment=this.players.get(this.localId)?.state.deployment;
    if (!this.starliner.visible || shouldKeepStarlinerInDropView(this.room?.phase,renderedDeployment,this.localState?.deployment)) return;
    // Once a player has jumped, the very large transport can cross the camera
    // boom and completely hide the island. Keep it in the wider aerial view,
    // but cull it while it is inside the player's immediate camera envelope.
    if (shouldHideStarlinerNearCamera(this.room?.phase,renderedDeployment,this.localState?.deployment,this.starliner.position.distanceTo(this.camera.position))) this.starliner.visible = false;
  }

  private audioListenerPosition():Vec3|null {
    if(!this.localState)return null;
    // After elimination, the camera follows a living pilot rather than the
    // corpse. Remote combat/footstep direction must follow that same view.
    return this.localState.alive?this.predictedMotion?.position??this.localState.position:this.camera.position;
  }

  private updateBrAudio():void {
    const local=this.localState;
    const deployment=this.predictedMotion?.deployment??local?.deployment;
    this.audio.setBrLoop("starliner",Boolean(this.room?.phase==="ship"&&deployment==="attached"),.8);
    const falling=Boolean(local?.alive)&&(deployment==="freefall"||deployment==="chute");
    const verticalSpeed=Math.abs(this.predictedMotion?.velocity.y??local?.velocity.y??0);
    this.audio.setBrLoop("drop",falling,falling?THREE.MathUtils.clamp(verticalSpeed/BR_BALANCE.freefallSpeed,.2,1):0);
    const vehicle=local?.alive&&local.vehicleId?this.vehicles.get(local.vehicleId):null;
    const speed=vehicle?Math.hypot(vehicle.renderVelocity.x,vehicle.renderVelocity.z):0;
    this.audio.setBrLoop("skimmer",Boolean(vehicle),vehicle?THREE.MathUtils.clamp(speed/BR_BALANCE.vehicle.maxSpeed,.12,1):0);
  }

  private updateCamera(dt: number): void {
    if (this.debugCameraView) { this.cameraInitialized=false;this.camera.position.copy(this.debugCameraView.position); this.camera.up.set(0, 1, 0); this.camera.lookAt(this.debugCameraView.focus); this.camera.fov = 60; this.camera.updateProjectionMatrix(); return; }
    if(this.room?.phase==="lobby"||this.room?.phase==="countdown"){
      this.cameraInitialized=false;const time=performance.now()*.000035;const focus=new THREE.Vector3(-25,0,15);const desired=new THREE.Vector3(Math.sin(time)*570,330,Math.cos(time)*570);this.camera.position.lerp(desired,Math.min(1,dt*2.2));this.camera.up.set(0,1,0);this.camera.lookAt(focus);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,58,Math.min(1,dt*3));this.camera.updateProjectionMatrix();return;
    }
    const localPlayer = this.players.get(this.localId);
    if(this.room?.phase==="ship"&&this.room.ship&&(!localPlayer||(this.predictedMotion?.deployment??localPlayer.state.deployment)==="attached")){
      this.cameraInitialized=false;const shipPosition=this.starliner.position.clone(); const route = vec(this.room.ship.end).sub(vec(this.room.ship.start)); route.y = 0; route.normalize();
      // Seed the post-jump camera and camera-relative steering with the route
      // direction. Previously the cinematic camera faced the ship while the
      // gameplay yaw stayed at its unrelated default, causing a disorienting
      // turn the instant the astronaut jumped.
      const initialShipFrame=!this.shipLookInitialized;
      const shipLook=brShipLookState(this.yaw,route,this.shipLookInitialized);this.yaw=shipLook.yaw;this.shipLookInitialized=shipLook.initialized;
      if(initialShipFrame)this.pitch=-.42;
      const transportFrame=brShipCameraFrame(shipPosition,this.yaw,this.pitch);
      const focus=vec(transportFrame.focus),desired=vec(transportFrame.desired);
      if(initialShipFrame)this.camera.position.copy(desired);
      else this.camera.position.lerp(desired,1-Math.exp(-18*dt));
      this.camera.up.set(0,1,0);this.camera.lookAt(focus);
      this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,70,Math.min(1,dt*4));this.camera.updateProjectionMatrix();return;
    }
    if (!localPlayer) return;
    const local = localPlayer.state.alive ? localPlayer : this.getSpectatorTarget() ?? localPlayer;
    const spectator=!localPlayer.state.alive&&local.state.id!==localPlayer.state.id;
    const localMotion=!spectator&&local.state.id===this.localId?this.predictedMotion:null;
    const followedVehicle=local.state.vehicleId?this.vehicles.get(local.state.vehicleId):null;
    const enteringVehicle=Boolean(followedVehicle&&followedVehicle.state.id!==this.cameraVehicleId);
    if(!spectator){
      this.yaw=brVehicleEntryYaw(this.yaw,this.cameraVehicleId,followedVehicle?{id:followedVehicle.state.id,yaw:followedVehicle.renderYaw}:null);
      if(enteringVehicle)this.pitch=-.08;
    }
    this.cameraVehicleId=followedVehicle?.state.id??null;
    const position=followedVehicle?{x:followedVehicle.visual.group.position.x,y:followedVehicle.visual.group.position.y+.62,z:followedVehicle.visual.group.position.z}:localMotion?.position??local.state.position;
    const velocity=followedVehicle?followedVehicle.renderVelocity:localMotion?.velocity??local.state.velocity;
    const deployment=localMotion?.deployment??local.state.deployment;
    const downed=localMotion?.downed??local.state.downed;
    const speed=Math.hypot(velocity.x,velocity.z);
    const mode=followedVehicle?"vehicle":brCameraMode(deployment,downed,this.aiming,spectator);
    const rig=brCameraGeometry(position,this.yaw,this.pitch,mode,speed);
    const held=local.state.id===this.localId?this.localState?.inventory[this.localState.selectedSlot]??null:local.state.heldItem;
    const optic=brAimProfile(held&&isBrWeapon(held.itemId)?held.itemId:null,this.aiming&&!spectator);
    this.cameraFocus.set(rig.focus.x,rig.focus.y,rig.focus.z);
    this.cameraDesired.set(rig.desired.x,rig.desired.y,rig.desired.z);
    this.cameraRight.set(rig.right.x,0,rig.right.z);
    const cameraFloor=brBaseDeckHeight(this.cameraDesired)+.42;
    if(this.cameraDesired.y<cameraFloor&&isInsideBrIsland(this.cameraDesired))this.cameraDesired.y=cameraFloor;
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
    this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,this.aiming&&!spectator?optic.fov:rig.fov,1-Math.exp(-7*dt));this.camera.updateProjectionMatrix();
    // When a wall must shorten the boom to first-person distance, hiding only
    // the local rig avoids filling the screen with helmet/boots while retaining
    // collision-correct visibility. It returns immediately as the boom clears.
    if(local.state.id===this.localId){
      this.camera.updateMatrixWorld(); local.helmet.updateWorldMatrix(true,false);
      const bounds=local.cameraHelmetBounds; let minY=Infinity,maxY=-Infinity;
      for(let corner=0;corner<8;corner++){
        this.cameraHelmetPoint.set(corner&1?bounds.max.x:bounds.min.x,corner&2?bounds.max.y:bounds.min.y,corner&4?bounds.max.z:bounds.min.z)
          .applyMatrix4(local.helmet.matrixWorld).applyMatrix4(this.camera.matrixWorldInverse);
        if(this.cameraHelmetPoint.z>=-this.camera.near){minY=-Infinity;maxY=Infinity;break;}
        this.cameraHelmetPoint.applyMatrix4(this.camera.projectionMatrix);
        minY=Math.min(minY,this.cameraHelmetPoint.y);maxY=Math.max(maxY,this.cameraHelmetPoint.y);
      }
      this.localRigCameraVisible=brLocalRigCameraVisible(this.cameraBoom,this.localRigCameraVisible,Boolean(optic.scope),(maxY-minY)/2);
      local.rig.visible=this.localRigCameraVisible;
    }
  }

  private cameraObstructionDistance(focus:THREE.Vector3,desired:THREE.Vector3,right:THREE.Vector3):number {
    this.cameraRay.copy(desired).sub(focus);const maximum=this.cameraRay.length();if(maximum<.001)return maximum;this.cameraRay.divideScalar(maximum);
    let nearest=maximum;
    const lateral=[0,.22,-.22,0,0];const vertical=[0,0,0,.18,-.18];
    for(let index=0;index<lateral.length;index++){
      this.cameraProbeOrigin.copy(focus).addScaledVector(right,lateral[index]).addScaledVector(this.cameraUp,vertical[index]);
      const distance = this.physics.cameraDistance(this.cameraProbeOrigin, this.cameraRay, maximum);
      if (distance > .25) nearest = Math.min(nearest, distance);
    }
    return nearest;
  }

  private syncPlayers(states: Array<BrPlayerSnapshotState | BrPlayerState>, relevanceSnapshot = false): void {
    if (relevanceSnapshot) for (const visual of this.players.values()) visual.relevant = visual.state.id === this.localId;
    for (const source of states) {
      const state = this.renderState(source);
      let visual = this.players.get(state.id);
      if (!visual) { visual = this.makePlayer(state); this.players.set(state.id, visual); this.scene.add(visual.group,visual.flightTrail); }
      visual.state = state; visual.relevant = true; visual.target.copy(vec(state.position)); visual.suitMaterial.color.set(cosmeticColor(state.equippedCosmetics.suit, state.color));
      if(visual.flightTrail.userData.cosmeticId!==state.equippedCosmetics.trail)configureCosmeticFlightTrail(visual.flightTrail,cosmeticColor(state.equippedCosmetics.trail,"#70f5ff"),state.equippedCosmetics.trail);
    }
  }

  private syncProjectiles(states: BrProjectileState[]): void {
    const ids = new Set(states.map((state) => state.id));
    for (const state of states) { let visual = this.projectiles.get(state.id); if (!visual) { this.addProjectile(state); visual = this.projectiles.get(state.id)!; } visual.state = state; visual.target.copy(vec(state.position)); }
    for (const [id, visual] of this.projectiles) if (!ids.has(id)) { this.scene.remove(visual.mesh, visual.trail); this.disposeObject(visual.mesh); this.disposeObject(visual.trail); this.projectiles.delete(id); }
  }

  private syncVehicles(states:readonly BrVehicleState[]):void {
    this.physics.setVehicles(states,this.localState?.vehicleId??null);
    const ids=new Set(states.map(state=>state.id));
    for(const state of states){
      let entry=this.vehicles.get(state.id);
      if(entry&&entry.state.kind!==state.kind){entry.lod.dispose();disposeBrHoverSkimmer(entry.visual);this.vehicles.delete(state.id);entry=undefined;}
      if(!entry){
        const visual=state.kind==="hover-skimmer"?createBrHoverSkimmer():createBrTeamVehicle(state.kind);visual.group.position.copy(vec(state.position));visual.group.rotation.y=Math.PI-state.yaw;this.scene.add(visual.group);
        entry={visual,lod:state.kind==="hover-skimmer"?createBrSkimmerDistanceLod(visual):{group:new THREE.Group(),parts:[],setFar:()=>{},sync:()=>{},dispose:()=>{}},far:false,state,target:vec(state.position),renderYaw:state.yaw,renderVelocity:{...state.velocity}};this.vehicles.set(state.id,entry);
      }
      if(state.driverId===this.localId){entry.renderVelocity.x+=(state.velocity.x-entry.renderVelocity.x)*.25;entry.renderVelocity.z+=(state.velocity.z-entry.renderVelocity.z)*.25;}
      else entry.renderVelocity={...state.velocity};
      entry.state={...state,position:{...state.position},velocity:{...state.velocity}};entry.target.copy(vec(state.position));
    }
    for(const [id,entry] of this.vehicles)if(!ids.has(id)){entry.lod.dispose();disposeBrHoverSkimmer(entry.visual);this.vehicles.delete(id);}
  }

  private addProjectile(state: BrProjectileState): void {
    const style=brProjectileStyle(state.weaponId),color=style.color;
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(style.radius,style.detail), new THREE.MeshBasicMaterial({ color })); mesh.position.copy(vec(state.position));
    const trailGeometry = new THREE.BufferGeometry(); trailGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(14 * 3), 3)); trailGeometry.setDrawRange(0, 1);
    const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: style.trailOpacity })); this.scene.add(mesh, trail);
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
    rig.position.y = BR_ASTRONAUT_FLOOR_OFFSET;
    group.add(rig);
    const cameraHelmetBounds=new THREE.Box3().setFromObject(astronaut.helmet);
    cameraHelmetBounds.applyMatrix4(astronaut.helmet.matrixWorld.clone().invert());
    const body = astronaut.torso;
    const limbs = [astronaut.leftArm, astronaut.rightArm, astronaut.leftLeg, astronaut.rightLeg];
    const label = this.makeLabel(`${state.name}${state.isBot ? "  BOT" : ""}`, state.color); label.position.y = 3.2; group.add(label); group.position.copy(vec(state.position));
    const nameplatePlacement=createBrNameplatePlacement(astronaut.helmet);
    const wings=createBrIonWings(cosmeticColor(state.equippedCosmetics.trail,"#70f5ff"));astronaut.backpack.add(wings);
    const weapon = new THREE.Group(); weapon.visible = false; astronaut.upperBody.add(weapon);
    const actionDevice=new THREE.Group();actionDevice.position.set(.31,.91,.55);actionDevice.visible=false;astronaut.upperBody.add(actionDevice);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.48, 18), new THREE.MeshBasicMaterial({ color: 0x02050b, transparent: true, opacity: .38, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .025; group.add(shadow);
    const damageRipple=new THREE.Mesh(new THREE.SphereGeometry(.82,14,10),new THREE.MeshBasicMaterial({color:0x65eaff,transparent:true,opacity:0,wireframe:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    damageRipple.position.y=.82;damageRipple.visible=false;group.add(damageRipple);
    const flightTrail=createCosmeticFlightTrail(cosmeticColor(state.equippedCosmetics.trail,"#70f5ff"),state.equippedCosmetics.trail); flightTrail.visible=false;
    return { supported:null,supportedModel:null,heldAimFrame:createBrHeldAimFrame(),heldFrame:{dt:0,pitch:0,yaw:0,recoil:0,reloadProgress:null}, lastShotAt:-Infinity, motion:createAstronautMotion(astronaut), upperBody:astronaut.upperBody, motionYaw:null, motionX:state.position.x, motionY:state.position.y, motionZ:state.position.z, nameplatePlacement, flightTrail, flightTrailPoints:[], trailSampleAt:0, group, rig, target: vec(state.position), label, shadow, body, helmet: astronaut.helmet, cameraHelmetBounds, backpack: astronaut.backpack, suitMaterial: astronaut.suitMaterial, lodDetails: astronaut.lodDetails, limbs, wings, weapon, weaponId:null, actionDevice, actionHealId:null, actionHealModel:null, state, relevant: true, emote: null, emoteEndsAt: 0, damageFeedback:new BrDamageFeedback(), damageRipple };
  }

  private updateDamageFeedback(visual:PlayerVisual,now:number):void {
    const state=visual.damageFeedback.read(now);
    if(!state){visual.suitMaterial.emissive.setHex(0x000000);visual.suitMaterial.emissiveIntensity=1;visual.damageRipple.visible=false;return;}
    const flash=brDamageFeedbackFade(state.startedAt,state.flashUntil,now);
    visual.suitMaterial.emissive.setHex(state.style.color);visual.suitMaterial.emissiveIntensity=1+state.style.emissiveIntensity*flash;
    const ripple=brDamageFeedbackFade(state.startedAt,state.rippleUntil,now);
    visual.damageRipple.visible=ripple>0&&state.style.rippleOpacity>0;
    if(visual.damageRipple.visible){
      visual.damageRipple.material.color.setHex(state.style.rippleColor);visual.damageRipple.material.opacity=state.style.rippleOpacity*ripple;
      const expansion=state.style.rippleScale+state.style.rippleExpansion*(1-ripple);visual.damageRipple.scale.set(expansion,expansion*1.18,expansion);
    }
  }

  private updateHitMarker(now:number):void {
    const state=this.hitMarkerFeedback.read(now),crosshair=document.getElementById("br-crosshair");
    const visible=Boolean(state&&now<state.hitMarkerUntil);
    crosshair?.classList.toggle("hit",visible);crosshair?.classList.toggle("shield-break",Boolean(visible&&state?.kind==="shield-break"));
    document.getElementById("br-damage-direction")?.classList.toggle("visible",now<this.damageIndicatorUntil);
  }

  private makeLabel(text: string, color: string, depthTest = true): THREE.Sprite {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128; const context = canvas.getContext("2d")!; context.font = "900 42px Arial"; context.textAlign = "center"; context.textBaseline = "middle"; context.strokeStyle = "#020616"; context.lineWidth = 12; context.strokeText(text.toUpperCase(), 256, 64); context.fillStyle = color; context.fillText(text.toUpperCase(), 256, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest, depthWrite: false })); sprite.renderOrder = 15; return sprite;
  }

  private makeLoot(state: BrLootState): BrLootLod {
    const model = new THREE.Group(); const color = rarityColor[state.rarity];
    if(state.itemId&&isBrWeapon(state.itemId)){this.buildWeaponModel(model,state.itemId,color);const transform=brLootWeaponTransform(state.itemId);model.position.set(...transform.position);model.rotation.set(...transform.rotation);model.scale.setScalar(transform.scale);}
    else if(state.ammoType){const ammoColor=state.ammoType==="light"?0x70f5ff:state.ammoType==="heavy"?0xffd84d:0xff6bba;const cell=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.58,8),new THREE.MeshStandardMaterial({color:0x23344d,emissive:ammoColor,emissiveIntensity:.75,metalness:.6,roughness:.23}));cell.rotation.z=Math.PI/2;model.add(cell);for(const side of [-1,1]){const cap=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.08,8),new THREE.MeshBasicMaterial({color:ammoColor}));cap.rotation.z=Math.PI/2;cap.position.x=side*.32;model.add(cap);}}
    else if(state.itemId&&isBrHeal(state.itemId)){model.add(this.healModels.create(state.itemId));}
    else if(state.itemId&&isBrUtility(state.itemId)){model.add(this.utilityModels.create(state.itemId));}
    else{const core=new THREE.Mesh(new THREE.OctahedronGeometry(.33,0),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.28,metalness:.35,roughness:.25}));model.add(core);}
    // Loot state positions are authored around the item's old center. Keep the
    // rarity field on its supporting surface while only the item floats.
    const field = this.lootRarity.create(model,state.rarity,state.id,brLootSurfaceOffset(state),brLootModelSupportLift(model));
    return new BrLootLod(field, color, brLootCategory(state));
  }

  private makeCrate(): THREE.Group {
    const group = new THREE.Group();
    const shell = new THREE.Mesh(this.crateBoxGeometry, this.crateShellMaterial); shell.position.y = .5;shell.scale.set(1.65,.92,1.12); shell.castShadow = true; group.add(shell);
    const corners = new THREE.InstancedMesh(this.crateBoxGeometry, this.crateTrimMaterial, 4);
    const cornerMatrix = new THREE.Matrix4();
    const cornerScale = new THREE.Vector3(.15,1.02,.15);
    const cornerQuaternion = new THREE.Quaternion();
    let cornerIndex = 0;
    for (const x of [-.74, .74]) for (const z of [-.48, .48]) corners.setMatrixAt(cornerIndex++, cornerMatrix.compose(new THREE.Vector3(x,.5,z),cornerQuaternion,cornerScale));
    corners.instanceMatrix.needsUpdate = true;
    group.add(corners);
    const lid = new THREE.Mesh(this.crateBoxGeometry, this.crateTrimMaterial); lid.name="crate-lid";lid.position.y = 1.01;lid.scale.set(1.72,.2,1.18); group.add(lid);
    // The seam opacity animates per crate, so only this tiny material is cloned.
    const seam = new THREE.Mesh(this.crateBoxGeometry, this.crateSeamMaterial.clone()); seam.name="crate-seam";seam.position.y = .72;seam.scale.set(1.76,.1,1.2); group.add(seam);
    const lockBase = new THREE.Mesh(this.crateBoxGeometry, this.crateTrimMaterial); lockBase.position.set(0, .61, -.62);lockBase.scale.set(.42,.35,.12); group.add(lockBase);
    const lock = new THREE.Mesh(this.crateLockGeometry, this.crateLockMaterial); lock.position.set(0, .63, -.7);lock.scale.setScalar(.18); group.add(lock);
    const shadow = new THREE.Mesh(this.crateShadowGeometry, this.crateShadowMaterial); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02;shadow.scale.setScalar(1.05); group.add(shadow);
    return group;
  }

  private playEnergyBurst(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group(); group.position.copy(at);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .82, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(.3, .42, 24), material); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(scale); group.add(ring);
    for (let index = 0; index < 8; index++) { const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(.12), material); const angle = index / 8 * Math.PI * 2; shard.position.set(Math.cos(angle) * scale, .45 + index % 2 * .28, Math.sin(angle) * scale); group.add(shard); }
    this.scene.add(group);
    this.transients.push({group,expiresAt:performance.now()+230});
  }

  private updateTransients(now:number):void {for(let index=this.transients.length-1;index>=0;index--){const transient=this.transients[index];if(now<transient.expiresAt)continue;this.scene.remove(transient.group);this.disposeObject(transient.group);this.transients.splice(index,1);}}
  private clearTransients():void {for(const transient of this.transients){this.scene.remove(transient.group);this.disposeObject(transient.group);}this.transients=[];}

  private nearestLoot(position: Vec3, player:BrPlayerState): LootVisual | null { let best: LootVisual | null = null; let distance: number = BR_BALANCE.pickupRange; for (const visual of this.loot.values()) { if(brPickupDisposition(player.inventory,player.ammo,visual.state)==="full")continue;const next = Math.hypot(visual.state.position.x-position.x,visual.state.position.y-position.y,visual.state.position.z-position.z); if (next < distance) { best = visual; distance = next; } } return best; }
  private nearestCrate(position: Vec3): CrateVisual | null { let best: CrateVisual | null = null; let distance = 2.7; for (const visual of this.crates.values()) { const next = Math.hypot(visual.group.position.x-position.x,visual.group.position.y-position.y,visual.group.position.z-position.z); if (next < distance) { best = visual; distance = next; } } return best; }
  private nearestDownedTeammate(local: BrPlayerState,position:Vec3): BrPlayerSnapshotState | null { let best: BrPlayerSnapshotState | null = null; let distance: number = BR_BALANCE.reviveRange; for (const visual of this.players.values()) { const state = visual.state; if (!state.downed || state.teamId !== local.teamId || state.id === local.id) continue; const next = Math.hypot(state.position.x-position.x,state.position.y-position.y,state.position.z-position.z); if (next < distance) { best = state; distance = next; } } return best; }
  private nearestVehicle(position:Vec3):VehicleVisual|null { let best:VehicleVisual|null=null;let distance=Infinity;for(const vehicle of this.vehicles.values()){if(vehicle.state.driverId&&(vehicle.state.passengerIds?.filter(Boolean).length??0)>=BR_VEHICLE_DEFINITIONS[vehicle.state.kind].seats.length-1)continue;const next=Math.hypot(vehicle.state.position.x-position.x,vehicle.state.position.y-position.y,vehicle.state.position.z-position.z);if(next<distance&&next<BR_VEHICLE_DEFINITIONS[vehicle.state.kind].entryRange){best=vehicle;distance=next;}}return best; }
  private syncReviveInput(candidateTargetId:string|null,held:boolean,now:number):void {
    const next=brReviveInput(this.activeReviveTargetId,candidateTargetId,held);
    this.activeReviveTargetId=next.activeTargetId;
    for(const command of next.commands){this.onRevive?.(command.targetId,command.active);this.lastReviveRequestAt=now;this.reviveConfirmedDuringHold=false;}
    // Prediction can briefly put the local prompt inside range before the
    // authoritative player arrives. Retry a rejected reliable start at a low
    // rate rather than either dropping the hold or emitting every frame.
    if(next.activeTargetId&&next.commands.length===0&&brReviveRetryDue(next.activeTargetId,this.confirmedReviveTargetId,this.lastReviveRequestAt,now,this.reviveConfirmedDuringHold)){
      this.onRevive?.(next.activeTargetId,true);this.lastReviveRequestAt=now;
    }
  }
  private lootName(state: BrLootState): string { if (state.itemId) return `${state.rarity.toUpperCase()} ${state.itemId.replaceAll("-", " ").toUpperCase()}`; return `${state.ammoType?.toUpperCase()} CELLS`; }
  private lookDirection(): THREE.Vector3 { return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize(); }
  private aimPoint(includePlayers=false): THREE.Vector3 {
    const direction=this.lookDirection();
    this.raycaster.set(this.camera.position,direction);this.raycaster.far=500;
    const worldHit=this.raycaster.intersectObjects(this.islandMeshes,false)[0];
    let nearest=worldHit?.distance??500,playerHit=false;
    if(includePlayers&&this.localState)for(const visual of this.players.values()){
      if(!visual.relevant||!visual.state.alive||visual.group.visible===false||visual.state.id===this.localId||visual.state.teamId===this.localState.teamId)continue;
      const hit=brPlayerHitDistance(this.camera.position,direction,visual.group.position,visual.state.crouched,visual.state.downed);
      if(hit&&hit.distance<nearest){nearest=hit.distance;playerHit=true;}
    }
    // Converge only onto a suit already under the reticle, before the world
    // surface. Muzzle obstruction and all damage remain server validated.
    if(playerHit)return this.camera.position.clone().addScaledVector(direction,nearest);
    return worldHit?.point??this.camera.position.clone().addScaledVector(direction,80);
  }
  private shotSolution(player: BrPlayerState): { origin: Vec3; direction: Vec3; blocked: boolean } {
    const shotPosition=player.id===this.localId&&this.predictedMotion?this.predictedMotion.position:player.position;
    const origin = brMuzzlePosition(shotPosition, this.yaw, this.pitch);
    const aimPoint = this.aimPoint(true);
    const direction = aimPoint.sub(vec(origin));
    const distance = Math.max(.001, direction.length());
    direction.divideScalar(distance);
    this.raycaster.set(vec(origin), direction);
    this.raycaster.far = distance;
    const obstruction = this.raycaster.intersectObjects(this.islandMeshes, false)[0];
    return { origin, direction: { x: direction.x, y: direction.y, z: direction.z }, blocked: !brShotDirectionAllowed(direction,this.yaw,this.pitch)||Boolean(obstruction && obstruction.distance < distance - .16) };
  }
  private hash(value: string): number { let hash = 0; for (let i = 0; i < value.length; i++) hash = Math.imul(31, hash) + value.charCodeAt(i) | 0; return hash; }

  private cycleSpectator(direction: number): void {
    const candidates = [...this.players.values()].filter((visual) => visual.state.alive && visual.relevant);
    if (!candidates.length) { this.spectatorTargetId = null; return; }
    const current = candidates.findIndex((visual) => visual.state.id === this.spectatorTargetId);
    this.spectatorTargetId = candidates[(current + direction + candidates.length) % candidates.length].state.id;
    this.pendingSpectatorTarget={value:this.spectatorTargetId,expiresAt:performance.now()+900};
  }

  private getSpectatorTarget(): PlayerVisual | null {
    const selected = this.spectatorTargetId ? this.players.get(this.spectatorTargetId) : null;
    if (selected?.state.alive && selected.relevant) return selected;
    const local = this.players.get(this.localId)?.state;
    const visible=[...this.players.values()].filter(visual=>visual.state.alive&&visual.relevant);
    const teammates=visible.filter(visual=>visual.state.teamId===local?.teamId);
    const fallback = (teammates.length?teammates:visible).sort((a,b)=>brSpectatorPriority(a.state)-brSpectatorPriority(b.state))[0] ?? null;
    this.spectatorTargetId = fallback?.state.id ?? null; return fallback;
  }

  private animateEmote(visual: PlayerVisual, now: number): void {
    // Emotes own the full limb pose rather than inheriting a frozen stride or
    // a prior weapon carry. Deployment/vehicle overrides still run afterward.
    visual.limbs[0].rotation.set(0,0,.17);visual.limbs[1].rotation.set(0,0,-.17);
    visual.limbs[2].rotation.set(0,0,0);visual.limbs[3].rotation.set(0,0,0);
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
    if(local.vehicleId){this.predictedMotion=null;return;}
    if (!this.predictedMotion) this.predictedMotion = this.motionFromPlayer(local);
    const previousDeployment=this.predictedMotion.deployment;
    const previousGrounded=this.predictedMotion.grounded;
    const previousVerticalSpeed=this.predictedMotion.velocity.y;
    // A complete key tap can occur between render frames. Input sampling keeps
    // its pressed edge even when held is already false; prediction must too.
    const nextMotion = stepBrMovement(this.predictedMotion, { moveX: frame.moveX, moveY: frame.moveY, yaw: this.yaw, jump: frame.jump.held || frame.jump.pressed, sprint: frame.burst.held, crouch: frame.crouch.held }, dt, now, (position,desired,options)=>this.physics.move(position,desired,options.jumping,options.crouched));
    this.predictedMotion=nextMotion;
    if(previousGrounded&&!nextMotion.grounded&&nextMotion.velocity.y>1&&previousDeployment==="grounded"){
      // Protect the first predicted frame, before the fixed-rate send occurs.
      this.jumpInputSequence=this.sequence+1;this.jumpPredictionStartedAt=now;
      this.audio.jump();
    }
    const landing=brLandingFeedback(previousDeployment,nextMotion.landed,previousVerticalSpeed,now,this.lastLandingFeedbackAt);
    if(landing){
      this.lastLandingFeedbackAt=now;this.audio.land(landing.impact);
      if(landing.initialDrop){
        this.playEnergyBurst(new THREE.Vector3(this.predictedMotion.position.x,this.predictedMotion.position.y+.03,this.predictedMotion.position.z),0x70f5ff,.72);
        this.input.vibrate(90,.22);
      }
    }
  }

  private reconcilePrediction(authoritative: BrPlayerState): void {
    if (!authoritative.alive) { this.predictedMotion = null; return; }
    if(authoritative.vehicleId){this.predictedMotion=null;return;}
    if (!this.predictedMotion) { this.predictedMotion = this.motionFromPlayer(authoritative); return; }
    const coilDeadline=authoritative.gravCoilEndsAt?performance.now()+authoritative.gravCoilEndsAt-(Date.now()+this.serverClockOffsetMs):0;
    if(coilDeadline>performance.now()&&coilDeadline>(this.predictedMotion.gravCoilEndsAt??0)+100){this.predictedMotion=this.motionFromPlayer(authoritative);return;}
    this.predictedMotion.gravCoilEndsAt=coilDeadline;
    const prediction = this.predictedMotion; const dx = authoritative.position.x - prediction.position.x; const dy = authoritative.position.y - prediction.position.y; const dz = authoritative.position.z - prediction.position.z; const error = Math.hypot(dx, dy, dz);
    if(authoritative.deployment==="attached"&&prediction.deployment==="freefall"&&performance.now()-this.dropPredictionStartedAt<350)return;
    const terminalStateChange=prediction.deployment!==authoritative.deployment&&(authoritative.deployment==="attached"||authoritative.deployment==="eliminated");
    const materiallyMissedLanding=prediction.deployment!==authoritative.deployment&&authoritative.deployment==="grounded"&&error>1.5;
    const hardStateChange=terminalStateChange||materiallyMissedLanding;
    const snapped = error > 4.5 || hardStateChange;
    if (import.meta.env.DEV) this.reconciliationTracker.record(error, snapped, performance.now());
    if (snapped) { this.predictedMotion = this.motionFromPlayer(authoritative); return; }
    const correction = brPredictionCorrectionStrength(error);
    const order={freefall:0,chute:1,grounded:2} as const;
    const predictedOrder=prediction.deployment in order?order[prediction.deployment as keyof typeof order]:-1;
    const authoritativeOrder=authoritative.deployment in order?order[authoritative.deployment as keyof typeof order]:-1;
    const preserveAdvancedDrop=predictedOrder>authoritativeOrder&&error<1.5;
    const preservePendingJump=brPreservePendingJump(authoritative.lastInputSequence,this.jumpInputSequence,this.jumpPredictionStartedAt,performance.now(),prediction.velocity.y);
    prediction.position.x += dx * correction; if(!preserveAdvancedDrop&&!preservePendingJump)prediction.position.y += dy * correction; prediction.position.z += dz * correction;
    const velocityCorrection=correction===0?0:Math.min(.2,correction*.7);
    prediction.velocity.x += (authoritative.velocity.x - prediction.velocity.x) * velocityCorrection;if(!preserveAdvancedDrop&&!preservePendingJump)prediction.velocity.y += (authoritative.velocity.y - prediction.velocity.y) * velocityCorrection;prediction.velocity.z += (authoritative.velocity.z - prediction.velocity.z) * velocityCorrection;
    if(!preserveAdvancedDrop&&!preservePendingJump){prediction.grounded=authoritative.grounded;prediction.deployment=authoritative.deployment;}
    prediction.downed = authoritative.downed;
  }

  private motionFromPlayer(player: BrPlayerState): BrMotionState {
    return { gravCoilEndsAt:player.gravCoilEndsAt?performance.now()+player.gravCoilEndsAt-(Date.now()+this.serverClockOffsetMs):0, position: { ...player.position }, velocity: { ...player.velocity }, yaw: player.yaw, grounded: player.grounded, crouched: player.crouched, deployment: player.deployment, downed: player.downed, lastJumpSignal: false, lastCrouchSignal: false, slideEndsAt: 0, traversalCooldownUntil: 0, lastGroundedAt: player.grounded ? performance.now() : Number.NEGATIVE_INFINITY, jumpBufferedUntil: 0 };
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

  private clearHeldSupport(visual:PlayerVisual):void {
    visual.supported?.dispose();visual.supported=null;visual.supportedModel=null;
  }

  private anchorSupportedWeapon(visual:PlayerVisual,now:number,dt:number):boolean {
    const id=visual.weaponId;
    if(!id||!isBrSupportWeaponId(id)||!visual.group.visible||!visual.rig.visible)return false;
    const model=visual.weapon.children.find(child=>child.userData.borrowedWeaponResources) as THREE.Group|undefined;
    if(!model)return false;
    if(visual.supportedModel!==model){
      this.clearHeldSupport(visual);
      visual.supported=createBrHeldPresentation({leftArm:visual.limbs[0],rightArm:visual.limbs[1],group:visual.rig,upperBody:visual.upperBody},model,id,this.heldResources);
      visual.supportedModel=model;
    }
    const local=visual.state.id===this.localId;
    const aimed=(local?this.aiming||this.firingPoseHeld:Boolean(visual.state.aiming))||now-visual.lastShotAt<240;
    if(aimed){
      const shot=local&&this.localState?this.shotSolution(this.localState):null;
      if(shot)this.heldDirection.set(shot.direction.x,shot.direction.y,shot.direction.z);
      else{const yaw=local?this.yaw:visual.state.yaw,pitch=local?this.pitch:visual.state.pitch;this.heldDirection.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));}
      visual.group.rotation.set(0,brAstronautFacingRotation(brHeldAimFacing(this.heldDirection,-visual.group.rotation.y)),0);
    }else this.heldDirection.set(-Math.sin(visual.group.rotation.y),0,-Math.cos(visual.group.rotation.y));
    // Body follows the real shot; torso inclination takes any angle outside the
    // arms' comfortable range. Authority and camera direction are unchanged.
    visual.rig.rotation.set(0,Math.PI,0);visual.rig.updateWorldMatrix(true,false);
    const resolved=visual.heldAimFrame.resolve(this.heldDirection,visual.rig.matrixWorld);
    if(!resolved){visual.weapon.userData.supportedPoseValid=false;return true;}
    const aim=visual.heldAimFrame.state;
    visual.upperBody.rotation.set(aim.torsoPitch,0,0);visual.upperBody.position.set(0,aim.torsoY,aim.torsoZ);
    visual.body.rotation.x=0;
    const frame=visual.heldFrame;frame.dt=dt;frame.pitch=aim.pitch;frame.yaw=aim.yaw;
    const recoil=THREE.MathUtils.clamp(Number(visual.weapon.userData.recoil??0),0,1);
    frame.recoil=recoil;
    frame.reloadProgress=local&&this.reloadEndsAt>now?THREE.MathUtils.clamp((now-this.reloadStartedAt)/Math.max(1,this.reloadEndsAt-this.reloadStartedAt),0,1):null;
    visual.weapon.userData.supportedPoseValid=visual.supported!.update(visual.weapon,frame);
    visual.weapon.userData.recoil=brRecoilAfter(recoil,dt);
    return true;
  }

  private updateHeldWeapon(visual: PlayerVisual, dt: number): void {
    const item = visual.state.id===this.localId?this.localState?.inventory[this.localState.selectedSlot]:visual.state.heldItem;
    visual.weapon.visible = Boolean(item && isBrWeapon(item.itemId) && !visual.state.vehicleId && !visual.state.downed && visual.state.deployment === "grounded" && !visual.emote);
    // Emotes holster the item; hidden actors/model swaps are safe teardown boundaries.
    if (!visual.weapon.visible || !visual.group.visible || !visual.rig.visible) {this.clearHeldSupport(visual);if(!visual.weapon.visible)return;}
    if (!item || !isBrWeapon(item.itemId)) { visual.weaponId=null; return; }
    if(visual.weaponId!==item.itemId||visual.weapon.userData.rarity!==item.rarity){this.clearHeldSupport(visual);for(const child of [...visual.weapon.children]){visual.weapon.remove(child);this.disposeObject(child);}this.buildWeaponModel(visual.weapon,item.itemId,rarityColor[item.rarity]??0xffffff);visual.weaponId=item.itemId;visual.weapon.userData.rarity=item.rarity;}
    // Motion owns the carry pose. Final glove anchoring runs after reload/heal
    // have finished posing the arms, so actions cannot detach the item.

  }

  private updateActionPresentation(visual:PlayerVisual,now:number):void {
    const local=visual.state.id===this.localId;
    const selected=local?this.localState?.inventory[this.localState.selectedSlot]??null:visual.state.heldItem;
    const healing=Boolean(local&&this.useEndsAt>now&&selected&&isBrHeal(selected.itemId));
    const holdingHeal=Boolean(selected&&(isBrHeal(selected.itemId)||isBrUtility(selected.itemId))&&!visual.state.vehicleId&&!visual.state.downed&&visual.state.deployment==="grounded");
    visual.actionDevice.visible=holdingHeal;
    if(holdingHeal&&selected&&(isBrHeal(selected.itemId)||isBrUtility(selected.itemId))){
      if(visual.actionHealId!==selected.itemId){
        if(visual.actionHealModel)visual.actionDevice.remove(visual.actionHealModel);
        visual.actionHealModel=isBrUtility(selected.itemId)?this.utilityModels.create(selected.itemId):this.healModels.create(selected.itemId);visual.actionDevice.add(visual.actionHealModel);visual.actionHealId=selected.itemId;
      }
      visual.actionDevice.scale.setScalar(1);
      if(isBrUtility(selected.itemId)&&visual.actionHealModel){const transform=brHeldUtilityTransform(selected.itemId);visual.actionHealModel.position.set(...transform.position);visual.actionHealModel.rotation.set(...transform.rotation);visual.actionHealModel.scale.setScalar(transform.scale);}
      if(healing){const phase=(now-this.useStartedAt)*.009;visual.actionDevice.rotation.z=Math.sin(phase)*.08;visual.actionDevice.scale.multiplyScalar(1+Math.sin(phase*1.7)*.04);visual.limbs[0].rotation.x=-1.02;visual.limbs[0].rotation.z=.32;visual.limbs[1].rotation.x=-1.08;visual.limbs[1].rotation.z=-.28;visual.body.rotation.x=-.08;}
      else{visual.actionDevice.rotation.z=0;visual.limbs[0].rotation.x=THREE.MathUtils.lerp(visual.limbs[0].rotation.x,-.78,.35);visual.limbs[1].rotation.x=THREE.MathUtils.lerp(visual.limbs[1].rotation.x,-.96,.35);}
    }else{visual.actionDevice.rotation.z=0;visual.actionDevice.scale.setScalar(1);}
    const reloading=local&&this.reloadEndsAt>now&&visual.weapon.visible;
    if(reloading){
      const progress=THREE.MathUtils.clamp((now-this.reloadStartedAt)/Math.max(1,this.reloadEndsAt-this.reloadStartedAt),0,1);

      visual.limbs[1].rotation.x=-1.2;visual.limbs[1].rotation.z=-.24*Math.sin(progress*Math.PI);
    }
  }

  private anchorHeldPresentation(visual:PlayerVisual,now:number,dt:number):void {
    if(!visual.rig.visible||!visual.group.visible)return;
    if(visual.weapon.visible&&visual.weaponId){
      if(this.anchorSupportedWeapon(visual,now,dt))return;
      const recoil=Number(visual.weapon.userData.recoil??0);
      anchorAstronautHeldItem(visual.weapon,visual.limbs[1],brHeldWeaponTransform(visual.weaponId),recoil);
      const motion=visual.motion.state;
      // Only carried presentation rotates; shotSolution always uses canonical
      // brMuzzlePosition and the camera reticle, never these animated nodes.
      const aimStability=1-motion.aim;
      visual.weapon.rotation.x+=motion.speed/BR_BALANCE.sprintSpeed*.08*aimStability;
      visual.weapon.rotation.z+=motion.turn*.012*aimStability;
      if(visual.state.id===this.localId&&this.reloadEndsAt>now){
        const progress=THREE.MathUtils.clamp((now-this.reloadStartedAt)/Math.max(1,this.reloadEndsAt-this.reloadStartedAt),0,1);
        visual.weapon.rotation.z-=.28*Math.sin(progress*Math.PI);
      }
      visual.weapon.userData.recoil=brRecoilAfter(recoil,dt);
    }
    if(visual.actionDevice.visible){
      visual.limbs[1].updateMatrix();const m=visual.limbs[1].matrix.elements;
      visual.actionDevice.position.set(m[12]-.61*m[4],m[13]-.61*m[5]+.06,m[14]-.61*m[6]+.06);
    }
  }

  private buildWeaponModel(group:THREE.Group,id:BrWeaponId,accent:number):void {
    const model=this.weaponModels.create(id,accent);group.add(model);
    group.userData.muzzle=model.userData.muzzle.clone();
  }

  private renderState(source: BrPlayerSnapshotState | BrPlayerState): BrPlayerSnapshotState {
    if ("heldItem" in source) return source;
    const heldItem = source.inventory[source.selectedSlot];
    return {
      id: source.id, name: source.name, isBot: source.isBot, connected: source.connected, color: source.color, teamId: source.teamId,
      alive: source.alive, downed: source.downed, deployment: source.deployment, hp: source.hp, shield: source.shield,
      downedHp: source.downedHp, bleedoutEndsAt: source.bleedoutEndsAt, position: { ...source.position }, velocity: { ...source.velocity },
      rotation: { ...source.rotation }, yaw: source.yaw, pitch: source.pitch, grounded: source.grounded, crouched: source.crouched, selectedSlot: source.selectedSlot,
      vehicleId: source.vehicleId,
      heldItem: heldItem ? { ...heldItem } : null, kills: source.kills, damageDealt: source.damageDealt, revives: source.revives,
      placement: source.placement, equippedCosmetics: { ...source.equippedCosmetics }
    };
  }

  private debugStormPreview: {center:{x:number;z:number};radius:number}|null = null;

  private updateStorm(now:number): void {
    // Art-only storm fixtures: neither room state nor the authoritative player
    // is changed. Selecting Gameplay camera restores the live storm immediately.
    if (import.meta.env.DEV && this.debugStormPreview && this.room) {
      updateVoidStorm(this.stormWall, {storm:{...this.room.storm,...this.debugStormPreview,stage:"closing"}}, now, this.settings.graphicsQuality);
      document.body.classList.remove("br-in-void");return;
    }
    if (!this.room || this.room.phase !== "combat") { this.stormWall.visible = false; document.body.classList.remove("br-in-void"); return; }
    updateVoidStorm(this.stormWall, this.room, now, this.settings.graphicsQuality);
    const local = this.localState;
    const outside = Boolean(local?.alive && Math.hypot(local.position.x - this.room.storm.center.x, local.position.z - this.room.storm.center.z) > this.room.storm.radius);
    document.body.classList.toggle("br-in-void", outside);
  }

  private updateWorldPresentation(now:number):void {
    if(this.poiTitle&&now>=this.poiTitleUntil)this.clearPoiTitle();
    this.world.update(this.camera, now);
    const local=this.localState;
    const labelViewer=this.debugCameraView?.position??local?.position;
    const airborne=this.debugCameraView
      ? this.debugCameraView.position.y>80
      : Boolean(local&&(local.deployment==="attached"||local.deployment==="freefall"||local.deployment==="chute"));
    if(local?.deployment==="grounded"){this.temp.set(local.position.x,0,local.position.z);this.sunTarget.position.lerp(this.temp,.08);this.sun.position.set(this.sunTarget.position.x-105,this.sunTarget.position.y+190,this.sunTarget.position.z+82);}
    for(const label of this.poiLabels){
      const presentation=brPoiLabelPresentation(labelViewer,label.position,this.camera.position,airborne);
      label.sprite.visible=presentation.visible;
      if(!presentation.visible)continue;
      label.sprite.scale.set(presentation.scale*2.1,presentation.scale*.56,1);
      label.sprite.material.opacity=presentation.opacity;
    }
    if (local?.alive && local.deployment === "grounded") {
      let nearest: BrPoi | null = null; let nearestDistance = 82;
      for (const poi of BR_POIS) { const distance = Math.hypot(local.position.x - poi.position.x, local.position.z - poi.position.z); if (distance < nearestDistance) { nearest = poi; nearestDistance = distance; } }
      if (nearest && nearest.id !== this.currentPoiId) { this.currentPoiId = nearest.id; if (!this.visitedPois.has(nearest.id)) { this.visitedPois.add(nearest.id); this.showPoiTitle(nearest); } }
      else if (!nearest) this.currentPoiId = "";
    }
  }

  private showPoiTitle(poi: BrPoi): void {
    this.clearPoiTitle();
    const title = document.createElement("div"); title.className = "br-poi-arrival"; title.style.setProperty("--poi-accent", poi.color);
    title.innerHTML = `<span>NOW ENTERING</span><b>${poi.name}</b>`; document.body.append(title);
    this.poiTitle=title;this.poiTitleUntil=performance.now()+2600;
  }

  private clearPoiTitle():void {this.poiTitle?.remove();this.poiTitle=null;this.poiTitleUntil=0;}

  private disposeObject(object: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    object.traverse((child) => {
      let cursor:THREE.Object3D|null=child,borrowed=false;
      while(cursor){if(cursor.userData.borrowedHealResources||cursor.userData.borrowedUtilityResources||cursor.userData.borrowedWeaponResources){borrowed=true;break;}if(cursor===object)break;cursor=cursor.parent;}
      if(borrowed)return;
      const renderable = child as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
      if ("geometry" in renderable && renderable.geometry instanceof THREE.BufferGeometry) geometries.add(renderable.geometry);
      const objectMaterials = renderable.material ? Array.isArray(renderable.material) ? renderable.material : [renderable.material] : [];
      for (const material of objectMaterials) { materials.add(material); const map = (material as THREE.SpriteMaterial).map; if (map) textures.add(map); }
    });
    for (const geometry of geometries) if(!this.crateSharedGeometries.has(geometry))geometry.dispose();
    for (const texture of textures) texture.dispose();
    for (const material of materials) if(!this.crateSharedMaterials.has(material))material.dispose();
  }

  private buildScene(): void {
    this.scene.background = new THREE.Color(0x020612);
    this.scene.fog = new THREE.FogExp2(0x0a1930, .00046);
    // Cool deck bounce keeps ceilings and the underside of stair flights
    // readable without filling every room with dynamic point lights.
    const hemisphere = new THREE.HemisphereLight(0xbadfff, 0x43556a, 1.72);
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
    const rim = new THREE.DirectionalLight(0x9dafff, .65);
    rim.position.set(310, 100, -260);
    this.scene.add(hemisphere, this.sun, this.sunTarget, rim, this.backdrop, this.island, this.stormWall, this.starliner, this.shotEffects.root,this.utilityEffects.root,this.beamEffects.root);
    this.renderer.shadowMap.enabled = this.settings.graphicsQuality !== "low";
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    if(this.active)this.neon?.setQuality(this.settings.graphicsQuality);
    this.resize();
  }

  private resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    if (!this.active) return;
    const preset = QUALITY_PRESETS[this.settings.graphicsQuality];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, preset.pixelRatioCap) * preset.resolutionScale);
    this.renderer.setSize(innerWidth, innerHeight);
    this.neon?.resize();
  }
}
