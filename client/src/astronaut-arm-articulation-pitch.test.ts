import { expect, it } from "vitest";
import * as THREE from "three";
import { createAstronautVisual } from "./astronaut";
import { createAstronautMotion } from "./astronaut-motion";
import { createAstronautArmArticulation } from "./astronaut-arm-articulation";
import { buildBrWeaponModel } from "./modes/battle-royale/br-weapons";
import { addBrWeaponSupportGrip, anchorBrSupportedWeapon, type BrSupportWeaponId } from "./modes/battle-royale/br-weapon-support-grip";

function volume(mesh: THREE.Mesh) {
  const p=mesh.geometry.getAttribute("position"),index=mesh.geometry.index;
  const triangle=new THREE.Triangle(),planes:THREE.Plane[]=[];
  for(let i=0;i<(index?.count??p.count);i+=3){
    [triangle.a,triangle.b,triangle.c].forEach((v,j)=>v.fromBufferAttribute(p,index?index.getX(i+j):i+j));
    if(triangle.getArea()>1e-10)planes.push(new THREE.Plane().setFromCoplanarPoints(triangle.a,triangle.b,triangle.c));
  }
  return {mesh,planes,inverse:new THREE.Matrix4()};
}

it.each(["idle","ads","sprint","crouch"] as const)("keeps pitched arms and all four weapons clear in settled %s",mode=>{
  const rig=createAstronautVisual({identityColor:"#70f5ff",suitAccent:"#ffd84d",isBot:false});
  const motion=createAstronautMotion(rig);
  Object.assign(motion.input,{item:"two-hand",dt:1/60,aiming:mode==="ads",crouched:mode==="crouch",forwardSpeed:mode==="sprint"?7:0});
  for(let i=0;i<180;i++){motion.input.timeSeconds=i/60;motion.update();}
  const bodies=[rig.torso,rig.helmet.children[0],...rig.upperBody.children.filter(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.BoxGeometry)] as THREE.Mesh[];
  const volumes=bodies.map(volume),controller=createAstronautArmArticulation(rig);
  const box=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial();
  const ids:BrSupportWeaponId[]=["helix-burst-rifle","quasar-carbine","prism-beam","vortex-cannon"];
  const weapons=ids.map(id=>{const group=new THREE.Group();buildBrWeaponModel(group,id,0xffffff);const handle=addBrWeaponSupportGrip(group,id,box,material);rig.upperBody.add(group);return{id,group,handle};});
  const world=new THREE.Vector3(),local=new THREE.Vector3(),right=new THREE.Vector3(),left=new THREE.Vector3();
  const edgeA=new THREE.Vector3(),edgeB=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3();
  for(let n=0;n<=39;n++){
    const pitch=Number((-1.15+n*.05).toFixed(2));
    controller.reset();
    expect(controller.apply(true,pitch)).toBe(true);
    controller.wrist("right",right);controller.wrist("left",left);
    expect(right.distanceTo(left)).toBeCloseTo(.38);
    for(const w of weapons)anchorBrSupportedWeapon(w.group,w.id,right,pitch);
    rig.group.updateMatrixWorld(true);
    for(const v of volumes)v.inverse.copy(v.mesh.matrixWorld).invert();
    const clear=(point:THREE.Vector3,label:string)=>{
      for(const v of volumes){
        local.copy(point).applyMatrix4(v.inverse);
        let distance=-Infinity;
        for(const plane of v.planes)distance=Math.max(distance,plane.distanceToPoint(local));
        expect(distance,`${mode} pitch=${pitch} ${label} vs ${v.mesh.geometry.type}`).toBeGreaterThanOrEqual(-1e-6);
      }
    };
    for(const arm of [rig.leftArm,rig.rightArm]){
      const skin=arm.getObjectByName("articulated-arm-sleeve") as THREE.SkinnedMesh;skin.skeleton.update();
      expect(skin.frustumCulled).toBe(false);
      const [upper,fore]=skin.skeleton.bones;
      expect(upper.getWorldPosition(new THREE.Vector3()).distanceTo(fore.getWorldPosition(new THREE.Vector3()))).toBeCloseTo(.305);
      arm.traverse(o=>{
        if(!(o instanceof THREE.Mesh)||!o.visible)return;
        if(o!==skin&&!(o.geometry instanceof THREE.CylinderGeometry)&&!(o.geometry instanceof THREE.SphereGeometry&&o.geometry.parameters.radius===.18))return;
        const p=o.geometry.getAttribute("position");
        for(let i=0;i<p.count;i++){
          world.fromBufferAttribute(p,i);
          if(o===skin&&world.y>-.115)continue;
          if(o===skin)skin.applyBoneTransform(i,world);
          clear(world.applyMatrix4(o.matrixWorld),`${o.name||o.geometry.type} vertex ${i}`);
        }
      });
    }
    for(const w of weapons){
      for(const [name,wrist] of [["weapon-primary-grip",right],["weapon-support-grip",left]] as const){
        const contact=w.group.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
        rig.upperBody.worldToLocal(contact);expect(contact.distanceTo(wrist)).toBeLessThan(1e-8);
      }
      expect(new THREE.Vector3(0,0,-1).applyQuaternion(w.group.quaternion).distanceTo(new THREE.Vector3(0,-Math.sin(pitch),Math.cos(pitch)))).toBeLessThan(1e-8);
      w.group.traverse(o=>{
        if(!(o instanceof THREE.Mesh)||!o.visible)return;
        const p=o.geometry.getAttribute("position");
        for(let i=0;i<p.count;i++)clear(world.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),`${w.id} ${o.name||o.geometry.type} vertex ${i}`);
        // Vertices alone miss a long brace crossing a body between endpoints.
        const index=o.geometry.index,count=index?.count??p.count;
        for(let i=0;i<count;i+=3)for(let j=0;j<3;j++){
          edgeA.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(o.matrixWorld);
          edgeB.fromBufferAttribute(p,index?index.getX(i+(j+1)%3):i+(j+1)%3).applyMatrix4(o.matrixWorld);
          for(const v of volumes){
            a.copy(edgeA).applyMatrix4(v.inverse);b.copy(edgeB).applyMatrix4(v.inverse);
            let low=0,high=1;
            for(const plane of v.planes){
              const da=plane.distanceToPoint(a)+1e-6,db=plane.distanceToPoint(b)+1e-6;
              if(da>0&&db>0){low=2;break;}
              if(da>0)low=Math.max(low,da/(da-db));
              if(db>0)high=Math.min(high,da/(da-db));
              if(low>high)break;
            }
            expect(low>high,`${w.id} pitch ${pitch} edge crosses ${v.mesh.geometry.type}`).toBe(true);
          }
        }
      });
    }
  }
  weapons.forEach(w=>w.handle.restore());controller.dispose();box.dispose();material.dispose();
});
