import {describe,expect,it,vi} from "vitest";
import * as THREE from "three";
import {createAstronautVisual} from "./astronaut";
import {applyAstronautSuitFinish} from "./astronaut-suit-finish";

const make=()=>createAstronautVisual({identityColor:"#dfb367",suitAccent:"#5986ba",isBot:false});
describe("astronaut suit finishes",()=>{
  it("gives each finish distinct housing color and reflectance, preserving accents and exact pre-equip material settings",()=>{
    const rig=make(),body=rig.torso.material,accent=rig.suitMaterial;
    body.color.setRGB(.25,.321,.645);body.metalness=.17;body.roughness=.63;accent.metalness=.11;accent.roughness=.78;
    const before=body.color.clone(),initialAccent=accent.color.clone(),colors=new Set<number>(),surfaces=new Set<string>();
    for(const style of ["pressure","courier","salvage"] as const){
      applyAstronautSuitFinish(rig,style);colors.add(body.color.getHex());surfaces.add([body.roughness,body.metalness,accent.roughness,accent.metalness].join("/"));
      expect(accent.color.equals(initialAccent)).toBe(true);
      const writes=vi.spyOn(body.color,"setHex");applyAstronautSuitFinish(rig,style);expect(writes).not.toHaveBeenCalled();writes.mockRestore();
    }
    expect(colors.size).toBe(3);expect(surfaces.size).toBe(3);
    accent.color.setHex(0xefc689);
    applyAstronautSuitFinish(rig,null);applyAstronautSuitFinish(rig,null);
    expect(body.color.equals(before)).toBe(true);expect([body.roughness,body.metalness,accent.roughness,accent.metalness]).toEqual([.63,.17,.78,.11]);
    expect(accent.color.getHex()).toBe(0xefc689);
  });
  it("retains silhouette, visor, eyes and identity lights across style switches without affecting a second pilot",()=>{
    const rig=make(),other=make(),otherBody=other.torso.material.color.clone();
    const meshes:THREE.Mesh[]=[];rig.group.traverse(n=>{if(n instanceof THREE.Mesh)meshes.push(n);});
    const original=meshes.map(m=>({geometry:m.geometry,material:m.material,matrix:m.matrix.clone()}));
    const protectedMaterials=new Map<THREE.Material,string>();
    for(const mesh of meshes){
      const mat=mesh.material as THREE.Material;
      if(mat!==rig.suitMaterial&&mat!==rig.torso.material)protectedMaterials.set(mat,JSON.stringify(mat.toJSON()));
    }
    for(const style of ["salvage","pressure",null] as const){
      applyAstronautSuitFinish(rig,style);expect(other.torso.material.color.equals(otherBody)).toBe(true);
      for(const [i,mesh] of meshes.entries()){
        expect(mesh.geometry).toBe(original[i].geometry);expect(mesh.material).toBe(original[i].material);expect(mesh.matrix.equals(original[i].matrix)).toBe(true);
      }
      for(const [mat,serialized] of protectedMaterials)expect(JSON.stringify(mat.toJSON())).toBe(serialized);
    }
  });
});
