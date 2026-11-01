import * as THREE from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {BrWeaponId,PgModeDrop,PgWeaponId} from "@planetfall/shared";
import {BrWeaponModelLibrary} from "../battle-royale/br-weapon-model-library";
import {createPgOrbitModel} from "./pg-weapon-presentation";

export const PG_DROP_ART_CAPACITY=48;
const MODELS:Record<Exclude<PgWeaponId,"orbit">,BrWeaponId>={pulse:"pulse-rifle",nova:"nova-smg",photon:"photon-shotgun",quasar:"quasar-carbine",rail:"rail-laser",comet:"comet-hand-cannon",helix:"helix-burst-rifle",arc:"arc-blaster",prism:"prism-beam"};
/** Bake the canonical world models once into color-preserving pickup instances.
 * Authoritative settled positions remain the root anchors; only model-local
 * orientation is changed to lay each recognizable weapon on its side. */
export function createPgModeDropArt(){
 const group=new THREE.Group();group.name="pg-weapon-drops";
 const library=new BrWeaponModelLibrary(),box=new THREE.BoxGeometry(1,1,1),orbitMaterials:THREE.Material[]=[new THREE.MeshStandardMaterial({color:0x91a7b3}),new THREE.MeshStandardMaterial({color:0x263c48}),new THREE.MeshStandardMaterial({color:0x14222c})];
 const material=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.45,roughness:.5}),batches=new Map<PgWeaponId,THREE.InstancedMesh>(),geometries:THREE.BufferGeometry[]=[];
 for(const id of [...Object.keys(MODELS),"orbit"] as PgWeaponId[]){
  const model=id==="orbit"?createPgOrbitModel({box,metal:orbitMaterials[0],composite:orbitMaterials[1],grip:orbitMaterials[2],ownMaterial:m=>{orbitMaterials.push(m);return m;}}):library.create(MODELS[id],0x65d8f2);
  model.updateMatrixWorld(true);const pieces:THREE.BufferGeometry[]=[];
  model.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geometry.applyMatrix4(o.matrixWorld);geometry.deleteAttribute("uv");if(!geometry.getAttribute("normal"))geometry.computeVertexNormals();const source=Array.isArray(o.material)?o.material[0]:o.material,color=(source as THREE.MeshStandardMaterial).color??new THREE.Color(0x90a3bd),colors=new Float32Array(geometry.getAttribute("position").count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));pieces.push(geometry);});
  const geometry=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());geometry.rotateZ(Math.PI/2);geometry.scale(.48,.48,.48);geometry.computeBoundingBox();const bounds=geometry.boundingBox!;geometry.translate(-(bounds.min.x+bounds.max.x)/2,.035-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);geometry.computeBoundingBox();geometries.push(geometry);
  const mesh=new THREE.InstancedMesh(geometry,material,PG_DROP_ART_CAPACITY);mesh.name=`pg-dropped-weapon-${id}`;mesh.userData.weaponId=id;mesh.userData.dropIds=Array(PG_DROP_ART_CAPACITY).fill("");mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;batches.set(id,mesh);group.add(mesh);
 }
 library.dispose();box.dispose();orbitMaterials.forEach(m=>m.dispose());
 const ring=new THREE.RingGeometry(.47,.5,24);ring.rotateX(-Math.PI/2);const glow=new THREE.MeshBasicMaterial({color:0x6bd9f2,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide}),markers=new THREE.InstancedMesh(ring,glow,PG_DROP_ART_CAPACITY);markers.name="pg-weapon-drop-markers";markers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);markers.frustumCulled=false;markers.count=0;group.add(markers);
 const pose=new THREE.Object3D();let disposed=false;
 return {group,
  update(drops:readonly PgModeDrop[]|null){if(disposed)return;for(const mesh of batches.values()){mesh.count=0;(mesh.userData.dropIds as string[]).fill("");}markers.count=0;let shown=0;
   if(drops)for(const drop of drops){if(shown>=PG_DROP_ART_CAPACITY)break;if(drop.kind!=="weapon"||!drop.weapon)continue;const mesh=batches.get(drop.weapon);if(!mesh)continue;pose.position.copy(drop.position);pose.scale.set(1,1,1);pose.updateMatrix();mesh.setMatrixAt(mesh.count,pose.matrix);mesh.userData.dropIds[mesh.count]=drop.id;mesh.count++;pose.position.y+=.012;pose.scale.set(.65,1,1.15);pose.updateMatrix();markers.setMatrixAt(markers.count++,pose.matrix);shown++;}
   for(const mesh of batches.values())mesh.instanceMatrix.needsUpdate=true;markers.instanceMatrix.needsUpdate=true;group.visible=shown>0;
  },
  dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.clear();for(const mesh of batches.values())mesh.dispose();geometries.forEach(g=>g.dispose());material.dispose();markers.dispose();ring.dispose();glow.dispose();}
 };
}
