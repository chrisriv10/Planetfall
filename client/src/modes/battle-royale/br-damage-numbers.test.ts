import {describe,expect,it} from "vitest";
import {addBrDamageNumber,BR_DAMAGE_NUMBER_LIFETIME_MS} from "./br-damage-numbers";

const hit=(shieldDamage=0,hpDamage=0)=>({targetId:"target",position:{x:1,y:2,z:3},shieldDamage,hpDamage,shieldBroken:false,headshot:false});
describe("BR damage number aggregation",()=>{
  it("keeps shield and HP channels visually distinct",()=>{const entries=addBrDamageNumber([],hit(8,5),100);expect(entries.map(e=>[e.kind,e.amount])).toEqual([["shield",8],["hp",5]]);});
  it("aggregates rapid automatic and shotgun damage without number spam",()=>{let entries=addBrDamageNumber([],hit(7,0),100);entries=addBrDamageNumber(entries,hit(9,0),240);expect(entries).toHaveLength(1);expect(entries[0].amount).toBe(16);entries=addBrDamageNumber(entries,hit(2,0),500);expect(entries).toHaveLength(2);});
  it("expires old markers and respects a bounded pool",()=>{const old=addBrDamageNumber([],hit(4,0),0);let entries=addBrDamageNumber(old,{...hit(0,2),targetId:"fresh"},BR_DAMAGE_NUMBER_LIFETIME_MS+1,1);expect(entries).toHaveLength(1);expect(entries[0].targetId).toBe("fresh");});
});
