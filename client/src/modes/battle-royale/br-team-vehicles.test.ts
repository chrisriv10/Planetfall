import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {BR_VEHICLE_DEFINITIONS} from "@planetfall/shared";
import {createBrTeamVehicle,updateBrTeamVehicle,disposeBrTeamVehicle} from "./br-team-vehicles";
describe("team vehicle presentation",()=>{
  it("separates exposed rover surfaces instead of layering different finishes coplanar",()=>{
    const visual=createBrTeamVehicle("relay-rover");visual.group.updateMatrixWorld(true);
    const bounds=(name:string)=>new THREE.Box3().setFromObject(visual.group.getObjectByName(name)!);
    expect(bounds("vehicle-floor").max.x).toBeLessThan(1.49);
    expect(bounds("vehicle-floor").max.z).toBeLessThan(2.79);
    for(const part of visual.group.getObjectsByProperty("name","vehicle-side-sill")){
      const b=new THREE.Box3().setFromObject(part);expect(Math.max(Math.abs(b.min.x),Math.abs(b.max.x))).toBeLessThan(1.48);
    }
    for(const part of visual.group.getObjectsByProperty("name","rover-drive-armor")){
      const b=new THREE.Box3().setFromObject(part);expect(Math.max(Math.abs(b.min.x),Math.abs(b.max.x))).toBeCloseTo(1.49);
    }
    expect(bounds("rover-drive-vent").min.x).toBeLessThan(-1.499);
    expect(bounds("rover-front-grille").max.z-bounds("vehicle-nose").max.z).toBeGreaterThan(.009);
    expect(bounds("rover-hood-center").max.y-bounds("rover-stepped-hood").max.y).toBeGreaterThan(.009);
    disposeBrTeamVehicle(visual);
  });
  it("keeps the rover drive armor and hood inside existing body collision envelopes",()=>{
    const visual=createBrTeamVehicle("relay-rover");visual.group.updateMatrixWorld(true);
    for(const name of ["rover-stepped-hood","rover-hood-center","rover-drive-armor","rover-drive-vent","rover-drive-status","rover-cabin-step","rover-front-grille"]){
      const parts=visual.group.getObjectsByProperty("name",name);expect(parts.length).toBeGreaterThan(0);
      for(const part of parts){
        const bounds=new THREE.Box3().setFromObject(part);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-1.50001);expect(bounds.max.x).toBeLessThanOrEqual(1.50001);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-2.80001);expect(bounds.max.z).toBeLessThanOrEqual(2.80001);
        expect(bounds.min.y).toBeGreaterThanOrEqual(.63999);expect(bounds.max.y).toBeLessThanOrEqual(1.12001);
      }
    }
    const chassis=new THREE.Box3().setFromObject(visual.group.getObjectByName("rover-drive-chassis")!);
    expect(chassis.min.y).toBeCloseTo(.4);expect(chassis.max.y).toBeCloseTo(.7);
    expect(chassis.getSize(new THREE.Vector3()).toArray()).toEqual([2.6,.30000000000000004,4.8]);
    disposeBrTeamVehicle(visual);
  });
  for(const kind of ["relay-rover","ion-shuttle"] as const)it(`${kind} preserves canonical occupant anchors and bounded resources`,()=>{
    const visual=createBrTeamVehicle(kind);
    expect(visual.seatAnchors).toHaveLength(kind==="relay-rover"?4:2);
    for(let i=0;i<visual.seatAnchors.length;i++){
      const seat=BR_VEHICLE_DEFINITIONS[kind].seats[i];
      expect(visual.seatAnchors[i].position.toArray()).toEqual([seat.x,seat.y,seat.z]);
    }
    expect(visual.driverAnchor).toBe(visual.seatAnchors[0]);
    const bounds=new THREE.Box3().setFromObject(visual.group),size=bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThanOrEqual(kind==="relay-rover"?3:6.8);
    expect(size.x).toBeLessThan(kind==="relay-rover"?3.1:6.9);
    expect(size.z).toBeLessThan(kind==="relay-rover"?5.8:5);
    expect(bounds.min.y).toBeGreaterThan(.35);
    let draws=0;visual.group.traverse(o=>{expect(o).not.toBeInstanceOf(THREE.Light);if(o instanceof THREE.Mesh&&o.visible)draws++;});
    expect(draws).toBeLessThanOrEqual(24);expect(visual.resources.geometries).toHaveLength(2);expect(visual.resources.materials).toHaveLength(5);
    for(const t of [0,1,10,NaN])updateBrTeamVehicle(visual,{time:t,speed:30,steering:1});
    expect(visual.model.position.toArray()).toEqual([0,0,0]);
    const spies=[...visual.resources.geometries,...visual.resources.materials].map(r=>vi.spyOn(r,"dispose"));
    disposeBrTeamVehicle(visual);disposeBrTeamVehicle(visual);for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);
  });
});
