import {describe,expect,it,vi} from "vitest";
import {PlanetRunGame} from "./pr-game";
import {BindingState} from "../../binding-state";
import {emptyBindingSettings,setBinding} from "../../input-bindings";
function controller(){
 const game=Object.create(PlanetRunGame.prototype) as any,viewer={id:"local",status:"active"};
 Object.assign(game,{active:true,blocked:false,review:null,localId:"local",socket:{connected:true,emit:vi.fn()},snapshot:{phase:"running",players:[viewer]},bindings:new BindingState("planet-run"),bindingHeld:new Set(),bindingEnabled:true,spectatorIndex:0,cameraDragging:false});
 return {game,viewer};
}
describe("PlanetRun canonical binding integration",()=>{
 it("supports rebound jump, dive and movement without changing controller ownership",()=>{
  const {game}=controller();let settings=emptyBindingSettings();
  for(const [action,token]of [["jump","Mouse4"],["dive","KeyJ"],["moveForward","KeyK"]]as const){const result=setBinding(settings,"planet-run",action,[token]);if(!result.ok)throw Error("binding failed");settings=result.settings;}
  game.bindings.setSettings(settings);game.bindings.mouseDown(4);game.bindings.keyDown({code:"KeyJ"});game.bindings.keyDown({code:"KeyK"});
  expect([...game.bindings.sample().held].sort()).toEqual(["dive","jump","moveForward"]);expect(game.bindings.keyDown({code:"Space"})).toEqual([]);
 });
 it("routes remapped emotes and uses separate spectator controls after elimination",()=>{
  const {game,viewer}=controller();game.bindingActions(game.bindings.keyDown({code:"KeyV"}));expect(game.socket.emit).toHaveBeenCalledWith("pr:emote",{emote:"wave"});
  game.bindings.keyDown({code:"KeyW"});viewer.status="eliminated";game.syncBindingContext();expect(game.getBindingContext()).toBe("planet-run:spectator");expect(game.bindings.held("moveForward")).toBe(false);
  expect(game.canLook()).toBe(false);game.bindingActions(game.bindings.keyDown({code:"KeyE"}));expect(game.spectatorIndex).toBe(1);
  const changed=setBinding(emptyBindingSettings(),"planet-run:spectator","previousTarget",["WheelUp"]);if(!changed.ok)throw Error("binding failed");game.bindings.setSettings(changed.settings);
  game.bindingActions(game.bindings.wheel(-1));expect(game.spectatorIndex).toBe(0);
 });
 it("clears held movement/drag on modal, phase and disconnect transitions",()=>{
  const {game}=controller();game.bindings.keyDown({code:"KeyW"});game.bindingHeld.add("moveForward");game.cameraDragging=true;game.blocked=true;game.syncBindingContext();
  expect(game.bindingHeld.size).toBe(0);expect(game.cameraDragging).toBe(false);expect(game.bindings.held("moveForward")).toBe(false);
  game.blocked=false;game.syncBindingContext();game.bindings.keyDown({code:"KeyW"});game.snapshot.phase="results";game.syncBindingContext();expect(game.bindings.sample().held.size).toBe(0);
  game.snapshot.phase="running";game.syncBindingContext();game.bindings.keyDown({code:"KeyW"});game.socket.connected=false;game.syncBindingContext();expect(game.bindings.sample().held.size).toBe(0);
 });
});
