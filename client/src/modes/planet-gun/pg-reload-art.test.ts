import {describe,it,expect} from "vitest";
import {PG_RELOAD_PROFILES,createPgReloadSample,samplePgReload,type PgPresentationWeapon} from "./pg-reload-art";
describe("PlanetGun component reload tracks",()=>{
 for(const weapon of Object.keys(PG_RELOAD_PROFILES) as PgPresentationWeapon[])it(`${weapon} carries its cell with the support hand and returns to rest`,()=>{
  const s=createPgReloadSample(),p=PG_RELOAD_PROFILES[weapon];
  for(const t of[.23,.35,.45,.55,.65,.75]){samplePgReload(weapon,t,-.20,-.1,-1,s);expect(s.handX).toBeCloseTo(s.cellX-p.width*.5-.07,8);expect(s.handY).toBeCloseTo(s.cellY,8);expect(s.handZ).toBeCloseTo(s.cellZ,8);}
  samplePgReload(weapon,.45,-.20,-.1,-1,s);expect(Math.hypot(s.cellX-p.cellX,s.cellY-p.cellY,s.cellZ-p.cellZ)).toBeGreaterThan(.3);
  for(const t of[0,1,NaN]){samplePgReload(weapon,t,-.20,-.1,-1,s);expect(s.phase).toBe("idle");expect([s.handX,s.handY,s.handZ]).toEqual([-.20,-.1,-1]);expect([s.cellX,s.cellY,s.cellZ]).toEqual([p.cellX,p.cellY,p.cellZ]);}
 });
 it("has continuous bounded hand motion and distinct authored paths",()=>{
  const signatures=new Set<string>();for(const weapon of Object.keys(PG_RELOAD_PROFILES) as PgPresentationWeapon[]){const s=createPgReloadSample();let previous=[-.2,-.1,-1];for(let i=0;i<=1000;i++){samplePgReload(weapon,i/1000,-.2,-.1,-1,s);expect(Math.hypot(s.handX-previous[0],s.handY-previous[1],s.handZ-previous[2])).toBeLessThan(.035);previous=[s.handX,s.handY,s.handZ];}samplePgReload(weapon,.45,-.2,-.1,-1,s);signatures.add([s.cellX,s.cellY,s.cellZ].join(","));}expect(signatures.size).toBe(10);
 });
});
