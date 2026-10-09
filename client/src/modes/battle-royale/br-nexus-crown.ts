import * as THREE from "three";
import type {BrStructure,Vec3} from "@planetfall/shared";

type CrownResources={
  geometry:<T extends THREE.BufferGeometry>(geometry:T)=>T;
  box:THREE.BufferGeometry; dark:THREE.Material; metal:THREE.Material;
  energy:THREE.Material; conduit:THREE.Material;
};

/** A roof-mounted energy crown. The caller owns all geometry/material lifetime
 * and registers the returned animation targets with its normal world update. */
export function createBrNexusCrown(s:BrStructure,origin:Vec3,r:CrownResources):{group:THREE.Group;animated:THREE.Object3D[]}{
  const group=new THREE.Group(),animated:THREE.Object3D[]=[];
  group.name="zero-rooftop-crown";
  group.position.set(s.position.x-origin.x,s.position.y+s.size.y-origin.y,s.position.z-origin.z);
  const mesh=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number)=>{
    const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);group.add(m);return m;
  };
  mesh("zero-roof-mast",r.geometry(new THREE.CylinderGeometry(2.6,4.5,11,12)),r.dark,0,5.65,0);
  for(const [radius,y,tilt,speed] of [[13,10.7,.25,.00028],[11,17.2,-.35,.00033],[7.5,27.4,.55,.00038]]){
    const ring=mesh("zero-crown-orbit",r.geometry(new THREE.TorusGeometry(radius,.52,9,42)),r.energy,0,y,0);
    ring.rotation.x=Math.PI/2+tilt;ring.userData.rotationSpeed=speed;animated.push(ring);
  }
  const core=mesh("zero-energy-core",r.geometry(new THREE.OctahedronGeometry(5.8,2)),r.energy,0,17.2,0);
  core.userData.rotationSpeed=.00048;core.userData.pulse=true;core.userData.baseScale=1;animated.push(core);
  const capGeometry=r.geometry(new THREE.OctahedronGeometry(1.2,1));
  for(const [sx,sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
    const pylon=mesh("zero-roof-pylon",r.box,r.dark,sx*7,3.85,sz*7);pylon.scale.set(1.6,7.4,1.6);
    const cap=mesh("zero-pylon-core",capGeometry,r.energy,sx*7,8.9,sz*7);
    cap.userData.rotationSpeed=.0002*sx;animated.push(cap);
    const from=new THREE.Vector3(sx*7,7.5,sz*7),to=new THREE.Vector3(sx*2,9.2,sz*2);
    for(const [name,width,material,lift] of [["zero-crown-brace",.6,r.metal,0],["zero-crown-conduit",.12,r.conduit,.38]] as const){
      const direction=to.clone().sub(from);
      const beam=mesh(name,r.box,material,0,0,0);
      beam.position.copy(from).add(to).multiplyScalar(.5);beam.position.y+=lift;
      beam.scale.set(width,width,direction.length());beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());
    }
  }
  const light=new THREE.PointLight(0x70f5ff,6.5,105,1.6);light.position.y=17.2;group.add(light);
  group.userData.cameraCollision=false;
  return {group,animated};
}
