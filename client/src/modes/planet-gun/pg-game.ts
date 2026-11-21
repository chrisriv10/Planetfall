import {PgZombieDangerFeedback} from "./pg-zombie-danger-feedback";
import {pgWorldWeaponModuleMask} from "./pg-world-weapon-art";
import {applyAstronautSuitFinish} from "../../astronaut-suit-finish";
import {PgInputOwnership} from "./pg-input-ownership";
import {BindingState} from "../../binding-state";
import {bindingSettings} from "../../binding-settings";
import {textInputOwnsBindings,type BindingAction,type BindingContext} from "../../input-bindings";
import {PgCharacterShowcaseLayer,type PgShowcaseLayerView} from "./pg-character-showcase-layer";
import type {PgCaptureHintMode} from "./pg-capture-hint";
import type {InputMethod} from "../../input";
import {PgCameraLifecycle} from "./pg-camera-lifecycle";
import {createPgModeArt} from "./pg-mode-art";
import {createPgCharacterArt,createPgFirstPersonCharacterArt} from "./pg-character-art";
import {pgNearbyModeInteraction,pgModeAbilityIntent,type PgModeIntent} from "./pg-mode-input";
import {PgRenderCorrection} from "./pg-render-correction";
import {createPgFriendlyNames} from "./pg-friendly-names";
import {pgFireReady,pgFirePressValid} from "./pg-fire-readiness";
import {PgBurstCycle} from "./pg-burst-cycle";
import {createPgPilotBatches} from "./pg-pilot-batches";
import {PgClientProfile} from "./pg-client-profile";
import {createPgPilotLodArt} from "./pg-pilot-lod-art";
import {pgPilotDetail,type PgPilotDetail} from "./pg-pilot-detail";
import {pgCrowdReviewPose} from "./pg-profile-views";
import {pgClock} from "./pg-clock";
import {PgMotionDiagnostics} from "./pg-motion-diagnostics";
import {pgReconcileMotion,pgPredictedStepTime} from "./pg-prediction";
import {PgEffects} from "./pg-effects";
import {createPgPilotPresentation} from "./pg-pilot-presentation";
import * as THREE from "three";
import {pgSmokeClear,PG_SIEGE_CAMERAS,PG_MAP,PG_DEFAULT_MOVEMENT_RULES,pgAcceptCollisionSnapshot,pgCollisionMap,type PgCollisionSnapshot,PG_PANEL_SOCKETS,PG_BALANCE as B,pgGunProfile,PG_REVIEW_VIEWS,SHOP_CATALOG,pgStepMovement,type PgInput,type PgMotion,type PgSnapshot,type PgShot} from "@planetfall/shared";
import type {GameSocket} from "../../network";
import type {UserSettings,GraphicsQuality} from "../../settings";
import {QUALITY_PRESETS} from "../../settings";
import {createAstronautVisual,type AstronautVisual} from "../../astronaut";
import {createAstronautMotion} from "../../astronaut-motion";
import type {GameAudio} from "../../audio";
import {PgWorldRenderer} from "./pg-world";
import {createPgViewmodel,PG_VIEWMODEL_LAYER} from "./pg-viewmodel";
import {renderPgFrame} from "./pg-render";
import {createPgWatchEntryShaders} from "./pg-watch-entry-shaders";

export class PlanetGunGame {
 private readonly inputOwnership=new PgInputOwnership();private publishedInputMethod:InputMethod="keyboard";onInputMethod:(method:InputMethod)=>void=()=>{};
 private captureHint:PgCaptureHintMode=null;onCaptureHint:(mode:PgCaptureHintMode)=>void=()=>{};
 private readonly dangerFeedback=new PgZombieDangerFeedback();
 private readonly cameraLifecycle=new PgCameraLifecycle();private spectatorTarget:string|null=null;onSpectator:(name:string|null)=>void=()=>{};
 private readonly renderCorrection=new PgRenderCorrection();private readonly nameSolids=[...PG_MAP.solids];private readonly friendlyNames=createPgFriendlyNames(this.nameSolids);
 private readonly modeArt=createPgModeArt();private firstPersonIdentity="";private firstPersonCharacter:ReturnType<typeof createPgFirstPersonCharacterArt>|null=null;
 private watchMode=false;
 private rampartWarmup:Promise<void>|null=null;
 private watchEntry: {shaders:ReturnType<typeof createPgWatchEntryShaders>;abort:AbortController;pending:boolean;shadows:boolean}|null=null;
 private collision:PgCollisionSnapshot|null=null;private collisionMap=PG_MAP;private modeHold:string|null=null;private modeHoldAt=0;private modeInteractHeld=false;private modeDrone=false;private modeDroneAt=0;
 onModeAction:(action:PgModeIntent)=>void=()=>{};onModeMenu:()=>void=()=>{};
 private readonly motionDiagnostics=import.meta.env.DEV?new PgMotionDiagnostics():null;
 private readonly profile=import.meta.env.DEV?new PgClientProfile():null;
 private readonly nearPilots=createPgPilotBatches();private readonly farPilots=createPgPilotLodArt();private readonly pilotTarget=new THREE.Vector3();
 private readonly farPose={rootPosition:new THREE.Vector3(),yaw:0,velocity:{x:0,y:0,z:0},grounded:true,crouched:false,team:"solar",suitColor:0xffffff,weapon:"pulse",timeSeconds:0};
 private pilotBatching=true;
 private quality:GraphicsQuality="medium";private readonly detailCounts={near:0,mid:0,far:0};
 private readonly burstCycle=new PgBurstCycle();private beamUntil=0;private beamPlaying=false;private reloadPhase="idle";private landingImpulse=0;
 private readonly characterShowcaseLayer=new PgCharacterShowcaseLayer();
 private crowdReview:ReturnType<typeof pgCrowdReviewPose>|null=null;
 private viewmodelScene=new THREE.Scene();private viewCamera=new THREE.PerspectiveCamera(78,1,.01,12);private sun=new THREE.DirectionalLight(0xcbe4ff,2.5);private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(78,1,.12,400);private world=new PgWorldRenderer();private viewmodel=createPgViewmodel();
 onAim:(weapon:PgShot["weapon"],ads:number,spread:number,optic:string)=>void=()=>{};
 onMenuNavigate:(action:"up"|"down"|"left"|"right"|"confirm"|"back")=>void=()=>{};onPause:()=>void=()=>{};onScoreboard:()=>void=()=>{};
 private reviewPilot:string|null=null;private padButtons:boolean[]=[];private menuAt=0;private review:keyof typeof PG_REVIEW_VIEWS|"crowd3"|"crowd6"|null=null;
 private active=false;private blocked=false;private id="";private snapshot:PgSnapshot|null=null;private local:PgMotion|null=null;private life=-1;private pending:{input:PgInput;at:number}[]=[];private sequence=0;private simulationAt=0;private shotSequence=0;
 private readonly bindings=new BindingState("planet-gun",bindingSettings.get());private bindingHeld=new Set<BindingAction>();private bindingEnabled=false;private mouseFire=false;private mouseAds=false;private dragged=false;private yaw=0;private pitch=0;private offset=0;private accumulator=0;private lastFrame=0;private nextFire=0;private sprintFireAt=0;private sprintExitSequence=-1;private firingWeapon="";private fireHeld=false;private semiPending=false;private semiPendingUntil=0;private jumpQueuedUntil=0;private thrustCueAt=0;private ads=0;private recoil=0;private wallRoll=0;private movementFov=0;private lastStep=0;private times:number[]=[];
 private rendererName="";private suitAccent=0xffba62;private settings:UserSettings|null=null;private pilots=new Map<string,{rig:AstronautVisual;presentation:ReturnType<typeof createPgPilotPresentation>;motion:ReturnType<typeof createAstronautMotion>;detail:PgPilotDetail;nextAnimationAt:number;lastAnimationAt:number;suitColor:number;suitKey:string;batchKey:string;batched:boolean;characterId:string;characterArt:ReturnType<typeof createPgCharacterArt>|null}>();private effects=new PgEffects();private remoteSteps=new Map<string,number>();
 constructor(private renderer:THREE.WebGLRenderer,private canvas:HTMLCanvasElement,private socket:GameSocket,private hud:(s:PgSnapshot)=>void,private hit:(n:number,headshot:boolean)=>void,private audio:GameAudio){
  const gl=renderer.getContext(),extension=gl.getExtension("WEBGL_debug_renderer_info");this.rendererName=String(gl.getParameter(extension?extension.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
  canvas.addEventListener("webglcontextrestored",()=>{if(this.active&&this.watchMode){this.prepareRampart();if(this.snapshot?.phase==="countdown")this.prepareWatchEntry();}});
  this.scene.background=new THREE.Color(0x101c32);this.scene.fog=new THREE.Fog(0x101c32,100,230);this.scene.add(this.modeArt.group,this.world.root,this.camera,this.effects.root,this.nearPilots.group,this.farPilots.group,this.friendlyNames.root);this.viewCamera.layers.set(PG_VIEWMODEL_LAYER);this.viewmodelScene.add(this.viewCamera);this.viewCamera.add(this.viewmodel.root);this.attachMuzzle();
  this.scene.add(new THREE.HemisphereLight(0xb8d7ef,0x526574,1.7));this.sun.position.set(-35,55,20);this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-64,right:64,top:64,bottom:-64,near:10,far:150});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.035;this.sun.shadow.camera.updateProjectionMatrix();this.scene.add(this.sun);const fill=new THREE.DirectionalLight(0xffd8ad,.5);fill.position.set(30,18,-25);this.scene.add(fill);
  bindingSettings.subscribe(settings=>this.bindings.setSettings(settings));
  addEventListener("keydown",e=>{if(!this.active||e.defaultPrevented)return;this.syncBindingContext();const policy={capturedGameplay:this.canLook()&&document.pointerLockElement===canvas};if(this.bindings.ownsKeyboardEvent(e,policy))e.preventDefault();const actions=this.bindings.keyDown(e,policy);if(actions.length){this.inputOwnership.keyboard();this.motionDiagnostics?.input(performance.now());this.bindingActions(actions);}});
  addEventListener("keyup",e=>{this.bindings.keyUp(e);this.releaseBindingHolds();if(this.canPlay())this.motionDiagnostics?.input(performance.now());});addEventListener("blur",()=>this.clearInput());
  // Acquisition can be notified after a fresh press; only losing our capture cancels holds.
  document.addEventListener("pointerlockchange",()=>{if(this.active&&document.pointerLockElement!==canvas)this.clearInput();});
  document.addEventListener("compositionstart",()=>this.clearInput());document.addEventListener("focusin",e=>{if(textInputOwnsBindings(e.target))this.clearInput();});
  canvas.addEventListener("mousedown",e=>{if(this.active)this.inputOwnership.keyboard();if(e.defaultPrevented||e.altKey||e.metaKey||!this.canLook())return;this.audio.unlock();if(document.pointerLockElement!==canvas){void canvas.requestPointerLock().catch(()=>{});return;}this.syncBindingContext();const actions=this.bindings.mouseDown(e.button);if(actions.length){e.preventDefault();this.dragged=true;this.bindingActions(actions);}});
  addEventListener("mouseup",e=>{this.dragged=false;this.bindings.mouseUp(e.button);this.releaseBindingHolds();});
  canvas.addEventListener("wheel",e=>{if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||!this.canLook()||document.pointerLockElement!==canvas)return;this.syncBindingContext();const actions=this.bindings.wheel(e.deltaY);if(actions.length){e.preventDefault();this.inputOwnership.keyboard();this.bindingActions(actions);}},{passive:false});
  canvas.addEventListener("contextmenu",e=>{if(this.canPlay())e.preventDefault();});
  addEventListener("mousemove",e=>{if(this.active&&(document.pointerLockElement===canvas?e.movementX!==0||e.movementY!==0:Math.abs(e.movementX)+Math.abs(e.movementY)>2))this.inputOwnership.keyboard();if(!this.canLook()||document.pointerLockElement!==canvas)return;const viewer=this.snapshot!.players.find(p=>p.id===this.id)!;if(viewer.hp<=0&&!this.sensorActive()){this.cameraLifecycle.look(e.movementX,e.movementY,.0022*(this.settings?.mouseSensitivity??1),this.settings?.invertY??false);return;}const beforeYaw=this.yaw,beforePitch=this.pitch,sensitivity=.0022*(this.settings?.mouseSensitivity??1)*(this.ads>.5?.48:1);this.yaw-=e.movementX*sensitivity;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*sensitivity*(this.settings?.invertY?-1:1),-1.4,1.4);this.motionDiagnostics?.mouse(performance.now(),e.movementX,e.movementY,beforeYaw,beforePitch,this.yaw,this.pitch,document.pointerLockElement===canvas,this.dragged);});
 }
 private setCaptureHint(mode:PgCaptureHintMode):void{if(mode!==this.captureHint){this.captureHint=mode;this.onCaptureHint(mode);}}
 getInputMethod():InputMethod{return this.inputOwnership.method;}
 private sensorActive():boolean{const m=this.snapshot?.mode;return m?.id==="planetsiege"&&!!(m.pilots[this.id]?.cameraId||m.pilots[this.id]?.controllingDrone);}
 private get preparingRampart():boolean{return this.watchMode&&this.rampartWarmup!==null;}
 private get preparingWatchEntry():boolean{return this.watchEntry?.pending??false;}
 private canLook():boolean{return this.active&&!this.preparingRampart&&!this.preparingWatchEntry&&!this.blocked&&!this.review&&!this.reviewPilot&&this.socket.connected&&!!this.snapshot&&["playing","overtime"].includes(this.snapshot.phase)&&this.snapshot.players.some(p=>p.id===this.id);}
 private canPlay():boolean{return this.active&&!this.preparingRampart&&!this.preparingWatchEntry&&!this.blocked&&!this.review&&!this.reviewPilot&&this.socket.connected&&!!this.snapshot&&["playing","overtime"].includes(this.snapshot.phase)&&((this.snapshot.players.find(p=>p.id===this.id)?.hp??0)>0||this.sensorActive());}
 getBindingContext():BindingContext{const viewer=this.snapshot?.players.find(p=>p.id===this.id);return !viewer||viewer.hp>0||this.sensorActive()?(this.snapshot?.mode?`planet-gun:${this.snapshot.mode.id}`:"planet-gun"):"planet-gun:spectator";}
 private syncBindingContext():void{const context=this.getBindingContext(),enabled=this.canLook();if(context!==this.bindings.getContext()||this.bindingEnabled!==enabled){this.clearInput();this.bindings.setContext(context);this.bindingEnabled=enabled;}this.bindings.setBlocked(!enabled);}
 private releaseBindingHolds():void{this.mouseFire=this.bindings.held("fire");this.mouseAds=this.bindings.held("aim");if(!this.bindings.held("interact")&&this.modeHold){this.onModeAction({kind:"interact",targetId:this.modeHold,held:false});this.modeHold=null;this.modeInteractHeld=false;}}
 private bindingActions(actions:readonly BindingAction[]):void{for(const action of actions){if(action==="pause"){this.onPause();continue;}if(action==="scoreboard"){this.onScoreboard();continue;}if(action==="buyMenu"){if(this.snapshot?.mode&&this.canLook())this.onModeMenu();continue;}const viewer=this.snapshot?.players.find(p=>p.id===this.id);if((action==="nextTarget"||action==="previousTarget")&&viewer&&viewer.hp<=0&&!this.sensorActive()){this.cameraLifecycle.cycle(this.snapshot!,viewer,action==="nextTarget"?1:-1);continue;}if(!this.canPlay())continue;if(action==="jump")this.jumpQueuedUntil=performance.now()+150;if(action==="fire"){this.mouseFire=true;this.semiPending=true;this.semiPendingUntil=performance.now()+1000;}if(action==="aim")this.mouseAds=true;if(action==="reload"){this.burstCycle.cancel();this.socket.emit("pg:weapon:reload");}if(action==="slot1"||action==="slot2"||action==="switchWeapon"){this.burstCycle.cancel();this.socket.emit("pg:weapon:switch",{slot:action==="slot1"?0:action==="slot2"?1:viewer?.slot===0?1:0});}this.modeAction(action);}}
 resolveModeAbility(slot:0|1|2):PgModeIntent|null{const s=this.snapshot,p=s?.players.find(p=>p.id===this.id);return s&&p?pgModeAbilityIntent(s,{...p,position:this.local?.position??p.position,yaw:this.yaw,pitch:this.pitch},slot):null;}
 private modeAction(binding:BindingAction):void{
  const s=this.snapshot,p=s?.players.find(p=>p.id===this.id);if(!s?.mode||!p)return;
  const aimed={...p,position:this.local?.position??p.position,yaw:this.yaw,pitch:this.pitch};
  if(binding==="interact"){this.modeInteractHeld=true;this.interactMode(s,aimed,pgClock(this.socket).now(performance.now(),this.offset));}
  if(binding==="ability1"||binding==="ability2"||binding==="ultimate"){const action=pgModeAbilityIntent(s,aimed,binding==="ability1"?0:binding==="ability2"?1:2);if(action)this.onModeAction(action);}
  if(binding==="reinforce"){const socket=PG_PANEL_SOCKETS.find(t=>Math.hypot(t.solid.center.x-p.position.x,t.solid.center.z-p.position.z)<3);if(socket)this.onModeAction({kind:"deploy",socketId:socket.id});}
  if(binding==="drone"&&s.mode.id==="planetsiege"){this.modeDrone=!this.modeDrone;this.onModeAction({kind:"drone",control:this.modeDrone,moveX:0,moveZ:0,yaw:this.yaw,pitch:this.pitch});}
  if(binding==="drop"&&s.mode.id==="planetstrike")this.onModeAction({kind:"pickup",entityId:s.mode.charge.carrierId===p.id?"drop-charge":"drop-weapon"});
  if(binding==="camera"&&s.mode.id==="planetsiege")this.onModeAction({kind:"camera",cameraId:s.mode.pilots[p.id]?.cameraId?null:s.mode.site===0?"west-camera":"east-camera"});
 }
 private modeInput(s:PgSnapshot,p:PgSnapshot["players"][number],input:PgInput,at:number):void{
  if(!s.mode||!this.canPlay())return;
  if(this.modeDrone&&at-this.modeDroneAt>100){this.modeDroneAt=at;this.onModeAction({kind:"drone",control:true,moveX:input.moveX,moveZ:input.moveZ,yaw:this.yaw,pitch:this.pitch});}
  const pad=navigator.getGamepads?.().find(g=>g?.connected),interact=this.bindingHeld.has("interact")||!!pad?.buttons[11]?.pressed;
  if(interact&&(!this.modeInteractHeld||at-this.modeHoldAt>200))this.interactMode(s,{...p,position:this.local?.position??p.position},at,this.modeInteractHeld);
  else if(!interact&&this.modeHold){this.onModeAction({kind:"interact",targetId:this.modeHold,held:false});this.modeHold=null;}
  this.modeInteractHeld=interact;
 }
 private interactMode(s:PgSnapshot,p:PgSnapshot["players"][number],at:number,repeated=false):void{this.modeHoldAt=at;const intent=pgNearbyModeInteraction(s,p,at);if(intent&&(!repeated||intent.kind==="interact")){this.onModeAction(intent);this.modeHold=intent.kind==="interact"?intent.targetId:null;}}
 private clearInput():void{this.bindings.clear();this.bindingHeld.clear();this.modeInteractHeld=false;if(this.modeHold){this.onModeAction({kind:"interact",targetId:this.modeHold,held:false});this.modeHold=null;}if(this.modeDrone){this.onModeAction({kind:"drone",control:false,moveX:0,moveZ:0,yaw:this.yaw,pitch:this.pitch});this.modeDrone=false;}this.beamUntil=0;this.beamPlaying=false;this.audio.pgBeam(false);this.burstCycle.cancel();this.jumpQueuedUntil=0;this.mouseFire=false;this.semiPending=false;this.semiPendingUntil=0;this.mouseAds=false;this.dragged=false;}
 activate(id:string,watchMode=false):void{
  this.id=id;
  if(this.active)return;
  this.active=true;this.watchMode=watchMode;
  this.audio.setPgAmbience(true);
  if(this.settings)this.setSettings(this.settings);
  // The room enters a three-second countdown before accepting gameplay input.
  // A reconnect can already be in play, so the frame and input gate also wait for readiness.
  if(this.watchMode)this.prepareRampart();
  this.lastFrame=performance.now();this.renderer.setAnimationLoop(t=>this.frame(t));
 }
 private prepareRampart():void{
  if(this.rampartWarmup)return;
  const shadows=this.renderer.shadowMap.enabled;
  const pending=this.modeArt.warmRampart(this.renderer,this.camera,this.scene);
  this.rampartWarmup=pending;
  void pending.catch(error=>console.warn("PlanetWatch shader warm-up failed.",error)).finally(()=>{
   this.rampartWarmup=null;
   // Quality can change while the driver compiles. Finish one variant before starting the next.
   if(this.active&&this.watchMode&&this.renderer.shadowMap.enabled!==shadows)this.prepareRampart();
  });
 }
 private prepareWatchEntry():void{
  this.releaseWatchEntry();
  const abort=new AbortController();
  const nameplate=this.friendlyNames.root.children.find((object):object is THREE.Sprite=>object instanceof THREE.Sprite);
  const shaders=createPgWatchEntryShaders(this.modeArt.watchEntryShaderObjects(),this.viewmodel.watchEntryShaderSources(),nameplate);
  const preparation={abort,shaders,pending:true,shadows:this.renderer.shadowMap.enabled};
  this.watchEntry=preparation;
  void shaders.prepare(this.renderer,{scene:this.scene,camera:this.camera},{scene:this.viewmodelScene,camera:this.viewCamera},abort.signal)
   .catch(error=>{if(!abort.signal.aborted)console.warn("PlanetWatch match-entry shader preparation failed.",error);})
   .finally(()=>{preparation.pending=false;});
 }
 private releaseWatchEntry():void{
  if(!this.watchEntry)return;
  this.watchEntry.abort.abort();
  this.watchEntry.shaders.dispose();
  this.watchEntry=null;
 }
 deactivate():void{if(!this.active)return;this.setCaptureHint(null);this.active=false;this.releaseWatchEntry();this.audio.setPgAmbience(false);this.clearInput();document.exitPointerLock?.();this.renderer.setAnimationLoop(null);}
 setUiCaptured(value:boolean):void{if(this.blocked!==value)this.clearInput();this.blocked=value;this.bindings.setBlocked(!this.canLook());if(value){this.setCaptureHint(null);document.exitPointerLock?.();}}
 setCharacterShowcase(view:PgShowcaseLayerView|null,stage:HTMLElement|null):void{this.characterShowcaseLayer.set(view,stage);}
 setSettings(settings:UserSettings):void{this.settings=settings;const quality=settings.graphicsQuality==="auto"?"medium":settings.graphicsQuality,q=QUALITY_PRESETS[quality];this.quality=quality;this.world.setQuality(quality);if(this.active){const shadows=quality==="high",changed=this.renderer.shadowMap.enabled!==shadows;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q.pixelRatioCap)*q.resolutionScale);this.renderer.shadowMap.enabled=shadows;this.sun.castShadow=shadows;if(changed&&this.watchMode)this.prepareRampart();}}
 applySnapshot(s:PgSnapshot):void {
  const profileStart=this.profile?performance.now():0;
  if(this.snapshot&&s.serverTime<this.snapshot.serverTime)return;
  const previous=this.snapshot;if(previous?.phase!==s.phase||previous?.mode?.subphase!==s.mode?.subphase||previous?.mode?.pilots[this.id]?.life!==s.mode?.pilots[this.id]?.life)this.clearInput();const old=previous?.players.find(p=>p.id===this.id),next=s.players.find(p=>p.id===this.id);
  if(next&&this.dangerFeedback.update(s.mode,this.id,next.lifeId,s.serverTime))this.audio.critical();
  if(next&&old){if(next.guns[next.slot].reloadUntil>old.guns[old.slot].reloadUntil){this.burstCycle.cancel();this.reloadPhase="idle";}if(next.hp<=0&&old.hp>0)this.audio.prCue("eliminate");if(next.lifeId!==old.lifeId)this.audio.prCue("go");}
  if(s.phase==="countdown"&&Math.ceil((s.phaseEndsAt-s.serverTime)/1000)!==Math.ceil(((previous?.phaseEndsAt??0)-(previous?.serverTime??0))/1000))this.audio.prCue("countdown");
  if(s.phase==="results"&&previous?.phase!=="results")this.audio.result(s.winner===next?.team);
  if(s.feed.at(-1)?.id!==previous?.feed.at(-1)?.id&&s.feed.at(-1)?.killerId===this.id)this.audio.prCue("qualify");
  const oldRevision=this.collision?.topologyRevision??this.collision?.revision;this.collision=s.mode?pgAcceptCollisionSnapshot(this.collision,s.mode.collision):null;const collisionChanged=oldRevision!==(this.collision?.topologyRevision??this.collision?.revision);if(collisionChanged){this.collisionMap=this.collision?pgCollisionMap(this.collision,PG_MAP,{navigation:false}):PG_MAP;this.nameSolids.splice(0,this.nameSolids.length,...this.collisionMap.solids);this.pending=[];this.renderCorrection.reset();}if(s.mode&&previous?.mode){if(s.mode.id==="planetstrike"&&previous.mode.id==="planetstrike"&&s.mode.charge.site&&!previous.mode.charge.site)this.audio.countdown(0);if(s.mode.id==="planetzombies"&&previous.mode.id==="planetzombies"&&s.mode.wave!==previous.mode.wave)this.audio.callout();if(s.mode.effects.some(e=>e.ownerId===this.id&&!previous.mode!.effects.some(old=>old.id===e.id)))this.audio.repair();if(s.mode.pilots[this.id]?.life==="alive"&&previous.mode.pilots[this.id]?.life==="downed")this.audio.brUseItem(false);}
  if(this.collision)this.motionDiagnostics?.topology(performance.now(),this.collision.revision,this.collision.topologyRevision??this.collision.revision,collisionChanged);this.snapshot=s;if(s.mode?.id==="planetsiege"){const state=s.mode.pilots[this.id];this.modeDrone=!!state?.controllingDrone;}this.offset=Math.max(this.offset,s.serverTime-performance.now());const me=s.players.find(p=>p.id===this.id);
  if(me){const gun=me.guns[me.slot],profile=pgGunProfile(gun);this.burstCycle.observe({weapon:gun.id,lifeId:me.lifeId,serverTime:s.serverTime,shots:gun.shots,nextFireAt:gun.nextFireAt,burstShots:profile.burstShots??0,intervalMs:profile.intervalMs,recoveryMs:profile.burstRecoveryMs??profile.intervalMs});this.suitAccent=new THREE.Color(SHOP_CATALOG.find(i=>i.id===me.equippedCosmetics.suit&&i.category==="suit")?.color??me.color).getHex();if(me.lifeId!==this.life){this.life=me.lifeId;this.simulationAt=s.serverTime;this.yaw=me.yaw;this.pitch=me.pitch;this.pending=[];this.nextFire=0;this.sprintFireAt=0;this.sprintExitSequence=-1;this.firingWeapon="";this.wallRoll=0;this.movementFov=0;this.ads=0;this.recoil=0;this.landingImpulse=0;this.accumulator=0;this.renderCorrection.reset();this.clearInput();}
   const predictedBefore=this.local,oldLife=old?.lifeId;this.local=structuredClone(me);this.sequence=Math.max(this.sequence,me.lastInputSequence);this.pending=this.pending.filter(p=>p.input.sequence>me.lastInputSequence);
   if(me.hp>0&&["playing","overtime"].includes(s.phase)){const replay=pgReconcileMotion(me,me.lastInputSequence,this.pending,s.serverTime,this.collisionMap,s.mode?.controls?.[me.id]?.movement??PG_DEFAULT_MOVEMENT_RULES,s.mode?.controls?.[me.id]?.canMove??true);this.local=replay.motion;this.pending=replay.pending;this.simulationAt=replay.at;}
   if(predictedBefore&&oldLife===me.lifeId){
    const previousOffset={...this.renderCorrection.offset};
    const continuous=me.hp>0&&["playing","overtime"].includes(s.phase)&&this.pending.length<30&&!collisionChanged;
    this.renderCorrection.correct(predictedBefore.position,this.local.position,continuous);
    this.motionDiagnostics?.corrected(predictedBefore,this.local,performance.now(),pgClock(this.socket).now(performance.now(),this.offset)-s.serverTime,this.pending.length,{x:this.local.position.x+this.renderCorrection.offset.x-predictedBefore.position.x-previousOffset.x,y:this.local.position.y+this.renderCorrection.offset.y-predictedBefore.position.y-previousOffset.y,z:this.local.position.z+this.renderCorrection.offset.z-predictedBefore.position.z-previousOffset.z});
   }else this.renderCorrection.reset();
  }
  this.syncBindingContext();if(me)this.cameraLifecycle.sync(me,this.yaw);if(!this.canLook())document.exitPointerLock?.();const hudStart=this.profile?performance.now():0;this.hud(s);if(this.profile){const end=performance.now();this.profile.snapshot(end-profileStart,end-hudStart);}
 }
 applyShot(s:PgShot):void {if(!this.active)return;const me=this.local;if(!me)return;
  if(s.shooterId===this.id){if(s.damage>0){this.hit(s.damage,s.headshot);this.audio.hitConfirm(s.headshot?"headshot":"hp");}}
  else this.audio.pgRemoteWeapon(s.weapon,s.origin,this.camera.position,this.camera.rotation.y);
  this.effects.shot(s,s.shooterId===this.id,performance.now());
 }
 setReviewPilot(id:string|null):void{if(!import.meta.env.DEV)return;this.review=null;this.reviewPilot=id;this.clearInput();document.exitPointerLock?.();if(id===null){const v=this.pilots.get(this.id);if(v){this.nearPilots.unregister(v.rig.group);v.characterArt?.dispose();v.presentation.dispose();this.disposePilot(v.rig);this.pilots.delete(this.id);}}}
 setPilotBatching(enabled:boolean):void{if(import.meta.env.DEV)this.pilotBatching=enabled;}
 setReviewView(name:keyof typeof PG_REVIEW_VIEWS|"crowd3"|"crowd6"|null):void{if(!import.meta.env.DEV)return;this.setReviewPilot(null);this.review=name;this.crowdReview=name==="crowd3"||name==="crowd6"?pgCrowdReviewPose((this.snapshot?.players??[]).filter(p=>p.id!==this.id),name==="crowd3"?3:6):null;this.clearInput();document.exitPointerLock?.();}
 private frame(now:number):void {
  if(!this.active)return;const inputNow=performance.now(),frameMs=Math.max(0,now-this.lastFrame),dt=Math.min(.05,Math.max(0,frameMs/1000));this.lastFrame=now;if(this.preparingRampart)return;this.times.push(frameMs);if(this.times.length>240)this.times.shift();const s=this.snapshot,me=s?.players.find(p=>p.id===this.id);if(!s||!me||!this.local)return;
  if(this.preparingWatchEntry&&["countdown","playing","overtime"].includes(s.phase))return;
  this.syncBindingContext();this.bindingHeld=this.bindings.sample().held;this.mouseFire=this.bindingHeld.has("fire");this.mouseAds=this.bindingHeld.has("aim");
  const physicalController=navigator.getGamepads?.().find(p=>p?.connected),controller=this.inputOwnership.sample(physicalController),buttons=physicalController?.buttons.map(b=>b.pressed)??[];if(this.publishedInputMethod!==this.inputOwnership.method){this.publishedInputMethod=this.inputOwnership.method;this.onInputMethod(this.publishedInputMethod);}
  this.setCaptureHint(this.canLook()&&this.inputOwnership.method==="keyboard"&&document.pointerLockElement!==this.canvas?(me.hp>0||this.sensorActive()?"play":"spectate"):null);
  if(controller){const pressed=(n:number)=>buttons[n]&&!this.padButtons[n];
   if(pressed(9))this.onPause();if(pressed(8))this.onScoreboard();
   const modeMenu=pressed(13)&&this.active&&!this.blocked&&!!s.mode&&["playing","overtime"].includes(s.phase);if(modeMenu)this.onModeMenu();
   if(!modeMenu&&(this.blocked||s.phase==="results")){if(pressed(0))this.onMenuNavigate("confirm");if(pressed(1))this.onMenuNavigate("back");if(now-this.menuAt>220){let action:"up"|"down"|"left"|"right"|null=null;if(buttons[12]||controller.axes[1]<-.55)action="up";if(buttons[13]||controller.axes[1]>.55)action="down";if(buttons[14]||controller.axes[0]<-.55)action="left";if(buttons[15]||controller.axes[0]>.55)action="right";if(action){this.menuAt=now;this.onMenuNavigate(action);}}}
   else if(this.canPlay()){if(pressed(4))this.modeAction("ability1");if(pressed(5))this.modeAction("ability2");if(pressed(12)&&s.mode)this.modeAction("ultimate");if(pressed(2)){this.burstCycle.cancel();this.socket.emit("pg:weapon:reload");}if(pressed(3)){this.burstCycle.cancel();this.socket.emit("pg:weapon:switch",{slot:me.slot===0?1:0});}}
  }
  this.padButtons=buttons;
  this.accumulator+=Math.min(.1,frameMs/1000);while(this.accumulator>=1/B.tickRate){this.accumulator-=1/B.tickRate;const at=pgPredictedStepTime(pgClock(this.socket).now(now,this.offset)-this.accumulator*1000,this.simulationAt);this.simulationAt=at;if(!this.socket.connected||!["playing","overtime"].includes(s.phase)||me.hp<=0&&!this.sensorActive())continue;
   this.semiPending&&=pgFirePressValid(inputNow,this.semiPendingUntil,me.guns[me.slot]);
   const enabled=this.canPlay(),pad=controller,dead=(v:number)=>Math.abs(v)>.18?v:0;
   if(enabled&&pad){this.yaw-=dead(pad.axes[2]??0)*2.3/B.tickRate*(this.settings?.controllerSensitivity??1)*(this.ads>.5?.5:1);this.pitch=THREE.MathUtils.clamp(this.pitch-dead(pad.axes[3]??0)*1.8/B.tickRate*(this.settings?.invertY?-1:1),-1.4,1.4);}
   this.burstCycle.setTrigger(enabled&&(this.mouseFire||this.semiPending||!!pad?.buttons[7]?.pressed));
   const input:PgInput={sequence:++this.sequence,moveX:enabled?Number(this.bindingHeld.has("moveRight"))-Number(this.bindingHeld.has("moveLeft"))+dead(pad?.axes[0]??0):0,moveZ:enabled?Number(this.bindingHeld.has("moveBackward"))-Number(this.bindingHeld.has("moveForward"))+dead(pad?.axes[1]??0):0,yaw:this.yaw,pitch:this.pitch,jump:enabled&&(this.bindingHeld.has("jump")||now<this.jumpQueuedUntil||!!pad?.buttons[0]?.pressed),sprint:enabled&&!this.burstCycle.pending&&!this.mouseFire&&!this.semiPending&&!this.mouseAds&&!pad?.buttons[7]?.pressed&&!pad?.buttons[6]?.pressed&&(this.bindingHeld.has("sprint")||!!pad?.buttons[10]?.pressed),crouch:enabled&&(this.bindingHeld.has("crouch")||!!pad?.buttons[1]?.pressed),ads:enabled&&(this.mouseAds||!!pad?.buttons[6]?.pressed),lean:enabled&&s.mode?.id==="planetsiege"?(Number(this.bindingHeld.has("leanRight")||!!pad?.buttons[15]?.pressed)-Number(this.bindingHeld.has("leanLeft")||!!pad?.buttons[14]?.pressed))as -1|0|1:0,...(this.collision?{collisionRevision:this.collision.topologyRevision??this.collision.revision}:{})};
   this.jumpQueuedUntil=0;const grounded=this.local.grounded,mode=this.local.mode,vertical=this.local.velocity.y;this.socket.emit("pg:player:input",input);this.modeInput(s,me,input,at);if(!this.modeDrone&&(s.mode?.controls?.[me.id]?.canMove??true))pgStepMovement(this.local,input,1/B.tickRate,at,this.collisionMap,s.mode?.controls?.[me.id]?.movement??PG_DEFAULT_MOVEMENT_RULES);if(mode==="sprint"&&this.local.mode!=="sprint"){this.sprintFireAt=Math.max(this.sprintFireAt,at+pgGunProfile(me.guns[me.slot]).sprintDelayMs);this.sprintExitSequence=input.sequence;}this.motionDiagnostics?.simulated(performance.now(),this.local.mode);this.pending.push({input,at});if(this.pending.length>60)this.pending.shift();
   if(grounded&&!this.local.grounded&&this.local.velocity.y>5)this.audio.jump();if(input.jump&&!this.local.grounded&&this.local.ion>0&&now-this.thrustCueAt>900){this.audio.burst();this.thrustCueAt=now;}if(!grounded&&this.local.grounded){this.audio.land(-vertical);this.landingImpulse=Math.min(1,Math.max(0,-vertical/14));}if(this.local.mode!==mode){if(this.local.mode==="slide")this.audio.slide();if(this.local.mode==="mantle")this.audio.mantle();if(this.local.mode==="wall-run")this.audio.wings();}if(this.local.grounded&&Math.hypot(this.local.velocity.x,this.local.velocity.z)>2&&now-this.lastStep>330){this.audio.brRemoteFootstep(this.local.position,this.local.position,this.yaw,input.sprint);this.lastStep=now;}
   // A queued RAF timestamp can be stale after a render stall. Fire uses the
   // live RTT-calibrated processing clock; fixed-step movement keeps its
   // simulation clock. Snapshot arrival latency must not age a new shot.
   const fireAt=pgClock(this.socket).now(performance.now(),this.offset),gun=me.guns[me.slot],w=pgGunProfile(gun);
   if(this.firingWeapon!==gun.id){this.firingWeapon=gun.id;this.nextFire=0;this.fireHeld=false;}
   const trigger=enabled&&(this.mouseFire||this.semiPending||!!pad?.buttons[7]?.pressed),ready=enabled&&!this.modeDrone&&(s.mode?.controls?.[me.id]?.canFire??true)&&pgFireReady(fireAt,this.local.mode,me,this.sprintFireAt,this.sprintExitSequence);
   const fire=w.burstShots?this.burstCycle.request(fireAt,ready):trigger&&(w.automatic||!this.fireHeld||this.semiPending)&&fireAt>=this.nextFire&&ready;
   if(fire){this.effects.localFire(gun.id,now);this.socket.emit("pg:weapon:fire",{sequence:++this.shotSequence,clientTime:fireAt,weapon:gun.id,yaw:this.yaw,pitch:this.pitch});this.semiPending=false;this.nextFire=fireAt+w.intervalMs*(s.mode?.controls?.[me.id]?.combat.interval??s.mode?.controls?.[me.id]?.combat.fireIntervalMultiplier??1);const kick=w.recoil*(s.mode?.controls?.[me.id]?.combat.recoilMultiplier??1);this.recoil=Math.min(1,this.recoil+kick*6);this.pitch=Math.min(1.4,this.pitch+kick);this.audio.pgWeapon(gun.id);if(gun.id==="prism")this.beamUntil=now+140;}
   if(!trigger)this.semiPending=false;this.fireHeld=trigger;
  }
  const beam=this.canPlay()&&now<this.beamUntil;if(beam!==this.beamPlaying){this.beamPlaying=beam;this.audio.pgBeam(beam);}
  const profileInput=this.profile?performance.now():0;
  const gun=me.guns[me.slot],weapon=pgGunProfile(gun),aim=this.canPlay()&&(this.mouseAds||!!controller?.buttons[6]?.pressed)&&this.local.mode!=="sprint"&&gun.reloadUntil<=s.serverTime;
  this.ads+=(Number(aim)-this.ads)*(1-Math.exp(-dt*(aim?Math.log(20)/(weapon.adsMs*(s.mode?.controls?.[me.id]?.combat.adsTimeMultiplier??1)/1000):20)));this.recoil*=Math.exp(-dt*12);
  const wallBank=this.local.mode==="wall-run"?-(this.local.wallNormal.x*Math.cos(this.yaw)-this.local.wallNormal.z*Math.sin(this.yaw))*.045:0;this.wallRoll+=(wallBank-this.wallRoll)*(1-Math.exp(-dt*10));this.movementFov+=((this.local.mode==="sprint"?4:this.local.mode==="wall-run"?2:0)-this.movementFov)*(1-Math.exp(-dt*10));
  this.camera.fov=78+(weapon.adsFov-78)*this.ads+this.movementFov;this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
  this.renderCorrection.update(dt);const visualOffset=this.renderCorrection.offset;
  const cameraView=this.cameraLifecycle.pose(s,me,this.local,this.yaw,this.pitch,visualOffset,this.collisionMap);this.camera.position.copy(cameraView.position);this.camera.rotation.order="YXZ";this.camera.rotation.set(cameraView.pitch,cameraView.yaw,cameraView.kind==="local"?this.wallRoll:0,"YXZ");if(cameraView.targetId!==this.spectatorTarget){this.spectatorTarget=cameraView.targetId;this.onSpectator(s.players.find(p=>p.id===cameraView.targetId)?.name??null);}
  this.onAim(gun.id,this.ads,(weapon.hipSpread+(weapon.adsSpread-weapon.hipSpread)*this.ads)*(!this.local.grounded?1.55:Math.hypot(this.local.velocity.x,this.local.velocity.z)>1?1.2:1),gun.modules?.find(m=>m==="reflex-array"||m==="precision-lens")??"");
  this.landingImpulse*=Math.exp(-dt*10);
  const presentationAt=pgClock(this.socket).now(inputNow,this.offset);
  const identity=s.mode?.pilots[me.id]?.characterId??"";if(identity!==this.firstPersonIdentity){this.firstPersonCharacter?.dispose();this.firstPersonIdentity=identity;this.firstPersonCharacter=identity?createPgFirstPersonCharacterArt(this.viewmodel.root,identity):null;}this.viewmodel.root.visible=!this.characterShowcaseLayer.active&&me.hp>0&&!this.review&&!this.reviewPilot&&!this.modeDrone&&(s.mode?.pilots[me.id]?.life??"alive")==="alive";this.viewmodel.update({weapon:gun.id,ads:this.ads,recoil:this.recoil,reload:gun.reloadUntil?Math.min(1,Math.max(0,1-(gun.reloadUntil-presentationAt)/weapon.reloadMs)):0,speed:Math.hypot(this.local.velocity.x,this.local.velocity.z),mode:this.local.mode,time:now,suitAccent:this.suitAccent,modules:gun.modules,finishId:me.equippedCosmetics["weapon-skin"],upgradeTier:s.mode?.id==="planetzombies"&&me.slot===0?s.mode.pilots[me.id]?.upgrade as 0|1|2|3:0,landing:this.landingImpulse,verticalSpeed:this.local.velocity.y,airborne:!this.local.grounded,wallSide:Math.sign(wallBank)});
  const phase=this.viewmodel.getReloadPhase();if(phase!==this.reloadPhase){this.reloadPhase=phase;if(phase!=="idle")this.audio.pgReloadPhase(gun.id,phase);}
  this.viewmodel.getMuzzle(this.effects.muzzleRoot.position,this.effects.muzzleRoot.quaternion);
  const profileViewmodel=this.profile?performance.now():0;
  if(s.mode?.id==="planetzombies"&&s.mode.forge?.phase==="processing"&&s.mode.forge.ownerId===me.id&&me.slot===0)this.viewmodel.root.visible=false;
  if(me.hp>0&&s.mode?.id==="planetsiege"&&!this.sensorActive())this.camera.rotation.z=-(this.local.lean??0)*.1;
  if(this.modeDrone&&s.mode?.id==="planetsiege"){const drone=s.mode.drones.find(d=>d.ownerId===me.id&&d.hp>0);if(drone){this.camera.position.set(drone.position.x,drone.position.y+.32,drone.position.z);this.camera.rotation.set(this.pitch,this.yaw,0,"YXZ");}else this.modeDrone=false;}
  if(s.mode?.id==="planetsiege"){const cameraId=s.mode.pilots[me.id]?.cameraId,feed=PG_SIEGE_CAMERAS.find(c=>c.id===cameraId);if(feed){this.camera.position.copy(feed.position);this.camera.lookAt(feed.target.x,feed.target.y,feed.target.z);this.camera.fov=70;this.camera.updateProjectionMatrix();this.viewmodel.root.visible=false;}}
  if(this.review){const view=this.review==="crowd3"||this.review==="crowd6"?this.crowdReview!:PG_REVIEW_VIEWS[this.review];this.camera.position.set(view.position.x,view.position.y,view.position.z);this.camera.lookAt(view.target.x,view.target.y,view.target.z);this.camera.fov=70;this.camera.updateProjectionMatrix();}
  if(this.reviewPilot){const target=s.players.find(p=>p.id===this.reviewPilot);if(target){const yaw=target.yaw;this.camera.position.set(target.position.x-Math.sin(yaw)*4+Math.cos(yaw)*.6,target.position.y+1.55,target.position.z-Math.cos(yaw)*4-Math.sin(yaw)*.6);this.camera.lookAt(target.position.x,target.position.y+1.05,target.position.z);this.camera.fov=45;this.camera.updateProjectionMatrix();}}
  let farCount=0;this.detailCounts.near=this.detailCounts.mid=this.detailCounts.far=0;
  for(const p of s.players){
   // Inspection shows the actual selected rig without a tightly packed spawn
   // neighbour obscuring it. This camera is development-only; state never moves.
   if(this.reviewPilot&&p.id!==this.reviewPilot){const hidden=this.pilots.get(p.id);if(hidden)hidden.rig.group.visible=false;continue;}
   if(p.id===this.id&&this.reviewPilot!==this.id)continue;
   let v=this.pilots.get(p.id);
   if(!v){const suit=SHOP_CATALOG.find(i=>i.id===p.equippedCosmetics.suit&&i.category==="suit")?.color??p.color,rig=createAstronautVisual({identityColor:p.team==="solar"?"#ffb45c":"#5ae1f0",suitAccent:suit,isBot:p.isBot});rig.group.scale.setScalar(.85);v={rig,characterId:"",characterArt:null,presentation:createPgPilotPresentation(rig),motion:createAstronautMotion(rig),detail:"near",nextAnimationAt:0,lastAnimationAt:now,suitColor:new THREE.Color(suit).getHex(),suitKey:"",batchKey:"",batched:false};this.pilots.set(p.id,v);this.scene.add(rig.group);}
   if(v.suitKey!==p.equippedCosmetics.suit){this.nearPilots.unregister(v.rig.group);const suit=SHOP_CATALOG.find(item=>item.id===p.equippedCosmetics.suit);v.rig.suitMaterial.color.set(suit?.color??p.color);v.suitColor=v.rig.suitMaterial.color.getHex();applyAstronautSuitFinish(v.rig,suit?.suitStyle??null);v.suitKey=p.equippedCosmetics.suit;v.batchKey="";v.batched=false;}
   const characterId=s.mode?.pilots[p.id]?.characterId??"";if(v.characterId!==characterId){this.nearPilots.unregister(v.rig.group);v.characterArt?.dispose();v.characterId=characterId;v.characterArt=characterId?createPgCharacterArt(v.rig,characterId):null;v.batchKey="";v.batched=false;}
   if(p.hp>0&&p.grounded&&Math.hypot(p.velocity.x,p.velocity.z)>2&&now-(this.remoteSteps.get(p.id)??0)>360&&Math.hypot(p.position.x-this.camera.position.x,p.position.z-this.camera.position.z)<32){this.remoteSteps.set(p.id,now);this.audio.brRemoteFootstep(p.position,this.camera.position,this.camera.rotation.y,p.mode==="sprint");}
   this.pilotTarget.set(p.position.x,p.position.y+(p.crouched?.04:.25),p.position.z);
   if(v.rig.group.position.distanceToSquared(this.pilotTarget)>100)v.rig.group.position.copy(this.pilotTarget);else v.rig.group.position.lerp(this.pilotTarget,1-Math.exp(-dt*20));
   v.rig.group.rotation.y=p.yaw+Math.PI;
   const distance=v.rig.group.position.distanceTo(this.camera.position),requested=p.hp>0?pgPilotDetail(distance,this.quality,v.detail):"near",detail=characterId&&requested==="far"?"mid":requested;
   if(detail!==v.detail){v.detail=detail;for(const part of v.rig.lodDetails)part.visible=detail==="near";v.nextAnimationAt=0;}
   const live=p.hp>0||presentationAt-p.deadAt<400;
   v.rig.group.visible=live&&detail!=="far";
   v.rig.torso.castShadow=this.quality==="high";const shell=v.rig.helmet.children[0];if(shell instanceof THREE.Mesh)shell.castShadow=v.rig.torso.castShadow;
   if(!live)continue;
   this.detailCounts[detail]++;
   const batchKey=`${this.quality}:${p.guns[p.slot].id}:${pgWorldWeaponModuleMask(p.guns[p.slot].modules)}:${p.equippedCosmetics["weapon-skin"]??"default"}:${s.mode?.id==="planetzombies"?s.mode.pilots[p.id]?.upgrade??0:0}`;
   if(detail==="far"){
    const pose=this.farPose;pose.rootPosition=v.rig.group.position;pose.yaw=p.yaw;pose.velocity=p.velocity;pose.grounded=p.grounded;pose.crouched=p.crouched;pose.team=p.team;pose.suitColor=v.suitColor;pose.weapon=p.guns[p.slot].id;pose.timeSeconds=Math.floor(now/66.6667)*.0666667;this.farPilots.update(farCount++,pose);
   }else if(now>=v.nextAnimationAt||v.batchKey!==batchKey){
    Object.assign(v.motion.input,{dt:Math.min(.1,Math.max(.001,(now-v.lastAnimationAt)/1000)),timeSeconds:now/1000,forwardSpeed:Math.hypot(p.velocity.x,p.velocity.z),lateralSpeed:0,verticalSpeed:p.velocity.y,grounded:p.grounded,crouched:p.crouched,aiming:p.adsSince>0,item:"two-hand",detail:detail==="near"?"near":"far",floorOffset:(p.crouched?.04:.25)/.85});v.motion.update();v.presentation.update(p,presentationAt,{upgradeTier:s.mode?.id==="planetzombies"&&p.slot===0?s.mode.pilots[p.id]?.upgrade as 0|1|2|3:0,weaponInserted:s.mode?.id==="planetzombies"&&s.mode.forge.phase==="processing"&&s.mode.forge.ownerId===p.id&&p.slot===0});v.lastAnimationAt=now;v.nextAnimationAt=now+(detail==="mid"?1000/30:0);
   }
   if(detail!=="far"){
    if(v.batchKey!==batchKey){v.batchKey=batchKey;v.batched=this.nearPilots.register(v.rig.group).accepted;if(!v.batched)this.nearPilots.unregister(v.rig.group);}
    if(v.batched&&this.pilotBatching){v.rig.group.updateMatrixWorld(true);this.nearPilots.submit(v.rig.group);v.rig.group.visible=false;}
   }
  }
  this.nearPilots.flush();
  this.farPilots.flush(farCount);
  for(const [id,v]of this.pilots)if(!s.players.some(p=>p.id===id)){this.nearPilots.unregister(v.rig.group);v.characterArt?.dispose();v.presentation.dispose();this.disposePilot(v.rig);this.pilots.delete(id);}
  const profilePilots=this.profile?performance.now():0;
  this.friendlyNames.update(s.mode?s.players.map(p=>s.mode?.pilots[p.id]?.life==="downed"?{...p,name:p.name+" · DOWNED"}:p):s.players,me.hp<=0&&s.mode?{...me,hp:1}:me,this.camera,now,innerHeight,id=>this.pilots.get(id)?.rig.group.position,(from,to)=>pgSmokeClear(s.mode?.effects??[],from,to,presentationAt));
  this.effects.update(now);this.world.update(now);
  const zombieMode=s.mode?.id==="planetzombies"?s.mode:null;this.modeArt.update(s.mode??null,this.id,presentationAt,this.quality,matchMedia("(prefers-reduced-motion: reduce)").matches,zombieMode?s.players.find(player=>player.id===zombieMode.arsenal.ownerId)?.name??null:null,zombieMode?s.players.find(player=>player.id===zombieMode.forge.ownerId)?.name??null:null);
  const profileWorld=this.profile?performance.now():0;
  if(this.watchMode&&s.phase==="countdown"&&this.watchEntry?.shadows!==this.renderer.shadowMap.enabled){this.prepareWatchEntry();return;}
  if(this.canvas.width!==Math.floor(innerWidth*this.renderer.getPixelRatio())||this.canvas.height!==Math.floor(innerHeight*this.renderer.getPixelRatio()))this.renderer.setSize(innerWidth,innerHeight);renderPgFrame(this.renderer,this.scene,this.camera,this.viewmodelScene,this.viewCamera,this.viewmodel.root.visible);this.characterShowcaseLayer.render(this.renderer,this.camera,now/1000,this.quality,matchMedia("(prefers-reduced-motion: reduce)").matches);
  const owner=this.review||this.reviewPilot?"review":this.sensorActive()?"sensor":cameraView.kind==="spectator"?`spectator:${cameraView.targetId??"none"}`:"local";
  this.motionDiagnostics?.presented(performance.now(),owner,me.lifeId,this.camera.rotation.y,this.camera.rotation.x,this.yaw,this.pitch,this.camera.position);
  this.profile?.frame(inputNow,profileInput,profileViewmodel,profilePilots,profileWorld,performance.now());
 }
 debugState(){let visibleInstances=0;const materials=new Set<THREE.Material>();for(const scene of[this.scene,this.viewmodelScene])scene.traverseVisible(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)visibleInstances+=o.count;}});return {inputMethod:this.inputOwnership.method,renderer:this.rendererName,visibleInstances,materialCount:materials.size,review:this.review,reviewPilot:this.reviewPilot,active:this.active,phase:this.snapshot?.phase,local:this.local,mode:this.snapshot?.mode,collisionRevision:this.collision?.revision,blocked:this.blocked,pending:this.pending.length,players:this.snapshot?.players.length,quality:this.settings?.graphicsQuality,ads:this.ads,cameraFov:this.camera.fov,cameraRoll:this.camera.rotation.z,calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,pilotBatching:this.pilotBatching,pilotDetail:{...this.detailCounts},burst:{pending:this.burstCycle.pending,remaining:this.burstCycle.remaining,inFlight:this.burstCycle.inFlight},audio:this.audio.debugState(),reloadPhase:this.viewmodel.getReloadPhase(),resolvedQuality:this.quality,effects:this.effects.stats(),programs:this.renderer.info.programs?.length,cameraDirection:(()=>{const direction=this.camera.getWorldDirection(new THREE.Vector3());return{x:direction.x,y:direction.y,z:direction.z};})(),cameraPosition:{x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z},remotePilots:this.snapshot?.players.filter(p=>p.id!==this.id).map(p=>({id:p.id,name:p.name,team:p.team,characterId:this.snapshot?.mode?.pilots[p.id]?.characterId,hp:p.hp,lean:p.lean,position:p.position,velocity:p.velocity})),nameplates:this.friendlyNames.stats(),renderCorrection:{...this.renderCorrection.offset},movement:this.motionDiagnostics?.read(),network:pgClock(this.socket).measurements(),profile:this.profile?.read(),frameTimes:[...this.times]};}
 reset():void{this.releaseWatchEntry();this.characterShowcaseLayer.reset();this.setCaptureHint(null);this.inputOwnership.reset();this.cameraLifecycle.reset();this.spectatorTarget=null;this.onSpectator(null);this.firstPersonCharacter?.dispose();this.firstPersonCharacter=null;this.firstPersonIdentity="";this.modeArt.update(null,this.id,0);this.collision=null;this.collisionMap=PG_MAP;this.nameSolids.splice(0,this.nameSolids.length,...PG_MAP.solids);this.renderCorrection.reset();this.simulationAt=0;this.friendlyNames.clear();this.motionDiagnostics?.reset();this.farPilots.clear();this.burstCycle.cancel();this.reloadPhase="idle";this.landingImpulse=0;this.offset=0;this.review=null;this.reviewPilot=null;this.snapshot=null;this.local=null;this.pending=[];this.life=-1;for(const v of this.pilots.values()){this.nearPilots.unregister(v.rig.group);v.characterArt?.dispose();v.presentation.dispose();this.disposePilot(v.rig);}this.pilots.clear();this.effects.dispose();this.effects=new PgEffects();this.scene.add(this.effects.root);this.attachMuzzle();this.remoteSteps.clear();}
 private attachMuzzle():void{this.effects.muzzleRoot.traverse(o=>o.layers.set(PG_VIEWMODEL_LAYER));this.viewCamera.add(this.effects.muzzleRoot);}
 private disposePilot(rig:AstronautVisual):void{rig.group.removeFromParent();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();rig.group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
}
