import {describe,expect,it,vi} from "vitest";
import * as THREE from "three";
import {createAstronautVisual} from "../../astronaut";
import {createPgInfectedIdentityArt} from "./pg-infected-identity-art";

const rig=()=>createAstronautVisual({identityColor:"#ffa663",suitAccent:"#574761",isBot:false});
describe("infected astronaut identity art",()=>{
  it("sets three distinct silhouettes on canonical body pivots within the standing envelope",()=>{
    const headWidths:number[]=[],packs:number[]=[];
    for(const kind of ["drifter","skitter","bulwark"] as const){
      const r=rig(),bones=[r.group,r.upperBody,r.helmet,r.backpack,r.leftArm,r.rightArm,r.leftLeg,r.rightLeg],bind=bones.map(o=>[o.parent,o.position.clone(),o.quaternion.clone(),o.scale.clone()] as const);
      const art=createPgInfectedIdentityArt(r,kind);r.group.updateMatrixWorld(true);
      bones.forEach((o,i)=>{expect(o.parent).toBe(bind[i][0]);expect(o.position.equals(bind[i][1])).toBe(true);expect(o.quaternion.equals(bind[i][2])).toBe(true);expect(o.scale.equals(bind[i][3])).toBe(true);});
      const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity),p=new THREE.Vector3();
      const materials=new Set<THREE.Material>();
      r.group.traverse(node=>{
        if(!(node instanceof THREE.Mesh))return;
        materials.add(node.material);
        const pos=node.geometry.getAttribute("position");
        for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(node.matrixWorld);min.min(p);max.max(p);}
      });
      expect(materials.size).toBe(3);expect([...min.toArray(),...max.toArray()].every(Number.isFinite)).toBe(true);
      expect(max.x-min.x).toBeLessThanOrEqual(1.65);expect(max.y-min.y).toBeLessThanOrEqual(2.4);
      expect(r.helmet.getObjectByName("astronaut-eyes")).toBeUndefined();expect(r.visor.parent).toBeNull();
      headWidths.push(new THREE.Box3().setFromObject(r.helmet,true).getSize(p).x);
      packs.push(new THREE.Box3().setFromObject(r.backpack,true).getSize(p).x);
      for(const anchor of [r.helmet,r.backpack,r.upperBody,r.leftArm,r.rightArm]){
        expect(anchor.children.filter(o=>o.name.startsWith("infected-")).length).toBeLessThanOrEqual(3);
      }
      art.dispose();
    }
    expect(headWidths[1]).toBeLessThan(headWidths[0]);expect(headWidths[1]).toBeLessThan(headWidths[2]);
    expect(packs[2]).toBeGreaterThan(packs[0]);expect(packs[0]).toBeGreaterThan(packs[1]);
  });
  it("restores the original friendly head, tanks and shared materials and disposes only the added batches",()=>{
    const r=rig(),helmet=[...r.helmet.children],backpack=[...r.backpack.children],eyes=r.helmet.getObjectByName("astronaut-eyes")!;
    const ref=r.torso.material,baseGeometry=r.torso.geometry,releaseBase=vi.spyOn(ref,"dispose"),releaseGeo=vi.spyOn(baseGeometry,"dispose");
    const art=createPgInfectedIdentityArt(r,"drifter"),owned=r.helmet.children[0] as THREE.Mesh;
    const releaseOwned=vi.spyOn(owned.geometry,"dispose"),releaseMat=vi.spyOn(owned.material as THREE.Material,"dispose");
    expect(r.torso.material).not.toBe(ref);art.dispose();art.dispose();
    expect(releaseOwned).toHaveBeenCalledOnce();expect(releaseMat).toHaveBeenCalledOnce();
    expect(releaseBase).not.toHaveBeenCalled();expect(releaseGeo).not.toHaveBeenCalled();
    expect(r.torso.material).toBe(ref);expect(r.helmet.children).toEqual(helmet);expect(r.backpack.children).toEqual(backpack);expect(eyes.parent).toBe(r.helmet);
  });
});
