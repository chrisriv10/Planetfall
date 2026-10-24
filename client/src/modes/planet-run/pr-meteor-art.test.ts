import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {createPrMeteorArt} from "./pr-meteor-art";

describe("meteor phase presentation",()=>{
 it("descends only during real warning and seeks directly to supplied impact age",()=>{
  const art=createPrMeteorArt({x:3.2,y:2,z:3.2}),incoming=art.root.getObjectByName("incoming-meteor-trail") as THREE.InstancedMesh,matrix=new THREE.Matrix4();
  art.update(false,true,100,{warningProgress:0,impactAgeMs:null});incoming.getMatrixAt(0,matrix);const high=matrix.elements[13];
  art.update(false,true,200,{warningProgress:.9,impactAgeMs:null});incoming.getMatrixAt(0,matrix);expect(matrix.elements[13]).toBeLessThan(high);expect(incoming.visible).toBe(true);
  art.update(true,false,300,{warningProgress:0,impactAgeMs:900});expect(incoming.visible).toBe(false);expect(art.root.getObjectByName("meteor-fragments")!.visible).toBe(false);
  art.update(false,false,400);expect(art.root.visible).toBe(false);art.dispose();art.dispose();expect(art.root.children).toHaveLength(0);
 });
});
