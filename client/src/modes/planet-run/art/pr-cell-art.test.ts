import {describe,expect,it,vi} from "vitest";
import * as THREE from "three";
import {PR_BALANCE,PR_ROUNDS} from "@planetfall/shared";
import {createPrCellArt} from "./pr-cell-art";
const round=PR_ROUNDS.find(r=>r.id==="shatterdeck")!;
const matrix=new THREE.Matrix4();
function scale(mesh:THREE.InstancedMesh,index:number){mesh.getMatrixAt(index,matrix);return [matrix.elements[0],matrix.elements[5],matrix.elements[10]];}

describe("instanced Shatterdeck cells",()=>{
 it("preserves exact pointy hex support and intact scale through the entire live timeline",()=>{
  const art=createPrCellArt(round),tile=round.tiles[0];art.cells.geometry.computeBoundingBox();const b=art.cells.geometry.boundingBox!;
  expect(art.cells.name).toBe("shatterdeck-cells");expect(b.max.x).toBeCloseTo(Math.sqrt(3)*PR_BALANCE.tileRadius/2);expect(b.max.z).toBeCloseTo(PR_BALANCE.tileRadius);
  for(const ms of [0,100,459,460,619]){art.update(ms,new Map([[tile.id,0]]));expect(scale(art.cells,0)).toEqual([1,1,1]);expect(matrix.elements[13]+b.max.y).toBeCloseTo(tile.center.y);}
  art.update(PR_BALANCE.tileBreakMs,new Map([[tile.id,0]]));expect(scale(art.cells,0)).toEqual([0,0,0]);expect(scale(art.cells,1)).toEqual([1,1,1]);art.dispose();
 });
 it("removes every tile surface and trim on gone, keeps layer colors distinct, and owns only five batches",()=>{
  const art=createPrCellArt(round),meshes=art.root.children as THREE.InstancedMesh[];
  expect(meshes).toHaveLength(5);expect(meshes.slice(0,4).every(m=>m.count===round.tiles.length)).toBe(true);
  const colors=new Set<number>(),c=new THREE.Color();for(let deck=0;deck<4;deck++){meshes[1].getColorAt(round.tiles.findIndex(t=>t.deck===deck),c);colors.add(c.getHex());}expect(colors.size).toBe(4);
  const gone=new Map(round.tiles.map(t=>[t.id,0]));art.update(PR_BALANCE.tileBreakMs,gone);
  for(const mesh of meshes.slice(0,4))for(let i=0;i<mesh.count;i++)expect(scale(mesh,i)).toEqual([0,0,0]);
  art.dispose();
 });
 it("bounds and expires downward shards, suppresses old transitions, and scales VFX with quality",()=>{
  const art=createPrCellArt(round),shards=art.root.children[4] as THREE.InstancedMesh;
  expect(shards.count).toBeLessThan(96);
  const all=new Map(round.tiles.map(t=>[t.id,0]));art.update(620,all);
  let active=0;for(let i=0;i<shards.count;i++){shards.getMatrixAt(i,matrix);if(matrix.elements[0]!==0){active++;expect(matrix.elements[13]).toBeLessThan(18-.4);}}
  expect(active).toBe(72);art.update(1000,all);for(let i=0;i<shards.count;i++)expect(scale(shards,i)).toEqual([0,0,0]);
  art.update(0,new Map());art.setQuality("medium");art.update(620,new Map([[round.tiles[0].id,0]]));active=0;for(let i=0;i<shards.count;i++)if(scale(shards,i)[0]!==0)active++;expect(active).toBe(3);
  art.setQuality("low");art.update(621,all);expect(shards.visible).toBe(false);for(let i=0;i<shards.count;i++)expect(scale(shards,i)).toEqual([0,0,0]);
  art.setQuality("high");art.update(0,new Map());art.update(10000,all);for(let i=0;i<shards.count;i++)expect(scale(shards,i)).toEqual([0,0,0]);art.dispose();
 });
 it("reuses geometry, materials and instance buffers during updates and disposes each resource once",()=>{
  const art=createPrCellArt(round),meshes=art.root.children as THREE.InstancedMesh[];
  const resources=meshes.map(m=>({mesh:m,geometry:m.geometry,material:m.material,matrix:m.instanceMatrix,color:m.instanceColor,dispose:vi.fn(),gd:vi.fn(),md:vi.fn()}));
  for(const r of resources){r.mesh.addEventListener("dispose",r.dispose);r.geometry.addEventListener("dispose",r.gd);(r.material as THREE.Material).addEventListener("dispose",r.md);}
  const triggered=new Map(round.tiles.slice(0,20).map(t=>[t.id,0]));for(let ms=0;ms<1200;ms+=16)art.update(ms,triggered);
  for(const r of resources){expect(r.mesh.geometry).toBe(r.geometry);expect(r.mesh.material).toBe(r.material);expect(r.mesh.instanceMatrix).toBe(r.matrix);expect(r.mesh.instanceColor).toBe(r.color);}
  art.dispose();art.dispose();expect(art.root.children).toHaveLength(0);for(const r of resources){expect(r.dispose).toHaveBeenCalledTimes(1);expect(r.gd).toHaveBeenCalledTimes(1);expect(r.md).toHaveBeenCalledTimes(1);}
 });
});
