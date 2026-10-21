import { createBrHeldReloadBrace as createReloadBraceFold, createBrHeldReloadPath as createReloadServicePath } from './br-held-reload';
import {expect,it} from "vitest";
import * as THREE from "three";
import {createAstronautVisual} from "../../astronaut";
import {createAstronautMotion} from "../../astronaut-motion";
import {createAstronautSupportedArms} from "../../astronaut-supported-arms";
import {buildBrWeaponModel} from "./br-weapons";
import {createBrHeldWeaponSupport,type BrSupportWeaponId} from "./br-held-weapon-support";

function volume(mesh:THREE.Mesh){
  const p=mesh.geometry.getAttribute("position"),index=mesh.geometry.index,t=new THREE.Triangle(),planes:THREE.Plane[]=[];
  for(let i=0;i<(index?.count??p.count);i+=3){
    [t.a,t.b,t.c].forEach((v,j)=>v.fromBufferAttribute(p,index?index.getX(i+j):i+j));
    if(t.getArea()>1e-10)planes.push(new THREE.Plane().setFromCoplanarPoints(t.a,t.b,t.c));
  }
  return{mesh,planes,inverse:new THREE.Matrix4()};
}

/** Actual mesh vertices plus the deepest point of every triangle edge.
 * Inset convex clipping finds edge penetration even when both vertices are outside. */
function penetration(group:THREE.Group,volumes:ReturnType<typeof volume>[]){
 let worst=0;
 group.traverse(o=>{
 if(!(o instanceof THREE.Mesh)||!o.visible)return; if(group.name==='arm-clearance' && !(o instanceof THREE.SkinnedMesh)&& !(o.geometry instanceof THREE.CapsuleGeometry)&& !(o.geometry instanceof THREE.CylinderGeometry)&& !(o.geometry instanceof THREE.SphereGeometry&&o.geometry.parameters.radius===.18))return; if(o instanceof THREE.SkinnedMesh)o.skeleton.update();
 const p=o.geometry.getAttribute('position'),idx=o.geometry.index;
 for(const v of volumes){const matrix=new THREE.Matrix4().multiplyMatrices(v.inverse,o.matrixWorld);
 for(let i=0;i<(idx?.count??p.count);i+=3){let raw:Array<{point:THREE.Vector3;bindY:number}>=Array.from({length:3},(_,j)=>{const k=idx?idx.getX(i+j):i+j,point=new THREE.Vector3().fromBufferAttribute(p,k),bindY=point.y+(o.geometry instanceof THREE.CapsuleGeometry?o.position.y:0);if(o instanceof THREE.SkinnedMesh)o.applyBoneTransform(k,point);return{point:point.applyMatrix4(matrix),bindY};});
 if(o instanceof THREE.SkinnedMesh||o.geometry instanceof THREE.CapsuleGeometry){const clipped:Array<{point:THREE.Vector3;bindY:number}>=[];for(let j=0;j<raw.length;j++){const a=raw[j],b=raw[(j+1)%raw.length],da=a.bindY+.115,db=b.bindY+.115;if(da<=0)clipped.push(a);if(da*db<0)clipped.push({point:a.point.clone().lerp(b.point,da/(da-db)),bindY:-.115});}raw=clipped;}if(raw.length<3)continue;const polygon=raw.map(a=>a.point);
 const intersects=(inset:number)=>{let clip=polygon;
 for(const plane of v.planes){const next:THREE.Vector3[]=[];for(let j=0;j<clip.length;j++){
 const a=clip[j],b=clip[(j+1)%clip.length],da=plane.distanceToPoint(a)+inset,db=plane.distanceToPoint(b)+inset;
 if(da<=0)next.push(a);if(da*db<0)next.push(a.clone().lerp(b,da/(da-db)));
 }clip=next;if(!clip.length)return false;}return true;};
 if(!intersects(worst+1e-7))continue;
 let lo=worst,hi=1;for(let n=0;n<20;n++){const mid=(lo+hi)/2;if(intersects(mid))lo=mid;else hi=mid;}worst=lo;
 }}});return worst;
}


it.each(['helix-burst-rifle','quasar-carbine','prism-beam','vortex-cannon'] as const)('reload surface path %s',id=>{
for(const yawDirection of[-1,1])for(const basePitch of[-1,1]){
const rig=createAstronautVisual({identityColor:'#70f5ff',suitAccent:'#ffd84d',isBot:false}),controller=createAstronautSupportedArms(rig);let pitch=basePitch<0?-1.25:1.05,yaw=0;expect(controller.apply(true,pitch,yaw)).toBe(true);const right=controller.wrist('right',new THREE.Vector3()).clone(),left=controller.wrist('left',new THREE.Vector3()).clone();
const path=createReloadServicePath(id),wrapper=new THREE.Group(),model=new THREE.Group();wrapper.add(model);rig.upperBody.add(wrapper);buildBrWeaponModel(model,id,0xffffff);const box=new THREE.BoxGeometry(1,1,1),mat=new THREE.MeshBasicMaterial(),entry=createBrHeldWeaponSupport(model,id,box,mat),fold=createReloadBraceFold(model);
const volumes=[rig.torso,rig.helmet.children[0],...rig.upperBody.children.filter(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.BoxGeometry)].map(o=>volume(o as THREE.Mesh));
let priorHandleDepth=Infinity,priorAxisDistance=0;for(let i=0;i<=40;i++){const progress=i/40;pitch=-.1+basePitch*1.15*Math.cos(progress*Math.PI*2);yaw=yawDirection*.4*Math.sin(progress*Math.PI*2);controller.reset();expect(controller.apply(true,pitch,yaw)).toBe(true);controller.wrist('right',right);controller.wrist('left',left);expect(path.update(progress,right,pitch,yaw)).toBe(true);controller.reset();expect(controller.applyTargets(path.state.left,path.state.right,pitch,yaw),'reach '+id+' '+pitch+' '+yaw+' '+progress).toBe(true);const actual=controller.wrist('right',new THREE.Vector3());expect(actual.distanceTo(path.state.right)).toBeLessThan(1e-8);expect(entry.update(wrapper,actual,1,path.state.pitch,path.state.yaw)).toBe(true);expect(fold.update(progress)).toBe(true);rig.group.updateMatrixWorld(true);for(const v of volumes)v.inverse.copy(v.mesh.matrixWorld).invert();
for(const arm of[rig.leftArm,rig.rightArm]){arm.name='arm-clearance';expect(penetration(arm,volumes),'arm '+id+' '+pitch+' '+yaw+' '+progress).toBeLessThan(1e-6);}expect(penetration(model,volumes),'weapon '+id+' '+pitch+' '+yaw+' '+progress).toBeLessThan(1e-6);
const weaponVolumes:ReturnType<typeof volume>[]=[];model.traverse(o=>{if(o instanceof THREE.Mesh&&o.visible&&o.name!=='weapon-grasped-handle'){const v=volume(o);v.inverse.copy(o.matrixWorld).invert();weaponVolumes.push(v);}});const leftGlove=rig.leftArm.getObjectsByProperty('type','Mesh').find(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.SphereGeometry&&o.geometry.parameters.radius===.18)!;expect(penetration(leftGlove as THREE.Group,weaponVolumes),'left glove/weapon '+id+' '+pitch+' '+yaw+' '+progress).toBeLessThan(1e-6);const handle=model.getObjectByName('weapon-support-grip')!.children[0] as THREE.Mesh;const hv=volume(handle);hv.inverse.copy(handle.matrixWorld).invert();const hd=penetration(leftGlove as THREE.Group,[hv]);const ha=new THREE.Vector3(0,-.5,0).applyMatrix4(handle.matrixWorld),hb=new THREE.Vector3(0,.5,0).applyMatrix4(handle.matrixWorld),gc=leftGlove.getWorldPosition(new THREE.Vector3()),axisDistance=new THREE.Line3(ha,hb).closestPointToPoint(gc,true,new THREE.Vector3()).distanceTo(gc);if(progress>.25&&progress<=.35)expect(axisDistance,'outward axis separation').toBeGreaterThanOrEqual(priorAxisDistance-1e-8);priorAxisDistance=axisDistance;if(progress>=.35&&progress<=.65)expect(hd,'released handle '+id).toBeLessThan(1e-6);priorHandleDepth=hd;const rightGlove=rig.rightArm.getObjectsByProperty('type','Mesh').find(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.SphereGeometry&&o.geometry.parameters.radius===.18)! as THREE.Mesh;const rv=volume(rightGlove);rv.inverse.copy(rightGlove.matrixWorld).invert();expect(penetration(leftGlove as THREE.Group,[rv]),'glove separation '+id).toBeLessThan(1e-6);const primary=rig.upperBody.worldToLocal(model.getObjectByName('weapon-primary-grip')!.getWorldPosition(new THREE.Vector3()));expect(primary.distanceTo(actual)).toBeLessThan(1e-8);if(i===0||i===40){expect(controller.wrist('left',new THREE.Vector3()).distanceTo(left)).toBeLessThan(1e-8);expect(actual.distanceTo(right)).toBeLessThan(1e-8);}const phase=Math.min(progress,1-progress)/.25,t=Math.min(1,phase),blend=t*t*(3-2*t);expect(path.state.right.distanceTo(right.clone().lerp(new THREE.Vector3(.19,1.15,.68),blend))).toBeLessThan(1e-8);
}fold.restore();entry.restore();controller.dispose();box.dispose();mat.dispose();
}},120000);
