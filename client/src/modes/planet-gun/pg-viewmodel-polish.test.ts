import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import type {PgWeaponId} from "@planetfall/shared";
import {createPgViewmodel,PG_VIEWMODEL_LAYER} from "./pg-viewmodel";

const weapons:PgWeaponId[]=["pulse","nova","photon","quasar","rail","comet"];
function settle(vm:ReturnType<typeof createPgViewmodel>,weapon:PgWeaponId,ads=1){for(let i=0;i<180;i++)vm.update({weapon,ads,recoil:0,reload:0,speed:0,mode:"ground",time:i*1000/60});vm.root.updateMatrixWorld(true);}
describe("PlanetGun first-person composition",()=>{
  it("keeps all geometry and bounded unshadowed lighting exclusively in the viewmodel pass",()=>{
    const vm=createPgViewmodel();let lights=0;
    vm.root.traverse(o=>{expect(o.layers.mask).toBe(1<<PG_VIEWMODEL_LAYER);if(o instanceof THREE.Light){lights++;expect(o.castShadow).toBe(false);}if(o instanceof THREE.Mesh){expect(o.castShadow).toBe(false);expect(o.receiveShadow).toBe(false);}});
    expect(lights).toBe(2);vm.dispose();
  });
  it("projects a thin Rail optic at 150–190 pixels with usable glass and a clear precision region",()=>{
    const vm=createPgViewmodel();settle(vm,"rail");
    const camera=new THREE.PerspectiveCamera(34,1280/720,.01,100),rim=vm.root.getObjectByName("rail-scope-rear-open-rim-1")!;
    const bounds=new THREE.Box3().setFromObject(rim),a=bounds.min.clone().project(camera),b=bounds.max.clone().project(camera);
    const diameter=Math.abs(b.x-a.x)*640;expect(diameter).toBeGreaterThanOrEqual(150);expect(diameter).toBeLessThanOrEqual(190);
    const glass=vm.root.getObjectByName("pg-optic-glass")as THREE.Mesh;
    expect(glass.userData.pgOpticGlass).toBe(true);expect((glass.material as THREE.Material).transparent).toBe(true);expect((glass.material as THREE.Material).opacity).toBeLessThanOrEqual(.08);
    const ray=new THREE.Raycaster();ray.layers.set(PG_VIEWMODEL_LAYER);const meshes:THREE.Object3D[]=[];vm.root.traverseVisible(o=>{if(o instanceof THREE.Mesh&&!o.userData.pgOpticGlass)meshes.push(o);});
    for(const [x,y]of[[0,0],[35,0],[-35,0],[0,35],[0,-35],[25,25],[-25,-25]]){ray.setFromCamera(new THREE.Vector2(x/640,y/360),camera);expect(ray.intersectObjects(meshes,false).map(h=>h.object.name)).toEqual([]);}
    vm.dispose();
  });
  it("keeps visible supporting glove portions below the optic in settled Rail ADS",()=>{
    const vm=createPgViewmodel();settle(vm,"rail");const camera=new THREE.PerspectiveCamera(34,1280/720,.01,100);
    for(const name of["support-glove","trigger-glove"]){const box=new THREE.Box3().setFromObject(vm.root.getObjectByName(name)!);const top=new THREE.Vector3(box.max.x,box.max.y,box.min.z).project(camera);expect(top.y).toBeGreaterThan(-1);expect(top.y).toBeLessThan(-.1);expect(Math.abs(top.x)).toBeLessThan(1);}
    vm.dispose();
  });
  it("keeps the settled aim ray free across every weapon and gives long and compact weapons different poses",()=>{
    const poses=new Set<string>();for(const weapon of weapons){const vm=createPgViewmodel();settle(vm,weapon);const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1));ray.layers.set(PG_VIEWMODEL_LAYER);
      const meshes:THREE.Object3D[]=[];vm.root.traverseVisible(o=>{if(o instanceof THREE.Mesh&&!o.userData.pgOpticGlass)meshes.push(o);});expect(ray.intersectObjects(meshes,false)).toHaveLength(0);poses.add(vm.root.children[0].position.toArray().join(","));vm.dispose();}
    expect(poses.size).toBe(6);
  });
  it("bounds transitional poses, preserves resources through updates, and disposes owned geometry once",()=>{
    const vm=createPgViewmodel();settle(vm,"rail",0);const geometry=(vm.root.getObjectByName("glove-palm")as THREE.Mesh).geometry,dispose=vi.spyOn(geometry,"dispose");
    const materials=new Set<THREE.Material>();vm.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
    for(let i=0;i<120;i++){vm.update({weapon:weapons[Math.floor(i/20)],ads:(i%20)/19,recoil:.7,reload:.5,speed:11,mode:i%2?"sprint":"slide",time:3000+i*16});expect(vm.root.children[0].position.toArray().every(Number.isFinite)).toBe(true);expect(vm.root.children[0].position.z).toBeLessThan(-.35);}
    const after=new Set<THREE.Material>();vm.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])after.add(m);});expect(after).toEqual(materials);
    vm.dispose();vm.dispose();expect(dispose).toHaveBeenCalledTimes(1);
  });
});

describe("PlanetGun local muzzle anchor",()=>{
  it("tracks canonical tips through every weapon pose without leaking the camera world transform",()=>{
    const vm=createPgViewmodel(),camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3(9,8,7);
    expect(vm.getMuzzle(target)).toBe(false);expect(target.toArray()).toEqual([9,8,7]);
    camera.position.set(41,17,-23);camera.rotation.set(.4,1.2,-.2);camera.add(vm.root);
    vm.root.position.set(.01,-.02,.03);vm.root.rotation.set(.01,-.02,.03);
    let time=0;
    for(const weapon of weapons)for(const pose of[{ads:0,reload:0,speed:0,mode:"ground"},{ads:1,reload:0,speed:0,mode:"ground"},{ads:0,reload:0,speed:10,mode:"sprint"},{ads:.5,reload:.6,speed:4,mode:"slide"}]){
      for(let i=0;i<90;i++)vm.update({weapon,...pose,recoil:.2,time:time+=16});
      const model=vm.root.children[0].children.find(o=>o.name.startsWith("br-weapon-")&&o.visible)!;
      const anchor=(model.userData.muzzle as THREE.Vector3).clone();
      // Independently compose the local ancestor chain, including the root transform.
      const expected=anchor.clone();let part:THREE.Object3D|null=model;
      while(part&&part!==camera){part.updateMatrix();expected.applyMatrix4(part.matrix);part=part.parent;}
      expect(vm.getMuzzle(target)).toBe(true);expect(target.distanceTo(expected)).toBeLessThan(1e-10);expect(target.toArray().every(Number.isFinite)).toBe(true);
      expect((model.userData.muzzle as THREE.Vector3).toArray()).toEqual(anchor.toArray());
      camera.position.add(new THREE.Vector3(13,-7,4));camera.rotation.y+=.15;
      expect(vm.getMuzzle(target)).toBe(true);expect(target.distanceTo(expected)).toBeLessThan(1e-10);
    }
    camera.remove(vm.root);expect(vm.getMuzzle(target)).toBe(true);
    vm.dispose();expect(vm.getMuzzle(target)).toBe(false);
  });
});
