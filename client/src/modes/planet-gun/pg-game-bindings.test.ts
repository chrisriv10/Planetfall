import {describe,expect,it,vi} from "vitest";
import {PlanetGunGame} from "./pg-game";
import {BindingState} from "../../binding-state";
import {emptyBindingSettings,setBinding} from "../../input-bindings";

function controller(){
 const game=Object.create(PlanetGunGame.prototype) as any;
 const viewer={id:"local",hp:100,slot:0,position:{x:0,y:0,z:0}};
 Object.assign(game,{active:true,blocked:false,review:null,reviewPilot:null,id:"local",socket:{connected:true,emit:vi.fn()},snapshot:{phase:"playing",players:[viewer]},bindings:new BindingState("planet-gun"),bindingHeld:new Set(),bindingEnabled:true,burstCycle:{cancel:vi.fn()},audio:{pgBeam:vi.fn()},cameraLifecycle:{cycle:vi.fn()},modeHold:null,modeDrone:false,onModeAction:vi.fn(),onPause:vi.fn(),onScoreboard:vi.fn(),onModeMenu:vi.fn()});
 return {game,viewer};
}
describe("PlanetGun canonical binding integration",()=>{
 it("dispatches rebound reload and weapon slots from logical actions",()=>{
  const {game}=controller();let settings=emptyBindingSettings();
  const reload=setBinding(settings,"planet-gun","reload",["KeyJ"]);if(!reload.ok)throw Error("binding failed");settings=reload.settings;
  const slot=setBinding(settings,"planet-gun","slot2",["Mouse4"]);if(!slot.ok)throw Error("binding failed");game.bindings.setSettings(slot.settings);
  game.bindingActions(game.bindings.keyDown({code:"KeyJ"}));game.bindingActions(game.bindings.mouseDown(4));
  expect(game.socket.emit.mock.calls).toEqual([["pg:weapon:reload"],["pg:weapon:switch",{slot:1}]]);
  expect(game.bindings.keyDown({code:"KeyR"})).toEqual([]);
 });
 it("buffers fire and jump from any bound device and clears them through lifecycle transitions",()=>{
  const {game}=controller();game.bindingActions(["fire","jump","aim"]);
  expect(game.semiPending).toBe(true);expect(game.mouseFire).toBe(true);expect(game.mouseAds).toBe(true);expect(game.jumpQueuedUntil).toBeGreaterThan(0);
  game.bindings.keyDown({code:"KeyW"});game.bindingHeld.add("moveForward");game.blocked=true;game.syncBindingContext();
  expect(game.semiPending).toBe(false);expect(game.mouseFire).toBe(false);expect(game.jumpQueuedUntil).toBe(0);expect(game.bindingHeld.size).toBe(0);
 });
 it("selects exclusive submode/spectator contexts while retaining the live submode during menus",()=>{
  const {game,viewer}=controller();game.snapshot.mode={id:"planetsiege",pilots:{local:{}}};game.blocked=true;
  expect(game.getBindingContext()).toBe("planet-gun:planetsiege");game.blocked=false;game.syncBindingContext();
  game.bindings.keyDown({code:"KeyC"});expect(game.bindings.held("leanRight")).toBe(true);expect(game.bindings.held("crouch")).toBe(false);
  viewer.hp=0;game.syncBindingContext();expect(game.getBindingContext()).toBe("planet-gun:spectator");expect(game.bindings.held("leanRight")).toBe(false);
  game.bindingActions(game.bindings.keyDown({code:"ArrowRight"}));expect(game.cameraLifecycle.cycle).toHaveBeenCalledWith(game.snapshot,viewer,1);
  game.bindingActions(game.bindings.keyDown({code:"KeyB"}));expect(game.onModeMenu).toHaveBeenCalledTimes(1);
 });
 it("releases the original rebound interaction and stops its authoritative hold",()=>{
  const {game}=controller();const changed=setBinding(emptyBindingSettings(),"planet-gun","interact",["KeyJ"]);if(!changed.ok)throw Error("binding failed");game.bindings.setSettings(changed.settings);
  game.bindings.keyDown({code:"KeyJ"});game.modeHold="forge";game.modeInteractHeld=true;game.bindings.setSettings(emptyBindingSettings());game.bindings.keyUp({code:"KeyJ"});game.releaseBindingHolds();
  expect(game.onModeAction).toHaveBeenCalledWith({kind:"interact",targetId:"forge",held:false});expect(game.modeHold).toBeNull();
 });
 it("keeps Q/E/F/G independent of Z/C lean and supports logical drone/camera actions",()=>{
  const {game}=controller();game.snapshot.mode={id:"planetsiege",site:0,pilots:{local:{}}};game.syncBindingContext();
  expect(game.bindings.keyDown({code:"KeyQ"})).toEqual(["ability1"]);expect(game.bindings.keyDown({code:"KeyE"})).toEqual(["interact"]);expect(game.bindings.keyDown({code:"KeyF"})).toEqual(["ability2"]);expect(game.bindings.keyDown({code:"KeyG"})).toEqual(["ultimate"]);
  game.modeAction("drone");expect(game.onModeAction).toHaveBeenCalledWith(expect.objectContaining({kind:"drone",control:true}));
  game.modeAction("camera");expect(game.onModeAction).toHaveBeenCalledWith({kind:"camera",cameraId:"west-camera"});
 });
});
