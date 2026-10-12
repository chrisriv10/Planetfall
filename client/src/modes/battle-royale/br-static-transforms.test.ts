import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { freezeBrStaticTransforms } from "./br-static-transforms";

describe("fixed BR transform caching", () => {
  it("keeps scenery placed while machinery and labels still move", () => {
    const scene=new THREE.Scene(),root=new THREE.Group(),building=new THREE.Group(),wall=new THREE.Object3D(),rotor=new THREE.Group(),blade=new THREE.Object3D(),label=new THREE.Sprite();
    scene.add(root);root.add(building);building.position.set(12,5,-8);building.add(wall,rotor,label);wall.position.x=4;rotor.add(blade);blade.position.x=2;
    freezeBrStaticTransforms(root,[rotor],true);
    const before=wall.matrixWorld.clone();rotor.rotation.y=Math.PI/2;label.scale.set(4,2,1);scene.updateMatrixWorld();
    expect(wall.matrixWorld.equals(before)).toBe(true);
    expect(new THREE.Vector3().setFromMatrixPosition(blade.matrixWorld).toArray()).toEqual([12,5,-10]);
    expect(label.matrixWorld.elements[0]).toBe(4);
  });
  it("allows the home-preview root to move and rescale the whole island", () => {
    const scene=new THREE.Scene(),root=new THREE.Group(),child=new THREE.Object3D();scene.add(root);root.add(child);child.position.x=10;
    freezeBrStaticTransforms(root,[],false);root.position.x=3;root.scale.setScalar(.1);scene.updateMatrixWorld();
    expect(new THREE.Vector3().setFromMatrixPosition(child.matrixWorld).x).toBe(4);
  });
  it("does not revisit fixed or hidden branches but still updates nested moving roots once", () => {
    const scene=new THREE.Scene(),root=new THREE.Group(),district=new THREE.Group(),hidden=new THREE.Group(),wall=new THREE.Object3D(),furniture=new THREE.Object3D(),rotor=new THREE.Group(),blade=new THREE.Object3D(),label=new THREE.Sprite();
    scene.add(root);root.add(district,hidden);district.position.set(8,3,-4);district.add(wall,rotor);rotor.add(blade,label);hidden.add(furniture);hidden.visible=false;
    freezeBrStaticTransforms(root,[rotor,blade],true);
    const wallUpdate=vi.spyOn(wall,"updateMatrixWorld"),furnitureUpdate=vi.spyOn(furniture,"updateMatrixWorld"),rotorUpdate=vi.spyOn(rotor,"updateMatrixWorld"),bladeUpdate=vi.spyOn(blade,"updateMatrixWorld"),labelUpdate=vi.spyOn(label,"updateMatrixWorld");
    rotor.rotation.y=.7;blade.position.z=2;label.scale.setScalar(3);scene.updateMatrixWorld(true);
    expect(wallUpdate).not.toHaveBeenCalled();expect(furnitureUpdate).not.toHaveBeenCalled();
    expect(rotorUpdate).toHaveBeenCalledTimes(1);expect(bladeUpdate).toHaveBeenCalledTimes(1);expect(labelUpdate).toHaveBeenCalledTimes(1);
    expect(new THREE.Vector3().setFromMatrixPosition(blade.matrixWorld).x).toBeCloseTo(8+Math.sin(.7)*2);
    expect(new THREE.Vector3().setFromMatrixScale(label.matrixWorld).x).toBeCloseTo(3);
    hidden.visible=true;scene.updateMatrixWorld();expect(furnitureUpdate).not.toHaveBeenCalled();
  });
  it("matches recursive world matrices and ray intersections through animated and quality changes", () => {
    const make=()=>{const scene=new THREE.Scene(),root=new THREE.Group(),district=new THREE.Group(),wall=new THREE.Mesh(new THREE.BoxGeometry(3,5,1)),rotor=new THREE.Group(),blade=new THREE.Mesh(new THREE.BoxGeometry(4,.2,.3)),label=new THREE.Sprite();scene.add(root);root.add(district);district.position.set(2,1,-8);district.add(wall,rotor,label);wall.position.y=2.5;rotor.position.set(4,3,0);rotor.add(blade);return {scene,root,district,wall,rotor,blade,label};};
    const cached=make(),reference=make();freezeBrStaticTransforms(cached.root,[cached.rotor],true);
    const ray=new THREE.Raycaster(new THREE.Vector3(2,3,0),new THREE.Vector3(0,0,-1));
    for(let frame=0;frame<120;frame++){
      for(const rig of [cached,reference]){rig.rotor.rotation.set(frame*.013,frame*.023,0);rig.rotor.scale.setScalar(1+Math.sin(frame*.1)*.03);rig.label.scale.set(2+frame*.01,1,1);rig.district.visible=frame%7!==0;rig.scene.updateMatrixWorld(frame%2===0);}
      for(const key of ["wall","rotor","blade","label"] as const)for(let i=0;i<16;i++)expect(cached[key].matrixWorld.elements[i]).toBeCloseTo(reference[key].matrixWorld.elements[i],10);
      expect(ray.intersectObject(cached.wall)[0]?.distance).toBe(ray.intersectObject(reference.wall)[0]?.distance);
    }
  });
});
