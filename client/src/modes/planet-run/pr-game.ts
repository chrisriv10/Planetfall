import {prOrbitRadius,setPrOrbitPosition} from "./pr-orbit-camera";
import {updatePrFollowTarget} from "./pr-follow-target";
import {prControllerCamera} from "./pr-camera-input";
import {BindingState} from "../../binding-state";
import {bindingSettings} from "../../binding-settings";
import {textInputOwnsBindings,type BindingAction,type BindingContext} from "../../input-bindings";
import {prCameraSurfaceBlocks} from "./pr-camera-collision";
import {createPrPilotPresentation} from "./pr-pilot-presentation";
import * as THREE from "three";
import {PR_BALANCE as B,PrTileState,prRound,prStepMotion,prPlatformCenter,prMeteorTimeline,SHOP_CATALOG,type PrInput,type PrMotion,type PrSnapshot,type PrTileDelta} from "@planetfall/shared";
import type {GameSocket} from "../../network";
import {createAstronautVisual,type AstronautVisual} from "../../astronaut";
import {createAstronautMotion} from "../../astronaut-motion";
import {QUALITY_PRESETS,type UserSettings} from "../../settings";
import {PrWorldRenderer} from "./pr-world";
import {prReviewCamera,prIntroCamera,type PrReviewName} from "./pr-review";
import {createPrEventArt} from "./art/pr-event-art";
import {createPrWinnerStage} from "./art/pr-winner-stage";
import {PR_ART_PALETTES} from "./art/pr-art-shared";
import {prIsBoosting} from "./pr-feedback-state";

/** Owns PlanetRun only. Reuses the application's renderer while Classic is paused. */
export class PlanetRunGame {
  private readonly scene=new THREE.Scene();private readonly camera=new THREE.PerspectiveCamera(65,1,.1,1000);
  private world:PrWorldRenderer|null=null;private snapshot:PrSnapshot|null=null;private tiles=new PrTileState([]);
  private cameraColliders:THREE.Object3D[]=[];
  private readonly pilots=new Map<string,{rig:AstronautVisual;motion:ReturnType<typeof createAstronautMotion>;presentation:ReturnType<typeof createPrPilotPresentation>}>();
  private local:PrMotion|null=null;private pending:{input:PrInput;elapsed:number}[]=[];private sequence=0;private tileRevision=0;
  private active=false;private blocked=false;private cameraDragging=false;private readonly bindings=new BindingState("planet-run",bindingSettings.get());private bindingHeld=new Set<BindingAction>();private bindingEnabled=false;private yaw=0;private pitch=.38;
  private lastFrame=0;private accumulator=0;private offset=0;private spectatorIndex=0;private settings:UserSettings|null=null;
  private readonly rendererName:string;
  private frameTimes:number[]=[];private lastImpactCue=0;private previousElapsed=0;private lastMachineryCue=-2000;
  private readonly direction=new THREE.Vector3();
  private readonly hemisphere=new THREE.HemisphereLight(0xe7faff,0x595175,2.5);
  private readonly sun=new THREE.DirectionalLight(0xfff0d5,2.6);
  private readonly events=createPrEventArt();
  private readonly winnerStage=createPrWinnerStage();
  private lastEnvironmentCue=-2000;private wasLowGravity=false;
  private orbitRadius=9;private qualifiedFocusUntil=0;private followSubject:object|null=null;private followId="";
  private readonly warningIds=new Set<string>();
  private review:PrReviewName|null=null;
  private readonly target=new THREE.Vector3();private readonly desired=new THREE.Vector3();private readonly ray=new THREE.Raycaster();
  constructor(private readonly renderer:THREE.WebGLRenderer,private readonly canvas:HTMLCanvasElement,private readonly socket:GameSocket,private readonly hud:(s:PrSnapshot)=>void,private readonly cue:(kind:"jump"|"dive"|"tile"|"impact"|"tile-break"|"machinery"|"meteor-warning"|"gravity"|"boost"|"land")=>void=()=>{}){
    const gl=this.renderer.getContext(),extension=gl.getExtension("WEBGL_debug_renderer_info");this.rendererName=extension?String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)):String(gl.getParameter(gl.RENDERER));
    this.scene.background=new THREE.Color(0x10243c);this.scene.fog=new THREE.Fog(0x10243c,100,280);
    this.sun.position.set(30,70,25);this.scene.add(this.hemisphere,this.sun,this.events.root,this.winnerStage.root);
    bindingSettings.subscribe(settings=>this.bindings.setSettings(settings));
    addEventListener("keydown",e=>{if(!this.active||e.defaultPrevented)return;this.syncBindingContext();const policy={capturedGameplay:this.canBind()&&document.pointerLockElement===canvas};if(this.bindings.ownsKeyboardEvent(e,policy))e.preventDefault();this.bindingActions(this.bindings.keyDown(e,policy));});
    addEventListener("keyup",e=>this.bindings.keyUp(e));addEventListener("mouseup",e=>{this.cameraDragging=false;this.bindings.mouseUp(e.button);});addEventListener("blur",()=>this.clearInput());
    document.addEventListener("pointerlockchange",()=>{if(this.active)this.clearInput();});document.addEventListener("compositionstart",()=>this.clearInput());document.addEventListener("focusin",e=>{if(textInputOwnsBindings(e.target))this.clearInput();});
    canvas.addEventListener("mousedown",e=>{if(e.defaultPrevented||e.altKey||e.metaKey||!this.canBind())return;this.cameraDragging=this.canLook()&&(e.button===0||e.button===2);if(document.pointerLockElement!==canvas)return;this.syncBindingContext();const actions=this.bindings.mouseDown(e.button);if(actions.length){e.preventDefault();this.bindingActions(actions);}});
    canvas.addEventListener("wheel",e=>{if(e.defaultPrevented||e.ctrlKey||e.altKey||e.metaKey||!this.canBind()||document.pointerLockElement!==canvas)return;this.syncBindingContext();const actions=this.bindings.wheel(e.deltaY);if(actions.length){e.preventDefault();this.bindingActions(actions);}},{passive:false});
    canvas.addEventListener("contextmenu",e=>{if(this.canLook())e.preventDefault();});
    addEventListener("mousemove",e=>{if(this.canLook()&&(document.pointerLockElement===this.canvas||this.cameraDragging)){this.yaw-=e.movementX*.0025*(this.settings?.mouseSensitivity??1);this.pitch=THREE.MathUtils.clamp(this.pitch+e.movementY*.002*(this.settings?.mouseSensitivity??1)*(this.settings?.invertY?-1:1),-.15,1.1);}});
    canvas.addEventListener("click",()=>{if(this.canBind())void canvas.requestPointerLock().catch(()=>{/* Embedded browsers can deny capture; right-drag look remains available. */});});
  }
  private canBind():boolean{return this.active&&!this.blocked&&!this.review&&this.socket.connected&&this.snapshot?.phase==="running"&&this.snapshot.players.some(p=>p.id===this.localId);}
  private canLook():boolean{return this.canBind()&&this.snapshot?.players.find(p=>p.id===this.localId)?.status==="active";}
  getBindingContext():BindingContext{return this.snapshot?.players.find(p=>p.id===this.localId)?.status==="active"?"planet-run":"planet-run:spectator";}
  private syncBindingContext():void{const enabled=this.canBind(),context=this.getBindingContext();if(this.bindingEnabled!==enabled||this.bindings.getContext()!==context){this.clearInput();this.bindingEnabled=enabled;}this.bindings.setContext(context);this.bindings.setBlocked(!enabled);}
  private clearInput():void{this.bindings.clear();this.bindingHeld.clear();this.cameraDragging=false;}
  private bindingActions(actions:readonly BindingAction[]):void{if(!this.canBind())return;for(const action of actions){if(action==="emote")this.socket.emit("pr:emote",{emote:"wave"});if(action==="previousTarget")this.spectatorIndex--;if(action==="nextTarget")this.spectatorIndex++;}}
  setReviewView(name:PrReviewName|null):void{if(!import.meta.env.DEV)return;this.review=name;this.clearInput();document.exitPointerLock?.();}
  activate(id:string):void{if(this.active&&this.localId===id)return;this.localId=id;this.active=true;if(this.settings)this.setSettings(this.settings);this.lastFrame=performance.now();this.renderer.setAnimationLoop(t=>this.frame(t));}
  private localId="";
  deactivate():void{if(!this.active)return;this.active=false;this.clearInput();this.bindings.setBlocked(true);this.pending=[];document.exitPointerLock?.();this.renderer.setAnimationLoop(null);}
  setUiCaptured(blocked:boolean):void{if(this.blocked!==blocked)this.clearInput();this.blocked=blocked;this.bindings.setBlocked(!this.canBind());if(blocked)document.exitPointerLock?.();}
  setSettings(settings:UserSettings):void{this.settings=settings;const quality=settings.graphicsQuality==="auto"?"medium":settings.graphicsQuality,q=QUALITY_PRESETS[quality];if(this.active){this.world?.setQuality(quality);this.events.setQuality(quality);this.renderer.setPixelRatio(Math.min(devicePixelRatio,q.pixelRatioCap)*q.resolutionScale);this.renderer.shadowMap.enabled=false;}}
  debugState(){let worldCalls=0;this.world?.root.traverseVisible(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points)worldCalls++;});let visibleInstances=0;const materials=new Set<THREE.Material>();this.scene.traverseVisible(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)visibleInstances+=o.count;}});return {serverTime:this.snapshot?.serverTime,roundElapsed:this.snapshot?Math.max(0,this.snapshot.serverTime-this.snapshot.roundStartedAt):0,worldCalls,review:this.review,status:this.snapshot?.players.find(p=>p.id===this.localId)?.status,camera:{yaw:this.yaw,pitch:this.pitch,position:{x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z},target:{x:this.target.x,y:this.target.y,z:this.target.z},distance:this.camera.position.distanceTo(this.target)},renderer:this.rendererName,quality:this.settings?.graphicsQuality,visibleInstances,materialCount:materials.size,active:this.active,blocked:this.blocked,phase:this.snapshot?.phase,roundId:this.snapshot?.roundId,roundIndex:this.snapshot?.roundIndex,local:this.local?{position:{...this.local.position},grounded:this.local.grounded,velocity:{...this.local.velocity},supportId:this.local.supportId}:null,tileCount:this.tiles.tiles.length,triggeredTiles:this.tiles.triggered.size,tileRevision:this.tileRevision,pendingInputs:this.pending.length,players:this.snapshot?.players.length??0,pilotStates:this.snapshot?.players.map(p=>({id:p.id,isBot:p.isBot,status:p.status,position:p.position,velocity:p.velocity,grounded:p.grounded,supportId:p.supportId})),calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,frameTimes:[...this.frameTimes]};}
  applySnapshot(s:PrSnapshot):void {
    const previousStatus=this.snapshot?.players.find(p=>p.id===this.localId)?.status;
    const changed=s.roundIndex!==this.snapshot?.roundIndex||s.roundId!==this.snapshot?.roundId;
    if(changed||s.phase!==this.snapshot?.phase||s.players.find(p=>p.id===this.localId)?.status!==this.snapshot?.players.find(p=>p.id===this.localId)?.status)this.clearInput();
    if(changed){this.qualifiedFocusUntil=0;this.previousElapsed=0;this.lastMachineryCue=-2000;this.lastEnvironmentCue=-2000;this.wasLowGravity=false;this.warningIds.clear();this.events.update(0);this.world?.dispose();this.world=null;this.pending=[];this.tileRevision=0;
      if(s.roundId){const round=prRound(s.roundId);this.world=new PrWorldRenderer(round);this.scene.add(this.world.root);this.cameraColliders=[];this.world.root.traverse(o=>{if(["authoritative-platform","authoritative-hazard","shatterdeck-cells"].includes(o.name))this.cameraColliders.push(o);});this.tiles=new PrTileState(round.tiles);}else this.tiles=new PrTileState([]);
      this.yaw=0;this.review=null;
      if(s.roundId){const palette=PR_ART_PALETTES[s.roundId];this.hemisphere.groundColor.set(palette.dark);this.hemisphere.color.set(palette.white);this.sun.color.set(s.roundId==="solar-sweep"?0xffdf9e:palette.white);this.sun.intensity=s.roundId==="shatterdeck"?2:2.6;}
      if(this.settings)this.setSettings(this.settings);
    }
    if(!changed&&this.snapshot){const elapsed=Math.max(0,s.serverTime-s.roundStartedAt);for(const p of s.players){const previous=this.snapshot.players.find(old=>old.id===p.id);if(previous?.status!=="active"||p.status==="active")continue;if(p.id===this.localId||this.local&&Math.hypot(p.position.x-this.local.position.x,p.position.z-this.local.position.z)<18){const color=SHOP_CATALOG.find(i=>i.id===p.equippedCosmetics.trail&&i.category==="trail")?.color??p.color;this.events.emit(p.status==="qualified"?"qualify":"eliminate",p.position,color,elapsed);}}}
    if(!changed&&s.players.find(p=>p.id===this.localId)?.status==="qualified"&&this.snapshot?.players.find(p=>p.id===this.localId)?.status==="active")this.qualifiedFocusUntil=Math.max(0,s.serverTime-s.roundStartedAt)+900;
    this.snapshot=s;this.syncBindingContext();this.offset=s.serverTime-performance.now();
    this.winnerStage.setWinner(s.phase==="results"?s.players.find(p=>p.id===s.winnerId)??null:null);
    if(s.tilesFull){this.tiles=new PrTileState(s.roundId?prRound(s.roundId).tiles:[]);this.tiles.apply(s.tiles);this.tileRevision=s.tileRevision;}
    if(s.tileRevision>this.tileRevision)this.socket.emit("pr:tiles:sync");
    const me=s.players.find(p=>p.id===this.localId);
    if(me&&me.diveUntil>Math.max(0,s.serverTime-s.roundStartedAt)&&me.diveReadyAt-me.diveUntil<500&&s.serverTime-this.lastImpactCue>300){this.lastImpactCue=s.serverTime;this.cue("impact");}
    if(me){this.local={...me,position:{...me.position},velocity:{...me.velocity}};this.sequence=Math.max(this.sequence,me.lastInputSequence);this.pending=this.pending.filter(p=>p.input.sequence>me.lastInputSequence);
      if(s.roundId&&s.phase==="running"&&me.status==="active")for(const p of this.pending)prStepMotion(this.local,p.input,1/B.tickRate,p.elapsed,prRound(s.roundId),s.seed,this.tiles);
    }
    if(s.phase!=="running"||me?.status!=="active"&&previousStatus==="active")document.exitPointerLock?.();this.hud(s);
  }
  applyTiles(p:{roundIndex:number;revision:number;tiles:PrTileDelta[]}):void {
    if(p.roundIndex!==this.snapshot?.roundIndex)return;
    if(p.revision-this.tileRevision!==p.tiles.length&&p.revision>this.tileRevision){this.socket.emit("pr:tiles:sync");return;}
    if(this.local&&p.tiles.some(c=>{const t=this.tiles.tiles[c.id];return t&&Math.hypot(t.center.x-this.local!.position.x,t.center.y-this.local!.position.y,t.center.z-this.local!.position.z)<4;}))this.cue("tile");
    this.tiles.apply(p.tiles);this.tileRevision=Math.max(this.tileRevision,p.revision);
  }
  private frame(now:number):void {
    if(!this.active)return;
    const frameMs=now-this.lastFrame,dt=Math.min(.05,frameMs/1000);this.lastFrame=now;const s=this.snapshot;if(!s||!this.world)return;
    this.syncBindingContext();this.bindingHeld=this.bindings.sample().held;
    this.frameTimes.push(frameMs);if(this.frameTimes.length>180)this.frameTimes.shift();
    const elapsed=Math.max(0,now+this.offset-s.roundStartedAt),round=prRound(s.roundId!);
    const me=s.players.find(p=>p.id===this.localId);
    const focusQualified=s.phase==="running"&&me?.status==="qualified"&&elapsed<this.qualifiedFocusUntil;
    if(s.phase==="running"&&!this.blocked&&me?.status==="active"&&this.local){
      for(const [id,at] of this.tiles.triggered){const cell=this.tiles.tiles[id],breakAt=at+B.tileBreakMs;
        if(cell&&this.previousElapsed<breakAt&&elapsed>=breakAt&&Math.hypot(cell.center.x-this.local.position.x,cell.center.y-this.local.position.y,cell.center.z-this.local.position.z)<7){this.cue("tile-break");break;}
      }
      if(elapsed-this.lastMachineryCue>1400&&round.obstacles.some(o=>(o.kind==="rotator"||o.kind==="door")&&Math.hypot(o.center.x-this.local!.position.x,o.center.z-this.local!.position.z)<o.half.x+10)){this.lastMachineryCue=elapsed;this.cue("machinery");}
      let warning=false;for(const o of round.obstacles){if(o.kind!=="meteor")continue;const active=prMeteorTimeline(o,elapsed,s.seed).warning;if(active&&!this.warningIds.has(o.id)&&Math.hypot(o.center.x-this.local.position.x,o.center.z-this.local.position.z)<o.half.x+9)warning=true;if(active)this.warningIds.add(o.id);else this.warningIds.delete(o.id);}
      if(warning&&elapsed-this.lastEnvironmentCue>650){this.lastEnvironmentCue=elapsed;this.cue("meteor-warning");}
      const lowGravity=this.inLowGravity(this.local,elapsed);if(lowGravity&&!this.wasLowGravity&&elapsed-this.lastEnvironmentCue>650){this.lastEnvironmentCue=elapsed;this.cue("gravity");}this.wasLowGravity=lowGravity;
    }
    this.previousElapsed=elapsed;
    this.accumulator+=dt;
    while(this.accumulator>=1/B.tickRate){this.accumulator-=1/B.tickRate;
      if(s.phase!=="running"||me?.status!=="active"||!this.local||!this.socket.connected)continue;
      const pad=navigator.getGamepads?.().find(p=>p?.connected),dead=(v:number)=>Math.abs(v)>.18?v:0;
      const enabled=!this.blocked;
      let x=enabled?Number(this.bindingHeld.has("moveRight"))-Number(this.bindingHeld.has("moveLeft"))+dead(pad?.axes[0]??0):0;
      let z=enabled?Number(this.bindingHeld.has("moveBackward"))-Number(this.bindingHeld.has("moveForward"))+dead(pad?.axes[1]??0):0;
      if(enabled&&pad){const view=prControllerCamera(this.yaw,this.pitch,pad.axes[2]??0,pad.axes[3]??0,1/B.tickRate,this.settings?.controllerSensitivity??1,this.settings?.invertY??false);this.yaw=view.yaw;this.pitch=view.pitch;}
      const length=Math.max(1,Math.hypot(x,z));x/=length;z/=length;const c=Math.cos(this.yaw),sin=Math.sin(this.yaw);
      const input:PrInput={sequence:++this.sequence,moveX:x*c+z*sin,moveZ:-x*sin+z*c,jump:enabled&&(this.bindingHeld.has("jump")||!!pad?.buttons[0]?.pressed),dive:enabled&&(this.bindingHeld.has("dive")||!!pad?.buttons[2]?.pressed)};
      const grounded=this.local.grounded,diveReady=this.local.diveReadyAt,vertical=this.local.velocity.y;
      this.socket.emit("pr:player:input",input);prStepMotion(this.local,input,1/B.tickRate,elapsed,round,s.seed,this.tiles);
      if(grounded&&!this.local.grounded&&this.local.velocity.y>5)this.cue("jump");
      if(this.local.diveReadyAt>diveReady){const boosted=prIsBoosting(this.local,elapsed);this.cue(boosted?"boost":"dive");if(boosted)this.events.emit("boost",this.local.position,me.color,elapsed);}
      if(!grounded&&this.local.grounded&&vertical< -4){this.events.emit("land",this.local.position,me.color,elapsed);this.cue("land");}
      this.pending.push({input,elapsed});if(this.pending.length>30)this.pending.shift();
    }
    this.world.update(elapsed,s.seed,this.tiles.triggered);
    this.world.setPhase(s.phase,Math.max(0,Math.ceil((s.phaseEndsAt-now-this.offset)/1000)),elapsed);this.events.update(elapsed);
    this.world.root.visible=s.phase!=="results";this.events.root.visible=s.phase!=="results";
    const present=new Set(s.players.map(p=>p.id));
    for(const [id,p]of this.pilots)if(!present.has(id)){p.presentation.dispose();this.disposePilot(p.rig);this.pilots.delete(id);}
    for(const p of s.players){
      let visual=this.pilots.get(p.id);
      if(!visual){const rig=createAstronautVisual({identityColor:p.color,suitAccent:p.color,isBot:p.isBot});visual={rig,motion:createAstronautMotion(rig),presentation:createPrPilotPresentation(rig,this.scene)};this.pilots.set(p.id,visual);this.scene.add(rig.group);}
      const state=p.id===this.localId&&this.local?this.local:p,rig=visual.rig;
      rig.group.visible=p.status==="active"||p.status==="qualified"&&(s.phase==="round-results"||p.id===this.localId&&focusQualified);if(!rig.group.visible){visual.presentation.update(p,elapsed,dt);continue;}
      this.desired.set(state.position.x,state.position.y+.295,state.position.z);if(rig.group.position.distanceToSquared(this.desired)>100)rig.group.position.copy(this.desired);else rig.group.position.lerp(this.desired,1-Math.exp(-dt*18));
      rig.group.rotation.set(0,state.yaw,0);
      for(const detail of rig.lodDetails)detail.visible=p.id===this.localId||this.settings?.graphicsQuality!=="low"&&rig.group.position.distanceToSquared(this.camera.position)<2500;
      Object.assign(visual.motion.input,{dt,timeSeconds:now/1000,forwardSpeed:state.velocity.x*Math.sin(state.yaw)+state.velocity.z*Math.cos(state.yaw),lateralSpeed:0,verticalSpeed:state.velocity.y,grounded:state.grounded,walkSpeed:4,runSpeed:B.runSpeed,detail:p.id!==this.localId&&(this.settings?.graphicsQuality==="low"||rig.group.position.distanceToSquared(this.camera.position)>1600)?"far":"near"});visual.motion.update();
      visual.presentation.update({...p,...state,status:p.status},elapsed,dt,{lowGravity:this.inLowGravity(state,elapsed),boosted:prIsBoosting(state,elapsed),detail:p.id!==this.localId&&rig.group.position.distanceToSquared(this.camera.position)>1600?"far":"near"});
    }
    const candidates=s.players.filter(p=>p.status==="active"&&p.position.y>round.killY).sort((a,b)=>a.position.z-b.position.z||a.id.localeCompare(b.id));
    const followingLocal=(me?.status==="active"||focusQualified)&&this.local;
    const follow=followingLocal?this.local:candidates[((this.spectatorIndex%candidates.length)+candidates.length)%candidates.length];
    if(follow){const id=followingLocal?this.localId:(follow as PrSnapshot["players"][number]).id;
      this.desired.set(follow.position.x,follow.position.y+1.5,follow.position.z);
      const changedSubject=id!==this.followId||this.followSubject!==this.world;
      updatePrFollowTarget(this.target,this.desired,dt,this.settings?.cameraShake??"full",changedSubject);
      this.followId=id;this.followSubject=this.world;const distance=s.phase==="intro"?24:9;
      if(s.phase==="intro")this.target.z=round.category==="race"?-22:0;
      setPrOrbitPosition(this.desired,this.target,this.yaw,this.pitch,distance);
      const direction=this.direction.copy(this.desired).sub(this.target),length=direction.length();this.ray.set(this.target,direction.normalize());this.ray.far=length;const hit=this.ray.intersectObjects(this.cameraColliders,false).find(h=>h.distance>.5&&prCameraSurfaceBlocks(h.object));
      this.orbitRadius=prOrbitRadius(this.orbitRadius,distance,hit?hit.distance-.4:distance,dt,changedSubject);
      setPrOrbitPosition(this.camera.position,this.target,this.yaw,this.pitch,this.orbitRadius);this.camera.lookAt(this.target);
    }
    if(s.phase==="intro"){const view=prIntroCamera(round,Math.max(0,1-(s.phaseEndsAt-now-this.offset)/B.introMs));this.camera.position.set(...view.position);this.camera.lookAt(...view.target);}
    if(import.meta.env.DEV&&this.review){const view=prReviewCamera(round,this.review);this.camera.position.set(...view.position);this.camera.lookAt(...view.target);}
    const width=innerWidth,height=innerHeight;if(this.renderer.domElement.width!==Math.floor(width*this.renderer.getPixelRatio())||this.renderer.domElement.height!==Math.floor(height*this.renderer.getPixelRatio()))this.renderer.setSize(width,height);
    this.camera.fov=65;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    if(s.phase==="results"&&this.winnerStage.root.visible){
      const rect=document.querySelector<HTMLElement>(".pr-winner-stage")?.getBoundingClientRect();
      this.winnerStage.update(elapsed,matchMedia("(prefers-reduced-motion: reduce)").matches);
      this.renderer.clear();if(rect&&rect.width>0&&rect.height>0){this.camera.fov=32;this.camera.aspect=rect.width/rect.height;this.camera.position.set(0,1.4,7);this.camera.lookAt(0,.8,0);this.camera.updateProjectionMatrix();this.renderer.setViewport(rect.left,height-rect.bottom,rect.width,rect.height);this.renderer.setScissor(rect.left,height-rect.bottom,rect.width,rect.height);this.renderer.setScissorTest(true);this.renderer.render(this.scene,this.camera);this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,width,height);}
    }else this.renderer.render(this.scene,this.camera);
  }
  private inLowGravity(state:PrMotion,elapsed:number):boolean{if(!this.snapshot?.roundId)return false;return prRound(this.snapshot.roundId).platforms.some(p=>{if(p.gravityScale===undefined||p.gravityScale>=1)return false;const c=prPlatformCenter(p,elapsed);return Math.abs(state.position.x-c.x)<=p.half.x&&Math.abs(state.position.z-c.z)<=p.half.z&&state.position.y>=c.y+p.half.y-.1&&state.position.y<c.y+15;});}
  reset():void{this.followSubject=null;this.followId="";this.winnerStage.setWinner(null);this.events.update(-1);this.world?.dispose();this.world=null;for(const p of this.pilots.values()){p.presentation.dispose();this.disposePilot(p.rig);}this.pilots.clear();this.snapshot=null;this.local=null;this.pending=[];}
  private disposePilot(rig:AstronautVisual):void{rig.group.removeFromParent();const g=new Set<THREE.BufferGeometry>(),m=new Set<THREE.Material>();rig.group.traverse(o=>{if(o instanceof THREE.Mesh){g.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material])m.add(mat);}});g.forEach(x=>x.dispose());m.forEach(x=>x.dispose());}
}
