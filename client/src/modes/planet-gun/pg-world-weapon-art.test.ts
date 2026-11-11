import {describe,expect,it,vi} from "vitest";
import * as THREE from "three";
import {WEAPON_FINISHES,type PgModuleId,type PgWeaponId} from "@planetfall/shared";
import {createPgPreviewModels,PG_PREVIEW_MODELS} from "./pg-kit-preview";
import {createPgOverchargeFinish} from "./pg-overcharge-finish";
import {createPgWorldWeaponMount} from "./pg-world-weapon-art";
import {createPgPilotBatches} from "./pg-pilot-batches";
import {createAstronautVisual} from "../../astronaut";

const modules:PgModuleId[]=["reflex-array","precision-lens","gyro-stabilizer","expanded-cell","rapid-charge-cell","lightweight-frame"];
function surfaces(root:THREE.Group){
 const totals=new Map<string,number>();
 root.traverseVisible(part=>{
  if(!(part instanceof THREE.Mesh))return;
  const m=part.material as THREE.MeshStandardMaterial;
  const pattern=m.map instanceof THREE.DataTexture?(m.map.image.data as Uint8Array).join(","):"";
  const key=[m.type,m.color?.getHex(),m.emissive?.getHex(),m.emissiveIntensity,m.metalness,m.roughness,m.transparent,m.opacity,m.side,pattern].join("|");
  totals.set(key,(totals.get(key)??0)+(part.geometry.index??part.geometry.getAttribute("position")).count);
 });
 return totals;
}

describe("compact world weapon",()=>{
 it("fits eleven equipped astronauts in the near-pilot geometry and instance budget",()=>{
  const pool=createPgPilotBatches(),mounts:ReturnType<typeof createPgWorldWeaponMount>[]=[];
  try{
   for(let i=0;i<11;i++){
    const rig=createAstronautVisual({identityColor:"#ffb45c",suitAccent:"#aabbcc",isBot:true});
    const mount=createPgWorldWeaponMount(rig.upperBody);mounts.push(mount);
    mount.set(i%2?"rail":"pulse",["precision-lens","expanded-cell"],WEAPON_FINISHES[i%2].id,3);
    rig.group.updateMatrixWorld(true);expect(pool.register(rig.group).accepted).toBe(true);pool.submit(rig.group);
   }
   pool.flush();
   let bytes=0;
   for(const mesh of pool.group.children)if(mesh instanceof THREE.Mesh){
    for(const a of Object.values(mesh.geometry.attributes))if(a instanceof THREE.BufferAttribute)bytes+=a.array.byteLength;
    bytes+=mesh.geometry.index?.array.byteLength??0;
    if(mesh instanceof THREE.InstancedMesh)bytes+=mesh.instanceMatrix.array.byteLength+(mesh.instanceColor?.array.byteLength??0);
   }
   expect(bytes).toBeLessThan(8*1024*1024);
   console.info(`Eleven canonical equipped pilots used ${bytes} batch bytes and ${pool.group.children.length} batch/proxy meshes`);
  }finally{pool.dispose();mounts.forEach(m=>m.dispose());}
 });
 it("batches shared opaque weapon parts while separating different finishes and render layers",()=>{
  const pool=createPgPilotBatches(),roots=Array.from({length:4},()=>new THREE.Group());
  const mounts=roots.map(createPgWorldWeaponMount);
  try{
   mounts.forEach((mount,i)=>mount.set("pulse",["expanded-cell"],WEAPON_FINISHES[i===2?1:0].id,1));
   roots[3].traverse(o=>o.layers.set(2));
   roots.forEach(root=>{
    expect(pool.register(root).accepted).toBe(true);root.updateMatrixWorld(true);pool.submit(root);
   });
   pool.flush();
   const batches=pool.group.children.filter((o):o is THREE.InstancedMesh=>o instanceof THREE.InstancedMesh);
   expect(batches.some(mesh=>mesh.count===2 && mesh.layers.mask===1)).toBe(true);
   expect(batches.some(mesh=>mesh.count===1 && mesh.layers.mask===1)).toBe(true);
   expect(batches.some(mesh=>mesh.count===1 && mesh.layers.mask===4)).toBe(true);
   expect(Math.max(...batches.map(mesh=>mesh.count))).toBe(2);
  }finally{pool.dispose();mounts.forEach(mount=>mount.dispose());}
 });
 it.each(Object.keys(PG_PREVIEW_MODELS) as PgWeaponId[])("keeps the canonical visible hardware and materials for %s",weapon=>{
  const models=createPgPreviewModels(),holder=new THREE.Group(),mount=createPgWorldWeaponMount(holder);
  try{
   const source=models.get(weapon),upgrade=createPgOverchargeFinish(source.root,weapon);
   for(const [i,finish] of WEAPON_FINISHES.entries()){
    const selected=[modules[i]],tier=([1,2,3] as const)[i%3];
    source.modules.setModules(selected);source.finish.setFinish(finish);upgrade.setTier(tier);
    mount.set(weapon,selected,finish.id,tier);
    expect(holder.children).toHaveLength(1);
    const compact=holder.children[0] as THREE.Group;
    expect(compact.scale.toArray()).toEqual([.48,.48,.48]);
    expect(compact.children.length).toBeLessThanOrEqual(40);
    expect(surfaces(compact)).toEqual(surfaces(source.root));
   }
   upgrade.dispose();
  }finally{mount.dispose();models.dispose();}
 });
 it("shares immutable geometry across pilots and protects a mounted finish during eviction",()=>{
  const a=new THREE.Group(),b=new THREE.Group(),first=createPgWorldWeaponMount(a),second=createPgWorldWeaponMount(b);
  try{
   const attachments:PgModuleId[]=["precision-lens","expanded-cell"];
   first.set("pulse",attachments,WEAPON_FINISHES[0].id,2);
   second.set("pulse",[...attachments].reverse(),WEAPON_FINISHES[0].id,2);
   const active=a.children[0] as THREE.Group,other=b.children[0] as THREE.Group;
   const mesh=active.children[0] as THREE.Mesh;
   expect(mesh.geometry).toBe((other.children[0] as THREE.Mesh).geometry);
   const disposed=vi.fn();mesh.geometry.addEventListener("dispose",disposed);
   const original=surfaces(active);
   for(const id of Object.keys(PG_PREVIEW_MODELS) as PgWeaponId[])second.set(id,[],WEAPON_FINISHES[1].id,1);
   second.dispose();expect(disposed).not.toHaveBeenCalled();expect(surfaces(active)).toEqual(original);
   first.dispose();expect(disposed).toHaveBeenCalledTimes(1);
  }finally{first.dispose();second.dispose();}
 });
});
