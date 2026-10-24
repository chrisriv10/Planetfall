import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {createPrEventArt,type PrEventKind} from "./pr-event-art";

const kinds:PrEventKind[]=["qualify","boost","eliminate","land"];
function active(mesh:THREE.InstancedMesh){const m=new THREE.Matrix4();let count=0;for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);for(const value of m.elements)expect(Number.isFinite(value)).toBe(true);if(new THREE.Vector3().setFromMatrixScale(m).length()>0)count++;}return count;}
describe("shared PlanetRun event pool",()=>{
 it("bounds every event storm to one batch and 96 transient slots, with Low capped at 24",()=>{
  const art=createPrEventArt(),mesh=art.root.children[0] as THREE.InstancedMesh;
  expect(art.root.children).toHaveLength(1);expect(mesh.instanceMatrix.count).toBe(96);
  for(let i=0;i<100;i++)art.emit(kinds[i%4],{x:1,y:2,z:3},0xffaa77,1000);
  art.update(1050);expect(active(mesh)).toBe(96);
  art.setQuality("low");art.update(1060);expect(mesh.count).toBe(24);expect(active(mesh)).toBeLessThanOrEqual(24);
  art.setQuality("medium");art.update(1061);expect(mesh.count).toBe(60);expect(active(mesh)).toBeLessThanOrEqual(24);
  art.dispose();
 });
 it("expires every effect within 650ms, never shows future timestamps, and rejects nonfinite positions",()=>{
  for(const kind of kinds){const art=createPrEventArt(),mesh=art.root.children[0] as THREE.InstancedMesh;
   art.emit(kind,{x:NaN,y:0,z:0},0xffffff,0);art.update(0);expect(active(mesh)).toBe(0);
   art.emit(kind,{x:0,y:0,z:0},"#99ffee",100);art.update(50);expect(active(mesh)).toBe(0);art.update(120);expect(active(mesh)).toBeGreaterThan(0);
   art.update(750);expect(active(mesh)).toBe(0);art.update(10);expect(active(mesh)).toBe(0);art.dispose();
  }
 });
 it("keeps colors supplied by integration and reuses all GPU resources until idempotent cleanup",()=>{
  const art=createPrEventArt(),mesh=art.root.children[0] as THREE.InstancedMesh,geometry=mesh.geometry,material=mesh.material as THREE.Material,matrix=mesh.instanceMatrix,colors=mesh.instanceColor;
  const sd=vi.fn(),gd=vi.fn(),md=vi.fn();mesh.addEventListener("dispose",sd);geometry.addEventListener("dispose",gd);material.addEventListener("dispose",md);
  art.emit("qualify",{x:0,y:0,z:0},0x35adfc,0);const color=new THREE.Color();mesh.getColorAt(0,color);expect(color.getHex()).toBe(0x35adfc);
  for(let ms=0;ms<1000;ms+=16)art.update(ms);
  expect(mesh.geometry).toBe(geometry);expect(mesh.material).toBe(material);expect(mesh.instanceMatrix).toBe(matrix);expect(mesh.instanceColor).toBe(colors);
  art.dispose();art.dispose();expect(sd).toHaveBeenCalledTimes(1);expect(gd).toHaveBeenCalledTimes(1);expect(md).toHaveBeenCalledTimes(1);expect(art.root.children).toHaveLength(0);
 });
});
