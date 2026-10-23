import {describe,it,expect} from "vitest";
import {PG_WEAPONS,pgCreateGun,pgStartReload,pgFinishReload,pgSpread,pgDamage} from "./weapons.js";
describe("PlanetGun independent weapon balance",()=>{
 it("transfers only available ammunition at the server reload deadline",()=>{const g=pgCreateGun("pulse");g.magazine=2;g.reserve=7;expect(pgStartReload(g,1000)).toBe(true);pgFinishReload(g,2699);expect(g.magazine).toBe(2);pgFinishReload(g,2700);expect(g.magazine).toBe(9);expect(g.reserve).toBe(0);expect(pgStartReload(g,3000)).toBe(false);});
 it("cannot repeatedly restart reload or reload a full magazine",()=>{const g=pgCreateGun("nova");expect(pgStartReload(g,0)).toBe(false);g.magazine--;expect(pgStartReload(g,100)).toBe(true);const end=g.reloadUntil;expect(pgStartReload(g,200)).toBe(false);expect(g.reloadUntil).toBe(end);});
 it("settled ADS tightens every optic while airborne spread remains bounded",()=>{for(const id of Object.keys(PG_WEAPONS)as (keyof typeof PG_WEAPONS)[]){const hip=pgSpread(id,0,false,false),aim=pgSpread(id,1,false,false);expect(aim).toBeLessThan(hip);expect(pgSpread(id,1,false,true)).toBeCloseTo(aim*1.55);expect(pgDamage(id,10000,false)).toBeGreaterThan(0);expect(pgDamage(id,1,true)).toBeGreaterThan(pgDamage(id,1,false));}});
});
