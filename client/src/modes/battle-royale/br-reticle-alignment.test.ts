import {describe,expect,it} from "vitest";
import * as THREE from "three";
import {brMuzzlePosition,brPlayerHitDistance} from "@planetfall/shared";
import {createAstronautVisual} from "../../astronaut";
import {BattleRoyaleGame} from "./br-game";
import {brAstronautRigHeight} from "./br-feedback";

describe("BR reticle and visible astronaut agreement",()=>{
  it("registers precision head rays at the actual standing and crouched helmet centers",()=>{
    const astronaut=createAstronautVisual({identityColor:"#70f5ff",suitAccent:"#70f5ff",isBot:true});
    for(const crouched of [false,true]){
      astronaut.group.position.y=brAstronautRigHeight(false,false,crouched);
      astronaut.group.updateMatrixWorld(true);
      const head=astronaut.helmet.getWorldPosition(new THREE.Vector3());
      const hit=brPlayerHitDistance({x:0,y:head.y,z:10},{x:0,y:0,z:-1},{x:0,y:0,z:0},crouched);
      expect(hit,`visible helmet center ${head.y}`).not.toBeNull();
      expect(hit?.headshot).toBe(true);
      expect(brPlayerHitDistance({x:.301,y:head.y,z:10},{x:0,y:0,z:-1},{x:0,y:0,z:0},crouched)).toBeNull();
    }
    const resources=new Set<THREE.BufferGeometry|THREE.Material>();
    astronaut.group.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)resources.add(mesh.geometry);if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(material=>resources.add(material));});
    resources.forEach(resource=>resource.dispose());
  });

  const camera=new THREE.Vector3(-173.1769348002285,7.324319930006314,-106.75791996538632);
  const feet=new THREE.Vector3(-175,5.035,-116);
  const target=feet.clone().add(new THREE.Vector3(0,1.13,0));
  const direction=target.clone().sub(camera).normalize();
  function aim(overrides: {relevant?:boolean;alive?:boolean;teamId?:string;x?:number;wallDistance?:number}={}){
    const distance=overrides.wallDistance??80,worldPoint=camera.clone().addScaledVector(direction,distance);
    const context={camera:{position:camera},localId:"pilot",localState:{teamId:"local-team"},lookDirection:()=>direction,
      raycaster:{set:()=>{},intersectObjects:()=>[{point:worldPoint,distance}],far:500},islandMeshes:[],
      players:new Map([["target",{relevant:overrides.relevant??true,group:{position:feet.clone().setX(overrides.x??feet.x)},state:{id:"target",teamId:overrides.teamId??"enemy-team",alive:overrides.alive??true,crouched:false,downed:false}}]])};
    const point=(BattleRoyaleGame.prototype as unknown as {aimPoint:(players?:boolean)=>THREE.Vector3}).aimPoint.call(context,true);
    return {point,worldPoint};
  }
  it("converges the muzzle onto the suit actually under the close-range reticle",()=>{
    const {point}=aim(),yaw=Math.atan2(direction.x,-direction.z),pitch=Math.asin(direction.y);
    const origin=brMuzzlePosition({x:-175,y:5.035,z:-112},yaw,pitch);
    const shot=point.clone().sub(new THREE.Vector3(origin.x,origin.y,origin.z)).normalize();
    expect(brPlayerHitDistance(origin,shot,feet)).not.toBeNull();
    expect(point.distanceTo(camera)).toBeLessThan(target.distanceTo(camera));
  });
  it("keeps walls, off-reticle targets, teammates and inactive entries from redirecting aim",()=>{
    for(const overrides of [{wallDistance:4},{x:-170},{teamId:"local-team"},{relevant:false},{alive:false}]){
      const {point,worldPoint}=aim(overrides);expect(point.toArray()).toEqual(worldPoint.toArray());
    }
  });
});
