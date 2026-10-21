import {expect,it,vi} from "vitest";
import * as THREE from "three";
import {createAstronautVisual} from "../../astronaut";
import {buildBrWeaponModel} from "./br-weapons";
import {createBrHeldPresentation,type BrHeldPresentationFrame} from "./br-held-presentation";

it("returns a visibly interrupted reload along the current-aim path and releases borrowed resources once",()=>{
  const rig=createAstronautVisual({identityColor:"#70f5ff",suitAccent:"#ffd84d",isBot:false});
  const model=new THREE.Group(),wrapper=new THREE.Group();buildBrWeaponModel(model,"helix-burst-rifle",0xffffff);wrapper.add(model);rig.upperBody.add(wrapper);
  const children=model.children.slice();
  const resources={box:new THREE.BoxGeometry(),material:new THREE.MeshBasicMaterial(),cylinder:new THREE.CylinderGeometry(1,1,1,8)};
  const spies=Object.values(resources).map(resource=>vi.spyOn(resource,"dispose"));
  const controller=createBrHeldPresentation(rig,model,"helix-burst-rifle",resources);
  const frame:BrHeldPresentationFrame={dt:1/60,pitch:0,yaw:0,recoil:0,reloadProgress:null};
  const step=()=>{controller.beforeMotion();expect(controller.update(wrapper,frame)).toBe(true);};
  for(let i=0;i<14;i++)step();
  frame.reloadProgress=.5;step();expect(controller.state.reloadProgress).toBe(.5);
  frame.reloadProgress=null;frame.pitch=.3;
  let prior=.5,returns=0;
  while(controller.state.reloadProgress!==null&&returns<20){step();if(controller.state.reloadProgress!==null){expect(controller.state.reloadProgress).toBeGreaterThanOrEqual(prior);prior=controller.state.reloadProgress;}returns++;}
  expect(returns).toBeLessThan(20);expect(controller.state.recovering).toBe(false);
  const expected=new THREE.Vector3(0,-Math.sin(.3),Math.cos(.3));
  wrapper.updateWorldMatrix(true,false);
  expect(new THREE.Vector3(0,0,-1).transformDirection(wrapper.matrixWorld).distanceTo(expected)).toBeLessThan(1e-8);
  controller.dispose();controller.dispose();expect(model.children).toEqual(children);spies.forEach(spy=>expect(spy).not.toHaveBeenCalled());
  expect(controller.update(wrapper,frame)).toBe(false);Object.values(resources).forEach(resource=>resource.dispose());
});

it("rejects invalid action progress before moving the weapon",()=>{
  const rig=createAstronautVisual({identityColor:"#70f5ff",suitAccent:"#ffd84d",isBot:false}),model=new THREE.Group(),wrapper=new THREE.Group();
  buildBrWeaponModel(model,"quasar-carbine",0xffffff);wrapper.add(model);rig.upperBody.add(wrapper);
  const resources={box:new THREE.BoxGeometry(),material:new THREE.MeshBasicMaterial(),cylinder:new THREE.CylinderGeometry(1,1,1,8)};
  const controller=createBrHeldPresentation(rig,model,"quasar-carbine",resources);
  const position=wrapper.position.clone(),quaternion=wrapper.quaternion.clone();
  for(const progress of [NaN,-.1,1.1])expect(controller.update(wrapper,{dt:.016,pitch:0,yaw:0,recoil:0,reloadProgress:progress})).toBe(false);
  expect(wrapper.position).toEqual(position);expect(wrapper.quaternion.toArray()).toEqual(quaternion.toArray());expect(controller.state.weight).toBe(0);
  controller.dispose();Object.values(resources).forEach(resource=>resource.dispose());
});

it("keeps the completed two-hand pose when reload interrupts initial equip",()=>{
  const rig=createAstronautVisual({identityColor:"#70f5ff",suitAccent:"#ffd84d",isBot:false}),model=new THREE.Group(),wrapper=new THREE.Group();
  buildBrWeaponModel(model,"prism-beam",0xffffff);wrapper.add(model);rig.upperBody.add(wrapper);
  const resources={box:new THREE.BoxGeometry(),material:new THREE.MeshBasicMaterial(),cylinder:new THREE.CylinderGeometry(1,1,1,8)};
  const controller=createBrHeldPresentation(rig,model,"prism-beam",resources);
  const frame:BrHeldPresentationFrame={dt:1/60,pitch:0,yaw:0,recoil:0,reloadProgress:.2};
  controller.beforeMotion();expect(controller.update(wrapper,frame)).toBe(true);
  frame.reloadProgress=null;
  for(let i=0;i<12;i++){controller.beforeMotion();expect(controller.update(wrapper,frame)).toBe(true);}
  expect(controller.state.weight).toBe(1);expect(controller.state.reloadProgress).toBeNull();
  controller.dispose();Object.values(resources).forEach(resource=>resource.dispose());
});
