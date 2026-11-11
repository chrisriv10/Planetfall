import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {createPgEnvironmentBuilder,type PgArtMaterial} from "./pg-environment-builder";
const palette=():Record<PgArtMaterial,THREE.Material>=>({ivory:new THREE.MeshStandardMaterial(),frame:new THREE.MeshStandardMaterial(),dark:new THREE.MeshStandardMaterial(),glass:new THREE.MeshStandardMaterial(),soil:new THREE.MeshStandardMaterial(),leaf:new THREE.MeshStandardMaterial(),cyan:new THREE.MeshStandardMaterial(),amber:new THREE.MeshStandardMaterial(),violet:new THREE.MeshStandardMaterial(),paving:new THREE.MeshStandardMaterial()});
describe("shared neighborhood instance ownership",()=>{
 it("stores sRGB paint in one static batch, defaulting unpainted instances to white",()=>{
  const materials=palette(),art=createPgEnvironmentBuilder(materials);
  const placement=Object.freeze([1,2,3,4,5,6] as const);
  art.context.add("plain","box","ivory",placement);
  art.context.add("painted","box","ivory",placement,undefined,false,0xd58064);
  art.context.add("plain again","box","ivory",placement);
  art.context.add("signal","box","amber",placement);
  art.finish();
  const mesh=art.root.getObjectByName("neighborhood:box:ivory:false") as THREE.InstancedMesh;
  const signal=art.root.getObjectByName("neighborhood:box:amber:false") as THREE.InstancedMesh;
  expect(mesh.material).toBe(materials.ivory);
  expect(mesh.count).toBe(3);
  const colors=mesh.instanceColor!;
  expect(colors.usage).toBe(THREE.StaticDrawUsage);
  expect(signal.instanceColor).toBeNull();
  const color=new THREE.Color();
  for(const [index,hex] of [0xffffff,0xd58064,0xffffff].entries()){
   mesh.getColorAt(index,color);
   expect(color.getHex()).toBe(hex);
  }
  const version=colors.version;
  art.setQuality("low");art.setQuality("high");art.finish();
  expect(mesh.instanceColor).toBe(colors);
  expect(colors.version).toBe(version);
  expect((materials.ivory as THREE.MeshStandardMaterial).color.getHex()).toBe(0xffffff);
  art.dispose();Object.values(materials).forEach(m=>m.dispose());
 });
 it("merges district features by geometry/material while preserving transformed audit data and Low silhouettes",()=>{
  const materials=palette(),art=createPgEnvironmentBuilder(materials);
  art.context.add("habitat","box","ivory",[1,2,3,2,3,4]);art.context.add("engineering","box","ivory",[8,4,6,3,2,1]);art.context.add("vent","box","ivory",[4,3,2,.1,.2,.1],undefined,true);
  art.context.add("hatch","torus","frame",[12.623,1.9,29.4,.71,.71,.12],[0,Math.PI/2,0]);art.finish();art.finish();
  const meshes:THREE.InstancedMesh[]=[];art.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)meshes.push(o);});expect(meshes).toHaveLength(3);expect(meshes.find(m=>m.count===2)?.userData.features.map((f:{name:string})=>f.name)).toEqual(["habitat","engineering"]);
  const hatch=meshes.find(m=>m.userData.features[0].name==="hatch")!;const matrix=new THREE.Matrix4();hatch.getMatrixAt(0,matrix);hatch.geometry.computeBoundingBox();const bounds=hatch.geometry.boundingBox!.clone().applyMatrix4(matrix);expect(bounds.max.x-bounds.min.x).toBeLessThan(.011);expect(bounds.max.y-bounds.min.y).toBeGreaterThan(1.4);
  art.setQuality("low");const visible:THREE.Object3D[]=[];art.root.traverseVisible(o=>visible.push(o));expect(visible.filter(o=>o instanceof THREE.InstancedMesh)).toHaveLength(2);art.dispose();Object.values(materials).forEach(m=>m.dispose());
 });
 it("rejects malformed geometry and disposes only owned geometries exactly once",()=>{
  const materials=palette(),spies=Object.values(materials).map(m=>vi.spyOn(m,"dispose")),art=createPgEnvironmentBuilder(materials);
  expect(()=>art.context.add("bad","box","dark",[NaN,0,0,1,1,1])).toThrow("Invalid neighborhood art");expect(()=>art.context.add("flat","box","dark",[0,0,0,1,0,1])).toThrow("Invalid neighborhood art");
  art.context.add("valid","box","dark",[0,0,0,1,1,1]);art.finish();const mesh=art.root.children.find(o=>o instanceof THREE.InstancedMesh)as THREE.InstancedMesh,dispose=vi.spyOn(mesh.geometry,"dispose"),instanceDispose=vi.spyOn(mesh,"dispose");art.dispose();art.dispose();expect(dispose).toHaveBeenCalledTimes(1);expect(instanceDispose).toHaveBeenCalledTimes(1);expect(spies.every(s=>s.mock.calls.length===0)).toBe(true);Object.values(materials).forEach(m=>m.dispose());
 });
});
