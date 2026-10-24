import * as THREE from "three";
import type {PrRoundDefinition} from "@planetfall/shared";

export type PrArtQuality="low"|"medium"|"high";
export type PrArtPrimitive="box"|"cylinder"|"sphere"|"cone"|"torus"|"hex";
export type PrArtMaterial="neutral"|"dark"|"primary"|"secondary"|"hazard"|"glow"|"soft"|"white";
export type PrArtPlacement=readonly[number,number,number,number,number,number];
export interface PrArtContext {
 readonly round:PrRoundDefinition;
 readonly root:THREE.Group;
 readonly platforms:ReadonlyMap<string,THREE.Group>;
 readonly obstacles:ReadonlyMap<string,THREE.Group>;
 readonly surfaces:ReadonlyMap<string,THREE.Mesh>;
 readonly hazardVolumes:ReadonlyMap<string,THREE.Mesh>;
}
export interface PrRoundArt {
 update(elapsedMs:number,seed:number,triggered:ReadonlyMap<number,number>):void;
 setQuality(quality:PrArtQuality):void;
 dispose():void;
}
export type PrArtPalette=Readonly<Record<PrArtMaterial,number>>;
export const PR_ART_PALETTES:Record<PrRoundDefinition["id"],PrArtPalette>={
 "cargo-cyclone":{neutral:0xd6dbe0,dark:0x173247,primary:0xf66f59,secondary:0xf3b052,hazard:0xff8860,glow:0x80fff0,soft:0x778d9c,white:0xf6efe1},
 "solar-sweep":{neutral:0xe5d9b8,dark:0x373358,primary:0xeebf48,secondary:0x9b79d4,hazard:0xff935e,glow:0xffeaaa,soft:0x797496,white:0xfff5dc},
 "meteor-garden":{neutral:0xceded3,dark:0x183e49,primary:0x4ab9a3,secondary:0x88c965,hazard:0xff976c,glow:0xb4ffe0,soft:0x597f70,white:0xeff4dc},
 "flux-gardens":{neutral:0xd9d2e5,dark:0x343455,primary:0xaf85df,secondary:0x639eab,hazard:0xffa17c,glow:0x9affeb,soft:0x7e7aa3,white:0xf0e8ff},
 "capacitor-causeway":{neutral:0xcad9df,dark:0x1a3454,primary:0x498dce,secondary:0x6685ae,hazard:0xffb264,glow:0xa5f5ff,soft:0x637d9b,white:0xe6f7ff},
 shatterdeck:{neutral:0xd8e4e7,dark:0x292c4f,primary:0x6de0d2,secondary:0xb68ee8,hazard:0xffa666,glow:0xbaffeb,soft:0x636290,white:0xedf9ff},
};

/** Owns only the art it creates. Shared collision meshes/transforms stay untouched. */
export function createPrArtKit(context:PrArtContext,palette:PrArtPalette=PR_ART_PALETTES[context.round.id]){
 const geometries:Record<PrArtPrimitive,THREE.BufferGeometry>={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,16),sphere:new THREE.IcosahedronGeometry(1,1),cone:new THREE.ConeGeometry(1,1,12),torus:new THREE.TorusGeometry(1,.035,5,40),hex:new THREE.CylinderGeometry(1,1,1,6)};
 const materials={} as Record<PrArtMaterial,THREE.MeshStandardMaterial>;
 for(const key of Object.keys(palette) as PrArtMaterial[])materials[key]=new THREE.MeshStandardMaterial({color:palette[key],roughness:key==="dark"?.7:.54,metalness:.16,emissive:palette[key],emissiveIntensity:key==="glow"?.65:0});
 const resources=new Set<THREE.BufferGeometry|THREE.Material|THREE.Texture>([...Object.values(geometries),...Object.values(materials)]);
 const nodes:THREE.Object3D[]=[],tiers=new Map<THREE.Object3D,number>();
 const batches=new Map<string,{parent:THREE.Object3D;primitive:PrArtPrimitive;material:PrArtMaterial;tier:number;features:{name:string;placement:PrArtPlacement;rotation:readonly[number,number,number]}[]}>();
 const dummy=new THREE.Object3D();let finished=false,disposed=false;
 const group=(name:string,parent:THREE.Object3D=context.root,tier=0)=>{const g=new THREE.Group();g.name=name;g.userData.cameraCollision=false;parent.add(g);nodes.push(g);tiers.set(g,tier);return g;};
 const add=(name:string,primitive:PrArtPrimitive,material:PrArtMaterial,placement:PrArtPlacement,parent:THREE.Object3D=context.root,rotation:readonly[number,number,number]=[0,0,0],tier=0):void=>{
  if(finished)throw Error("PlanetRun art is sealed");
  if(!placement.every(Number.isFinite)||placement.slice(3).some(v=>v<=0)||!rotation.every(Number.isFinite))throw Error(`Invalid PlanetRun art ${name}`);
  const key=`${parent.uuid}:${primitive}:${material}:${tier}`;let batch=batches.get(key);
  if(!batch){batch={parent,primitive,material,tier,features:[]};batches.set(key,batch);}batch.features.push({name,placement,rotation});
 };
 const label=(text:string,placement:PrArtPlacement,parent:THREE.Object3D=context.root)=>{
  if(typeof document==="undefined")return;
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=96;const ctx=canvas.getContext("2d");if(!ctx)return;
  ctx.fillStyle="#12233b";ctx.fillRect(0,0,512,96);ctx.fillStyle="#edf9ff";ctx.font="800 40px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,256,49,490);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;resources.add(texture);
  const mat=new THREE.MeshBasicMaterial({map:texture});resources.add(mat);const geometry=new THREE.PlaneGeometry(placement[3],placement[4]);resources.add(geometry);
  const mesh=new THREE.Mesh(geometry,mat);mesh.name=`pr-art-label:${text}`;mesh.position.set(placement[0],placement[1],placement[2]);parent.add(mesh);nodes.push(mesh);
 };
 return {materials,geometries,group,add,label,
  finish(){if(finished)return;finished=true;for(const b of batches.values()){
   const mesh=new THREE.InstancedMesh(geometries[b.primitive],materials[b.material],b.features.length);mesh.name=`pr-round-art:${b.primitive}:${b.material}`;mesh.userData.features=b.features;mesh.userData.cameraCollision=false;mesh.receiveShadow=true;
   b.features.forEach((f,i)=>{dummy.position.set(f.placement[0],f.placement[1],f.placement[2]);dummy.scale.set(f.placement[3],f.placement[4],f.placement[5]);dummy.rotation.set(...f.rotation);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.computeBoundingSphere();b.parent.add(mesh);nodes.push(mesh);tiers.set(mesh,b.tier);
  }batches.clear();},
  setQuality(q:PrArtQuality){const tier=q==="low"?0:q==="medium"?1:2;for(const [node,min]of tiers)node.visible=min<=tier;},
  dispose(){if(disposed)return;disposed=true;for(const node of nodes){if(node instanceof THREE.InstancedMesh)node.dispose();node.removeFromParent();}for(const r of resources)r.dispose();nodes.length=0;tiers.clear();batches.clear();resources.clear();},
 };
}
