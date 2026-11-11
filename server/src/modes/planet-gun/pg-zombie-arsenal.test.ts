import {describe,expect,it,vi} from "vitest";
import {PG_ZOMBIE_ARSENAL_WEIGHTS} from "@planetfall/shared";
import {PgZombieArsenal} from "./pg-zombie-arsenal.js";

describe("zombie anomaly arsenal",()=>{
 it("reserves one purchase and never charges or rolls again while busy",()=>{
  const random=vi.fn(()=>.5),arsenal=new PgZombieArsenal(random),owner={id:"a",points:2000},other={id:"b",points:2000};
  expect(arsenal.purchase(owner,100)).toBe(true);
  expect(owner.points).toBe(1150);
  expect(arsenal.purchase(owner,100)).toBe(false);
  expect(arsenal.purchase(other,2300)).toBe(false);
  expect(owner.points).toBe(1150);expect(other.points).toBe(2000);expect(random).toHaveBeenCalledTimes(1);
  expect(arsenal.snapshot(2299)).toEqual({phase:"revealing",ownerId:"a",weaponId:null,revealAt:2300,expiresAt:17300});
  expect(arsenal.snapshot(2300)).toEqual({phase:"ready",ownerId:"a",weaponId:"nova",revealAt:2300,expiresAt:17300});
 });

 it.each([849,0,-1,850.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1])("rejects invalid or insufficient points %s",points=>{
  const random=vi.fn(()=>0),arsenal=new PgZombieArsenal(random),owner={id:"a",points};
  expect(arsenal.purchase(owner,0)).toBe(false);expect(Object.is(owner.points,points)).toBe(true);
  expect(random).not.toHaveBeenCalled();expect(arsenal.snapshot(0).phase).toBe("idle");
 });

 it.each([850,Number.MAX_SAFE_INTEGER])("accepts valid integer point boundary %s",points=>{
  const arsenal=new PgZombieArsenal(()=>0),owner={id:"a",points};
  expect(arsenal.purchase(owner,0)).toBe(true);expect(owner.points).toBe(points-850);
 });

 it("retains a valid claim after early or wrong-owner attempts and grants exactly once",()=>{
  const arsenal=new PgZombieArsenal(()=>0),owner={id:"a",points:850};
  arsenal.purchase(owner,0);
  expect(arsenal.claim("a",2199)).toBeNull();expect(arsenal.claim("b",2200)).toBeNull();
  expect(arsenal.claim("a",2200)).toBe("pulse");expect(arsenal.claim("a",2200)).toBeNull();
  expect(arsenal.snapshot(2200).phase).toBe("idle");
 });

 it("allows claims just before expiration and rejects the exact expiration deadline",()=>{
  const before=new PgZombieArsenal(()=>0),expired=new PgZombieArsenal(()=>0);
  before.purchase({id:"a",points:850},0);expired.purchase({id:"a",points:850},0);
  expect(before.claim("a",17199)).toBe("pulse");expect(expired.claim("a",17200)).toBeNull();
  expect(expired.snapshot(17200).phase).toBe("idle");
  expect(expired.purchase({id:"b",points:850},17200)).toBe(true);
 });

 it("cleans expired reservations on update or the next purchase",()=>{
  const arsenal=new PgZombieArsenal(()=>0);
  arsenal.purchase({id:"a",points:850},0);arsenal.update(17200);
  expect(arsenal.snapshot(17200).phase).toBe("idle");
  arsenal.purchase({id:"a",points:850},17200);
  expect(arsenal.purchase({id:"b",points:850},34400)).toBe(true);
  expect(arsenal.snapshot(34400).ownerId).toBe("b");
 });

 it("only releases the reserved owner, and resets across runs",()=>{
  const arsenal=new PgZombieArsenal(()=>0);
  arsenal.purchase({id:"a",points:850},0);arsenal.releaseOwner("b");
  expect(arsenal.snapshot(0).phase).toBe("revealing");arsenal.releaseOwner("a");
  expect(arsenal.snapshot(0).phase).toBe("idle");
  arsenal.purchase({id:"a",points:850},0);arsenal.reset();
  expect(arsenal.claim("a",2200)).toBeNull();expect(arsenal.snapshot(2200).phase).toBe("idle");
 });

 it.each([NaN,Infinity,-Infinity,-.1,1,2])("rejects malformed RNG result %s without charging",roll=>{
  const arsenal=new PgZombieArsenal(()=>roll),owner={id:"a",points:850};
  expect(arsenal.purchase(owner,0)).toBe(false);expect(owner.points).toBe(850);expect(arsenal.snapshot(0).phase).toBe("idle");
 });

 it("rejects a throwing RNG without charging",()=>{
  const arsenal=new PgZombieArsenal(()=>{throw new Error("rng failed");}),owner={id:"a",points:850};
  expect(arsenal.purchase(owner,0)).toBe(false);expect(owner.points).toBe(850);
 });

 it.each([NaN,Infinity,-Infinity,-1,Number.MAX_SAFE_INTEGER])("rejects malformed time %s without altering a reservation",now=>{
  const arsenal=new PgZombieArsenal(()=>0),owner={id:"a",points:1700};
  expect(arsenal.purchase(owner,now)).toBe(false);expect(owner.points).toBe(1700);
  arsenal.purchase(owner,0);expect(arsenal.claim("a",now)).toBeNull();arsenal.update(now);
  expect(()=>arsenal.snapshot(now)).toThrow(RangeError);
  expect(arsenal.claim("a",2200)).toBe("pulse");expect(owner.points).toBe(850);
 });

 it("maps the authored weighted pool boundaries to exactly the eight existing primary weapons",()=>{
  expect(PG_ZOMBIE_ARSENAL_WEIGHTS.map(item=>[item.weaponId,item.weight])).toEqual([
   ["pulse",30],["nova",25],["photon",18],["arc",12],["helix",8],["quasar",4],["prism",2],["rail",1],
  ]);
  let lower=0;
  for(const {weaponId,weight} of PG_ZOMBIE_ARSENAL_WEIGHTS){
   for(const roll of [lower/100,(lower+weight-.000001)/100]){
    const arsenal=new PgZombieArsenal(()=>roll);expect(arsenal.purchase({id:"a",points:850},0)).toBe(true);
    expect(arsenal.claim("a",2200)).toBe(weaponId);
   }
   lower+=weight;
  }
  expect(lower).toBe(100);
 });
});
