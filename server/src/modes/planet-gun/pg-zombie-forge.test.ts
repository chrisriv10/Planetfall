import {describe,expect,it} from "vitest";
import {PG_PRIMARY_WEAPONS,type PgPrimaryWeaponId} from "@planetfall/shared";
import {PgZombieForge} from "./pg-zombie-forge.js";

describe("zombie overcharge forge",()=>{
 it.each([[0,900],[1,1600],[2,2400]])("charges tier %s's existing price %s exactly once",(tier,price)=>{
  const forge=new PgZombieForge(),owner={id:"a",points:price};
  expect(forge.begin(owner,"pulse",tier,100)).toBe(true);expect(owner.points).toBe(0);
  expect(forge.snapshot()).toEqual({phase:"processing",ownerId:"a",weaponId:"pulse",targetTier:tier+1,startedAt:100,completesAt:2100});
  expect(forge.update(2100)).toEqual({ownerId:"a",weaponId:"pulse",targetTier:tier+1});
 });

 it("rejects all duplicate or competing purchases while processing and displaying completion",()=>{
  const forge=new PgZombieForge(),owner={id:"a",points:5000},other={id:"b",points:5000};
  forge.begin(owner,"pulse",0,0);
  expect(forge.begin(owner,"pulse",0,0)).toBe(false);expect(forge.begin(other,"rail",2,1000)).toBe(false);
  expect(owner.points).toBe(4100);expect(other.points).toBe(5000);
  expect(forge.update(2000)).not.toBeNull();expect(forge.begin(other,"rail",2,2000)).toBe(false);
  expect(forge.update(3200)).toBeNull();expect(forge.begin(other,"rail",2,3200)).toBe(true);
  expect(other.points).toBe(2600);
 });

 it("only update grants completion, at its inclusive deadline and exactly once",()=>{
  const forge=new PgZombieForge();forge.begin({id:"a",points:900},"pulse",0,0);
  expect(forge.update(1999)).toBeNull();expect(forge.snapshot().phase).toBe("processing");
  expect(forge.snapshot().phase).toBe("processing");
  expect(forge.update(2000)).toEqual({ownerId:"a",weaponId:"pulse",targetTier:1});
  expect(forge.snapshot().phase).toBe("complete");expect(forge.update(2000)).toBeNull();
  expect(forge.update(3199)).toBeNull();expect(forge.snapshot().phase).toBe("complete");
  expect(forge.update(3200)).toBeNull();expect(forge.snapshot().phase).toBe("idle");
  expect(forge.update(4000)).toBeNull();
 });

 it("emits late completion once even after the display window and cannot silently replace it",()=>{
  const forge=new PgZombieForge(),other={id:"b",points:900};
  forge.begin({id:"a",points:900},"pulse",0,0);
  expect(forge.begin(other,"pulse",0,5000)).toBe(false);expect(other.points).toBe(900);
  expect(forge.snapshot().phase).toBe("processing");
  expect(forge.update(5000)).toEqual({ownerId:"a",weaponId:"pulse",targetTier:1});
  expect(forge.snapshot().phase).toBe("idle");expect(forge.update(5000)).toBeNull();
  expect(forge.begin(other,"pulse",0,5000)).toBe(true);
 });

 it.each(PG_PRIMARY_WEAPONS)("accepts existing primary %s",weapon=>{
  const forge=new PgZombieForge();expect(forge.begin({id:"a",points:900},weapon,0,0)).toBe(true);
  expect(forge.update(2000)?.weaponId).toBe(weapon);
 });

 it.each(["comet","orbit","invalid","",null,{},undefined])("rejects non-primary weapon %s",weapon=>{
  const forge=new PgZombieForge(),owner={id:"a",points:900};
  expect(forge.begin(owner,weapon as PgPrimaryWeaponId,0,0)).toBe(false);
  expect(owner.points).toBe(900);expect(forge.snapshot().phase).toBe("idle");
 });

 it.each([-1,3,4,.5,NaN,Infinity,-Infinity])("rejects invalid/maxed current tier %s",tier=>{
  const forge=new PgZombieForge(),owner={id:"a",points:9000};
  expect(forge.begin(owner,"pulse",tier,0)).toBe(false);expect(owner.points).toBe(9000);expect(forge.snapshot().phase).toBe("idle");
 });

 it.each([[0,899],[1,1599],[2,2399],[0,-1],[0,900.5],[0,NaN],[0,Infinity],[0,Number.MAX_SAFE_INTEGER+1]])("rejects insufficient/malformed points tier %s points %s",(tier,points)=>{
  const forge=new PgZombieForge(),owner={id:"a",points};
  expect(forge.begin(owner,"pulse",tier,0)).toBe(false);expect(Object.is(owner.points,points)).toBe(true);expect(forge.snapshot().phase).toBe("idle");
 });

 it.each([NaN,Infinity,-Infinity,-1,Number.MAX_SAFE_INTEGER])("rejects malformed time %s without charging or advancing state",now=>{
  const forge=new PgZombieForge(),owner={id:"a",points:900};
  expect(forge.begin(owner,"pulse",0,now)).toBe(false);expect(owner.points).toBe(900);
  forge.begin(owner,"pulse",0,0);expect(forge.update(now)).toBeNull();expect(forge.snapshot().phase).toBe("processing");
  expect(forge.update(2000)).not.toBeNull();
 });

 it("rejects empty owner identity without charging",()=>{
  const forge=new PgZombieForge(),owner={id:"",points:900};
  expect(forge.begin(owner,"pulse",0,0)).toBe(false);expect(owner.points).toBe(900);expect(forge.snapshot().phase).toBe("idle");
 });

 it("releases only the inserted owner, cancels completion on leave, and resets between runs",()=>{
  const forge=new PgZombieForge(),owner={id:"a",points:5000};forge.begin(owner,"pulse",0,0);
  forge.releaseOwner("b");expect(forge.snapshot().phase).toBe("processing");
  forge.releaseOwner("a");expect(forge.snapshot().phase).toBe("idle");expect(forge.update(2000)).toBeNull();
  forge.begin(owner,"pulse",0,2000);forge.reset();expect(forge.update(4000)).toBeNull();
  expect(forge.snapshot().phase).toBe("idle");
  forge.begin(owner,"pulse",0,4000);forge.update(6000);forge.reset();expect(forge.snapshot().phase).toBe("idle");
  expect(owner.points).toBe(2300);
 });

 it("returns detached snapshots and completion records",()=>{
  const forge=new PgZombieForge();forge.begin({id:"a",points:900},"pulse",0,0);
  const processing=forge.snapshot();if(processing.phase!=="idle")processing.ownerId="wrong";
  const completion=forge.update(2000);expect(completion?.ownerId).toBe("a");if(completion)completion.ownerId="wrong";
  expect(forge.snapshot().ownerId).toBe("a");
 });
});
