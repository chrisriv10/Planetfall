import {describe,expect,it} from "vitest";
import * as THREE from "three";
import {DEFAULT_COSMETICS,WEAPON_FINISHES,PG_WEAPONS,pgCreateGun,type PgSnapshotPlayer,type PgWeaponId} from "@planetfall/shared";
import {createPgViewmodel} from "./pg-viewmodel";
import {createPgPilotPresentation} from "./pg-pilot-presentation";
import {createPgPreviewModels} from "./pg-kit-preview";
import {createAstronautVisual} from "../../astronaut";

const colors=(root:THREE.Object3D)=>{const result:number[]=[];root.traverseVisible(part=>{if(part instanceof THREE.Mesh&&part.material instanceof THREE.MeshStandardMaterial)result.push(part.material.color.getHex());});return result;};
describe("equipped weapon cosmetics",()=>{
 it("uses the canonical finish on first-person, remote and preview weapons, without changing weapon data",()=>{
  const original=JSON.stringify(PG_WEAPONS),vm=createPgViewmodel(),previews=createPgPreviewModels();
  const rig=createAstronautVisual({identityColor:"#fff",suitAccent:"#aaa",isBot:false}),remote=createPgPilotPresentation(rig);
  const state={hp:100,slot:0,pitch:0,grounded:true,mode:"ground",yaw:0,lean:0,adsSince:0,equippedCosmetics:{...DEFAULT_COSMETICS}} as PgSnapshotPlayer;
  let time=0;
  try{for(const weapon of Object.keys(PG_WEAPONS)as PgWeaponId[])for(const finish of WEAPON_FINISHES){
   state.guns=[pgCreateGun(weapon),pgCreateGun("orbit")];state.equippedCosmetics["weapon-skin"]=finish.id;
   for(let i=0;i<15;i++)vm.update({weapon,finishId:finish.id,ads:0,recoil:0,reload:0,speed:0,mode:"ground",time:time+=16});
   remote.update(state,time);const preview=previews.get(weapon);preview.finish.setFinish(finish);
   for(const [label,root]of [["local",vm.root],["remote",rig.upperBody],["preview",preview.root]]as const){
    expect(colors(root),`${weapon} ${finish.id} ${label}`).toContain(new THREE.Color(finish.body).getHex());
   }
  }
  expect(JSON.stringify(PG_WEAPONS)).toBe(original);
  state.equippedCosmetics["weapon-skin"]="default";remote.update(state,time);expect(colors(rig.upperBody)).not.toContain(new THREE.Color(WEAPON_FINISHES.at(-1)!.body).getHex());
  }finally{remote.dispose();vm.dispose();previews.dispose();}
 });
});
