import {afterEach,expect,it,vi} from "vitest";
import {BattleRoyaleGame} from "./br-game";
import type {BrWeaponId} from "@planetfall/shared";

afterEach(()=>vi.restoreAllMocks());

it.each(["helix-burst-rifle","prism-beam","vortex-cannon"] as BrWeaponId[])("confirmed %s shots update each pilot's facing without sharing flash deduplication",weaponId=>{
  vi.spyOn(performance,"now").mockReturnValue(1000);
  const local={lastShotAt:-Infinity,weapon:{userData:{}},body:{rotation:{x:0}},state:{heldItem:null}};
  const remote={lastShotAt:-Infinity,weapon:{userData:{}},body:{rotation:{x:0}},state:{heldItem:null}};
  const fire=vi.fn(),localAudio=vi.fn(),remoteAudio=vi.fn();
  const game=Object.assign(Object.create(BattleRoyaleGame.prototype),{
    localId:"local",lastAnticipatedFireAt:950,localState:{inventory:[],selectedSlot:0},
    players:new Map([["local",local],["remote",remote]]),projectiles:new Map(),
    audio:{brWeapon:localAudio,brRemoteWeapon:remoteAudio},shotEffects:{fire},
    audioListenerPosition:()=>({x:0,y:0,z:0}),shotTraceLength:()=>null,
    muzzleFlashOrigin:(_visual:unknown,_weapon:unknown,fallback:unknown)=>fallback
  });
  const shot={weaponId,origin:{x:10,y:1,z:0},direction:{x:0,y:0,z:-1}};
  game.weaponFired({...shot,playerId:"local"});
  expect(local.lastShotAt).toBe(1000);
  expect(remote.lastShotAt).toBe(-Infinity);
  expect(fire).not.toHaveBeenCalled();
  expect(localAudio).not.toHaveBeenCalled();
  game.weaponFired({...shot,playerId:"remote"});
  expect(remote.lastShotAt).toBe(1000);
  expect(game.lastAnticipatedFireAt).toBe(950);
  expect(fire).toHaveBeenCalledTimes(1);
  expect(remoteAudio).toHaveBeenCalledTimes(1);
});
