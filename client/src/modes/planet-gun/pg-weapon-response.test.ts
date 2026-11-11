import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {createPgWeaponResponse,PG_WEAPON_RESPONSE_PROFILES} from "./pg-weapon-response";
import {createPgViewmodel,PG_VIEWMODEL_LAYER} from "./pg-viewmodel";
import type {PgPresentationWeapon} from "./pg-reload-art";
import {PG_WEAPONS} from "@planetfall/shared";

const weapons=Object.keys(PG_WEAPON_RESPONSE_PROFILES)as PgPresentationWeapon[];
describe("PlanetGun mechanical weapon response",()=>{
  it("follows the same damped trajectory at 30, 60 and 144 Hz",()=>{
    const samples=[30,60,144].map(fps=>{
      const response=createPgWeaponResponse();response.reset("pulse");let envelope=0;
      for(let i=1;i<=fps/2;i++){
        if(i===1)envelope+=PG_WEAPONS.pulse.recoil*6;
        envelope*=Math.exp(-12/fps);response.update("pulse",envelope,1/fps,0);
        if(i===fps/6)expect(response.output.back).toBeGreaterThan(0);
      }
      return {...response.output};
    });
    for(const sample of samples)for(const key of["back","pitch","yaw","roll"]as const)expect(sample[key]).toBeCloseTo(samples[0][key],12);
  });
  it("takes up continuously, peaks quickly, then recovers without residual drift",()=>{
    for(const weapon of weapons){
      const r=createPgWeaponResponse();r.reset(weapon);const identity=r.output;
      expect(r.update(weapon,1,0,0).back).toBe(0);
      r.update(weapon,Math.exp(-.12),.01,0);expect(r.output.back).toBeGreaterThan(0);
      for(let i=2;i<=300;i++)expect(r.update(weapon,Math.exp(-12*i*.01),.01,0)).toBe(identity);
      expect(r.output.back).toBeLessThan(1e-12);expect(r.output.pitch).toBeLessThan(1e-12);
    }
  });
  it("preserves canonical single-shot amplitude through the game's add-before-decay envelope",()=>{
    for(const weapon of weapons){
      const r=createPgWeaponResponse(),p=PG_WEAPON_RESPONSE_PROFILES[weapon],kick=PG_WEAPONS[weapon].recoil*6;
      r.reset(weapon);let envelope=0,back=0,pitch=0;
      for(let i=0;i<1000;i++){
        if(i===0)envelope+=kick;
        envelope*=Math.exp(-12*.001);const out=r.update(weapon,envelope,.001,0);
        back=Math.max(back,out.back);pitch=Math.max(pitch,out.pitch);
      }
      expect(back).toBeCloseTo(kick*p.travel,5);expect(pitch).toBeCloseTo(kick*p.rise,5);
    }
  });
  it("bounds sustained impulses across the roster and preserves a quiet beam",()=>{
    for(const weapon of weapons){const r=createPgWeaponResponse(),p=PG_WEAPON_RESPONSE_PROFILES[weapon];r.reset(weapon);
      for(let i=0;i<1800;i++){const out=r.update(weapon,i%2,1/144,0);
        expect(out.back).toBeGreaterThanOrEqual(0);expect(out.back).toBeLessThanOrEqual(p.travel);
        expect(out.pitch).toBeLessThanOrEqual(p.rise);expect(Math.abs(out.yaw)).toBeLessThanOrEqual(p.lateral);
      }
    }
    expect(PG_WEAPON_RESPONSE_PROFILES.nova.rate).toBeGreaterThan(PG_WEAPON_RESPONSE_PROFILES.rail.rate);
    expect(PG_WEAPON_RESPONSE_PROFILES.prism.travel).toBeLessThan(PG_WEAPON_RESPONSE_PROFILES.pulse.travel/3);
  });
  it("discards old kick on switch, reset, and interrupted clocks",()=>{
    const r=createPgWeaponResponse();r.reset("comet");r.update("comet",1,0,0);r.update("comet",.8,.02,0);
    expect(r.output.pitch).toBeGreaterThan(0);
    expect(r.update("rail",.8,.02,0)).toEqual({back:0,pitch:0,yaw:0,roll:0});
    r.reset();expect(r.output.back).toBe(0);
    for(const dt of[NaN,-1,2])expect(r.update("rail",1,dt,1)).toEqual({back:0,pitch:0,yaw:0,roll:0});
  });
  it("returns the sights and arms to their original settled ADS pose after firing",()=>{
    for(const weapon of weapons){const vm=createPgViewmodel();
      const update=(time:number,recoil=0)=>vm.update({weapon,ads:1,recoil,reload:0,speed:0,mode:"ground",time});
      for(let i=0;i<=180;i++)update(i*1000/60);
      const rig=vm.root.children[0],position=rig.position.clone(),rotation=rig.quaternion.clone();
      const arm=vm.root.getObjectByName("support-forearm")!.getObjectByName("astronaut-sleeve")!,armPosition=arm.position.clone();
      update(3000,1);for(let i=1;i<=180;i++)update(3000+i*1000/60,Math.exp(-12*i/60));
      expect(rig.position.distanceTo(position)).toBeLessThan(1e-10);expect(rig.quaternion.angleTo(rotation)).toBeLessThan(1e-7);expect(arm.position.distanceTo(armPosition)).toBeLessThan(1e-10);
      vm.root.updateMatrixWorld(true);const meshes:THREE.Object3D[]=[];vm.root.traverseVisible(o=>{if(o instanceof THREE.Mesh&&!o.userData.pgOpticGlass)meshes.push(o);});
      const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1),.01,4);ray.layers.set(PG_VIEWMODEL_LAYER);
      expect(ray.intersectObjects(meshes,false).map(h=>h.object.name)).toEqual([]);vm.dispose();
    }
  });
});
