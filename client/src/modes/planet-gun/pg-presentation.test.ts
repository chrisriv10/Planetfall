import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {PG_MAP,pgCreateGun,type PgWeaponId,type PgSnapshotPlayer} from "@planetfall/shared";
import {PgWorldRenderer} from "./pg-world";
import {createPgViewmodel} from "./pg-viewmodel";
import {createPgPilotPresentation} from "./pg-pilot-presentation";
import {createAstronautVisual} from "../../astronaut";
import {PgHomePreview} from "./pg-home-preview";

describe("PlanetGun presentation",()=>{
  it("renders every authoritative solid at its exact position and dimensions",()=>{
    const world=new PgWorldRenderer(),actual:number[][]=[],matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
    world.root.traverse(o=>{if(o instanceof THREE.InstancedMesh&&o.name.startsWith("body-"))for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);actual.push([...position.toArray(),...scale.toArray()]);}});
    expect(actual).toHaveLength(PG_MAP.solids.length);
    for(const s of PG_MAP.solids){const expected=[s.center.x,s.center.y,s.center.z,s.half.x*2,s.half.y*2,s.half.z*2];expect(actual.some(a=>a.every((v,i)=>Math.abs(v-expected[i])<.00001))).toBe(true);}
    world.dispose();
  });
  it("quality removes detail without changing core surfaces, and resource disposal is repeatable",()=>{
    const world=new PgWorldRenderer();
    const count=()=>{let n=0;world.root.traverseVisible(o=>{if(o instanceof THREE.Mesh)n++;});return n;};
    world.setQuality("high");const high=count();world.setQuality("low");expect(count()).toBeLessThan(high);
    world.root.traverse(o=>{if(o.name.startsWith("body-"))expect(o.visible).toBe(true);});
    world.update(1000);world.dispose();world.dispose();expect(world.root.children).toHaveLength(0);
  });
  it("switches canonical weapons and centers settled ADS without touching shot state",()=>{
    const vm=createPgViewmodel();
    for(const weapon of ["pulse","nova","photon","quasar","rail","comet"]as PgWeaponId[]){
      for(let i=1;i<90;i++)vm.update({weapon,ads:1,recoil:0,reload:0,speed:0,mode:"ground",time:i*16});
      const rig=vm.root.children[0];expect(Math.abs(rig.position.x)).toBeLessThan(.001);
      expect(rig.children.filter(o=>o.name.startsWith("br-weapon-")&&o.visible)).toHaveLength(1);
      expect(rig.getObjectByName("support-forearm")).toBeDefined();expect(rig.getObjectByName("trigger-forearm")).toBeDefined();
    }
    vm.dispose();vm.dispose();expect(vm.root.children).toHaveLength(0);
  });
  it("remote weapon points along the canonical pilot's positive Z facing and shares safe ownership",()=>{
    const rig=createAstronautVisual({identityColor:"#fff",suitAccent:"#aaa",isBot:false}),other=createAstronautVisual({identityColor:"#fff",suitAccent:"#aaa",isBot:false});
    const art=createPgPilotPresentation(rig),second=createPgPilotPresentation(other);
    const state={guns:[pgCreateGun("pulse"),pgCreateGun("comet")],slot:0,hp:100,pitch:0} as unknown as PgSnapshotPlayer;
    art.update(state,0);second.update(state,0);
    const held=rig.upperBody.getObjectByName("planet-gun-held-weapon")!;
    expect(new THREE.Vector3(0,0,-1).applyQuaternion(held.quaternion).z).toBeGreaterThan(.99);
    const posture=rig.group.getObjectByName("planet-gun-pilot-posture")!;
    art.update({...state,hp:0,deadAt:10},360);expect(held.visible).toBe(false);expect(posture.rotation.z).toBeGreaterThan(.9);
    art.update({...state,hp:100},2700);expect(held.visible).toBe(true);expect(posture.rotation.z).toBe(0);expect(posture.position.y).toBe(0);
    art.update({...state,mode:"slide"},2800);const slidePitch=posture.rotation.x;expect(slidePitch).toBeGreaterThan(0);
    art.update({...state,mode:"slide"},2816);expect(posture.rotation.x).toBe(slidePitch);
    art.update({...state,mode:"wall-run",yaw:0,wallNormal:{x:1,y:0,z:0}},2900);const lean=posture.rotation.z;
    art.update({...state,mode:"wall-run",yaw:0,wallNormal:{x:-1,y:0,z:0}},2916);expect(posture.rotation.z).toBeCloseTo(-lean);
    art.update({...state,grounded:false,jumpHeld:true,ion:50},3000);expect(posture.rotation.x).toBeGreaterThan(0);
    art.update({...state,grounded:true,mode:"ground",adsSince:2999},3016);expect(posture.position.z).toBeGreaterThan(0);
    art.update({...state,grounded:true,mode:"ground",adsSince:0},3032);expect(posture.rotation.toArray().slice(0,3)).toEqual([0,0,0]);expect(posture.position.toArray()).toEqual([0,0,0]);
    art.dispose();second.update({...state,guns:[pgCreateGun("rail"),pgCreateGun("comet")]},20);second.dispose();
    expect(rig.upperBody.getObjectByName("planet-gun-held-weapon")).toBeUndefined();
    expect(rig.upperBody.parent).toBe(rig.group);
    for(const astronaut of[rig,other])astronaut.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
  });
  it("home arena stays finite through aspect changes and disposes",()=>{
    const preview=new PgHomePreview();for(const aspect of[.6,1,1.78,2.4]){preview.update(2,aspect);expect(preview.root.position.toArray().every(Number.isFinite)).toBe(true);expect(preview.root.scale.x).toBeGreaterThan(0);}preview.dispose();expect(preview.root.children).toHaveLength(0);
  });
});
