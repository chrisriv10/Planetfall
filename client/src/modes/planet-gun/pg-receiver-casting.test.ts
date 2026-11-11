import {expect,it} from "vitest";
import * as THREE from "three";
import {createPgReceiverCastingGeometry,fitPgReceiverCasting} from "./pg-receiver-casting";
import {createPgPreviewModels,PG_PREVIEW_MODELS} from "./pg-kit-preview";
import type {PgWeaponId} from "@planetfall/shared";

it("preserves folding-stock openings, visible striker faces and replaceable optic feet",()=>{
  const models=createPgPreviewModels();
  try{
    for(const id of ["nova","quasar"] as const){
      const {root}=models.get(id),heel=root.getObjectByName(`pg-${id}-shaped-pad`) as THREE.Mesh;
      const bounds=new THREE.Box3().setFromObject(heel);
      expect(bounds.min.x).toBeGreaterThan(.04);
      expect(bounds.max.x-bounds.min.x).toBeLessThan(.07);
    }
    const {root}=models.get("orbit");
    const frame=new THREE.Box3().setFromObject(root.getObjectByName("orbit-composite-frame")!);
    const striker=new THREE.Box3().setFromObject(root.getObjectByName("orbit-rear-striker-inset")!);
    expect(striker.max.z-frame.max.z).toBeGreaterThan(.01);
    for(const id of ["arc","prism"] as const){
      const model=models.get(id),feet=model.root.children.filter(o=>o.name==="optic-mount-foot");
      expect(feet).toHaveLength(2);model.modules.setModules(["precision-lens"]);
      expect(feet.every(o=>!o.visible)).toBe(true);
    }
  }finally{models.dispose();}
});

it("fits one existing action on each of the ten weapons without moving any model parts",()=>{
  const models=createPgPreviewModels(),casting=createPgReceiverCastingGeometry(),materials:THREE.Material[]=[];
  try{
    for(const id of Object.keys(PG_PREVIEW_MODELS) as PgWeaponId[]){
      const {root}=models.get(id);
      const parts:THREE.Object3D[]=[];root.traverse(o=>parts.push(o));
      root.updateMatrixWorld(true);
      const transforms=parts.map(o=>o.matrixWorld.clone()),muzzle=root.userData.muzzle.clone();
      fitPgReceiverCasting(root,id,casting,m=>{materials.push(m);return m;});
      expect(parts.filter(o=>o instanceof THREE.Mesh && o.geometry===casting),id).toHaveLength(1);
      root.updateMatrixWorld(true);
      expect(parts.map(o=>o.matrixWorld)).toEqual(transforms);
      expect(root.userData.muzzle).toEqual(muzzle);
    }
  }finally{models.dispose();materials.forEach(m=>m.dispose());casting.dispose();}
});

it("builds a closed patterned casting with inset shoulders inside the original receiver envelope",()=>{
  const geometry=createPgReceiverCastingGeometry();
  try{
    const positions=geometry.getAttribute("position"),colors=geometry.getAttribute("color"),uv=geometry.getAttribute("uv");
    expect(positions.count/3).toBeLessThan(150);
    expect(colors.count).toBe(positions.count);expect(uv.count).toBe(positions.count);
    const edges=new Map<string,number>();
    const peak=new THREE.Vector3(),floor=new THREE.Vector3();
    let shoulder=-Infinity,channel=-Infinity;
    for(let i=0;i<positions.count;i++){
      const v=peak.fromBufferAttribute(positions,i);
      expect(Math.max(Math.abs(v.x),Math.abs(v.y),Math.abs(v.z))).toBeLessThanOrEqual(.50001);
      if(v.z>.10 && v.z<.14){
        if(Math.abs(v.x)<.13)channel=Math.max(channel,v.y);
        if(Math.abs(v.x)>.16)shoulder=Math.max(shoulder,v.y);
      }
      const next=i%3===2?i-2:i+1,b=floor.fromBufferAttribute(positions,next);
      const edge=[v.toArray().join(","),b.toArray().join(",")].sort().join("|");
      edges.set(edge,(edges.get(edge)??0)+1);
    }
    expect(shoulder-channel).toBeGreaterThan(.1);
    expect([...edges.values()].every(n=>n===2)).toBe(true);
    expect(Math.min(...colors.array)).toBeLessThan(.5);
  }finally{geometry.dispose();}
});
