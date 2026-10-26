import {describe,it,expect} from "vitest";
import {PG_PRIMARY_WEAPONS,PG_SECONDARY_WEAPONS,pgValidateLoadout,pgValidateModules} from "./loadouts.js";
import {PG_WEAPONS,pgWeaponProfile,pgCreateGun,pgStartReload,pgFinishReload} from "./weapons.js";
const base={primary:"pulse",secondary:"comet"};
describe("PlanetGun Combat Kit contracts",()=>{
 it("normalizes legacy kits and copies validated IDs without mutating the payload",()=>{
  expect(pgValidateLoadout(base)).toEqual({...base,primaryModules:[],secondaryModules:[]});
  const raw={...base,primaryModules:["lightweight-frame","gyro-stabilizer"],secondaryModules:["reflex-array"],kitId:4,name:"  Scout  "},copy=structuredClone(raw),kit=pgValidateLoadout(raw)!;
  expect(kit.name).toBe("Scout");expect(kit.primaryModules).toEqual(["gyro-stabilizer","lightweight-frame"]);expect(raw).toEqual(copy);
  raw.primaryModules.push("expanded-cell");expect(kit.primaryModules).toHaveLength(2);
 });
 it("rejects module counts, wrong types, duplicates and incompatible cells",()=>{
  for(const modules of [["gyro-stabilizer","lightweight-frame","expanded-cell","reflex-array"],["reflex-array","precision-lens"],["expanded-cell","rapid-charge-cell"],["reflex-array","reflex-array"],["unknown"],[{damage:999}],"gyro-stabilizer",null])expect(pgValidateLoadout({...base,primaryModules:modules})).toBeNull();
  expect(pgValidateLoadout({...base,secondaryModules:["reflex-array","gyro-stabilizer"]})).toBeNull();
  expect(pgValidateModules("bogus" as never,[],3)).toBeNull();
 });
 it("rejects invalid slots, names, ownership selectors and arbitrary stat payloads",()=>{
  for(const extra of [{damage:999},{primary:{id:"pulse",damage:999}},{primary:"comet"},{secondary:"pulse"},{primary:"constructor"},{kitId:5},{kitId:-1},{kitId:1.5},{kitId:"0"},{name:""},{name:"a".repeat(25)},{name:"test\nkit"},{secondaryModules:[{id:"reflex-array",damage:999}]}])expect(pgValidateLoadout({...base,...extra})).toBeNull();
 });
 it("offers eight primary identities and two complementary sidearms",()=>{
  expect(PG_PRIMARY_WEAPONS).toHaveLength(8);expect(PG_SECONDARY_WEAPONS).toEqual(["comet","orbit"]);
  expect(PG_WEAPONS.helix.burstShots).toBe(3);expect(PG_WEAPONS.prism.heatPerShot).toBeGreaterThan(0);
  expect(PG_WEAPONS.arc.adsMs).toBeLessThan(PG_WEAPONS.pulse.adsMs);expect(PG_WEAPONS.orbit.damage).toBeLessThan(PG_WEAPONS.comet.damage);expect(PG_WEAPONS.orbit.intervalMs).toBeLessThan(PG_WEAPONS.comet.intervalMs);
 });
 it("caches effective profiles independent of ID order and leaves base balance intact",()=>{
  const original={...PG_WEAPONS.pulse},a=pgWeaponProfile("pulse",["gyro-stabilizer","lightweight-frame"]),b=pgWeaponProfile("pulse",["lightweight-frame","gyro-stabilizer"]);
  expect(a).toBe(b);expect(Object.isFrozen(a)).toBe(true);expect(a.recoil).toBeCloseTo(original.recoil*.84*1.15);expect(a.adsMs).toBe(Math.round((original.adsMs+25)*.85));expect(PG_WEAPONS.pulse).toEqual(original);
  expect(()=>pgWeaponProfile("pulse",["expanded-cell","rapid-charge-cell"])).toThrow();
 });
 it("applies magazine and reload tradeoffs through authoritative gun factories",()=>{
  const g=pgCreateGun("pulse",["expanded-cell"]);expect(g.magazine).toBe(36);g.magazine=0;expect(pgStartReload(g,1000)).toBe(true);expect(g.reloadUntil).toBe(2950);pgFinishReload(g,2949);expect(g.magazine).toBe(0);pgFinishReload(g,2950);expect(g.magazine).toBe(36);
  const rapid=pgWeaponProfile("pulse",["rapid-charge-cell"]);expect(rapid.magazine).toBe(25);expect(rapid.reloadMs).toBe(1445);
 });
});
