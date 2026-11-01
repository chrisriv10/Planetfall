import {describe,expect,it} from "vitest";
import {PG_WEAPONS} from "./weapons.js";
import {PG_HERO_IDS,PG_HEROES,PG_OPERATOR_IDS,PG_OPERATORS,PG_PASSIVES,PG_SIEGE_COMMON_EQUIPMENT,pgResolveHero,pgResolveOperator,pgAvailableHeroes,pgAvailableOperators,pgCharacterDefaultLoadout,pgValidateHeroLoadout,pgValidateOperatorLoadout} from "./characters.js";
import type {PgAbilityDefinition,PgCharacterReservation} from "./characters.js";

describe("PlanetGun canonical character contracts",()=>{
 it("supplies all six heroes, two of each role, and six operators for each side",()=>{
  expect(PG_HERO_IDS).toEqual(["cairn","kepler","cinder","parallax","solace","spindle"]);
  expect(PG_OPERATOR_IDS).toEqual(["rivet","lumen","null","strut","thread","patch","brace","hush","glint","coil","mend","shroud"]);
  for(const role of ["tank","damage","support"])expect(Object.values(PG_HEROES).filter(hero=>hero.role===role)).toHaveLength(2);
  expect(pgAvailableOperators("attack","solar",[])).toHaveLength(6);
  expect(pgAvailableOperators("defend","void",[])).toHaveLength(6);
  expect(new Set([...PG_HERO_IDS,...PG_OPERATOR_IDS]).size).toBe(18);
 });
 it("uses trusted existing weapon pairs and differentiated HP without modifying weapons",()=>{
  const before=structuredClone(PG_WEAPONS);
  for(const character of [...Object.values(PG_HEROES),...Object.values(PG_OPERATORS)]){
   for(const primary of character.primaryChoices)expect(Object.hasOwn(PG_WEAPONS,primary)).toBe(true);
   expect(Object.hasOwn(PG_WEAPONS,character.secondary)).toBe(true);
   expect(character.maxHp).toBeGreaterThan(0);
   const loadout=pgCharacterDefaultLoadout(character);
   expect((Object.hasOwn(PG_HEROES,character.id)?pgValidateHeroLoadout:pgValidateOperatorLoadout)(character.id,loadout)).toEqual(loadout);
  }
  expect(PG_HEROES.cairn.maxHp).toBeGreaterThan(PG_HEROES.cinder.maxHp);
  expect(PG_HEROES.solace.maxHp).not.toBe(PG_HEROES.parallax.maxHp);
  expect(PG_WEAPONS).toEqual(before);
 });
 it("fully bounds every ability and gives every hero all three distinct abilities",()=>{
  const definitions:PgAbilityDefinition[]=[];
  for(const hero of Object.values(PG_HEROES)){
   expect(hero.abilities).toHaveLength(2);expect(hero.ultimateCost).toBeGreaterThan(0);
   expect(Object.hasOwn(PG_PASSIVES,hero.passive)).toBe(true);
   expect(hero.ultimate.recharge).toBe("ultimate");
   definitions.push(...hero.abilities,hero.ultimate);
  }
  for(const operator of Object.values(PG_OPERATORS)){
   expect(operator.primaryChoices).toHaveLength(2);
   expect(operator.signature.recharge).toBe("round");definitions.push(operator.signature);
  }
  expect(new Set(definitions.map(a=>a.id)).size).toBe(30);
  for(const ability of definitions){
   for(const value of [ability.durationMs,ability.cooldownMs,ability.radius,ability.range,ability.warningMs,ability.deployableHp,...Object.values(ability.effect)])expect(Number.isFinite(value) && value>=0).toBe(true);
   expect(ability.charges).toBeGreaterThan(0);expect(ability.target).toBeTruthy();expect(ability.stacking).toBeTruthy();expect(ability.lineOfSight).toBeTruthy();
   expect(ability.cleanup).toContain("round-reset");expect(ability.cleanup).toContain("selection-change");
  }
  expect(PG_SIEGE_COMMON_EQUIPMENT.attack.scoutDrones).toBe(1);
  expect(PG_SIEGE_COMMON_EQUIPMENT.defend.reinforcements).toBeGreaterThan(0);
 });
 it("provides structured distinct silhouettes with team and distant readability",()=>{
  const silhouettes=[...Object.values(PG_HEROES),...Object.values(PG_OPERATORS)].map(c=>c.silhouette);
  expect(new Set(silhouettes.map(s=>s.helmet)).size).toBe(18);
  for(const silhouette of silhouettes){
   expect(silhouette.shoulders.length).toBeGreaterThan(5);expect(silhouette.backpack.length).toBeGreaterThan(5);expect(silhouette.arms.length).toBeGreaterThan(5);
   expect(silhouette.teamMarkings).toBe("shoulders-and-visor");expect(silhouette.preserveAtDistance).toEqual(["helmet","shoulders","backpack","arms"]);
   for(const color of Object.values(silhouette.colors))expect(color).toMatch(/^#[0-9a-f]{6}$/);
  }
 });
 it("fails closed for untrusted IDs, wrong sides, invalid weapons and unsupported modules",()=>{
  for(const id of [null,{},[],"constructor","__proto__","CAIRN",0]){expect(pgResolveHero(id)).toBeNull();expect(pgResolveOperator(id)).toBeNull();}
  expect(pgResolveOperator("rivet","defend")).toBeNull();expect(pgResolveOperator("brace","attack")).toBeNull();
  expect(pgResolveHero("cairn")).toBe(PG_HEROES.cairn);
  expect(pgValidateHeroLoadout("cairn",{primary:"pulse",secondary:"comet"})).toBeNull();
  expect(pgValidateHeroLoadout("cairn",{primary:"photon",secondary:"orbit"})).toBeNull();
  expect(pgValidateOperatorLoadout("rivet",{primary:"rail",secondary:"comet"})).toBeNull();
  expect(pgValidateOperatorLoadout("rivet",{primary:"pulse",secondary:"comet",primaryModules:["expanded-cell"]})).toBeNull();
  expect(pgValidateHeroLoadout("cairn",{primary:"photon",secondary:"comet",damage:999})).toBeNull();
  expect(pgValidateOperatorLoadout("rivet",{primary:"photon",secondary:"comet",secondaryModules:["gyro-stabilizer"]})).toBeNull();
  expect(pgValidateOperatorLoadout("rivet",{primary:"photon",secondary:"comet",primaryModules:["reflex-array"]})).not.toBeNull();
 });
 it("fills unique six-player teams while allowing opposing mirrors and reservation retention",()=>{
  const reservations:PgCharacterReservation[]=PG_HERO_IDS.map((characterId,i)=>({characterId,playerId:`solar-${i}`,team:"solar"}));
  expect(pgAvailableHeroes("solar",reservations)).toEqual([]);expect(pgAvailableHeroes("void",reservations)).toEqual([...PG_HERO_IDS]);
  expect(pgAvailableHeroes("solar",reservations,"solar-0")).toEqual(["cairn"]);
  for(const side of ["attack","defend"] as const){
   const operators=pgAvailableOperators(side,"solar",[]);
   const selected:PgCharacterReservation[]=operators.map((characterId,i)=>({characterId,playerId:`op-${i}`,team:"solar"}));
   expect(new Set(operators).size).toBe(6);expect(pgAvailableOperators(side,"solar",selected)).toEqual([]);
   expect(pgAvailableOperators(side,"void",selected)).toEqual(operators);
   expect(pgAvailableOperators(side,"solar",selected,"op-0")).toEqual([operators[0]]);
  }
 });
 it("deep-freezes shared definitions and returns independent mutable player equipment",()=>{
  expect(Object.isFrozen(PG_HEROES)).toBe(true);expect(Object.isFrozen(PG_HERO_IDS)).toBe(true);expect(Object.isFrozen(PG_OPERATORS.rivet.signature.effect)).toBe(true);
  expect(Object.isFrozen(PG_HEROES.cairn.silhouette.colors)).toBe(true);expect(Object.isFrozen(PG_HEROES.cairn.abilities[0].cleanup)).toBe(true);
  const a=pgCharacterDefaultLoadout(PG_HEROES.cairn),b=pgCharacterDefaultLoadout(PG_HEROES.cairn);
  a.primaryModules!.push("reflex-array");a.primary="pulse";
  expect(b.primaryModules).toEqual([]);expect(b.primary).toBe("photon");expect(PG_HEROES.cairn.primaryChoices).toEqual(["photon"]);
  const raw={primary:"pulse",secondary:"comet",primaryModules:["reflex-array"]};
  const validated=pgValidateOperatorLoadout("rivet",raw)!;raw.primaryModules.length=0;
  expect(validated.primaryModules).toEqual(["reflex-array"]);
 });
});
