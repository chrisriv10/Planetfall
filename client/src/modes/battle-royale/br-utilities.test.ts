import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {BR_UTILITIES} from "@planetfall/shared";
import {buildBrUtilityModel,BrUtilityModelLibrary} from "./br-utilities";
import {brLootModelSupportLift,brLootCategory} from "./br-item-presentation";

describe("authored utility devices",()=>{
  it("clones independent transforms with borrowed resources and exact-once library disposal",()=>{
    const library=new BrUtilityModelLibrary();
    const resources=new Set<THREE.BufferGeometry|THREE.Material>();
    for(const id of Object.keys(BR_UTILITIES) as (keyof typeof BR_UTILITIES)[]){
      const a=library.create(id),b=library.create(id);
      expect(a.userData.borrowedUtilityResources).toBe(true);
      for(let i=0;i<a.children.length;i++){
        const x=a.children[i] as THREE.Mesh,y=b.children[i] as THREE.Mesh;
        expect(x).not.toBe(y);expect(x.geometry).toBe(y.geometry);expect(x.material).toBe(y.material);
        resources.add(x.geometry);resources.add(x.material as THREE.Material);
        x.position.x+=5;expect(x.position.x).not.toBe(y.position.x);
      }
    }
    const spies=[...resources].map(r=>vi.spyOn(r,"dispose"));
    library.dispose();library.dispose();for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);
    expect(()=>library.create("grav-coil")).toThrow(/disposed/);
  });
  it("gives all utilities distinct equipment, bounded shared resources, and safe support lift",()=>{
    const signatures=new Set<string>();
    for(const id of Object.keys(BR_UTILITIES) as (keyof typeof BR_UTILITIES)[]){
      const group=new THREE.Group();buildBrUtilityModel(group,id);
      expect(group.children.length).toBeGreaterThanOrEqual(6);
      expect(group.children.length).toBeLessThanOrEqual(10);
      const parts=group.children as THREE.Mesh[];
      expect(new Set(parts.map(p=>p.geometry)).size).toBe(1);
      expect(new Set(parts.map(p=>p.material)).size).toBe(3);
      signatures.add(parts.map(p=>p.name).join(","));
      const box=new THREE.Box3().setFromObject(group);
      expect(box.getSize(new THREE.Vector3()).length()).toBeLessThan(1);
      expect(box.min.y+brLootModelSupportLift(group)-.08).toBeGreaterThan(0);
      expect(brLootCategory({itemId:id})).toBe("utility");
      for(const g of new Set(parts.map(p=>p.geometry)))g.dispose();
      for(const m of new Set(parts.map(p=>p.material as THREE.Material)))m.dispose();
    }
    expect(signatures.size).toBe(4);
  });
});
