import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {DEFAULT_COSMETICS,SHOP_CATALOG,type PrSnapshotPlayer} from "@planetfall/shared";
import {createAstronautVisual} from "../../astronaut";
import {createPrPilotPresentation} from "./pr-pilot-presentation";

function fixture(){
 const rig=createAstronautVisual({identityColor:"#55aacc",suitAccent:"#55aacc",isBot:false}),scene=new THREE.Scene();scene.add(rig.group);
 const state={equippedCosmetics:{...DEFAULT_COSMETICS},color:"#55aacc",velocity:{x:0,y:0,z:0},grounded:true,diveUntil:0,diveReadyAt:0,status:"active",emote:null,emoteStartedAt:0} as PrSnapshotPlayer;
 const art=createPrPilotPresentation(rig,scene),trail=scene.getObjectByName("planet-run-cosmetic-trail") as THREE.InstancedMesh;
 return {rig,scene,state,art,trail};
}
describe("PlanetRun canonical pilot presentation",()=>{
 it("leaves root transforms and snapshot data unchanged, and does not emit for idle or walking",()=>{
  const {rig,state,art,trail}=fixture();rig.group.position.set(2,3,4);rig.group.rotation.set(.1,.5,.2);rig.group.scale.setScalar(1.1);
  const pos=rig.group.position.clone(),rot=rig.group.quaternion.clone(),scale=rig.group.scale.clone();state.velocity.z=4;const before=JSON.stringify(state);
  for(let i=0;i<40;i++)art.update(state,i*50,.05,{lowGravity:true,boosted:false});
  expect(trail.visible).toBe(false);expect(rig.group.position).toEqual(pos);expect(rig.group.quaternion.toArray()).toEqual(rot.toArray());expect(rig.group.scale).toEqual(scale);expect(JSON.stringify(state)).toBe(before);art.dispose();
 });
 it("uses supplied gravity/boost context for airborne stretch, bounded trails, and landing recovery",()=>{
  const {rig,state,art,trail}=fixture(),baseScale=rig.torso.scale.clone(),baseY=rig.torso.position.y;
  state.grounded=false;state.velocity={x:4,y:3,z:0};art.update(state,50,.05,{lowGravity:true});art.update(state,100,.05,{lowGravity:true});
  expect(trail.visible).toBe(true);expect(trail.count).toBe(8);expect(rig.torso.scale.y).toBeGreaterThan(baseScale.y);expect(rig.leftArm.rotation.z).toBe(.4);
  state.velocity.y=-10;art.update(state,150,.05);state.grounded=true;state.velocity.y=0;art.update(state,200,.05);expect(rig.torso.position.y).toBeLessThan(baseY);
  for(let i=0;i<30;i++)art.update(state,250+i*50,.05);expect(rig.torso.position.y).toBeCloseTo(baseY);expect(trail.visible).toBe(false);
  art.update(state,1800,.05,{boosted:true});expect(trail.visible).toBe(true);expect(rig.leftArm.rotation.x).toBe(.55);art.dispose();expect(rig.torso.scale).toEqual(baseScale);
 });
 it("preserves catalog trail identity and skips all trail uploads for far pilots",()=>{
  const {state,art,trail}=fixture();const item=SHOP_CATALOG.find(i=>i.category==="trail"&&i.color)!;state.equippedCosmetics.trail=item.id;state.velocity.z=13;
  art.update(state,50,.05,{boosted:true});expect((trail.material as THREE.MeshBasicMaterial).color.getHex()).toBe(new THREE.Color(item.color!).getHex());
  const version=trail.instanceMatrix.version;for(let i=0;i<20;i++)art.update(state,100+i*50,.05,{boosted:true,detail:"far"});expect(trail.visible).toBe(false);expect(trail.instanceMatrix.version).toBe(version);
  state.velocity.z=0;art.update(state,1200,.05);expect(trail.visible).toBe(false);art.dispose();
 });
 it("bounds qualify/eliminate accents and owns only its trail resources",()=>{
  const {rig,state,art,trail,scene}=fixture(),geo=trail.geometry,mat=trail.material as THREE.Material,buffer=trail.instanceMatrix,sd=vi.fn(),gd=vi.fn(),md=vi.fn();trail.addEventListener("dispose",sd);geo.addEventListener("dispose",gd);mat.addEventListener("dispose",md);
  state.status="qualified";art.update(state,100,.05);expect(trail.visible).toBe(true);expect(rig.leftArm.rotation.x).toBeLessThan(-2);
  for(let i=0;i<25;i++)art.update(state,150+i*50,.05);expect(trail.visible).toBe(false);
  state.status="eliminated";art.update(state,1500,.05);expect(trail.visible).toBe(true);expect(rig.leftArm.rotation.z).toBe(.85);
  for(let i=0;i<25;i++)art.update(state,1550+i*50,.05);expect(trail.visible).toBe(false);
  expect(trail.geometry).toBe(geo);expect(trail.material).toBe(mat);expect(trail.instanceMatrix).toBe(buffer);art.dispose();art.dispose();expect(sd).toHaveBeenCalledTimes(1);expect(gd).toHaveBeenCalledTimes(1);expect(md).toHaveBeenCalledTimes(1);expect(scene.children).toEqual([rig.group]);
 });
});
