import {pgFireReady,pgFirePressValid} from "./pg-fire-readiness";
import {pgReconcileMotion} from "./pg-prediction";
import {PgEffects} from "./pg-effects";
import {createPgPilotPresentation} from "./pg-pilot-presentation";
import * as THREE from "three";
import {PG_BALANCE as B,PG_WEAPONS,PG_REVIEW_VIEWS,SHOP_CATALOG,pgStepMovement,pgSpread,type PgInput,type PgMotion,type PgSnapshot,type PgShot,type BrWeaponId} from "@planetfall/shared";
import type {GameSocket} from "../../network";
import type {UserSettings} from "../../settings";
import {QUALITY_PRESETS} from "../../settings";
import {createAstronautVisual,type AstronautVisual} from "../../astronaut";
import {createAstronautMotion} from "../../astronaut-motion";
import type {GameAudio} from "../../audio";
import {PgWorldRenderer} from "./pg-world";
import {createPgViewmodel,PG_VIEWMODEL_LAYER} from "./pg-viewmodel";
import {renderPgFrame} from "./pg-render";
const audioWeapons:Record<PgShot["weapon"],BrWeaponId>={pulse:"pulse-rifle",nova:"nova-smg",photon:"photon-shotgun",quasar:"quasar-carbine",rail:"rail-laser",comet:"comet-hand-cannon"};
export class PlanetGunGame {
 private viewmodelScene=new THREE.Scene();private viewCamera=new THREE.PerspectiveCamera(78,1,.01,12);private sun=new THREE.DirectionalLight(0xfff0d7,2.5);private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(78,1,.03,400);private world=new PgWorldRenderer();private viewmodel=createPgViewmodel();
 onAim:(weapon:PgShot["weapon"],ads:number,spread:number)=>void=()=>{};
 onMenuNavigate:(action:"up"|"down"|"left"|"right"|"confirm"|"back")=>void=()=>{};onPause:()=>void=()=>{};onScoreboard:()=>void=()=>{};
 private padButtons:boolean[]=[];private menuAt=0;private review:keyof typeof PG_REVIEW_VIEWS|null=null;
 private active=false;private blocked=false;private id="";private snapshot:PgSnapshot|null=null;private local:PgMotion|null=null;private life=-1;private pending:{input:PgInput;at:number}[]=[];private sequence=0;private shotSequence=0;
 private keys=new Set<string>();private mouseFire=false;private mouseAds=false;private dragged=false;private yaw=0;private pitch=0;private offset=0;private accumulator=0;private lastFrame=0;private nextFire=0;private sprintFireAt=0;private sprintExitSequence=-1;private firingWeapon="";private fireHeld=false;private semiPending=false;private semiPendingUntil=0;private jumpQueuedUntil=0;private thrustCueAt=0;private ads=0;private recoil=0;private wallRoll=0;private movementFov=0;private lastStep=0;private times:number[]=[];
 private rendererName="";private suitAccent=0xffba62;private settings:UserSettings|null=null;private pilots=new Map<string,{rig:AstronautVisual;presentation:ReturnType<typeof createPgPilotPresentation>;motion:ReturnType<typeof createAstronautMotion>}>();private effects=new PgEffects();private remoteSteps=new Map<string,number>();
 constructor(private renderer:THREE.WebGLRenderer,private canvas:HTMLCanvasElement,private socket:GameSocket,private hud:(s:PgSnapshot)=>void,private hit:(n:number,headshot:boolean)=>void,private audio:GameAudio){
  const gl=renderer.getContext(),extension=gl.getExtension("WEBGL_debug_renderer_info");this.rendererName=String(gl.getParameter(extension?extension.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
  this.scene.background=new THREE.Color(0x101c32);this.scene.fog=new THREE.Fog(0x101c32,100,230);this.scene.add(this.world.root,this.camera,this.effects.root);this.viewCamera.layers.set(PG_VIEWMODEL_LAYER);this.viewmodelScene.add(this.viewCamera);this.viewCamera.add(this.viewmodel.root);this.attachMuzzle();
  this.scene.add(new THREE.HemisphereLight(0xb8d7ef,0x526574,1.7));this.sun.position.set(-35,55,20);this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-64,right:64,top:64,bottom:-64,near:10,far:150});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.035;this.sun.shadow.camera.updateProjectionMatrix();this.scene.add(this.sun);const fill=new THREE.DirectionalLight(0xa9ccff,.35);fill.position.set(30,18,-25);this.scene.add(fill);
  addEventListener("keydown",e=>{if(!this.canPlay())return;if(["Space","Tab","ControlLeft","ControlRight","ShiftLeft","ShiftRight","KeyW","KeyA","KeyS","KeyD","KeyC","KeyR","Digit1","Digit2"].includes(e.code))e.preventDefault();this.keys.add(e.code);if(e.code==="Space"&&!e.repeat)this.jumpQueuedUntil=performance.now()+150;if(e.repeat)return;if(e.code==="KeyR")this.socket.emit("pg:weapon:reload");if(e.code==="Digit1"||e.code==="Digit2")this.socket.emit("pg:weapon:switch",{slot:e.code==="Digit1"?0:1});});
  addEventListener("keyup",e=>this.keys.delete(e.code));addEventListener("blur",()=>this.clearInput());
  canvas.addEventListener("mousedown",e=>{if(!this.canPlay())return;this.audio.unlock();this.dragged=true;if(e.button===0){this.mouseFire=true;this.semiPending=true;this.semiPendingUntil=performance.now()+1000;}if(e.button===2)this.mouseAds=true;void canvas.requestPointerLock().catch(()=>{});});
  addEventListener("mouseup",e=>{this.dragged=false;if(e.button===0)this.mouseFire=false;if(e.button===2)this.mouseAds=false;});
  canvas.addEventListener("contextmenu",e=>{if(this.canPlay())e.preventDefault();});
  addEventListener("mousemove",e=>{if(!this.canPlay()||document.pointerLockElement!==canvas&&!this.dragged)return;const sensitivity=.0022*(this.settings?.mouseSensitivity??1)*(this.ads>.5?.48:1);this.yaw-=e.movementX*sensitivity;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*sensitivity*(this.settings?.invertY?-1:1),-1.4,1.4);});
 }
 private canPlay():boolean{return this.active&&!this.blocked&&!this.review&&this.socket.connected&&!!this.snapshot&&["playing","overtime"].includes(this.snapshot.phase)&&(this.snapshot.players.find(p=>p.id===this.id)?.hp??0)>0;}
 private clearInput():void{this.keys.clear();this.jumpQueuedUntil=0;this.mouseFire=false;this.semiPending=false;this.semiPendingUntil=0;this.mouseAds=false;this.dragged=false;}
 activate(id:string):void{this.id=id;if(this.active)return;this.active=true;if(this.settings)this.setSettings(this.settings);this.lastFrame=performance.now();this.renderer.setAnimationLoop(t=>this.frame(t));}
 deactivate():void{if(!this.active)return;this.active=false;this.clearInput();document.exitPointerLock?.();this.renderer.setAnimationLoop(null);}
 setUiCaptured(value:boolean):void{this.blocked=value;if(value){this.clearInput();document.exitPointerLock?.();}}
 setSettings(settings:UserSettings):void{this.settings=settings;const quality=settings.graphicsQuality==="auto"?"medium":settings.graphicsQuality,q=QUALITY_PRESETS[quality];this.world.setQuality(quality);if(this.active){this.renderer.setPixelRatio(Math.min(devicePixelRatio,q.pixelRatioCap)*q.resolutionScale);this.renderer.shadowMap.enabled=quality==="high";if(this.sun)this.sun.castShadow=quality==="high";}}
 applySnapshot(s:PgSnapshot):void {
  if(this.snapshot&&s.serverTime<this.snapshot.serverTime)return;
  const previous=this.snapshot,old=previous?.players.find(p=>p.id===this.id),next=s.players.find(p=>p.id===this.id);
  if(next&&old){if(next.guns[next.slot].reloadUntil>old.guns[old.slot].reloadUntil)this.audio.brReload(audioWeapons[next.guns[next.slot].id]);if(next.hp<=0&&old.hp>0)this.audio.prCue("eliminate");if(next.lifeId!==old.lifeId)this.audio.prCue("go");}
  if(s.phase==="countdown"&&Math.ceil((s.phaseEndsAt-s.serverTime)/1000)!==Math.ceil(((previous?.phaseEndsAt??0)-(previous?.serverTime??0))/1000))this.audio.prCue("countdown");
  if(s.phase==="results"&&previous?.phase!=="results")this.audio.result(s.winner===next?.team);
  if(s.feed.at(-1)?.id!==previous?.feed.at(-1)?.id&&s.feed.at(-1)?.killerId===this.id)this.audio.prCue("qualify");
  this.snapshot=s;this.offset=Math.max(this.offset,s.serverTime-performance.now());const me=s.players.find(p=>p.id===this.id);
  if(me){this.suitAccent=new THREE.Color(SHOP_CATALOG.find(i=>i.id===me.equippedCosmetics.suit&&i.category==="suit")?.color??me.color).getHex();if(me.lifeId!==this.life){this.life=me.lifeId;this.yaw=me.yaw;this.pitch=me.pitch;this.pending=[];this.nextFire=0;this.sprintFireAt=0;this.sprintExitSequence=-1;this.firingWeapon="";this.wallRoll=0;this.movementFov=0;this.clearInput();}
   this.local=structuredClone(me);this.sequence=Math.max(this.sequence,me.lastInputSequence);this.pending=this.pending.filter(p=>p.input.sequence>me.lastInputSequence);
   if(me.hp>0&&["playing","overtime"].includes(s.phase)){const replay=pgReconcileMotion(me,me.lastInputSequence,this.pending);this.local=replay.motion;this.pending=replay.pending;}
  }
  if(!this.canPlay())document.exitPointerLock?.();this.hud(s);
 }
 applyShot(s:PgShot):void {if(!this.active)return;const me=this.local;if(!me)return;
  if(s.shooterId===this.id){if(s.damage>0){this.hit(s.damage,s.headshot);this.audio.hitConfirm(s.headshot?"headshot":"hp");}}
  else this.audio.brRemoteWeapon(audioWeapons[s.weapon],s.origin,me.position,this.yaw);
  this.effects.shot(s,s.shooterId===this.id,performance.now());
 }
 setReviewView(name:keyof typeof PG_REVIEW_VIEWS|null):void{if(!import.meta.env.DEV)return;this.review=name;this.clearInput();document.exitPointerLock?.();}
 private frame(now:number):void {
  if(!this.active)return;const frameMs=Math.max(0,now-this.lastFrame),dt=Math.min(.05,Math.max(0,frameMs/1000));this.lastFrame=now;this.times.push(frameMs);if(this.times.length>240)this.times.shift();const s=this.snapshot,me=s?.players.find(p=>p.id===this.id);if(!s||!me||!this.local)return;
  const controller=navigator.getGamepads?.().find(p=>p?.connected);
  if(controller){const buttons=controller.buttons.map(b=>b.pressed),pressed=(n:number)=>buttons[n]&&!this.padButtons[n];
   if(pressed(9))this.onPause();if(pressed(8))this.onScoreboard();
   if(this.blocked||s.phase==="results"){if(pressed(0))this.onMenuNavigate("confirm");if(pressed(1))this.onMenuNavigate("back");if(now-this.menuAt>220){let action:"up"|"down"|"left"|"right"|null=null;if(buttons[12]||controller.axes[1]<-.55)action="up";if(buttons[13]||controller.axes[1]>.55)action="down";if(buttons[14]||controller.axes[0]<-.55)action="left";if(buttons[15]||controller.axes[0]>.55)action="right";if(action){this.menuAt=now;this.onMenuNavigate(action);}}}
   else if(this.canPlay()){if(pressed(2))this.socket.emit("pg:weapon:reload");if(pressed(3))this.socket.emit("pg:weapon:switch",{slot:me.slot===0?1:0});}
   this.padButtons=buttons;
  }
  this.accumulator+=Math.min(.1,frameMs/1000);while(this.accumulator>=1/B.tickRate){this.accumulator-=1/B.tickRate;const at=now+this.offset-this.accumulator*1000;if(!this.socket.connected||!["playing","overtime"].includes(s.phase)||me.hp<=0)continue;
   this.semiPending&&=pgFirePressValid(now,this.semiPendingUntil,me.guns[me.slot]);
   const enabled=this.canPlay(),pad=navigator.getGamepads?.().find(p=>p?.connected),dead=(v:number)=>Math.abs(v)>.18?v:0;
   if(enabled&&pad){this.yaw-=dead(pad.axes[2]??0)*2.3/B.tickRate*(this.settings?.controllerSensitivity??1)*(this.ads>.5?.5:1);this.pitch=THREE.MathUtils.clamp(this.pitch-dead(pad.axes[3]??0)*1.8/B.tickRate*(this.settings?.invertY?-1:1),-1.4,1.4);}
   const input:PgInput={sequence:++this.sequence,moveX:enabled?Number(this.keys.has("KeyD"))-Number(this.keys.has("KeyA"))+dead(pad?.axes[0]??0):0,moveZ:enabled?Number(this.keys.has("KeyS"))-Number(this.keys.has("KeyW"))+dead(pad?.axes[1]??0):0,yaw:this.yaw,pitch:this.pitch,jump:enabled&&(this.keys.has("Space")||now<this.jumpQueuedUntil||!!pad?.buttons[0]?.pressed),sprint:enabled&&!this.mouseFire&&!this.semiPending&&!this.mouseAds&&!pad?.buttons[7]?.pressed&&!pad?.buttons[6]?.pressed&&(this.keys.has("ShiftLeft")||!!pad?.buttons[10]?.pressed),crouch:enabled&&(this.keys.has("ControlLeft")||this.keys.has("KeyC")||!!pad?.buttons[1]?.pressed),ads:enabled&&(this.mouseAds||!!pad?.buttons[6]?.pressed)};
   this.jumpQueuedUntil=0;const grounded=this.local.grounded,mode=this.local.mode,vertical=this.local.velocity.y;this.socket.emit("pg:player:input",input);pgStepMovement(this.local,input,1/B.tickRate,at);if(mode==="sprint"&&this.local.mode!=="sprint"){this.sprintFireAt=Math.max(this.sprintFireAt,at+PG_WEAPONS[me.guns[me.slot].id].sprintDelayMs);this.sprintExitSequence=input.sequence;}this.pending.push({input,at});if(this.pending.length>60)this.pending.shift();
   if(grounded&&!this.local.grounded&&this.local.velocity.y>5)this.audio.jump();if(input.jump&&!this.local.grounded&&this.local.ion>0&&now-this.thrustCueAt>900){this.audio.burst();this.thrustCueAt=now;}if(!grounded&&this.local.grounded)this.audio.land(-vertical);if(this.local.mode!==mode){if(this.local.mode==="slide")this.audio.slide();if(this.local.mode==="mantle")this.audio.mantle();if(this.local.mode==="wall-run")this.audio.wings();}if(this.local.grounded&&Math.hypot(this.local.velocity.x,this.local.velocity.z)>2&&now-this.lastStep>330){this.audio.brRemoteFootstep(this.local.position,this.local.position,this.yaw,input.sprint);this.lastStep=now;}
   const gun=me.guns[me.slot],w=PG_WEAPONS[gun.id],fire=enabled&&(this.mouseFire||this.semiPending||!!pad?.buttons[7]?.pressed);
   if(this.firingWeapon!==gun.id){this.firingWeapon=gun.id;this.nextFire=0;this.fireHeld=false;}
   if(fire&&(w.automatic||!this.fireHeld||this.semiPending)&&at>=this.nextFire&&pgFireReady(at,this.local.mode,me,this.sprintFireAt,this.sprintExitSequence)){this.socket.emit("pg:weapon:fire",{sequence:++this.shotSequence,clientTime:at,weapon:gun.id,yaw:this.yaw,pitch:this.pitch});this.semiPending=false;this.nextFire=at+w.intervalMs;this.recoil=Math.min(1,this.recoil+w.recoil*6);this.pitch=Math.min(1.4,this.pitch+w.recoil);this.audio.brWeapon(audioWeapons[gun.id]);}
   if(!fire)this.semiPending=false;this.fireHeld=fire;
  }
  const gun=me.guns[me.slot],weapon=PG_WEAPONS[gun.id],aim=this.canPlay()&&(this.mouseAds||!!navigator.getGamepads?.().find(p=>p?.connected)?.buttons[6]?.pressed)&&this.local.mode!=="sprint"&&gun.reloadUntil<=s.serverTime;
  this.ads+=(Number(aim)-this.ads)*(1-Math.exp(-dt*12));this.recoil*=Math.exp(-dt*12);
  const wallBank=this.local.mode==="wall-run"?-(this.local.wallNormal.x*Math.cos(this.yaw)-this.local.wallNormal.z*Math.sin(this.yaw))*.045:0;this.wallRoll+=(wallBank-this.wallRoll)*(1-Math.exp(-dt*10));this.movementFov+=((this.local.mode==="sprint"?4:this.local.mode==="wall-run"?2:0)-this.movementFov)*(1-Math.exp(-dt*10));
  this.camera.fov=78+(weapon.adsFov-78)*this.ads+this.movementFov;this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
  this.camera.position.set(this.local.position.x,this.local.position.y+(this.local.crouched?B.crouchEye:B.eye),this.local.position.z);this.camera.rotation.order="YXZ";this.camera.rotation.set(this.pitch,this.yaw,this.wallRoll,"YXZ");
  this.onAim(gun.id,this.ads,pgSpread(gun.id,this.ads,Math.hypot(this.local.velocity.x,this.local.velocity.z)>1,!this.local.grounded));
  this.viewmodel.root.visible=me.hp>0&&!this.review;this.viewmodel.update({weapon:gun.id,ads:this.ads,recoil:this.recoil,reload:gun.reloadUntil>s.serverTime?1-(gun.reloadUntil-s.serverTime)/weapon.reloadMs:0,speed:Math.hypot(this.local.velocity.x,this.local.velocity.z),mode:this.local.mode,time:now,suitAccent:this.suitAccent});
  this.viewmodel.getMuzzle(this.effects.muzzleRoot.position);
  for(const p of s.players){if(p.id===this.id)continue;let v=this.pilots.get(p.id);if(!v){const rig=createAstronautVisual({identityColor:p.team==="solar"?"#ffb45c":"#5ae1f0",suitAccent:SHOP_CATALOG.find(i=>i.id===p.equippedCosmetics.suit&&i.category==="suit")?.color??p.color,isBot:p.isBot});rig.group.scale.setScalar(.85);v={rig,presentation:createPgPilotPresentation(rig),motion:createAstronautMotion(rig)};this.pilots.set(p.id,v);this.scene.add(rig.group);}
   if(p.hp>0&&p.grounded&&Math.hypot(p.velocity.x,p.velocity.z)>2&&now-(this.remoteSteps.get(p.id)??0)>360&&Math.hypot(p.position.x-this.local.position.x,p.position.z-this.local.position.z)<32){this.remoteSteps.set(p.id,now);this.audio.brRemoteFootstep(p.position,this.local.position,this.yaw,p.mode==="sprint");}
   v.rig.torso.castShadow=this.settings?.graphicsQuality==="high";const shell=v.rig.helmet.children[0];if(shell instanceof THREE.Mesh)shell.castShadow=v.rig.torso.castShadow;
   v.rig.group.visible=p.hp>0||now+this.offset-p.deadAt<400;const target=new THREE.Vector3(p.position.x,p.position.y+(p.crouched?.04:.25),p.position.z);if(v.rig.group.position.distanceToSquared(target)>100)v.rig.group.position.copy(target);else v.rig.group.position.lerp(target,1-Math.exp(-dt*20));v.rig.group.rotation.y=p.yaw+Math.PI;const detailDistance=this.settings?.graphicsQuality==="low"?18:this.settings?.graphicsQuality==="high"?55:35;for(const detail of v.rig.lodDetails)detail.visible=v.rig.group.position.distanceToSquared(this.camera.position)<detailDistance*detailDistance;Object.assign(v.motion.input,{dt,timeSeconds:now/1000,forwardSpeed:Math.hypot(p.velocity.x,p.velocity.z),lateralSpeed:0,verticalSpeed:p.velocity.y,grounded:p.grounded,crouched:p.crouched,aiming:p.adsSince>0,item:"two-hand",detail:this.settings?.graphicsQuality==="low"?"far":"near",floorOffset:(p.crouched?.04:.25)/.85});v.motion.update();v.presentation.update(p,now+this.offset);
  }
  for(const [id,v]of this.pilots)if(!s.players.some(p=>p.id===id)){v.presentation.dispose();this.disposePilot(v.rig);this.pilots.delete(id);}
  this.effects.update(now);this.world.update(now);
  if(this.review){const view=PG_REVIEW_VIEWS[this.review];this.camera.position.set(view.position.x,view.position.y,view.position.z);this.camera.lookAt(view.target.x,view.target.y,view.target.z);this.camera.fov=70;this.camera.updateProjectionMatrix();}
  if(this.canvas.width!==Math.floor(innerWidth*this.renderer.getPixelRatio())||this.canvas.height!==Math.floor(innerHeight*this.renderer.getPixelRatio()))this.renderer.setSize(innerWidth,innerHeight);renderPgFrame(this.renderer,this.scene,this.camera,this.viewmodelScene,this.viewCamera,this.viewmodel.root.visible);
 }
 debugState(){let visibleInstances=0;const materials=new Set<THREE.Material>();for(const scene of[this.scene,this.viewmodelScene])scene.traverseVisible(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)visibleInstances+=o.count;}});return {renderer:this.rendererName,visibleInstances,materialCount:materials.size,review:this.review,active:this.active,phase:this.snapshot?.phase,local:this.local,blocked:this.blocked,pending:this.pending.length,players:this.snapshot?.players.length,quality:this.settings?.graphicsQuality,ads:this.ads,cameraFov:this.camera.fov,calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,frameTimes:[...this.times]};}
 reset():void{this.offset=0;this.review=null;this.snapshot=null;this.local=null;this.pending=[];this.life=-1;for(const v of this.pilots.values()){v.presentation.dispose();this.disposePilot(v.rig);}this.pilots.clear();this.effects.dispose();this.effects=new PgEffects();this.scene.add(this.effects.root);this.attachMuzzle();this.remoteSteps.clear();}
 private attachMuzzle():void{this.effects.muzzleRoot.traverse(o=>o.layers.set(PG_VIEWMODEL_LAYER));this.viewCamera.add(this.effects.muzzleRoot);}
 private disposePilot(rig:AstronautVisual):void{rig.group.removeFromParent();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();rig.group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
}
