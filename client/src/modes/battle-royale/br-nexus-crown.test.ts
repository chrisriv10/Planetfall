import {afterEach,describe,expect,it} from "vitest";
import * as THREE from "three";
import {BR_STRUCTURES} from "@planetfall/shared";
import {createBrNexusCrown} from "./br-nexus-crown";
import {spinBrMachinery} from "./br-machinery";

const owned:THREE.BufferGeometry[]=[];
const material=new THREE.MeshStandardMaterial();
const make=(elevation=0)=>{
  const original=BR_STRUCTURES.find(s=>s.id==="zero-spire")!;
  const s={...original,position:{...original.position,y:elevation}},origin={x:12,y:elevation+.45,z:-4};
  const box=new THREE.BoxGeometry(1,1,1);owned.push(box);
  const result=createBrNexusCrown(s,origin,{geometry:g=>{owned.push(g);return g;},box,dark:material,metal:material,energy:material,conduit:material});
  const parent=new THREE.Group();parent.position.set(origin.x,origin.y,origin.z);parent.add(result.group);
  return {...result,s,parent};
};
afterEach(()=>{for(const g of owned)g.dispose();owned.length=0;});

describe("Zero Point roof-mounted crown",()=>{
  it("keeps every mesh above the actual roof throughout tilted rotations and maximum core pulse",()=>{
    for(const elevation of [0,8]){
      const {group,animated,parent,s}=make(elevation);
      for(let pose=0;pose<64;pose++){
        for(const target of animated){spinBrMachinery(target,pose/64*Math.PI*2);if(target.userData.pulse)target.scale.setScalar(1.035);}
        parent.updateMatrixWorld(true);
        group.traverse(o=>{
          if(!(o instanceof THREE.Mesh))return;
          const bounds=new THREE.Box3().setFromObject(o);
          expect(bounds.min.y).toBeGreaterThanOrEqual(s.position.y+s.size.y+.14);
          expect(o.userData.cameraCollision).not.toBe(true);
        });
      }
    }
  });
  it("joins braces to their roof pylons and the tapered mast",()=>{
    const {group}=make(),mast=group.getObjectByName("zero-roof-mast") as THREE.Mesh<THREE.CylinderGeometry>;
    const {radiusTop,radiusBottom,height}=mast.geometry.parameters;
    const bottom=mast.position.y-height/2;
    for(const beam of group.children.filter(o=>o.name==="zero-crown-brace")){
      const start=new THREE.Vector3(0,0,-beam.scale.z/2).applyQuaternion(beam.quaternion).add(beam.position);
      const end=new THREE.Vector3(0,0,beam.scale.z/2).applyQuaternion(beam.quaternion).add(beam.position);
      const radius=radiusBottom+(radiusTop-radiusBottom)*(end.y-bottom)/height;
      expect(Math.hypot(end.x,end.z)).toBeLessThan(radius);
      const pylon=group.children.find(o=>o.name==="zero-roof-pylon"&&Math.sign(o.position.x)===Math.sign(start.x)&&Math.sign(o.position.z)===Math.sign(start.z))!;
      expect(Math.abs(start.x-pylon.position.x)).toBeLessThan(pylon.scale.x/2);
      expect(Math.abs(start.z-pylon.position.z)).toBeLessThan(pylon.scale.z/2);
      expect(start.y).toBeLessThan(pylon.position.y+pylon.scale.y/2);
    }
  });
  it("retains three orbit rings and one light while borrowing caller-owned resources",()=>{
    const {group,animated}=make();
    expect(animated.filter(o=>o.name==="zero-crown-orbit")).toHaveLength(3);
    expect(group.children.filter(o=>o instanceof THREE.PointLight)).toHaveLength(1);
    group.traverse(o=>{if(o instanceof THREE.Mesh){expect(owned).toContain(o.geometry);expect(o.material).toBe(material);}});
  });
});
