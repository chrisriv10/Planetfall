import {describe,expect,it,vi} from "vitest";
import * as THREE from "three";
import {BattleRoyaleGame} from "./br-game";

describe("BR spatial audio listener ownership",()=>{
  it.each([true,false])("hears confirmed remote shots from the current playing/spectating view (alive: %s)",alive=>{
    const predicted={x:-175,y:5,z:-112},corpse={x:-173,y:5,z:-110};
    const camera=new THREE.PerspectiveCamera();camera.position.set(130,4,90);
    const remote=vi.fn();
    // Exercise the real integration entry point without constructing WebGL,
    // Rapier or audio devices. The shot is a server-confirmed remote event.
    const game=Object.assign(Object.create(BattleRoyaleGame.prototype),{
      localId:"pilot",localState:{alive,position:corpse},predictedMotion:{position:predicted},
      camera,yaw:.8,players:new Map(),projectiles:new Map(),
      audio:{brRemoteWeapon:remote},shotEffects:{fire:vi.fn()},shotTraceLength:()=>null
    });
    const origin={x:140,y:4,z:90};
    game.weaponFired({playerId:"other",weaponId:"pulse-rifle",origin,direction:{x:-1,y:0,z:0}});
    expect(remote).toHaveBeenCalledExactlyOnceWith("pulse-rifle",origin,alive?predicted:camera.position,.8);
  });

  it("stops stale airborne and driven-engine loops after elimination",()=>{
    const loop=vi.fn();
    const game=Object.assign(Object.create(BattleRoyaleGame.prototype),{
      localState:{alive:false,deployment:"chute",vehicleId:"old-skimmer"},
      predictedMotion:{deployment:"chute",velocity:{y:-8}},room:{phase:"combat"},
      vehicles:new Map([["old-skimmer",{renderVelocity:{x:20,z:0}}]]),audio:{setBrLoop:loop}
    });
    game.updateBrAudio();
    expect(loop.mock.calls.map(call=>call.slice(0,2))).toEqual([["starliner",false],["drop",false],["skimmer",false]]);
  });
});
