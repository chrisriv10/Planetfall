import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BR_WEAPONS, type BrWeaponId } from "@planetfall/shared";
import { buildBrWeaponModel } from "./br-weapons";

function release(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  for (const mesh of group.children as THREE.Mesh[]) {
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  }
  materials.forEach(material => material.dispose());
}
describe("BR weapon presentation models", () => {
  it("retains every authoritative-facing muzzle and a bounded finite model/material budget", () => {
    const muzzle: Record<BrWeaponId, number[]> = {
      "pulse-rifle": [0,.02,-1.9], "nova-smg": [0,.03,-1.2], "photon-shotgun": [0,.03,-1.6],
      "rail-laser": [0,.08,-2.08], "plasma-launcher": [0,.02,-1.65], "arc-blaster": [0,.04,-1.56], "energy-saber": [0,0,-1.7],
    };
    const before=JSON.stringify(BR_WEAPONS);
    for (const id of Object.keys(BR_WEAPONS) as BrWeaponId[]) {
      const group=new THREE.Group(); buildBrWeaponModel(group,id,0x8877ff);
      expect(group.userData.muzzle.toArray()).toEqual(muzzle[id]);
      expect(group.children.length).toBeLessThanOrEqual(24);
      const materials=new Set<THREE.Material>();
      for (const mesh of group.children as THREE.Mesh[]) {
        expect(mesh).toBeInstanceOf(THREE.Mesh);
        expect([...mesh.position.toArray(),...mesh.scale.toArray(),mesh.rotation.x,mesh.rotation.y,mesh.rotation.z].every(Number.isFinite)).toBe(true);
        expect(mesh.scale.toArray().every(value=>value>0)).toBe(true);
        const material=mesh.material as THREE.Material; materials.add(material);
        if(material instanceof THREE.MeshStandardMaterial&&material.emissive.getHex()!==0)expect(material.emissiveIntensity).toBeLessThanOrEqual(.42);
      }
      expect(materials.size).toBeLessThanOrEqual(5);
      const bounds=new THREE.Box3().setFromObject(group);
      expect(bounds.min.x).toBeGreaterThan(-.65);expect(bounds.max.x).toBeLessThan(.65);
      expect(bounds.min.y).toBeGreaterThan(-.65);expect(bounds.max.y).toBeLessThan(.65);
      expect(bounds.min.z).toBeGreaterThan(-2.15);expect(bounds.max.z).toBeLessThan(.9);
      const second=new THREE.Group();buildBrWeaponModel(second,id,0x8877ff);
      expect(second.children.map(mesh=>[mesh.name,...mesh.position.toArray()])).toEqual(group.children.map(mesh=>[mesh.name,...mesh.position.toArray()]));
      release(group);release(second);
    }
    expect(JSON.stringify(BR_WEAPONS)).toBe(before);
  });

  it("gives each firearm a distinct sight/handling silhouette, with an open Pulse sight",()=>{
    const required:Partial<Record<BrWeaponId,string[]>>={
      "pulse-rifle":["pulse-optic-left","pulse-optic-right","pulse-optic-bridge","pulse-optic-emitter","pulse-handguard-seam"],
      "nova-smg":["smg-stock-strut","smg-stock-pad","smg-front-sight","smg-rear-sight"],
      "photon-shotgun":["shotgun-pump","shotgun-pump-rib","shotgun-front-bead"],
      "rail-laser":["rail-scope-body","rail-scope-front","rail-scope-rear","rail-scope-lens","rail-cheek-rest"],
    };
    for(const [id,names]of Object.entries(required)){
      const group=new THREE.Group();buildBrWeaponModel(group,id as BrWeaponId,0x777777);
      for(const name of names)expect(group.getObjectByName(name)).toBeDefined();
      if(id==="pulse-rifle"){
        const left=group.getObjectByName("pulse-optic-left") as THREE.Mesh<THREE.BoxGeometry>;
        const right=group.getObjectByName("pulse-optic-right") as THREE.Mesh<THREE.BoxGeometry>;
        expect(right.position.x-left.position.x-left.geometry.parameters.width).toBeGreaterThan(.12);
      }
      if(id==="rail-laser")expect((group.getObjectByName("rail-scope-body") as THREE.Mesh).geometry).toBeInstanceOf(THREE.CylinderGeometry);
      release(group);
    }
  });

  it("uses a non-emissive plasma chamber with restrained accent windows instead of a glowing sphere",()=>{
    const group=new THREE.Group();buildBrWeaponModel(group,"plasma-launcher",0xff55ff);
    const chamber=group.getObjectByName("plasma-pressure-chamber") as THREE.Mesh<THREE.SphereGeometry,THREE.MeshStandardMaterial>;
    expect(chamber.material.emissive.getHex()).toBe(0);
    const windows=group.children.filter(mesh=>mesh.name==="plasma-chamber-window") as THREE.Mesh<THREE.BoxGeometry,THREE.MeshStandardMaterial>[];
    expect(windows).toHaveLength(2);
    expect(windows[0].material).toBe(windows[1].material);
    expect(windows[0].material.emissiveIntensity).toBe(.42);
    for(const window of windows)expect(window.geometry.parameters.height*window.geometry.parameters.depth).toBeLessThan(.025);
    release(group);
  });
});
