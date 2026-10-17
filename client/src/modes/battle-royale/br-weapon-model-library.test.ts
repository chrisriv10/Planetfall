import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {BR_WEAPONS,type BrWeaponId} from "@planetfall/shared";
import {buildBrWeaponModel} from "./br-weapons";
import {BrWeaponModelLibrary} from "./br-weapon-model-library";
function resources(group:THREE.Group){
  const result=new Set<THREE.BufferGeometry|THREE.Material>();
  group.traverse(part=>{if(part instanceof THREE.Mesh){result.add(part.geometry);for(const m of Array.isArray(part.material)?part.material:[part.material])result.add(m);}});
  return result;
}
describe("cached weapon models",()=>{
  it("preserves every authored part and typed muzzle while sharing cached resources",()=>{
    const library=new BrWeaponModelLibrary();
    for(const id of Object.keys(BR_WEAPONS) as BrWeaponId[]){
      const original=new THREE.Group();buildBrWeaponModel(original,id,0xffaa22);
      const a=library.create(id,0xffaa22),b=library.create(id,0xffaa22);
      expect(a.userData.borrowedWeaponResources).toBe(true);
      expect(a.userData.muzzle).toBeInstanceOf(THREE.Vector3);
      expect(a.userData.muzzle).toEqual(original.userData.muzzle);
      expect(b.userData.muzzle).not.toBe(a.userData.muzzle);
      a.userData.muzzle.x=999;expect(b.userData.muzzle.x).toBe(original.userData.muzzle.x);
      expect(a.children).toHaveLength(original.children.length);
      for(let i=0;i<a.children.length;i++){
        const x=a.children[i] as THREE.Mesh,y=b.children[i] as THREE.Mesh,o=original.children[i] as THREE.Mesh;
        expect(x).not.toBe(y);expect(x.geometry).toBe(y.geometry);expect(x.material).toBe(y.material);
        expect(x.name).toBe(o.name);expect(x.position).toEqual(o.position);expect(x.quaternion.toArray()).toEqual(o.quaternion.toArray());expect(x.scale).toEqual(o.scale);
        x.position.x+=10;expect(y.position).toEqual(o.position);
      }
      for(const resource of resources(original))resource.dispose();
    }
    library.dispose();
  });
  it("separates accent keys and disposes every owned resource exactly once",()=>{
    const library=new BrWeaponModelLibrary();
    const a=library.create("pulse-rifle",0xffffff),b=library.create("pulse-rifle",0xffaa22),c=library.create("pulse-rifle",0xffffff);
    expect(resources(c)).toEqual(resources(a));
    expect((a.children[0] as THREE.Mesh).material).not.toBe((b.children[0] as THREE.Mesh).material);
    const all=new Set([...resources(a),...resources(b)]);
    const spies=[...all].map(r=>vi.spyOn(r,"dispose"));
    library.dispose();library.dispose();for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);
    expect(()=>library.create("pulse-rifle",0xffffff)).toThrow(/disposed/);
  });
});
