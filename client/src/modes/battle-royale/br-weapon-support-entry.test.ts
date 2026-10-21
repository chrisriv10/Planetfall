import {expect,it} from "vitest";
import * as THREE from "three";
import {createAstronautVisual} from "../../astronaut";
import {createAstronautMotion} from "../../astronaut-motion";
import {createAstronautArmArticulation} from "../../astronaut-arm-articulation";
import {buildBrWeaponModel} from "./br-weapons";
import {createBrSupportedWeaponEntry,type BrSupportWeaponId} from "./br-weapon-support-grip";

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
  const a=new THREE.Vector3(),b=new THREE.Vector3(),matrix=new THREE.Matrix4();
  group.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||!o.visible)return;
    const p=o.geometry.getAttribute("position"),index=o.geometry.index;
    for(const v of volumes){
      matrix.multiplyMatrices(v.inverse,o.matrixWorld);
      for(let i=0;i<p.count;i++){
        a.fromBufferAttribute(p,i).applyMatrix4(matrix);
        let distance=-Infinity;
        for(const plane of v.planes)distance=Math.max(distance,plane.distanceToPoint(a));
        worst=Math.max(worst,-distance);
      }
      for(let i=0;i<(index?.count??p.count);i+=3)for(let j=0;j<3;j++){
        a.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(matrix);
        b.fromBufferAttribute(p,index?index.getX(i+(j+1)%3):i+(j+1)%3).applyMatrix4(matrix);
        const crosses=(inset:number)=>{
          let low=0,high=1;
          for(const plane of v.planes){
            const da=plane.distanceToPoint(a)+inset,db=plane.distanceToPoint(b)+inset;
            if(da>0&&db>0)return false;
            if(da>0)low=Math.max(low,da/(da-db));
            if(db>0)high=Math.min(high,da/(da-db));
            if(low>high)return false;
          }
          return true;
        };
        if(!crosses(worst+1e-7))continue;
        let low=worst,high=1;
        for(let k=0;k<20;k++){const mid=(low+high)/2;if(crosses(mid))low=mid;else high=mid;}
        worst=low;
      }
    }
  });
  return worst;
}

it.each(["idle","ads","sprint","crouch"] as const)("recovers entry monotonically from the measured %s baseline",mode=>{
  for(const pitch of [-1.15,-.85,-.5,0,.8]){
    const rig=createAstronautVisual({identityColor:"#70f5ff",suitAccent:"#ffd84d",isBot:false});
    const motion=createAstronautMotion(rig);
    Object.assign(motion.input,{item:"two-hand",dt:1/60,aiming:mode==="ads",crouched:mode==="crouch",forwardSpeed:mode==="sprint"?7:0});
    for(let i=0;i<180;i++){motion.input.timeSeconds=i/60;motion.update();}
    const baseline=[rig.leftArm.quaternion.clone(),rig.rightArm.quaternion.clone()];
    const controller=createAstronautArmArticulation(rig),right=new THREE.Vector3(),left=new THREE.Vector3();
    const bodies=[rig.torso,rig.helmet.children[0],...rig.upperBody.children.filter(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.BoxGeometry)] as THREE.Mesh[];
    const volumes=bodies.map(volume),box=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial();
    const ids:BrSupportWeaponId[]=["helix-burst-rifle","quasar-carbine","prism-beam","vortex-cannon"];
    const weapons=ids.map(id=>{
      const model=new THREE.Group(),wrapper=new THREE.Group();buildBrWeaponModel(model,id,0xffffff);wrapper.add(model);rig.upperBody.add(wrapper);
      const originals=model.children.map(part=>({part,position:part.position.clone(),scale:part.scale.clone(),visible:part.visible}));
      return{id,model,wrapper,originals,entry:createBrSupportedWeaponEntry(model,id,box,material),previous:Infinity,gripError:Infinity};
    });
    for(let step=0;step<=40;step++){
      controller.reset();rig.leftArm.quaternion.copy(baseline[0]);rig.rightArm.quaternion.copy(baseline[1]);
      controller.update(true,step===0?0:.0045,false,pitch);controller.wrist("right",right);controller.wrist("left",left);
      for(const w of weapons)expect(w.entry.update(w.wrapper,right,controller.state.weight,pitch)).toBe(true);
      rig.group.updateMatrixWorld(true);for(const v of volumes)v.inverse.copy(v.mesh.matrixWorld).invert();
      for(const w of weapons){
        const depth=penetration(w.model,volumes);
        expect(depth,`${mode} ${pitch} ${w.id} weight ${controller.state.weight}`).toBeLessThanOrEqual(w.previous+2e-6);
        if(step===0)expect(depth).toBeGreaterThan(0);
        if(controller.state.weight>=.25)expect(depth).toBeLessThan(1e-6);
        w.previous=depth;
        const grip=w.model.getObjectByName(`${w.id.split("-")[0]}-grip`)!;
        const contact=rig.upperBody.worldToLocal(grip.getWorldPosition(new THREE.Vector3()));
        const error=contact.distanceTo(right);expect(error).toBeLessThanOrEqual(w.gripError+1e-8);w.gripError=error;
        if(controller.state.weight>=.25)expect(error).toBeLessThan(1e-8);
        if(step===40){
          const support=rig.upperBody.worldToLocal(w.model.getObjectByName("weapon-support-grip")!.getWorldPosition(new THREE.Vector3()));
          expect(support.distanceTo(left)).toBeLessThan(1e-8);
          const position=w.wrapper.position.clone();expect(w.entry.update(w.wrapper,right,0,pitch)).toBe(false);expect(w.wrapper.position).toEqual(position);
        }
      }
    }
    for(const w of weapons){w.entry.restore();w.entry.restore();expect(w.model.children).toEqual(w.originals.map(o=>o.part));for(const o of w.originals){expect(o.part.position).toEqual(o.position);expect(o.part.scale).toEqual(o.scale);expect(o.part.visible).toBe(o.visible);}}
    controller.dispose();box.dispose();material.dispose();
  }
},30000);
