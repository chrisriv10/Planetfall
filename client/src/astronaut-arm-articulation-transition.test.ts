import { expect, it } from "vitest";
import * as THREE from "three";
import { createAstronautVisual } from "./astronaut";
import { createAstronautArmArticulation } from "./astronaut-arm-articulation";
import { createAstronautMotion } from "./astronaut-motion";

// Canonical torso, shell and chest are convex. Their actual triangle planes
// provide an inside-depth measure without an oversized enclosing capsule.
function convexPlanes(mesh: THREE.Mesh) {
  const positions = mesh.geometry.getAttribute("position"), index = mesh.geometry.index;
  const triangle = new THREE.Triangle(), planes: THREE.Plane[] = [];
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    [triangle.a, triangle.b, triangle.c].forEach((p, j) => p.fromBufferAttribute(positions, index ? index.getX(i+j) : i+j));
    if (triangle.getArea() < 1e-10) continue;
    planes.push(new THREE.Plane().setFromCoplanarPoints(triangle.a, triangle.b, triangle.c));
  }
  return { mesh, planes, inverse: new THREE.Matrix4() };
}

it.each(["idle", "ads", "sprint"] as const)("bounds the %s transition's actual distal mesh penetration", mode => {
  const rig = createAstronautVisual({identityColor:"#70f5ff",suitAccent:"#ffd84d",isBot:false});
  const motion = createAstronautMotion(rig);
  Object.assign(motion.input, {item:"two-hand",dt:1/60,aiming:mode==="ads",forwardSpeed:mode==="sprint"?7:0});
  for(let i=0;i<180;i++) {motion.input.timeSeconds=i/60;motion.update();}
  const baselines = [rig.leftArm.quaternion.clone(),rig.rightArm.quaternion.clone()];
  const body = [rig.torso, rig.helmet.children[0] as THREE.Mesh,
    ...rig.upperBody.children.filter(p=>p instanceof THREE.Mesh && p.geometry instanceof THREE.BoxGeometry)] as THREE.Mesh[];
  const volumes=body.map(convexPlanes);
  const controller=createAstronautArmArticulation(rig);
  const scratch=new THREE.Vector3(),local=new THREE.Vector3();
  let worstPart="";
  const depth=()=>{
    rig.group.updateMatrixWorld(true);
    for(const v of volumes)v.inverse.copy(v.mesh.matrixWorld).invert();
    let worst=0;
    for(const arm of [rig.leftArm,rig.rightArm]) {
      const skin=arm.getObjectByName("articulated-arm-sleeve") as THREE.SkinnedMesh;
      skin.skeleton.update();
      arm.traverse(object=>{
        if(!(object instanceof THREE.Mesh)||!object.visible)return;
        const isSleeve=object===skin || object===arm.children[1];
        const isGlove=object.geometry instanceof THREE.SphereGeometry && object.geometry.parameters.radius===.18;
        const isCuff=object.geometry instanceof THREE.CylinderGeometry;
        if(!isSleeve&&!isGlove&&!isCuff)return;
        const positions=object.geometry.getAttribute("position");
        for(let i=0;i<positions.count;i++) {
          scratch.fromBufferAttribute(positions,i);
          // The proximal sleeve is intentionally embedded in its shoulder pad.
          if(isSleeve && (object===skin?scratch.y:scratch.y+object.position.y)>-.115)continue;
          if(object===skin)skin.applyBoneTransform(i,scratch);
          scratch.applyMatrix4(object.matrixWorld);
          for(const v of volumes) {
            local.copy(scratch).applyMatrix4(v.inverse);
            let maxDistance=-Infinity;
            for(const plane of v.planes)maxDistance=Math.max(maxDistance,plane.distanceToPoint(local));
            if(maxDistance<0 && -maxDistance>worst){worst=-maxDistance;worstPart=`${object.name||object.geometry.type} vertex ${i} vs ${v.mesh.geometry.type}`;}
          }
        }
      });
    }
    return worst;
  };
  const baselineDepth=depth();
  expect(baselineDepth).toBeGreaterThan(0);
  for(let i=1;i<=36;i++) {
    controller.reset();
    rig.leftArm.quaternion.copy(baselines[0]);rig.rightArm.quaternion.copy(baselines[1]);
    controller.update(true,.005);
    const penetration=depth();
    expect(penetration,`${mode} weight=${controller.state.weight}`).toBeLessThanOrEqual(baselineDepth+1e-6);
    if(controller.state.weight>=.25)expect(penetration,`${mode} clear weight=${controller.state.weight} ${worstPart}`).toBeLessThan(1e-6);
  }
  expect(controller.state.weight).toBeCloseTo(1);
  controller.dispose();
});
