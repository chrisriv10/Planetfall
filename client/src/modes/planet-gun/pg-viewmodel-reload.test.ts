import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {createPgViewmodel,PG_VIEWMODEL_LAYER} from "./pg-viewmodel";
import {PG_RELOAD_PROFILES,type PgPresentationWeapon} from "./pg-reload-art";
const state={ads:0,recoil:0,reload:0,speed:0,mode:"ground",time:0};
describe("PlanetGun authored first-person reload integration",()=>{
 for(const weapon of Object.keys(PG_RELOAD_PROFILES)as PgPresentationWeapon[])it(`${weapon} keeps its support hand attached to the extracted cell and clears its aim ray`,()=>{
  const vm=createPgViewmodel();vm.update({...state,weapon,reload:.45});vm.root.updateMatrixWorld(true);
  const cell=vm.root.getObjectByName(`pg-${weapon}-power-cell`)!,hand=vm.root.getObjectByName("support-glove")!,model=cell.parent!;
  const contactDistance=hand.getWorldPosition(new THREE.Vector3()).distanceTo(cell.getWorldPosition(new THREE.Vector3()));
  expect(contactDistance).toBeCloseTo((PG_RELOAD_PROFILES[weapon].width*.5+.07)*model.scale.x,5);
  expect(vm.getReloadPhase()).toBe("remove");
  for(let i=1;i<180;i++)vm.update({...state,weapon,ads:1,time:i*16});vm.root.updateMatrixWorld(true);
  expect(vm.getReloadPhase()).toBe("idle");const objects:THREE.Object3D[]=[];vm.root.traverseVisible(o=>{if(o instanceof THREE.Mesh&&!o.userData.pgOpticGlass)objects.push(o);});
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1));ray.layers.set(PG_VIEWMODEL_LAYER);expect(ray.intersectObjects(objects,false).map(h=>h.object.name)).toEqual([]);vm.dispose();
 });
 it("lowers the old weapon before revealing the new one, with exactly one model visible",()=>{
  const vm=createPgViewmodel(),visible=()=>vm.root.children[0].children.filter(o=>o.name.startsWith("br-weapon-")&&o.visible).map(o=>o.name);
  vm.update({...state,weapon:"pulse"});vm.update({...state,weapon:"rail",time:100});expect(visible()).toEqual(["br-weapon-pulse-rifle"]);
  vm.update({...state,weapon:"rail",time:150});expect(visible()).toEqual(["br-weapon-pulse-rifle"]);
  vm.update({...state,weapon:"rail",time:225});expect(visible()).toEqual(["br-weapon-rail-laser"]);
  vm.update({...state,weapon:"rail",time:450});expect(visible()).toEqual(["br-weapon-rail-laser"]);vm.dispose();
 });
});
