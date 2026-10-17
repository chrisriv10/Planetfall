import * as THREE from "three";
import type { BrWeaponId } from "@planetfall/shared";
import { buildBrWeaponModel } from "./br-weapons";

/** Owns cached weapon resources. Returned groups borrow those resources: remove
 * instances without disposing their meshes, then dispose the library at teardown. */
export class BrWeaponModelLibrary {
  private readonly templates=new Map<string,THREE.Group>();
  private disposed=false;

  create(id:BrWeaponId,rarityAccent:number):THREE.Group {
    if(this.disposed)throw new Error("BR weapon model library has been disposed");
    const key=`${id}:${rarityAccent}`;
    let template=this.templates.get(key);
    if(!template){
      template=new THREE.Group();
      buildBrWeaponModel(template,id,rarityAccent);
      template.name=`br-weapon-${id}`;
      template.userData.borrowedWeaponResources=true;
      template.traverse(part=>{part.userData.cameraCollision=false;});
      this.templates.set(key,template);
    }
    const instance=template.clone(true);
    // Object3D.clone serializes userData. Restore the typed mutable muzzle
    // independently for every instance, preserving the builder's exact anchor.
    instance.userData.muzzle=(template.userData.muzzle as THREE.Vector3).clone();
    return instance;
  }

  dispose():void {
    if(this.disposed)return;
    this.disposed=true;
    const geometries=new Set<THREE.BufferGeometry>();
    const materials=new Set<THREE.Material>();
    for(const template of this.templates.values())template.traverse(part=>{
      if(!(part instanceof THREE.Mesh))return;
      geometries.add(part.geometry);
      for(const material of Array.isArray(part.material)?part.material:[part.material])materials.add(material);
    });
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    this.templates.clear();
  }
}
