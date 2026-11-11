import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PG_LEAN, pgCreateGun, pgLeanOffset, type PgSnapshotPlayer } from "@planetfall/shared";
import { createAstronautVisual } from "../../astronaut";
import { createPgPilotPresentation } from "./pg-pilot-presentation";

function setup() {
  const rig = createAstronautVisual({identityColor:"#ffffff",suitAccent:"#aabbcc",isBot:false});
  const presentation = createPgPilotPresentation(rig);
  const yaw = .63;
  rig.group.rotation.y = yaw + Math.PI;
  rig.group.scale.setScalar(.85);
  const state = {yaw, lean:0, mode:"ground",grounded:true,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],
    slot:0,hp:100,pitch:0,adsSince:0} as PgSnapshotPlayer;
  const posture = rig.upperBody.parent!, held = rig.upperBody.getObjectByName("planet-gun-held-weapon")!;
  return {rig,presentation,state,posture,held};
}
const position = (part:THREE.Object3D) => part.getWorldPosition(new THREE.Vector3());
describe("remote Siege lean", () => {
  it("isolates survivor finishes, clears them outside Zombies, and hides an inserted primary",()=>{
    const a=setup(),b=setup();a.presentation.update(a.state,1000);b.presentation.update(b.state,1000);
    const colors=(held:THREE.Object3D)=>{const values:number[]=[];held.traverse(part=>{if(part instanceof THREE.Mesh&&part.material instanceof THREE.MeshStandardMaterial)values.push(part.material.color.getHex());});return values;};
    const ordinary=colors(a.held);expect(colors(b.held)).toEqual(ordinary);
    a.presentation.update(a.state,1000,{upgradeTier:3});expect(colors(a.held)).not.toEqual(ordinary);expect(colors(b.held)).toEqual(ordinary);
    a.presentation.update(a.state,1000,{upgradeTier:3,weaponInserted:true});expect(a.held.visible).toBe(false);
    a.presentation.update(a.state,1000);expect(a.held.visible).toBe(true);expect(colors(a.held)).toEqual(ordinary);
    a.presentation.dispose();b.presentation.update(b.state,1000);expect(colors(b.held)).toEqual(ordinary);b.presentation.dispose();
  });
  it("matches the authoritative head offset on both sides and keeps the feet planted", () => {
    const {rig,presentation,state,posture} = setup();
    presentation.update(state,1000);
    const head=position(rig.helmet),torso=position(rig.torso),foot=position(rig.rightFoot);
    for(const lean of [-1,.4,1,0]) {
      const pose={...state,lean}; const expected = new THREE.Vector3().copy(pgLeanOffset(pose));
      for(let i=0;i<8;i++) presentation.update(pose,1000+i);
      expect(position(rig.helmet).sub(head).distanceTo(expected)).toBeLessThan(1e-6);
      expect(posture.rotation.z).toBeCloseTo(lean*PG_LEAN.roll);
      expect(position(rig.rightFoot).distanceTo(foot)).toBe(0);
      if(lean) expect(position(rig.torso).sub(torso).length()).toBeLessThan(expected.length());
    }
    presentation.dispose();
  });
  it("layers over ADS and reload, yields to falling and death, and resets for display", () => {
    const {presentation,state,posture,held}=setup();
    state.guns[0].reloadUntil=1750;state.adsSince=100;
    presentation.update(state,1000);
    const pitch=posture.rotation.x,depth=posture.position.z,gunPose=held.quaternion.clone();
    expect(pitch).toBeGreaterThan(0);expect(held.rotation.x).toBeGreaterThan(0);
    presentation.update({...state,lean:1},1000);
    expect(posture.rotation.x).toBe(pitch);expect(posture.position.z).toBe(depth);expect(held.quaternion.equals(gunPose)).toBe(true);
    presentation.update({...state,lean:1,grounded:false,mode:"air"},1000);expect(posture.rotation.z).toBe(0);expect(posture.position.x).toBe(0);
    presentation.update({...state,lean:1,hp:0,deadAt:0},1000);expect(posture.rotation.z).toBeCloseTo(.95);expect(held.visible).toBe(false);
    presentation.display({weaponId:"pulse"}); expect(posture.position.toArray()).toEqual([0,0,0]);expect(posture.rotation.z).toBe(0);expect(held.visible).toBe(true);
    presentation.dispose();
  });
});
