import * as THREE from "three";
import {PG_PRIMARY_WEAPONS,type PgWeaponId} from "@planetfall/shared";

type Tier = 0|1|2|3;
const finishes = {
  1: {color:0x53decf,emissive:0x32d9cf,intensity:.55},
  2: {color:0xc49afa,emissive:0xb56af7,intensity:.73},
  3: {color:0xffda85,emissive:0xffaf46,intensity:.93},
} as const;

/** Attach to the actual weapon model, after its normal materials and hardware are in place. */
export function createPgOverchargeFinish(root:THREE.Group,weaponId:PgWeaponId) {
  const channels:{mesh:THREE.Mesh;original:THREE.MeshStandardMaterial}[]=[];
  const clones=new Map<THREE.MeshStandardMaterial,THREE.MeshStandardMaterial>();
  if(PG_PRIMARY_WEAPONS.some(id=>id===weaponId)){
    root.traverse(node=>{
      if(!(node instanceof THREE.Mesh) || !(node.material instanceof THREE.MeshStandardMaterial))return;
      // The canonical barrel channels on Pulse, Nova, Photon, Quasar, Arc and
      // Rail are unnamed direct meshes with a dedicated emissive finish.
      const barrel=node.parent===root && node.name==="" && node.material.emissive.getHex()!==0;
      const channel=node.name==="cell-energy-window" || node.name==="helix-channel" ||
        node.name==="prism-crystal" || node.name==="prism-focus-tip";
      if(barrel||channel)channels.push({mesh:node,original:node.material});
    });
  }
  let tier:Tier=0,disposed=false;
  function setTier(next:Tier){
    if(disposed || tier===next)return;
    tier=next;
    for(const {mesh,original} of channels){
      let clone=clones.get(original);
      // Another presentation layer may have taken ownership since attachment.
      if(mesh.material!==original && mesh.material!==clone)continue;
      if(next===0){mesh.material=original;continue;}
      if(!clone){clone=original.clone();clones.set(original,clone);}
      const finish=finishes[next];
      clone.color.setHex(finish.color);clone.emissive.setHex(finish.emissive);clone.emissiveIntensity=finish.intensity;
      mesh.material=clone;
    }
  }
  return {setTier,dispose(){
    if(disposed)return;
    setTier(0);disposed=true;
    for(const material of clones.values())material.dispose();
    clones.clear();channels.length=0;
  }};
}
