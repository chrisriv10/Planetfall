import * as THREE from "three";
export type PgArtMaterial="ivory"|"frame"|"dark"|"glass"|"soil"|"leaf"|"cyan"|"amber"|"violet"|"paving";
export type PgArtPrimitive="box"|"cylinder"|"sphere"|"cone"|"torus";
export type PgArtPlacement=readonly[number,number,number,number,number,number];
export interface PgArtContext {
 add(name:string,primitive:PgArtPrimitive,material:PgArtMaterial,placement:PgArtPlacement,rotation?:readonly[number,number,number],detail?:boolean):void;
}
/** Static authored instances share geometry/materials across all districts. */
export function createPgEnvironmentBuilder(materials:Record<PgArtMaterial,THREE.Material>){
 const root=new THREE.Group(),detail=new THREE.Group();root.name="nova-neighborhood-art";detail.name="neighborhood-secondary-detail";root.add(detail);
 const geometries:Record<PgArtPrimitive,THREE.BufferGeometry>={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,12),sphere:new THREE.SphereGeometry(1,10,7),cone:new THREE.ConeGeometry(1,1,10),torus:new THREE.TorusGeometry(1,.045,4,32)};
 const batches=new Map<string,{primitive:PgArtPrimitive;material:PgArtMaterial;detail:boolean;features:{name:string;placement:PgArtPlacement;rotation:readonly[number,number,number]}[]}>();
 const context:PgArtContext={add(name,primitive,material,placement,rotation=[0,0,0],secondary=false){
  if(!placement.every(Number.isFinite)||placement.slice(3).some(v=>v<=0)||!rotation.every(Number.isFinite))throw Error(`Invalid neighborhood art: ${name}`);
  const key=`${primitive}:${material}:${secondary}`;let batch=batches.get(key);if(!batch){batch={primitive,material,detail:secondary,features:[]};batches.set(key,batch);}batch.features.push({name,placement,rotation});
 }};
 let built=false,disposed=false;
 return {root,context,finish(){if(built)return;built=true;const dummy=new THREE.Object3D();for(const [key,b]of batches){const mesh=new THREE.InstancedMesh(geometries[b.primitive],materials[b.material],b.features.length);mesh.name=`neighborhood:${key}`;mesh.userData.features=b.features;mesh.receiveShadow=true;mesh.userData.cameraCollision=false;b.features.forEach((f,i)=>{dummy.position.set(...f.placement.slice(0,3)as[number,number,number]);dummy.scale.set(...f.placement.slice(3)as[number,number,number]);dummy.rotation.set(...f.rotation);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.computeBoundingSphere();(b.detail?detail:root).add(mesh);}batches.clear();},setQuality(q:"low"|"medium"|"high"){detail.visible=q!=="low";},dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});for(const g of Object.values(geometries))g.dispose();root.clear();batches.clear();}};
}
