import * as THREE from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {weaponFinishForId,type PgModeDrop,type PgWeaponId,type WeaponFinishDefinition} from "@planetfall/shared";
import {createPgPreviewModels} from "./pg-kit-preview";

export const PG_DROP_ART_CAPACITY=48;

// Bake painted and unpainted surfaces into one draw without losing the finish
// swatch UVs, roughness, or metallic response on just the original painted parts.
function bakePickup(model:THREE.Group,finish:WeaponFinishDefinition|null){
 const pieces:THREE.BufferGeometry[]=[];
 let swatch:THREE.DataTexture|null=null;
 model.updateMatrixWorld(true);
 model.traverseVisible(part=>{
  if(!(part instanceof THREE.Mesh))return;
  const source=part.material as THREE.MeshStandardMaterial;
  const piece=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();
  piece.applyMatrix4(part.matrixWorld);
  const count=piece.getAttribute("position").count;
  if(!piece.getAttribute("normal"))piece.computeVertexNormals();
  if(!piece.getAttribute("uv"))piece.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(count*2),2));
  const patterned=Boolean(finish&&source.map instanceof THREE.DataTexture);
  if(patterned&&!swatch){
   const sourceMap=source.map as THREE.DataTexture;
   // The preview model rewrites its swatch when the next variant is baked.
   swatch=new THREE.DataTexture();swatch.copy(sourceMap);
   swatch.source=new THREE.Source({...sourceMap.image,data:(sourceMap.image.data as Uint8Array).slice()});
   swatch.needsUpdate=true;
  }
  const colors=new Float32Array(count*3),surface=new Float32Array(count*3);
  for(let i=0;i<count*3;i+=3){
   colors[i]=source.color.r;colors[i+1]=source.color.g;colors[i+2]=source.color.b;
   surface[i]=source.roughness??.5;surface[i+1]=source.metalness??.45;surface[i+2]=Number(patterned);
  }
  piece.setAttribute("color",new THREE.BufferAttribute(colors,3));
  piece.setAttribute("dropSurface",new THREE.BufferAttribute(surface,3));pieces.push(piece);
 });
 const geometry=mergeGeometries(pieces)!;for(const piece of pieces)piece.dispose();
 geometry.rotateZ(Math.PI/2);geometry.scale(.48,.48,.48);geometry.computeBoundingBox();
 const bounds=geometry.boundingBox!;
 geometry.translate(-(bounds.min.x+bounds.max.x)/2,.035-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);
 geometry.computeBoundingBox();
 const material=new THREE.MeshStandardMaterial({vertexColors:true,map:swatch});
 material.onBeforeCompile=shader=>{
  shader.vertexShader="attribute vec3 dropSurface; varying vec3 vDropSurface;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvDropSurface=dropSurface;");
  shader.fragmentShader="varying vec3 vDropSurface;\n"+shader.fragmentShader
   .replace("#include <map_fragment>","if(vDropSurface.z>.5){\n#include <map_fragment>\n}")
   .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor=vDropSurface.x;")
   .replace("#include <metalnessmap_fragment>","#include <metalnessmap_fragment>\nmetalnessFactor=vDropSurface.y;");
 };
 return new THREE.InstancedMesh(geometry,material,PG_DROP_ART_CAPACITY);
}

export function createPgModeDropArt(){
 const group=new THREE.Group();group.name="pg-weapon-drops";
 const models=createPgPreviewModels(),batches=new Map<string,ReturnType<typeof bakePickup>>();
 function getBatch(id:PgWeaponId,finishId:string|undefined){
  const finish=weaponFinishForId(finishId),key=finish?id+"-"+finish.id:id;
  let mesh=batches.get(key);
  if(!mesh){
   const model=models.get(id);
   model.finish.setFinish(finish);
   mesh=bakePickup(model.root,finish);
   mesh.name="pg-dropped-weapon-"+key;mesh.userData.weaponId=id;mesh.userData.finishId=finish?.id;
   mesh.userData.dropIds=Array(PG_DROP_ART_CAPACITY).fill("");mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   mesh.frustumCulled=false;mesh.count=0;batches.set(key,mesh);group.add(mesh);
  }
  return mesh;
 }
 const ring=new THREE.RingGeometry(.47,.5,24);ring.rotateX(-Math.PI/2);
 const glow=new THREE.MeshBasicMaterial({color:0x6bd9f2,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide});
 const markers=new THREE.InstancedMesh(ring,glow,PG_DROP_ART_CAPACITY);
 markers.name="pg-weapon-drop-markers";markers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 markers.frustumCulled=false;markers.count=0;group.add(markers);
 const pose=new THREE.Object3D();let disposed=false;
 return {group,
  update(drops:readonly PgModeDrop[]|null){
   if(disposed)return;
   for(const mesh of batches.values()){
    (mesh.userData.dropIds as string[]).fill("",0,mesh.count);mesh.count=0;mesh.visible=false;
   }
   markers.count=0;
   if(drops)for(const drop of drops){
    if(markers.count>=PG_DROP_ART_CAPACITY)break;
    if(drop.kind!=="weapon"||!drop.weapon)continue;
    const mesh=getBatch(drop.weapon,drop.finishId);
    pose.position.copy(drop.position);pose.scale.set(1,1,1);pose.updateMatrix();
    mesh.setMatrixAt(mesh.count,pose.matrix);mesh.userData.dropIds[mesh.count++]=drop.id;mesh.visible=true;
    pose.position.y+=.012;pose.scale.set(.65,1,1.15);pose.updateMatrix();markers.setMatrixAt(markers.count++,pose.matrix);
   }
   for(const mesh of batches.values())if(mesh.count)mesh.instanceMatrix.needsUpdate=true;
   if(markers.count)markers.instanceMatrix.needsUpdate=true;
   group.visible=markers.count>0;
  },
  dispose(){
   if(disposed)return;disposed=true;group.removeFromParent();group.clear();
   for(const mesh of batches.values()){
    mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();mesh.dispose();
   }
   batches.clear();models.dispose();markers.dispose();ring.dispose();glow.dispose();
  }
 };
}
