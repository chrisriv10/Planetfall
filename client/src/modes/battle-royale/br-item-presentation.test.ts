import { describe,expect,it } from "vitest";
import { BR_WEAPONS,type BrWeaponId } from "@planetfall/shared";
import * as THREE from "three";
import {buildBrWeaponModel} from "./br-weapons";
import {brLootModelSupportLift} from "./br-item-presentation";
import { brHeldWeaponTransform,brLootCategory,brLootSurfaceOffset,brLootWeaponTransform } from "./br-item-presentation";

describe("BR item presentation transforms",()=>{
  it("keeps every authored weapon above support through the full loot bob",()=>{
    for(const id of Object.keys(BR_WEAPONS) as BrWeaponId[]){
      const model=new THREE.Group();buildBrWeaponModel(model,id,0xffffff);
      const pose=brLootWeaponTransform(id);
      model.rotation.set(...pose.rotation);model.scale.setScalar(pose.scale);
      const lift=brLootModelSupportLift(model);
      const bounds=new THREE.Box3().setFromObject(model);
      expect(bounds.min.y+lift-.1,id).toBeGreaterThanOrEqual(.0699);
      const meshes=model.children as THREE.Mesh[];
      for(const g of new Set(meshes.map(m=>m.geometry)))g.dispose();
      for(const m of new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material])))m.dispose();
    }
  });
  it("defines finite held and loot transforms for every weapon",()=>{
    for(const id of Object.keys(BR_WEAPONS) as BrWeaponId[]){
      for(const transform of [brHeldWeaponTransform(id),brLootWeaponTransform(id)]){
        expect([...transform.position,...transform.rotation,transform.scale].every(Number.isFinite),id).toBe(true);
        expect(transform.scale).toBeGreaterThan(0);
      }
    }
  });
  it("uses compact right-hand-relative grip offsets, including the Arc Blaster",()=>{
    for(const id of Object.keys(BR_WEAPONS) as BrWeaponId[]){
      const [x,y,z]=brHeldWeaponTransform(id).position;
      expect(Math.abs(x),id).toBeLessThan(.15);
      expect(Math.abs(y),id).toBeLessThan(.22);
      expect(Math.abs(z),id).toBeLessThan(.22);
    }
    expect(brHeldWeaponTransform("arc-blaster").position).toEqual([.06,.14,-.12]);
  });
  it("anchors rarity fields to explicit floor and roof support heights",()=>{
    expect(brLootSurfaceOffset({position:{x:0,y:.58,z:0},surfaceY:0})).toBeCloseTo(-.555);
    expect(brLootSurfaceOffset({position:{x:0,y:18.65,z:0},surfaceY:18})).toBeCloseTo(-.625);
    expect(brLootSurfaceOffset({position:{x:0,y:.58,z:0}})).toBeCloseTo(-.555);
  });
  it("assigns stable shape categories without coupling rarity to the item model",()=>{
    expect(brLootCategory({itemId:"pulse-rifle"})).toBe("weapon");
    expect(brLootCategory({ammoType:"light"})).toBe("ammo");
    expect(brLootCategory({itemId:"shield-cell"})).toBe("shield");
    expect(brLootCategory({itemId:"med-kit"})).toBe("health");
    expect(brLootCategory({})).toBe("unknown");
  });
});
