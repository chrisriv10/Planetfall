import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {addPgWeaponPresentation,createPgOrbitModel,createPgBeveledHousingGeometry,createPgSculptedHousingGeometry,type PgWeaponArtResources} from "./pg-weapon-presentation";
import {BrWeaponModelLibrary} from "../battle-royale/br-weapon-model-library";
import {createPgReloadSample,samplePgReload,PG_RELOAD_PROFILES,type PgPresentationWeapon} from "./pg-reload-art";
function resources(){const owned:THREE.Material[]=[];const r:PgWeaponArtResources={box:new THREE.BoxGeometry(1,1,1),metal:new THREE.MeshStandardMaterial(),composite:new THREE.MeshStandardMaterial(),grip:new THREE.MeshStandardMaterial(),ownMaterial:m=>{owned.push(m);return m;}};return{r,dispose(){r.box.dispose();r.metal.dispose();r.composite.dispose();r.grip.dispose();owned.forEach(m=>m.dispose());}};}
describe("PlanetGun first-person service hardware",()=>{
 it("sculpts local Photon and Comet instances without mutating borrowed templates or moving sight/grip components",()=>{
  const library=new BrWeaponModelLibrary(),base=resources(),bevel=createPgBeveledHousingGeometry(),sculpted=createPgSculptedHousingGeometry();
  const r={...base.r,bevel,sculpted};
  try{
   for(const [id,weapon,names]of [["photon-shotgun","photon",["shotgun-front-bead"]],["comet-hand-cannon","comet",["comet-grip","comet-cylinder","comet-muzzle"]]]as const){
    const local=library.create(id,0x81ecdf),other=library.create(id,0x81ecdf),original=other.children.map(o=>({position:o.position.clone(),scale:o.scale.clone(),geometry:o instanceof THREE.Mesh?o.geometry:null,vertices:o instanceof THREE.Mesh?Array.from(o.geometry.getAttribute("position").array):null}));
    const contacts=names.map(name=>({name,matrix:local.getObjectByName(name)!.matrix.clone(),position:local.getObjectByName(name)!.position.clone()}));
    const muzzle=local.userData.muzzle.clone();addPgWeaponPresentation(local,weapon,r);
    expect(local.userData.muzzle).toEqual(muzzle);
    for(const c of contacts){expect(local.getObjectByName(c.name)!.position).toEqual(c.position);expect(local.getObjectByName(c.name)!.matrix).toEqual(c.matrix);}
    other.children.forEach((o,i)=>{
     expect(o.position).toEqual(original[i].position);expect(o.scale).toEqual(original[i].scale);
     if(o instanceof THREE.Mesh){expect(o.geometry).toBe(original[i].geometry);expect(Array.from(o.geometry.getAttribute("position").array)).toEqual(original[i].vertices);}
    });
   }
  }finally{library.dispose();bevel.dispose();sculpted.dispose();base.dispose();}
 });
 it("moves named hardware rather than the model or immutable muzzle",()=>{
  const {r,dispose}=resources();for(const weapon of Object.keys(PG_RELOAD_PROFILES)as PgPresentationWeapon[]){const model=new THREE.Group();model.userData.muzzle=new THREE.Vector3(0,0,-1);const hardware=addPgWeaponPresentation(model,weapon,r),s=createPgReloadSample(),count=model.children.length;
   samplePgReload(weapon,.45,-.2,-.1,-1,s);hardware.update(s,.5);expect(hardware.cell.position.toArray()).toEqual([s.cellX,s.cellY,s.cellZ]);expect(hardware.chamber.rotation.z).not.toBe(0);expect(model.position.toArray()).toEqual([0,0,0]);expect(model.userData.muzzle.toArray()).toEqual([0,0,-1]);
   samplePgReload(weapon,.82,-.2,-.1,-1,s);const previous=hardware.latch.position.z;hardware.update(s,0);expect(hardware.latch.position.z).toBeGreaterThan(previous);
   for(let i=0;i<200;i++)hardware.update(s,.2);expect(model.children.length).toBe(count);
  }dispose();
 });
 it("gives Orbit a slim original slide and no heavy hand-cannon cylinder",()=>{
  const {r,dispose}=resources(),model=createPgOrbitModel(r);expect(model.getObjectByName("orbit-light-slide")).toBeDefined();expect(model.getObjectByName("comet-cylinder")).toBeUndefined();expect(model.userData.muzzle.z).toBe(-.73);expect((model.getObjectByName("orbit-light-slide")as THREE.Mesh).scale.x).toBeLessThan(.2);dispose();
 });
});
