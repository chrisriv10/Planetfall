import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { BR_HEALS, type BrHealId } from "@planetfall/shared";
import { brHealModelParts, BrHealModelLibrary } from "./br-heal-models";
import { brItemIconSvg } from "./br-item-art";

const ids=Object.keys(BR_HEALS) as BrHealId[];
describe("canonical held and ground heal presentation",()=>{
  it("gives all four real items distinct finite silhouettes matching their UI identity",()=>{
    const before=JSON.stringify(BR_HEALS),library=new BrHealModelLibrary();
    const dimensions:Record<string,THREE.Vector3>={};
    for(const id of ids){
      const parts=brHealModelParts(id),group=library.create(id);
      expect(parts.length).toBeLessThanOrEqual(9);expect(parts.length).toBeGreaterThanOrEqual(6);
      expect(brHealModelParts(id)).toEqual(parts);
      expect(new Set(parts.map(part=>part.name)).size).toBe(parts.length);
      for(const part of parts){
        expect([...part.position,...part.scale].every(Number.isFinite)).toBe(true);
        expect(part.scale.every(n=>n>0)).toBe(true);
      }
      const bounds=new THREE.Box3().setFromObject(group);dimensions[id]=bounds.getSize(new THREE.Vector3());
      expect(bounds.min.y).toBeGreaterThan(-.3);expect(bounds.max.y).toBeLessThan(.3);
      expect(dimensions[id].x).toBeLessThan(.7);expect(dimensions[id].z).toBeLessThan(.3);
      expect(group.children.every(mesh=>mesh.userData.cameraCollision===false)).toBe(true);
      const accent=id.startsWith("shield")?"#63d8ff":"#82e6ae";
      expect(brItemIconSvg(id)).toContain(accent);
      for(const mesh of group.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]){
        if(mesh.material.emissive.getHex()!==0){
          expect(mesh.material.emissiveIntensity).toBe(.2);
          expect(mesh.material.color.getHexString()).toBe(accent.slice(1));
          expect(mesh.scale.x*mesh.scale.y).toBeLessThan(.02); // small display, never a glowing shell
        }
      }
      group.removeFromParent();
    }
    expect(dimensions["med-kit"].z).toBeGreaterThan(dimensions["med-patch"].z*1.5);
    expect(dimensions["shield-battery"].x).toBeGreaterThan(dimensions["shield-cell"].x*2);
    expect(brHealModelParts("med-kit").filter(part=>part.name.startsWith("kit-handle"))).toHaveLength(3);
    expect(brHealModelParts("shield-cell").some(part=>part.geometry==="cylinder")).toBe(true);
    expect(JSON.stringify(BR_HEALS)).toBe(before);library.dispose();
  });
  it("shares only two geometries/four materials across repeated models and disposes each exactly once",()=>{
    const library=new BrHealModelLibrary(),models=Array.from({length:20},(_,i)=>library.create(ids[i%4]));
    const meshes=models.flatMap(group=>group.children as THREE.Mesh[]);
    const geometries=new Set(meshes.map(mesh=>mesh.geometry)),materials=new Set(meshes.map(mesh=>mesh.material as THREE.Material));
    expect(geometries.size).toBe(2);expect(materials.size).toBe(4);
    const disposal=[...geometries,...materials].map(resource=>vi.spyOn(resource,"dispose"));
    models[0].position.y=20;expect(models[4].position.y).toBe(0);
    models[0].children[0].scale.x=4;expect(models[4].children[0].scale.x).not.toBe(4);
    models.forEach(model=>model.clear());library.dispose();library.dispose();
    disposal.forEach(spy=>expect(spy).toHaveBeenCalledTimes(1));
    expect(()=>library.create("med-kit")).toThrow(/disposed/);
  });
});
