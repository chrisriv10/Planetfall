import {expect,describe,it,vi} from "vitest";
import * as THREE from "three";
import {PG_ZOMBIE_BARRICADE_SITES,type PgDynamicPanel} from "@planetfall/shared";
import {createPgZombieBarricadeArt} from "./pg-zombie-barricade-art";

function fixture(){
 const art=createPgZombieBarricadeArt(PG_ZOMBIE_BARRICADE_SITES);
 const panels:PgDynamicPanel[]=PG_ZOMBIE_BARRICADE_SITES.flatMap(site=>[...site.boards,...site.posts].map(part=>({...part,hp:30,maxHp:30,active:true,reinforced:false,revision:0})));
 const boards=art.root.getObjectByName("pg-entry-barricade-boards") as THREE.InstancedMesh;
 const posts=art.root.getObjectByName("pg-entry-barricade-posts") as THREE.InstancedMesh;
 return {art,panels,boards,posts};
}
describe("zombie entry barricade visuals",()=>{
 it("fits each physical board and post at both site orientations in two batches",()=>{
  const {art,panels,boards,posts}=fixture();art.update(panels);
  expect(boards.count).toBe(9);expect(posts.count).toBe(6);expect(art.root.children).toHaveLength(2);
  for(const mesh of [boards,posts]){
   mesh.geometry.computeBoundingBox();
   for(let i=0;i<mesh.count;i++){
    const panel=panels.find(p=>p.id===mesh.userData.panelIds[i])!;
    expect(art.ownsPanel(panel.id)).toBe(true);
    const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);
    const bounds=mesh.geometry.boundingBox!.clone().applyMatrix4(matrix);
    for(const axis of ["x","y","z"] as const){
     expect(bounds.min[axis]).toBeCloseTo(panel.solid.center[axis]-panel.solid.half[axis],5);
     expect(bounds.max[axis]).toBeCloseTo(panel.solid.center[axis]+panel.solid.half[axis],5);
    }
   }
  }
  expect(art.ownsPanel("door")).toBe(false);art.dispose();
 });
 it("shows damage on surviving steel and leaves a clear opening after a board is removed",()=>{
  const {art,panels,boards,posts}=fixture();const site=PG_ZOMBIE_BARRICADE_SITES[0];
  panels[0].hp=15;panels[1].active=false;
  art.update(panels,site.id);expect(boards.count).toBe(8);
  const meter=boards.geometry.getAttribute("integrityRepair"),status=posts.geometry.getAttribute("integrityRepair");
  expect(meter.getX(0)).toBe(.5);expect(status.getX(0)).toBe(.5);expect(status.getY(0)).toBe(1);expect(status.getY(2)).toBe(0);
  expect(boards.userData.panelIds.slice(0,boards.count)).not.toContain(panels[1].id);
  const version=boards.instanceMatrix.version;art.update(panels,site.id);expect(boards.instanceMatrix.version).toBe(version);
  art.update(null);expect(art.root.visible).toBe(false);
  art.update(panels.filter(panel=>panel.id.startsWith("installation-")));expect(boards.count).toBe(0);expect(posts.count).toBe(6);expect(status.getX(0)).toBe(0);
  panels[1].active=true;art.update(panels);expect(boards.count).toBe(9);expect(status.getY(0)).toBe(0);
  const dispose=vi.spyOn(boards.geometry,"dispose");art.dispose();art.dispose();expect(dispose).toHaveBeenCalledTimes(1);expect(art.root.children).toHaveLength(0);
 });
});
