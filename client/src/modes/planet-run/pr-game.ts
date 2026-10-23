import {prControllerCamera} from "./pr-camera-input";
import {createPrPilotPresentation} from "./pr-pilot-presentation";
import * as THREE from "three";
import {PR_BALANCE as B,PrTileState,prRound,prSpawn,prStepMotion,type PrInput,type PrMotion,type PrSnapshot,type PrTileDelta} from "@planetfall/shared";
import type {GameSocket} from "../../network";
import {createAstronautVisual,type AstronautVisual} from "../../astronaut";
import {createAstronautMotion} from "../../astronaut-motion";
import {QUALITY_PRESETS,type UserSettings} from "../../settings";
import {PrWorldRenderer} from "./pr-world";

/** Owns PlanetRun only. Reuses the application's renderer while Classic is paused. */
export class PlanetRunGame {
  private readonly scene=new THREE.Scene();private readonly camera=new THREE.PerspectiveCamera(65,1,.1,1000);
  private world:PrWorldRenderer|null=null;private snapshot:PrSnapshot|null=null;private tiles=new PrTileState([]);
  private cameraColliders:THREE.Object3D[]=[];
  private readonly pilots=new Map<string,{rig:AstronautVisual;motion:ReturnType<typeof createAstronautMotion>;presentation:ReturnType<typeof createPrPilotPresentation>}>();
  private local:PrMotion|null=null;private pending:{input:PrInput;elapsed:number}[]=[];private sequence=0;private tileRevision=0;
  private active=false;private blocked=false;private cameraDragging=false;private keys=new Set<string>();private yaw=0;private pitch=.38;
  private lastFrame=0;private accumulator=0;private offset=0;private spectatorIndex=0;private settings:UserSettings|null=null;
  private readonly rendererName:string;
  private frameTimes:number[]=[];private lastImpactCue=0;private previousElapsed=0;private lastMachineryCue=-2000;
  private readonly direction=new THREE.Vector3();
  private readonly target=new THREE.Vector3();private readonly desired=new THREE.Vector3();private readonly ray=new THREE.Raycaster();
  constructor(private readonly renderer:THREE.WebGLRenderer,private readonly canvas:HTMLCanvasElement,private readonly socket:GameSocket,private readonly hud:(s:PrSnapshot)=>void,private readonly cue:(kind:"jump"|"dive"|"tile"|"impact"|"tile-break"|"machinery")=>void=()=>{}){
    const gl=this.renderer.getContext(),extension=gl.getExtension("WEBGL_debug_renderer_info");this.rendererName=extension?String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)):String(gl.getParameter(gl.RENDERER));
    this.scene.background=new THREE.Color(0x10243c);this.scene.fog=new THREE.Fog(0x10243c,100,280);
    this.scene.add(new THREE.HemisphereLight(0xe7faff,0x595175,2.5));const sun=new THREE.DirectionalLight(0xfff0d5,2.6);sun.position.set(30,70,25);this.scene.add(sun);
    addEventListener("keydown",e=>{if(!this.active||this.blocked)return;if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();this.keys.add(e.code);if(e.code==="KeyV"&&!e.repeat)this.socket.emit("pr:emote",{emote:"wave"});if(e.code==="KeyQ")this.spectatorIndex--;if(e.code==="KeyE")this.spectatorIndex++;});
    addEventListener("keyup",e=>this.keys.delete(e.code));addEventListener("mouseup",()=>this.cameraDragging=false);addEventListener("blur",()=>{this.keys.clear();this.cameraDragging=false;});
    canvas.addEventListener("mousedown",e=>{if((e.button===0||e.button===2)&&this.canLook())this.cameraDragging=true;});
    canvas.addEventListener("contextmenu",e=>{if(this.canLook())e.preventDefault();});
    addEventListener("mousemove",e=>{if(this.canLook()&&(document.pointerLockElement===this.canvas||this.cameraDragging)){this.yaw-=e.movementX*.0025*(this.settings?.mouseSensitivity??1);this.pitch=THREE.MathUtils.clamp(this.pitch+e.movementY*.002*(this.settings?.mouseSensitivity??1)*(this.settings?.invertY?-1:1),-.15,1.1);}});
    canvas.addEventListener("click",()=>{if(this.canLook())void canvas.requestPointerLock().catch(()=>{/* Embedded browsers can deny capture; right-drag look remains available. */});});
  }
  private canLook():boolean{return this.active&&!this.blocked&&this.snapshot?.phase==="running"&&this.snapshot.players.find(p=>p.id===this.localId)?.status==="active";}
  activate(id:string):void{if(this.active&&this.localId===id)return;this.localId=id;this.active=true;if(this.settings)this.setSettings(this.settings);this.lastFrame=performance.now();this.renderer.setAnimationLoop(t=>this.frame(t));}
  private localId="";
  deactivate():void{if(!this.active)return;this.active=false;this.cameraDragging=false;this.keys.clear();this.pending=[];document.exitPointerLock?.();this.renderer.setAnimationLoop(null);}
  setUiCaptured(blocked:boolean):void{this.blocked=blocked;if(blocked){this.cameraDragging=false;this.keys.clear();document.exitPointerLock?.();}}
  setSettings(settings:UserSettings):void{this.settings=settings;const q=QUALITY_PRESETS[settings.graphicsQuality==="auto"?"medium":settings.graphicsQuality];if(this.active){this.renderer.setPixelRatio(Math.min(devicePixelRatio,q.pixelRatioCap)*q.resolutionScale);this.renderer.shadowMap.enabled=false;}}
  debugState(){let visibleInstances=0;const materials=new Set<THREE.Material>();this.scene.traverseVisible(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)visibleInstances+=o.count;}});return {camera:{yaw:this.yaw,pitch:this.pitch},renderer:this.rendererName,quality:this.settings?.graphicsQuality,visibleInstances,materialCount:materials.size,active:this.active,blocked:this.blocked,phase:this.snapshot?.phase,roundId:this.snapshot?.roundId,roundIndex:this.snapshot?.roundIndex,local:this.local?{position:{...this.local.position},grounded:this.local.grounded,velocity:{...this.local.velocity},supportId:this.local.supportId}:null,tileCount:this.tiles.tiles.length,triggeredTiles:this.tiles.triggered.size,tileRevision:this.tileRevision,pendingInputs:this.pending.length,players:this.snapshot?.players.length??0,calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,frameTimes:[...this.frameTimes]};}
  applySnapshot(s:PrSnapshot):void {
    const changed=s.roundIndex!==this.snapshot?.roundIndex||s.roundId!==this.snapshot?.roundId;
    if(changed){this.previousElapsed=0;this.lastMachineryCue=-2000;this.world?.dispose();this.world=null;this.pending=[];this.tileRevision=0;
      if(s.roundId){const round=prRound(s.roundId);this.world=new PrWorldRenderer(round);this.scene.add(this.world.root);this.cameraColliders=[];this.world.root.traverse(o=>{if(["authoritative-platform","authoritative-hazard","shatterdeck-cells"].includes(o.name))this.cameraColliders.push(o);});this.tiles=new PrTileState(round.tiles);}else this.tiles=new PrTileState([]);
      this.yaw=0;
    }
    this.snapshot=s;this.offset=s.serverTime-performance.now();
    if(s.tilesFull){this.tiles=new PrTileState(s.roundId?prRound(s.roundId).tiles:[]);this.tiles.apply(s.tiles);this.tileRevision=s.tileRevision;}
    if(s.tileRevision>this.tileRevision)this.socket.emit("pr:tiles:sync");
    const me=s.players.find(p=>p.id===this.localId);
    if(me&&me.diveUntil>Math.max(0,s.serverTime-s.roundStartedAt)&&me.diveReadyAt-me.diveUntil<500&&s.serverTime-this.lastImpactCue>300){this.lastImpactCue=s.serverTime;this.cue("impact");}
    if(me){this.local={...me,position:{...me.position},velocity:{...me.velocity}};this.sequence=Math.max(this.sequence,me.lastInputSequence);this.pending=this.pending.filter(p=>p.input.sequence>me.lastInputSequence);
      if(s.roundId&&s.phase==="running"&&me.status==="active")for(const p of this.pending)prStepMotion(this.local,p.input,1/B.tickRate,p.elapsed,prRound(s.roundId),s.seed,this.tiles);
    }
    if(s.phase!=="running"||me?.status!=="active")document.exitPointerLock?.();this.hud(s);
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
    this.frameTimes.push(frameMs);if(this.frameTimes.length>180)this.frameTimes.shift();
    const elapsed=Math.max(0,now+this.offset-s.roundStartedAt),round=prRound(s.roundId!);
    const me=s.players.find(p=>p.id===this.localId);
    if(s.phase==="running"&&!this.blocked&&me?.status==="active"&&this.local){
      for(const [id,at] of this.tiles.triggered){const cell=this.tiles.tiles[id],breakAt=at+B.tileBreakMs;
        if(cell&&this.previousElapsed<breakAt&&elapsed>=breakAt&&Math.hypot(cell.center.x-this.local.position.x,cell.center.y-this.local.position.y,cell.center.z-this.local.position.z)<7){this.cue("tile-break");break;}
      }
      if(elapsed-this.lastMachineryCue>1400&&round.obstacles.some(o=>(o.kind==="rotator"||o.kind==="door")&&Math.hypot(o.center.x-this.local!.position.x,o.center.z-this.local!.position.z)<o.half.x+10)){this.lastMachineryCue=elapsed;this.cue("machinery");}
    }
    this.previousElapsed=elapsed;
    this.accumulator+=dt;
    while(this.accumulator>=1/B.tickRate){this.accumulator-=1/B.tickRate;
      if(s.phase!=="running"||me?.status!=="active"||!this.local||!this.socket.connected)continue;
      const pad=navigator.getGamepads?.().find(p=>p?.connected),dead=(v:number)=>Math.abs(v)>.18?v:0;
      const enabled=!this.blocked;
      let x=enabled?Number(this.keys.has("KeyD"))-Number(this.keys.has("KeyA"))+dead(pad?.axes[0]??0):0;
      let z=enabled?Number(this.keys.has("KeyS"))-Number(this.keys.has("KeyW"))+dead(pad?.axes[1]??0):0;
      if(enabled&&pad){const view=prControllerCamera(this.yaw,this.pitch,pad.axes[2]??0,pad.axes[3]??0,1/B.tickRate,this.settings?.controllerSensitivity??1,this.settings?.invertY??false);this.yaw=view.yaw;this.pitch=view.pitch;}
      const length=Math.max(1,Math.hypot(x,z));x/=length;z/=length;const c=Math.cos(this.yaw),sin=Math.sin(this.yaw);
      const input:PrInput={sequence:++this.sequence,moveX:x*c+z*sin,moveZ:-x*sin+z*c,jump:enabled&&(this.keys.has("Space")||!!pad?.buttons[0]?.pressed),dive:enabled&&(this.keys.has("ShiftLeft")||this.keys.has("ShiftRight")||!!pad?.buttons[2]?.pressed)};
      const grounded=this.local.grounded,diveReady=this.local.diveReadyAt;
      this.socket.emit("pr:player:input",input);prStepMotion(this.local,input,1/B.tickRate,elapsed,round,s.seed,this.tiles);
      if(grounded&&!this.local.grounded&&this.local.velocity.y>5)this.cue("jump");
      if(this.local.diveReadyAt>diveReady)this.cue("dive");this.pending.push({input,elapsed});if(this.pending.length>30)this.pending.shift();
    }
    this.world.update(elapsed,s.seed,this.tiles.triggered);
    const present=new Set(s.players.map(p=>p.id));
    for(const [id,p]of this.pilots)if(!present.has(id)){p.presentation.dispose();this.disposePilot(p.rig);this.pilots.delete(id);}
    for(const p of s.players){
      let visual=this.pilots.get(p.id);
      if(!visual){const rig=createAstronautVisual({identityColor:p.color,suitAccent:p.color,isBot:p.isBot});visual={rig,motion:createAstronautMotion(rig),presentation:createPrPilotPresentation(rig,this.scene)};this.pilots.set(p.id,visual);this.scene.add(rig.group);}
      const state=p.id===this.localId&&this.local?this.local:p,rig=visual.rig;
      rig.group.visible=p.status==="active"||p.status==="qualified"&&s.phase==="round-results";if(!rig.group.visible){visual.presentation.update(p,elapsed,dt);continue;}
      this.desired.set(state.position.x,state.position.y+.295,state.position.z);if(rig.group.position.distanceToSquared(this.desired)>100)rig.group.position.copy(this.desired);else rig.group.position.lerp(this.desired,1-Math.exp(-dt*18));
      rig.group.rotation.y=state.yaw;
      for(const detail of rig.lodDetails)detail.visible=p.id===this.localId||this.settings?.graphicsQuality!=="low"&&rig.group.position.distanceToSquared(this.camera.position)<2500;
      Object.assign(visual.motion.input,{dt,timeSeconds:now/1000,forwardSpeed:state.velocity.x*Math.sin(state.yaw)+state.velocity.z*Math.cos(state.yaw),lateralSpeed:0,verticalSpeed:state.velocity.y,grounded:state.grounded,walkSpeed:4,runSpeed:B.runSpeed,detail:p.id!==this.localId&&(this.settings?.graphicsQuality==="low"||rig.group.position.distanceToSquared(this.camera.position)>1600)?"far":"near"});visual.motion.update();
      visual.presentation.update({...p,...state,status:s.phase==="results"&&s.winnerId===p.id?"qualified":p.status},elapsed,dt);
    }
    const candidates=s.players.filter(p=>p.status==="active"&&p.position.y>round.killY).sort((a,b)=>a.position.z-b.position.z||a.id.localeCompare(b.id));
    const follow=me?.status==="active"&&this.local?this.local:candidates[((this.spectatorIndex%candidates.length)+candidates.length)%candidates.length];
    if(follow){this.target.set(follow.position.x,follow.position.y+1.5,follow.position.z);const distance=s.phase==="intro"?24:9;
      if(s.phase==="intro")this.target.z=round.category==="race"?-22:0;
      this.desired.set(Math.sin(this.yaw)*Math.cos(this.pitch)*distance,Math.sin(this.pitch)*distance,Math.cos(this.yaw)*Math.cos(this.pitch)*distance).add(this.target);
      const direction=this.direction.copy(this.desired).sub(this.target),length=direction.length();this.ray.set(this.target,direction.normalize());this.ray.far=length;const hit=this.ray.intersectObjects(this.cameraColliders,false).find(h=>h.distance>.5&&(h.object.name==="authoritative-platform"||h.object.name==="authoritative-hazard"||h.object.name==="shatterdeck-cells"));
      if(hit)this.desired.copy(this.target).addScaledVector(direction,Math.max(1,hit.distance-.4));
      this.camera.position.lerp(this.desired,1-Math.exp(-dt*9));this.camera.lookAt(this.target);
    }
    const width=innerWidth,height=innerHeight;if(this.renderer.domElement.width!==Math.floor(width*this.renderer.getPixelRatio())||this.renderer.domElement.height!==Math.floor(height*this.renderer.getPixelRatio()))this.renderer.setSize(width,height);
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);
  }
  reset():void{this.world?.dispose();this.world=null;for(const p of this.pilots.values()){p.presentation.dispose();this.disposePilot(p.rig);}this.pilots.clear();this.snapshot=null;this.local=null;this.pending=[];}
  private disposePilot(rig:AstronautVisual):void{rig.group.removeFromParent();const g=new Set<THREE.BufferGeometry>(),m=new Set<THREE.Material>();rig.group.traverse(o=>{if(o instanceof THREE.Mesh){g.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material])m.add(mat);}});g.forEach(x=>x.dispose());m.forEach(x=>x.dispose());}
}
