import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {createPgPreviewModels,PG_PREVIEW_MODELS,pgPreviewKey,pgPreviewKeyboardView,pgPreviewCameraDistance,pgPreviewAngleDistance,pgPreviewPointsDistance} from "./pg-kit-preview";
import type {PgWeaponId} from "@planetfall/shared";

describe("PlanetGun canonical preview",()=>{
 it("fits every visible hardware part of all ten equipped models at representative drag angles",()=>{
  const models=createPgPreviewModels();try{for(const id of Object.keys(PG_PREVIEW_MODELS)as PgWeaponId[]){const item=models.get(id);item.modules.setModules(["reflex-array","gyro-stabilizer","expanded-cell"]);item.root.updateMatrixWorld(true);const bounds=new THREE.Box3(),points:THREE.Vector3[]=[];item.root.traverseVisible(o=>{if(!(o instanceof THREE.Mesh))return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const b=o.geometry.boundingBox!;for(let i=0;i<8;i++){const p=new THREE.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).applyMatrix4(o.matrixWorld);points.push(p);bounds.expandByPoint(p);}});const center=bounds.getCenter(new THREE.Vector3());points.forEach(p=>p.sub(center));const flat=points.flatMap(p=>p.toArray());for(const yaw of [0,.7,1.57,2.4])for(const pitch of [-.65,.08,.65]){const distance=pgPreviewPointsDistance(flat,3.5,pitch,yaw),rotation=new THREE.Euler(pitch,yaw,0),tangent=Math.tan(34*Math.PI/360);for(const p of points){const q=p.clone().applyEuler(rotation);expect(Math.abs(q.x)/(distance-q.z)).toBeLessThan(tangent*3.5);expect(Math.abs(q.y)/(distance-q.z)).toBeLessThan(tangent);}}}}finally{models.dispose();}
 });
 it("frames side-on weapons prominently while fitting every rotated view independently",()=>{
  const size={x:.5,y:.6,z:2.2},aspect=3.5,tangent=Math.tan(34*Math.PI/360);expect(pgPreviewAngleDistance(size,aspect,.08,-1.13)).toBeLessThan(2);
  for(let yaw=0;yaw<Math.PI*2;yaw+=.3)for(const pitch of [-.65,.08,.65]){const distance=pgPreviewAngleDistance(size,aspect,pitch,yaw);for(const x of[-.25,.25])for(const y of[-.3,.3])for(const z of[-1.1,1.1]){const p=new THREE.Vector3(x,y,z).applyEuler(new THREE.Euler(pitch,yaw,0));expect(Math.abs(p.x)/(distance-p.z)).toBeLessThan(tangent*aspect);expect(Math.abs(p.y)/(distance-p.z)).toBeLessThan(tangent);}}
 });
 it("uses all ten sculpted models with finite anchors and reuses cached instances",()=>{
  const models=createPgPreviewModels();
  for(const id of Object.keys(PG_PREVIEW_MODELS)as PgWeaponId[]){const a=models.get(id);expect(models.get(id)).toBe(a);expect(a.root.getObjectByName(`pg-${id}-power-cell`)).toBeDefined();expect(a.root.userData.muzzle).toBeInstanceOf(THREE.Vector3);expect(a.root.getObjectByName(`${id}-emitter-service-vane`)).toBeDefined();const b=new THREE.Box3().setFromObject(a.root);expect(b.isEmpty()).toBe(false);expect(b.max.length()).toBeLessThan(4);}
  models.dispose();expect(()=>models.get("pulse")).toThrow("disposed");
 });
 it("owns and disposes cached model resources exactly once",()=>{
  const models=createPgPreviewModels(),m=models.get("orbit"),part=m.root.getObjectByName("orbit-light-slide")as THREE.Mesh,dispose=vi.spyOn(part.geometry,"dispose");models.dispose();models.dispose();expect(dispose).toHaveBeenCalledTimes(1);
 });
 it("frames broad weapons more closely than a sphere while enclosing idle rotation",()=>{
  const size={x:.5,y:.6,z:2.2},distance=pgPreviewCameraDistance(size,2,.08),old=Math.hypot(size.x,size.y,size.z)*.5/Math.sin(34*Math.PI/360);
  expect(distance).toBeLessThan(old*.8);
  const tangent=Math.tan(34*Math.PI/360);
  for(let yaw=0;yaw<Math.PI*2;yaw+=.13)for(const x of[-.25,.25])for(const y of[-.3,.3])for(const z of[-1.1,1.1]){
   const corner=new THREE.Vector3(x,y,z).applyEuler(new THREE.Euler(.08,yaw,0));
   expect(Math.abs(corner.x)/(distance-corner.z)).toBeLessThan(tangent*2);
   expect(Math.abs(corner.y)/(distance-corner.z)).toBeLessThan(tangent);
  }
 });
 it("canonicalizes module order for thumbnail caching",()=>{expect(pgPreviewKey("pulse",["reflex-array","expanded-cell"])).toBe(pgPreviewKey("pulse",["expanded-cell","reflex-array"]));expect(pgPreviewKey("pulse",[])).not.toBe(pgPreviewKey("orbit",[]));});
 it("rotates and zooms from the keyboard with bounded pitch/zoom and a reset",()=>{
  const view={yaw:0,pitch:.64,zoom:.76};
  expect(pgPreviewKeyboardView("ArrowRight",view)?.yaw).toBeCloseTo(.12);
  expect(pgPreviewKeyboardView("ArrowDown",view)?.pitch).toBe(.65);
  expect(pgPreviewKeyboardView("+",view)?.zoom).toBe(.75);
  expect(pgPreviewKeyboardView("-",{...view,zoom:1.39})?.zoom).toBe(1.4);
  expect(pgPreviewKeyboardView("Home",view)).toEqual({yaw:-1.13,pitch:.08,zoom:1});
  expect(pgPreviewKeyboardView("Tab",view)).toBeNull();expect(view).toEqual({yaw:0,pitch:.64,zoom:.76});
 });
});
