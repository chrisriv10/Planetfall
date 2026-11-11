import * as THREE from "three";
import {RoomEnvironment} from "three/examples/jsm/environments/RoomEnvironment.js";
import type {GraphicsQuality} from "../../settings";
import type {createPgCharacterShowcase} from "./pg-character-showcase";

export type PgCharacterShowcase=ReturnType<typeof createPgCharacterShowcase>;
export type PgShowcaseLayerView=Pick<PgCharacterShowcase,"root"|"update">&{background?:THREE.Color;lighting?:"weapon"};
function createWeaponEnvironment(renderer:THREE.WebGLRenderer):THREE.WebGLRenderTarget {
 const room=new RoomEnvironment(), generator=new THREE.PMREMGenerator(renderer);
 const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
 const autoClear=renderer.autoClear,toneMapping=renderer.toneMapping,xr=renderer.xr.enabled;
 try {
  return generator.fromScene(room,0,.1,100,{size:128});
 } finally {
  renderer.setRenderTarget(target,face,mip);renderer.autoClear=autoClear;renderer.toneMapping=toneMapping;renderer.xr.enabled=xr;
  room.traverse(object=>{if(object instanceof THREE.InstancedMesh)object.dispose();});
  room.dispose();generator.dispose();
 }
}

/** The active renderer owner draws this scene after world depth, using its existing camera. */
export class PgCharacterShowcaseLayer {
 private readonly scene=new THREE.Scene();
 private view:PgShowcaseLayerView|null=null;
 private stage:HTMLElement|null=null;
 private readonly key=new THREE.DirectionalLight(0xd5e9ff,2.2);
 private readonly ambient=new THREE.AmbientLight(0xd6efff,1.5);
 private readonly hemisphere=new THREE.HemisphereLight(0xbfeaff,0x3d284f,0);
 private readonly rim=new THREE.DirectionalLight(0x68baff,0);
 private readonly cameraPosition=new THREE.Vector3();private readonly cameraRotation=new THREE.Quaternion();private readonly offset=new THREE.Vector3();
 private environment:THREE.WebGLRenderTarget|null=null;
 private disposed=false;
 constructor(private readonly makeEnvironment=createWeaponEnvironment){
  this.scene.add(this.ambient,this.hemisphere,this.rim,this.rim.target,this.key,this.key.target);
 }
 get active(){return !!this.stage&&this.view?.root.parent===this.scene;}
 set(view:PgShowcaseLayerView|null,stage:HTMLElement|null):void{
  if(this.disposed)return;
  if(this.view?.root.parent===this.scene){this.view.root.visible=false;this.scene.remove(this.view.root);}
  this.view=view;this.stage=stage;
  this.scene.background=view?.background??null;
  const weapon=view?.lighting==="weapon";
  this.scene.environment=weapon ? this.environment?.texture??null : null;
  this.ambient.intensity=weapon ? .3 : 1.5;this.hemisphere.intensity=weapon?2.7:0;this.rim.intensity=weapon?3:0;
  this.key.intensity=weapon?3.6:2.2;this.key.color.setHex(weapon?0xffe5ba:0xd5e9ff);
  if(view&&stage){this.scene.add(view.root);view.root.visible=true;}
 }
 render(renderer:THREE.WebGLRenderer,camera:THREE.PerspectiveCamera,timeSeconds:number,quality:GraphicsQuality,reducedMotion:boolean):void{
  if(!this.view||!this.stage||this.view.root.parent!==this.scene)return;
  const bounds=this.stage.getBoundingClientRect();if(bounds.width<=0||bounds.height<=0)return;
  camera.getWorldPosition(this.cameraPosition);camera.getWorldQuaternion(this.cameraRotation);
  if(this.view.lighting==="weapon"){
   this.environment??=this.makeEnvironment(renderer);
   this.scene.environment=this.environment.texture;
   this.scene.environmentRotation.setFromQuaternion(this.cameraRotation);
  }
  this.key.position.copy(this.offset.set(-3,7,5).applyQuaternion(this.cameraRotation)).add(this.cameraPosition);
  this.key.target.position.copy(this.offset.set(0,0,-6).applyQuaternion(this.cameraRotation)).add(this.cameraPosition);
  this.rim.position.copy(this.offset.set(-3,1,-8).applyQuaternion(this.cameraRotation)).add(this.cameraPosition);
  this.rim.target.position.copy(this.key.target.position);
  this.view.update(camera,{viewportWidth:innerWidth,viewportHeight:innerHeight,left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height},timeSeconds,quality,reducedMotion);
  const autoClear=renderer.autoClear;
  try{renderer.autoClear=false;renderer.clearDepth();renderer.render(this.scene,camera);}
  finally{renderer.autoClear=autoClear;}
 }
 reset():void{
  if(this.disposed)return;
  this.set(null,null);
  this.environment?.dispose();this.environment=null;
 }
 dispose():void{if(this.disposed)return;this.reset();this.disposed=true;}
}
