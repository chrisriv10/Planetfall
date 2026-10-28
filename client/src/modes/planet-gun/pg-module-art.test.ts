import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {createPgPreviewModels,PG_PREVIEW_MODELS} from "./pg-kit-preview";
import {createPgModuleArt} from "./pg-module-art";
import {PG_RELOAD_PROFILES} from "./pg-reload-art";
import {PG_MODULES,type PgModuleId,type PgWeaponId} from "@planetfall/shared";

describe("PlanetGun cosmetic module sockets",()=>{
 it("visibly equips every module on every weapon without moving the muzzle",()=>{
  const models=createPgPreviewModels();
  for(const id of Object.keys(PG_PREVIEW_MODELS)as PgWeaponId[]){const m=models.get(id),anchor=m.root.userData.muzzle.clone();
   for(const module of Object.keys(PG_MODULES)as PgModuleId[]){m.modules.setModules([module]);const g=m.root.getObjectByName(`pg-module-${module}`)!;expect(g.visible).toBe(true);expect(g.children.length).toBeGreaterThan(1);for(const other of Object.keys(PG_MODULES))if(other!==module)expect(m.root.getObjectByName(`pg-module-${other}`)!.visible).toBe(false);expect(m.root.userData.muzzle).toEqual(anchor);}
   m.modules.setModules([]);for(const module of Object.keys(PG_MODULES))expect(m.root.getObjectByName(`pg-module-${module}`)!.visible).toBe(false);
  }models.dispose();
 });
 it("moves energy accessories with reload cells and restores canonical optics",()=>{
  const models=createPgPreviewModels(),m=models.get("rail"),cell=m.root.getObjectByName("pg-rail-power-cell")!,optic=m.root.getObjectByName("rail-scope-body")!;
  m.modules.setModules(["precision-lens","expanded-cell"]);expect(optic.visible).toBe(false);expect(m.root.getObjectByName("pg-module-expanded-cell")!.parent).toBe(cell);
  const before=new THREE.Vector3();m.root.getObjectByName("pg-module-expanded-cell")!.getWorldPosition(before);cell.position.y-=.2;const after=new THREE.Vector3();m.root.getObjectByName("pg-module-expanded-cell")!.getWorldPosition(after);expect(after.y-before.y).toBeCloseTo(-.2);
  m.modules.setModules([]);expect(optic.visible).toBe(true);models.dispose();
 });
 it("keeps both module apertures clear at the actual ADS sight height",()=>{
  const models=createPgPreviewModels();
  const heights={pulse:.35,nova:.30,photon:.215,quasar:.30,rail:.37,comet:.265,helix:.23,arc:.35,prism:.35,orbit:.22};
  for(const weapon of Object.keys(PG_PREVIEW_MODELS)as PgWeaponId[]){const m=models.get(weapon);
   for(const module of ["reflex-array","precision-lens"]as const){m.modules.setModules([module]);m.root.updateMatrixWorld(true);
    for(const x of [-.025,0,.025]){
     const ray=new THREE.Raycaster(new THREE.Vector3(x,heights[weapon],1),new THREE.Vector3(0,0,-1));
     const hits=ray.intersectObject(m.root,true).filter(hit=>{
      for(let o:THREE.Object3D|null=hit.object;o;o=o.parent)if(!o.visible)return false;
      const material=(hit.object as THREE.Mesh).material;
      return !Array.isArray(material)&&!(material.transparent&&material.opacity<.3);
     });expect(hits.map(h=>h.object.name),`${weapon} ${module} aperture ${x}`).toEqual([]);
    }
   }
  }models.dispose();
 });
 it("inherits the render layer, exposes cell hardware, and restores optics on disposal",()=>{
  const model=new THREE.Group();model.layers.set(7);
  const original=new THREE.Mesh();original.name="pulse-optic-left";model.add(original);
  const geometry=new THREE.BoxGeometry(),materials:THREE.Material[]=[];
  const material=new THREE.MeshStandardMaterial();materials.push(material);
  const art=createPgModuleArt(model,"pulse",{box:geometry,metal:material,composite:material,grip:material,ownMaterial(m){materials.push(m);return m;}});
  expect(original.visible).toBe(true);art.setModules(["reflex-array"]);expect(original.visible).toBe(false);
  model.getObjectByName("pg-module-reflex-array")!.traverse(o=>expect(o.layers.mask).toBe(model.layers.mask));
  const fin=model.getObjectByName("rapid-charge-fin")!;
  expect(fin.position.z).toBeGreaterThan(PG_RELOAD_PROFILES.pulse.depth*.5);
  art.dispose();art.dispose();expect(original.visible).toBe(true);expect(model.getObjectByName("pg-module-sockets")).toBeUndefined();
  geometry.dispose();materials.forEach(m=>m.dispose());
 });
});
