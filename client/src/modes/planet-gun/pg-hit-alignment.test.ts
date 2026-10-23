import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {pgPilotHit} from "@planetfall/shared";
import {createAstronautVisual} from "../../astronaut";
describe("PlanetGun canonical helmet and combat volume agreement",()=>{
 it("registers standing and crouched helmet-center rays, while obvious misses stay misses",()=>{
  const rig=createAstronautVisual({identityColor:"#80dfff",suitAccent:"#80dfff",isBot:false});rig.group.scale.setScalar(.85);
  for(const crouched of [false,true]){
   rig.group.position.y=crouched?.04:.25;rig.group.updateMatrixWorld(true);const head=rig.helmet.getWorldPosition(new THREE.Vector3());
   const origin={x:0,y:head.y,z:10},direction={x:0,y:0,z:-1},feet={x:0,y:0,z:0};
   expect(pgPilotHit(origin,direction,feet,crouched)?.headshot).toBe(true);
   expect(pgPilotHit({...origin,x:.4},direction,feet,crouched)?.headshot).toBe(true);
   expect(pgPilotHit({...origin,x:.65},direction,feet,crouched)).toBeNull();
  }
  const resources=new Set<THREE.BufferGeometry|THREE.Material>();rig.group.traverse(o=>{if(o instanceof THREE.Mesh){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);}});resources.forEach(r=>r.dispose());
 });
});
