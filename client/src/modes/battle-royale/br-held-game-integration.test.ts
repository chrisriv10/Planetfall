import {expect,it,vi} from "vitest";
import * as THREE from "three";
import {BattleRoyaleGame} from "./br-game";

it("uses optimistic local slot selection and restores support before releasing a replaced model",()=>{
  const order:string[]=[],oldModel=new THREE.Group(),weapon=new THREE.Group();weapon.add(oldModel);
  weapon.userData.rarity="common";
  const old={itemId:"helix-burst-rifle",rarity:"common"},selected={itemId:"quasar-carbine",rarity:"rare"};
  const visual={state:{id:"pilot",heldItem:old,vehicleId:null,downed:false,deployment:"grounded"},
    weapon,weaponId:"helix-burst-rifle",group:{visible:true},rig:{visible:true},emote:null,
    supported:{dispose:()=>order.push("restore-support")},supportedModel:oldModel};
  const build=vi.fn(()=>order.push("build-selected"));
  const game=Object.assign(Object.create(BattleRoyaleGame.prototype),{
    localId:"pilot",localState:{selectedSlot:1,inventory:[old,selected]},
    disposeObject:()=>order.push("release-old"),buildWeaponModel:build
  });
  game.updateHeldWeapon(visual,1/60);
  expect(order).toEqual(["restore-support","release-old","build-selected"]);
  expect(visual.weaponId).toBe("quasar-carbine");
  expect(visual.supported).toBeNull();expect(visual.supportedModel).toBeNull();
  expect(build).toHaveBeenCalledWith(weapon,"quasar-carbine",expect.any(Number));
});

it("holsters an emote and releases support while the weapon is hidden",()=>{
  const dispose=vi.fn(),weapon=new THREE.Group();
  const visual={state:{id:"other",heldItem:{itemId:"helix-burst-rifle",rarity:"common"},vehicleId:null,downed:false,deployment:"grounded"},
    weapon,group:{visible:true},rig:{visible:true},emote:"wave",supported:{dispose},supportedModel:new THREE.Group()};
  const game=Object.assign(Object.create(BattleRoyaleGame.prototype),{localId:"pilot"});
  game.updateHeldWeapon(visual,1/60);
  expect(weapon.visible).toBe(false);expect(dispose).toHaveBeenCalledOnce();expect(visual.supported).toBeNull();
});
