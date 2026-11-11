import * as THREE from "three";
import {describe,expect,it,vi} from "vitest";
import {PG_WEAPONS,type PgWeaponId} from "@planetfall/shared";
import {createPgPreviewModels} from "./pg-kit-preview";
import {createPgOverchargeFinish} from "./pg-overcharge-finish";
import {createPgWeaponFinishArt,type PgWeaponFinishDescriptor} from "./pg-weapon-finish-art";

const sample:PgWeaponFinishDescriptor={id:"solar",body:"#bb8254",inset:"#314557",accent:"#ffd799",metalness:.62,roughness:.33,pattern:"brushed"};
function meshes(root:THREE.Group){
  const parts:THREE.Mesh[]=[];root.traverse(n=>{if(n instanceof THREE.Mesh)parts.push(n);});return parts;
}
describe("cosmetic weapon finishes",()=>{
  it("paints all ten real models locally, preserves sights, energy and gloves, and restores exact references",()=>{
    const owner=createPgPreviewModels();
    for(const id of Object.keys(PG_WEAPONS) as PgWeaponId[]){
      const model=owner.get(id).root,glove=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
      glove.name="trigger-glove";model.add(glove);
      const other=model.clone(true),parts=meshes(model),sibling=meshes(other),materials=parts.map(p=>p.material);
      const snapshots=materials.map(m=>(m as THREE.MeshStandardMaterial).color?.getHex());
      const geometries=parts.map(p=>p.geometry),finish=createPgWeaponFinishArt(model);
      finish.setFinish(sample);
      expect(parts.some((p,i)=>p.material!==materials[i])).toBe(true);
      for(const [i,p] of parts.entries()){
        const original=materials[i] as THREE.MeshStandardMaterial;
        expect(sibling[i].material).toBe(original);expect(original.color?.getHex()).toBe(snapshots[i]);expect(p.geometry).toBe(geometries[i]);
        if(/sight|lens|optic|scope|glove|grip/.test(p.name)||original.transparent||original.emissive?.getHex())expect(p.material).toBe(original);
      }
      const assigned=parts.map(p=>p.material);finish.setFinish({...sample});expect(parts.every((p,i)=>p.material===assigned[i])).toBe(true);
      finish.setFinish(null);expect(parts.every((p,i)=>p.material===materials[i])).toBe(true);
      finish.setFinish(sample);expect(parts.every((p,i)=>p.material===assigned[i])).toBe(true);
      finish.dispose();expect(parts.every((p,i)=>p.material===materials[i])).toBe(true);
      glove.removeFromParent();glove.geometry.dispose();glove.material.dispose();
    }
    owner.dispose();
  });
  it("reuses a single patterned swatch across six motifs and coexists with independently owned overcharge",()=>{
    const owner=createPgPreviewModels(),model=owner.get("pulse").root,parts=meshes(model);
    const overcharge=createPgOverchargeFinish(model,"pulse");overcharge.setTier(2);
    const energy=model.getObjectByName("cell-energy-window") as THREE.Mesh,oc=energy.material;
    const art=createPgWeaponFinishArt(model);art.setFinish(sample);
    const coated=parts.find(p=>(p.material as THREE.MeshStandardMaterial).map instanceof THREE.DataTexture)!;
    const mat=coated.material as THREE.MeshStandardMaterial,swatch=mat.map as THREE.DataTexture;
    const fingerprints=new Set<string>();
    for(const pattern of ["brushed","ceramic","circuit","starfield","glass","champion"] as const){
      art.setFinish({...sample,pattern});
      expect(coated.material).toBe(mat);expect(mat.map).toBe(swatch);expect(mat.transparent).toBe(false);
      expect(energy.material).toBe(oc);fingerprints.add(Array.from(swatch.image.data as Uint8Array).join(","));
    }
    expect(fingerprints.size).toBe(6);
    const release=vi.spyOn(swatch,"dispose"),releaseMat=vi.spyOn(mat,"dispose");
    const override=new THREE.MeshStandardMaterial();coated.material=override;
    art.dispose();art.dispose();expect(coated.material).toBe(override);expect(release).toHaveBeenCalledOnce();expect(releaseMat).toHaveBeenCalledOnce();expect(energy.material).toBe(oc);
    override.dispose();overcharge.dispose();owner.dispose();
  });
});
