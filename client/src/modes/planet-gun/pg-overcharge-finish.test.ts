import * as THREE from "three";
import {describe,expect,it,vi} from "vitest";
import {PG_PRIMARY_WEAPONS} from "@planetfall/shared";
import {BrWeaponModelLibrary} from "../battle-royale/br-weapon-model-library";
import {createPgPreviewModels,PG_PREVIEW_MODELS} from "./pg-kit-preview";
import {createPgOverchargeFinish} from "./pg-overcharge-finish";

function meshes(root:THREE.Group){
  const parts:THREE.Mesh[]=[];
  root.traverse(node=>{if(node instanceof THREE.Mesh)parts.push(node);});
  return parts;
}
describe("Overcharge emitter finishes",()=>{
  it("covers the real emitters of all eight canonical primaries, preserves the model and shared resources, and restores every reference",()=>{
    const lib=new BrWeaponModelLibrary();
    for(const id of PG_PRIMARY_WEAPONS){
      const model=lib.create(PG_PREVIEW_MODELS[id]!,0xffffff),sibling=lib.create(PG_PREVIEW_MODELS[id]!,0xffffff);
      const parts=meshes(model),other=meshes(sibling),original=parts.map(p=>p.material);
      const oldColors=original.map(m=>(m as THREE.MeshStandardMaterial).color.getHex()),geos=parts.map(p=>p.geometry);
      const finish=createPgOverchargeFinish(model,id),variants=new Set<number>();
      let first:THREE.Material|null=null;
      for(const tier of [1,2,3] as const){
        finish.setTier(tier);finish.setTier(tier);
        const affected=parts.filter((p,i)=>p.material!==original[i]);
        expect(affected.length).toBeGreaterThan(0);expect(affected.length).toBeLessThan(parts.length);
        const clone=affected[0].material as THREE.MeshStandardMaterial;
        if(first)expect(clone).toBe(first);first=clone;variants.add(clone.color.getHex());
        expect(parts.map(p=>p.geometry)).toEqual(geos);
        for(let i=0;i<parts.length;i++){
          expect(other[i].material).toBe(original[i]);expect((other[i].material as THREE.MeshStandardMaterial).color.getHex()).toBe(oldColors[i]);
          if(/optic|scope|lens|grip|stock/.test(parts[i].name))expect(parts[i].material).toBe(original[i]);
        }
      }
      expect(variants.size).toBe(3);finish.setTier(0);expect(parts.map(p=>p.material)).toEqual(original);
      finish.setTier(3);const release=vi.spyOn(first!,"dispose");finish.dispose();finish.dispose();
      expect(release).toHaveBeenCalledOnce();expect(parts.every((p,i)=>p.material===original[i])).toBe(true);
    }
    lib.dispose();
  });
  it("also finishes the local service cell, preserves a later material override, and leaves sidearms standard",()=>{
    const models=createPgPreviewModels();
    const model=models.get("pulse").root,cell=model.getObjectByName("cell-energy-window") as THREE.Mesh;
    const original=cell.material,finish=createPgOverchargeFinish(model,"pulse");finish.setTier(2);expect(cell.material).not.toBe(original);
    const release=vi.spyOn(cell.material as THREE.Material,"dispose"),replacement=new THREE.MeshBasicMaterial();
    cell.material=replacement;finish.dispose();expect(cell.material).toBe(replacement);expect(release).toHaveBeenCalledOnce();
    for(const id of ["orbit","comet"] as const){
      const weapon=models.get(id).root,parts=meshes(weapon),materials=parts.map(p=>p.material);
      const polish=createPgOverchargeFinish(weapon,id);polish.setTier(3);expect(parts.every((p,i)=>p.material===materials[i])).toBe(true);polish.dispose();
    }
    replacement.dispose();models.dispose();
  });
});
