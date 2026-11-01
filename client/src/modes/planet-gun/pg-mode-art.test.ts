import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {pgCreateCollisionSnapshot,type PgModeSnapshot} from "@planetfall/shared";
import {createPgModeArt} from "./pg-mode-art";
const state=():Extract<PgModeSnapshot,{id:"planetzombies"}>=>({id:"planetzombies",collision:pgCreateCollisionSnapshot(),effects:[],pilots:{},round:1,subphase:"wave",deadline:10000,wave:1,remaining:1,queued:0,zombies:[],power:false,unlocked:[],reason:null});
describe("PlanetGun authoritative world presentation",()=>{
 it("marks objectives with ground rings and labels without solid posts through the capture position",()=>{
  const art=createPgModeArt(),s=state();art.update(s,"",0);
  const marker=art.group.getObjectByName("pg-objective-power")!;
  expect(marker.visible).toBe(true);expect(marker.children.filter(o=>o instanceof THREE.Mesh).map(o=>(o as THREE.Mesh).geometry.type)).toEqual(["RingGeometry"]);
  art.dispose();
 });
 it("joins heal beam endpoints at torso height and reuses the effect pool without stale transforms",()=>{
  const art=createPgModeArt(),s=state();s.effects=[{id:"beam",kind:"heal",ownerId:"p",team:"solar",position:{x:2,y:3,z:4},end:{x:5,y:7,z:4},radius:0,startsAt:0,endsAt:1000,hp:0,maxHp:0}];
  art.update(s,"",100);const root=art.group.getObjectByName("pg-effect-heal-beam")!,[boundary,volume,core]=root.children as THREE.Mesh[],geometry=core.geometry,material=core.material as THREE.MeshBasicMaterial;
  root.updateMatrixWorld(true);expect(core.localToWorld(new THREE.Vector3(0,-.5,0)).distanceTo(new THREE.Vector3(2,4,4))).toBeLessThan(1e-6);expect(core.localToWorld(new THREE.Vector3(0,.5,0)).distanceTo(new THREE.Vector3(5,8,4))).toBeLessThan(1e-6);expect(core.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([3.5,6,4]);expect(core.scale.toArray()).toEqual([.045,5,.045]);expect(boundary.visible).toBe(false);expect(volume.visible).toBe(false);expect(core.visible).toBe(true);expect(material.color.getHex()).toBe(0x69d6f1);expect(material.transparent).toBe(true);expect(material.opacity).toBeGreaterThan(0);expect(material.opacity).toBeLessThan(1);
  s.effects[0].end={...s.effects[0].position};art.update(s,"",200);expect(core.visible).toBe(false);expect(core.quaternion.toArray()).toEqual([0,0,0,1]);expect(core.scale.y).toBe(0);
  delete s.effects[0].end;art.update(s,"",300);expect(boundary.visible).toBe(true);expect(core.visible).toBe(false);expect(core.position.toArray()).toEqual([0,.25,0]);expect(core.scale.toArray()).toEqual([.35,.5,.35]);expect(core.quaternion.toArray()).toEqual([0,0,0,1]);expect(core.geometry).toBe(geometry);expect(core.material).toBe(material);
  s.effects[0].end={x:2,y:9,z:4};art.update(s,"",400);expect(core.visible).toBe(true);expect(core.scale.y).toBe(6);art.update(s,"",1000);expect(root.visible).toBe(false);art.update(null,"",1100);expect(art.group.visible).toBe(false);
  let geometryDisposals=0,materialDisposals=0;geometry.addEventListener("dispose",()=>geometryDisposals++);material.addEventListener("dispose",()=>materialDisposals++);art.dispose();art.dispose();expect(geometryDisposals).toBe(1);expect(materialDisposals).toBe(1);expect(art.group.children).toHaveLength(0);
 });
 it("animates opposed legs only while moving and settles back to idle",()=>{
  const art=createPgModeArt(),s=state();s.zombies=[{id:"walker",kind:"drifter",position:{x:0,y:0,z:0},yaw:0,hp:100,maxHp:100,windupUntil:0}];
  const left=art.group.getObjectByName("pg-infected-drifter-left-leg") as THREE.InstancedMesh,right=art.group.getObjectByName("pg-infected-drifter-right-leg") as THREE.InstancedMesh,a=new THREE.Matrix4(),b=new THREE.Matrix4();
  art.update(s,"",0);left.getMatrixAt(0,a);const idleRotation=a.elements.slice(0,12);art.update(s,"",100);left.getMatrixAt(0,a);expect(a.elements.slice(0,12)).toEqual(idleRotation);
  s.zombies[0].position.x=.3;art.update(s,"",200);left.getMatrixAt(0,a);right.getMatrixAt(0,b);expect(a.elements.slice(0,12)).not.toEqual(idleRotation);expect(a.elements[6]).toBeCloseTo(-b.elements[6]);
  art.update(s,"",1000);left.getMatrixAt(0,a);expect(a.elements.slice(0,12)).toEqual(idleRotation);art.dispose();
 });
 it("uses distinct skitter hunch and bulwark braced windup without moving root anchors",()=>{
  const art=createPgModeArt(),s=state();s.zombies=[{id:"tank",kind:"bulwark",position:{x:3,y:0,z:4},yaw:0,hp:100,maxHp:100,windupUntil:0},{id:"runner",kind:"skitter",position:{x:6,y:0,z:4},yaw:0,hp:100,maxHp:100,windupUntil:0}];
  const arm=art.group.getObjectByName("pg-infected-bulwark-left-arm") as THREE.InstancedMesh,body=art.group.getObjectByName("pg-infected-skitter") as THREE.InstancedMesh,a=new THREE.Matrix4();art.update(s,"",0);arm.getMatrixAt(0,a);const relaxed=[...a.elements];body.getMatrixAt(0,a);expect(Math.abs(a.elements[6])).toBeGreaterThan(.1);
  s.zombies[0].windupUntil=1000;art.update(s,"",100);arm.getMatrixAt(0,a);expect(a.elements).not.toEqual(relaxed);const ring=art.group.getObjectByName("pg-infected-windup") as THREE.InstancedMesh;ring.getMatrixAt(0,a);expect(a.elements[12]).toBe(3);expect(a.elements[14]).toBe(4);art.dispose();
 });
 it("keeps fifteen bounded limb batches and stable resources across motion and cleanup",()=>{
  const art=createPgModeArt(),s=state(),parts:THREE.InstancedMesh[]=[];art.group.traverse(o=>{if(o instanceof THREE.InstancedMesh&&o.name.startsWith("pg-infected-")&&o.name!=="pg-infected-windup")parts.push(o);});
  expect(parts).toHaveLength(15);expect(new Set(parts.map(p=>p.material)).size).toBe(3);const resources=parts.map(p=>[p.geometry,p.material,p.instanceMatrix]);s.zombies=Array.from({length:32},(_,i)=>({id:String(i),kind:"skitter",position:{x:i,y:0,z:0},yaw:0,hp:100,maxHp:100,windupUntil:0}));
  for(let frame=0;frame<40;frame++){for(const z of s.zombies)z.position.z+=.1;art.update(s,"",frame*50);for(const p of parts)expect(p.count).toBe(p.name.includes("skitter")?32:0);}
  parts.forEach((p,i)=>{expect(p.geometry).toBe(resources[i][0]);expect(p.material).toBe(resources[i][1]);expect(p.instanceMatrix).toBe(resources[i][2]);});art.update(null,"",2100);for(const p of parts)expect(p.count).toBe(0);art.dispose();
 });
 it("renders precise active panel bounds and removes destroyed barriers immediately",()=>{
  const art=createPgModeArt(),s=state(),p=s.collision.panels[0];art.update(s,"",0);const mesh=art.group.getObjectByName(`pg-panel-${p.id}`) as THREE.Mesh;expect(mesh.position.toArray()).toEqual([p.solid.center.x,p.solid.center.y,p.solid.center.z]);expect(mesh.scale.toArray()).toEqual([p.solid.half.x*2,p.solid.half.y*2,p.solid.half.z*2]);p.active=false;art.update(s,"",1);expect(mesh.visible).toBe(false);art.dispose();
 });
 it("caps infected instances, shows windups and clears all pooled state on mode exit",()=>{
  const art=createPgModeArt(),s=state();s.zombies=Array.from({length:50},(_,i)=>({id:String(i),kind:"skitter",position:{x:i,y:0,z:0},yaw:0,hp:100,maxHp:100,windupUntil:1000}));art.update(s,"",0);const mesh=art.group.getObjectByName("pg-infected-skitter") as THREE.InstancedMesh,windup=art.group.getObjectByName("pg-infected-windup") as THREE.InstancedMesh;expect(mesh.count).toBe(32);expect(windup.count).toBe(32);art.update(null,"",1);expect(mesh.count).toBe(0);expect(windup.count).toBe(0);expect(art.group.visible).toBe(false);art.dispose();art.dispose();expect(art.group.children).toHaveLength(0);
 });
 it("keeps smoke essential and removes expired effects",()=>{
  const art=createPgModeArt(),s=state();s.effects=[{id:"smoke",kind:"smoke",ownerId:"p",team:"solar",position:{x:0,y:1,z:0},radius:4,startsAt:0,endsAt:1000,hp:0,maxHp:0}];art.update(s,"",200);const smoke=art.group.getObjectByName("pg-effect-smoke-smoke")!;expect(smoke.visible).toBe(true);expect((smoke.children[1] as THREE.Mesh).scale.x).toBe(4);expect(smoke.children[1].position.y).toBe(1);expect(((smoke.children[1] as THREE.Mesh).material as THREE.Material).opacity).toBeGreaterThan(.9);art.update(s,"",1001);expect(smoke.visible).toBe(false);art.dispose();
 });
});
