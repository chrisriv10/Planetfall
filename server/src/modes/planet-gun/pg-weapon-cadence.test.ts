import {describe,it,expect} from "vitest";
import {pgCreateGun,pgUpdateGunHeat,pgStartReload,type PgPlayer,type PgFireRequest,type PgWeaponId} from "@planetfall/shared";
import {PgCombat} from "./pg-combat.js";
function pilot(weapon:PgWeaponId):PgPlayer{return {id:"a",team:"solar",hp:100,lifeId:1,position:{x:-10,y:0,z:32},velocity:{x:0,y:0,z:0},yaw:-Math.PI/2,pitch:0,connected:true,isBot:false,crouched:false,grounded:true,slot:0,guns:[pgCreateGun(weapon),pgCreateGun("comet")],adsSince:500,fireReadyAt:0,protectedUntil:0,mode:"ground"} as PgPlayer;}
function setup(weapon:PgWeaponId){const combat=new PgCombat(),p=pilot(weapon);let sequence=0;return {combat,p,fire:(now:number)=>{combat.history.record([p],now);const request:PgFireRequest={sequence:++sequence,clientTime:now,weapon,yaw:p.yaw,pitch:p.pitch};return combat.fire(p,request,[p],now);}};}
describe("PlanetGun server weapon cadence",()=>{
 it("enforces three Helix rounds followed by burst recovery and consumes one cell per accepted shot",()=>{
  const {p,fire}=setup("helix"),gun=p.guns[0];expect(fire(1000)).toHaveLength(1);expect(gun.burstRemaining).toBe(2);expect(fire(1079)).toHaveLength(0);expect(fire(1080)).toHaveLength(1);expect(fire(1160)).toHaveLength(1);expect(gun.burstRemaining).toBe(0);expect(fire(1240)).toHaveLength(0);expect(fire(1459)).toHaveLength(0);expect(fire(1460)).toHaveLength(1);expect(gun.magazine).toBe(23);
 });
 it("does not invent burst ammo and resets an interrupted burst on reload",()=>{
  const {p,fire}=setup("helix"),gun=p.guns[0];gun.magazine=1;expect(fire(1000)).toHaveLength(1);expect(fire(1080)).toHaveLength(0);expect(gun.magazine).toBe(0);expect(pgStartReload(gun,1080)).toBe(true);expect(gun.burstRemaining).toBe(0);expect(fire(1160)).toHaveLength(0);
 });
 it("limits Prism ticks and enters a server-owned overheat lock",()=>{
  const {p,fire}=setup("prism"),gun=p.guns[0];for(let i=0;i<25;i++)expect(fire(1000+i*70)).toHaveLength(1);expect(gun.magazine).toBe(75);expect(gun.heat).toBeCloseTo(1);expect(gun.overheatedUntil).toBe(3580);expect(fire(2750)).toHaveLength(0);expect(fire(3579)).toHaveLength(0);expect(fire(3580)).toHaveLength(1);expect(gun.magazine).toBe(74);
 });
 it("cools idle Prism heat by elapsed server time and cannot cool twice at one timestamp",()=>{
  const {p,fire}=setup("prism"),gun=p.guns[0];expect(fire(1000)).toHaveLength(1);pgUpdateGunHeat(gun,1070);expect(gun.heat).toBeCloseTo(.04);pgUpdateGunHeat(gun,1120);expect(gun.heat).toBeCloseTo(.021);pgUpdateGunHeat(gun,1120);expect(gun.heat).toBeCloseTo(.021);pgUpdateGunHeat(gun,2000);expect(gun.heat).toBe(0);expect(gun.magazine).toBe(99);
 });
 it("rejects Prism spam at sub-tick cadence without consuming ammo or adding heat",()=>{
  const {p,fire}=setup("prism"),gun=p.guns[0];fire(1000);for(let now=1001;now<1070;now++)expect(fire(now)).toHaveLength(0);expect(gun.magazine).toBe(99);expect(gun.heat).toBeCloseTo(.04);expect(fire(1070)).toHaveLength(1);expect(gun.magazine).toBe(98);
 });
});
