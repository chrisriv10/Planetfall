import * as THREE from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {weaponFinishForId,type PgModuleId,type PgWeaponId} from "@planetfall/shared";
import {createPgPreviewModels} from "./pg-kit-preview";
import {createPgOverchargeFinish} from "./pg-overcharge-finish";

type Tier=0|1|2|3;
const MODULE_BITS:Record<PgModuleId,number>={"reflex-array":1,"precision-lens":2,"gyro-stabilizer":4,"expanded-cell":8,"rapid-charge-cell":16,"lightweight-frame":32};
export function pgWorldWeaponModuleMask(modules:readonly PgModuleId[]|undefined){
 let mask=0;if(modules)for(const id of modules)mask|=MODULE_BITS[id];return mask;
}

function bakeWorldWeapon(models:ReturnType<typeof createPgPreviewModels>,weapon:PgWeaponId,modules:readonly PgModuleId[],finishId:string|undefined,tier:Tier){
 const model=models.get(weapon),root=new THREE.Group();root.name=model.root.name;
 model.modules.setModules(modules);model.finish.setFinish(weaponFinishForId(finishId));
 const overcharge=createPgOverchargeFinish(model.root,weapon);overcharge.setTier(tier);model.root.updateMatrixWorld(true);
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),textures=new Map<THREE.DataTexture,THREE.DataTexture>();
 const materials=new Map<THREE.Material,THREE.Material>();
 function ownedMaterial(source:THREE.Material){
  let material=materials.get(source);if(material)return material;
  material=source.clone();materials.set(source,material);
  if(material instanceof THREE.MeshStandardMaterial&&material.map instanceof THREE.DataTexture){
   const map=material.map;let copy=textures.get(map);
   if(!copy){copy=map.clone();copy.source=new THREE.Source({...map.image,data:(map.image.data as Uint8Array).slice()});copy.needsUpdate=true;textures.set(map,copy);}
   material.map=copy;
  }
  return material;
 }
 const geometries:THREE.BufferGeometry[]=[];
 model.root.traverseVisible(part=>{
  if(!(part instanceof THREE.Mesh))return;
  const material=ownedMaterial(part.material);
  if(material.transparent){
   // Preserve the lens transform and sorting origin.
   const geometry=part.geometry.clone(),lens=new THREE.Mesh(geometry,material);
   part.matrixWorld.decompose(lens.position,lens.quaternion,lens.scale);
   root.add(lens);geometries.push(geometry);
  }else{
   const geometry=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();
   geometry.applyMatrix4(part.matrixWorld);
   if(!geometry.getAttribute("uv"))geometry.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(geometry.getAttribute("position").count*2),2));
   let batch=batches.get(material);if(!batch){batch=[];batches.set(material,batch);}batch.push(geometry);
  }
 });
 for(const [material,pieces] of batches){
  const geometry=mergeGeometries(pieces)!;for(const p of pieces)p.dispose();
  const mesh=new THREE.Mesh(geometry,material);mesh.userData.pgSharedWorldWeapon=true;
  root.add(mesh);geometries.push(geometry);
 }
 overcharge.dispose();
 return {root,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}

// One canonical source per weapon across pilots. Mounted rigs own transforms
// only. Retain a few recently holstered variants to avoid rebuilding on swaps.
type Variant=ReturnType<typeof bakeWorldWeapon>&{refs:number};
let users=0,models:ReturnType<typeof createPgPreviewModels>|undefined;
const variants=new Map<string,Variant>(),noModules:readonly PgModuleId[]=[];
function trimCache(){
 let idle=0;
 for(const variant of variants.values())if(!variant.refs)idle++;
 for(const [key,variant] of variants){
  if(idle<=8)return;
  if(!variant.refs){variants.delete(key);variant.dispose();idle--;}
 }
}
export function createPgWorldWeaponMount(parent:THREE.Group){
 users++;let current:Variant|undefined,mounted:THREE.Group|undefined,disposed=false;
 let lastId:PgWeaponId|undefined,lastMask=-1,lastFinish:string|undefined,lastTier:Tier=0;
 function unmount(){
  mounted?.removeFromParent();mounted=undefined;
  if(current){current.refs--;current=undefined;}
 }
 return {
  set(id:PgWeaponId,modules:readonly PgModuleId[]|undefined,finishId:string|undefined,tier:Tier){
   if(disposed)return;
   const mask=pgWorldWeaponModuleMask(modules);
   if(lastId===id&&lastMask===mask&&lastFinish===finishId&&lastTier===tier)return;
   lastId=id;lastMask=mask;lastFinish=finishId;lastTier=tier;unmount();
   const finish=weaponFinishForId(finishId),key=id+"|"+mask+"|"+(finish?.id??"default")+"|"+tier;
   let variant=variants.get(key);
   if(!variant){
    models??=createPgPreviewModels();
    variant={...bakeWorldWeapon(models,id,modules??noModules,finish?.id,tier),refs:0};
   }else variants.delete(key);
   variants.set(key,variant);variant.refs++;current=variant;
   mounted=variant.root.clone();mounted.scale.setScalar(.48);parent.add(mounted);
   trimCache();
  },
  dispose(){
   if(disposed)return;disposed=true;unmount();users--;
   if(!users){for(const variant of variants.values())variant.dispose();variants.clear();models?.dispose();models=undefined;}else trimCache();
  },
 };
}
