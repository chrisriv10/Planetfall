import * as THREE from "three";
import { expect,it } from "vitest";
import { spinBrMachinery } from "./br-machinery";

it("keeps mounted reactor rings horizontal throughout their spin",()=>{
  const ring=new THREE.Object3D();ring.rotation.x=Math.PI/2;
  for(const angle of [0,.4,1.8,3.2,6.2,0]) {
    spinBrMachinery(ring,angle);
    const normal=new THREE.Vector3(0,0,1).applyQuaternion(ring.quaternion);
    expect(normal.y).toBeCloseTo(-1);expect(normal.x).toBeCloseTo(0);expect(normal.z).toBeCloseTo(0);
  }
});
it("rotates turbine blades within their housing rather than tipping the rotor",()=>{
  const rotor=new THREE.Object3D();
  spinBrMachinery(rotor,Math.PI/2,"z");
  const blade=new THREE.Vector3(1,0,0).applyQuaternion(rotor.quaternion);
  expect(blade.x).toBeCloseTo(0);expect(blade.y).toBeCloseTo(1);expect(blade.z).toBeCloseTo(0);
  spinBrMachinery(rotor,0,"z");expect(rotor.quaternion.w).toBeCloseTo(1);
});
