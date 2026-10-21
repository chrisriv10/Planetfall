import {expect,it} from "vitest";
import * as THREE from "three";
import {createBrHeldAim} from "./br-held-aim";

it("reconstructs world aim through body facing, torso twist and nonuniform squash",()=>{
  const aim=createBrHeldAim(),parent=new THREE.Matrix4(),rotation=new THREE.Quaternion(),position=new THREE.Vector3(13,4,-25),scale=new THREE.Vector3(.97,1.06,1.02);
  const local=new THREE.Vector3(),world=new THREE.Vector3();
  for(const facing of [-Math.PI,-1.2,0,2.1])for(const twist of [-.12,0,.12])for(const pitch of [-.75,0,1.15]){
    rotation.setFromEuler(new THREE.Euler(.09,facing+twist,.08));parent.compose(position,rotation,scale);
    world.set(Math.sin(facing)*Math.cos(pitch),Math.sin(pitch),-Math.cos(facing)*Math.cos(pitch));
    const before=parent.clone(),shot=world.clone();
    expect(aim.resolve(world,parent)).toBe(true);
    const p=aim.state.pitch,y=aim.state.yaw;
    local.set(Math.cos(p)*Math.sin(y),-Math.sin(p),Math.cos(p)*Math.cos(y)).transformDirection(parent);
    expect(local.distanceTo(world)).toBeLessThan(1e-10);
    expect(parent).toEqual(before);expect(world).toEqual(shot);
  }
});

it("keeps unsupported local directions exact instead of silently clamping",()=>{
  const aim=createBrHeldAim();
  expect(aim.resolve({x:1,y:0,z:0},new THREE.Matrix4())).toBe(true);
  expect(aim.state.yaw).toBeCloseTo(Math.PI/2);
  expect(aim.resolve({x:0,y:1,z:0},new THREE.Matrix4())).toBe(true);
  expect(aim.state.pitch).toBeCloseTo(-Math.PI/2);
});

it("rejects zero, invalid and singular transforms without retaining valid status",()=>{
  const aim=createBrHeldAim(),identity=new THREE.Matrix4();
  for(const [direction,matrix]of [
    [{x:0,y:0,z:0},identity],
    [{x:NaN,y:0,z:1},identity],
    [{x:1e308,y:1e308,z:1e308},identity],
    [{x:0,y:0,z:1},new THREE.Matrix4().makeScale(0,1,1)],
    [{x:0,y:0,z:1},new THREE.Matrix4().makeTranslation(Infinity,0,0)],
  ] as const){
    expect(aim.resolve({x:0,y:0,z:1},identity)).toBe(true);
    expect(aim.resolve(direction,matrix)).toBe(false);expect(aim.state.valid).toBe(false);
  }
});
