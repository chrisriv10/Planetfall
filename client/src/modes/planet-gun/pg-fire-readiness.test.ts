import {describe,it,expect} from "vitest";
import {pgCreateGun} from "@planetfall/shared";
import {pgFireReady,pgFirePressValid} from "./pg-fire-readiness";

describe("PlanetGun acknowledged sprint-to-fire",()=>{
 it("cannot present a beam shot while the authoritative heat lock is active",()=>{
  const gun=pgCreateGun("prism");gun.overheatedUntil=1900;
  const authority={mode:"ground" as const,slot:0 as const,guns:[gun,pgCreateGun("orbit")] as [typeof gun,typeof gun],fireReadyAt:0,lastInputSequence:1};
  expect(pgFireReady(1899,"ground",authority,0)).toBe(false);expect(pgFireReady(1900,"ground",authority,0)).toBe(true);
 });
 it("keeps a recent sprint press but discards stale, empty and reloading presses",()=>{
  const gun=pgCreateGun("comet");
  expect(pgFirePressValid(750,1000,gun)).toBe(true);
  expect(pgFirePressValid(1000,1000,gun)).toBe(false);
  expect(pgFirePressValid(500,1000,{...gun,magazine:0})).toBe(false);
  expect(pgFirePressValid(500,1000,{...gun,reloadUntil:1800})).toBe(false);
 });
 it("retains a quick click across the delayed authoritative sprint exit",()=>{
  const state={mode:"sprint" as const,slot:1 as const,guns:[pgCreateGun("nova"),pgCreateGun("comet")] as const,fireReadyAt:0,lastInputSequence:0};
  const authority={...state,guns:[...state.guns] as [typeof state.guns[0],typeof state.guns[1]]};
  // The local delay expires before the server has consumed its stop-sprint input.
  expect(pgFireReady(1992,"ground",authority,1990)).toBe(false);
  const acknowledged={...authority,mode:"ground" as const,fireReadyAt:2164};
  expect(pgFireReady(2152,"ground",acknowledged,1990)).toBe(false);
  expect(pgFireReady(2164,"ground",acknowledged,1990)).toBe(true);
 });
 it("rejects an old ground snapshot that predates the sprint entry and exit",()=>{
  const authority={mode:"ground" as const,slot:0 as const,guns:[pgCreateGun("nova"),pgCreateGun("comet")] as [ReturnType<typeof pgCreateGun>,ReturnType<typeof pgCreateGun>],fireReadyAt:0,lastInputSequence:40};
  // Sprint entry 41 is still in flight; the queued click exits sprint in 42.
  expect(pgFireReady(1000,"ground",authority,990,42)).toBe(false);
  const exited={...authority,lastInputSequence:42,fireReadyAt:1100};
  expect(pgFireReady(1088,"ground",exited,990,42)).toBe(false);
  expect(pgFireReady(1100,"ground",exited,990,42)).toBe(true);
 });
 it("also respects predicted stance, weapon cooldown and reload without changing authority",()=>{
  const authority={mode:"ground" as const,slot:0 as const,guns:[pgCreateGun("rail"),pgCreateGun("comet")] as [ReturnType<typeof pgCreateGun>,ReturnType<typeof pgCreateGun>],fireReadyAt:200,lastInputSequence:0};
  authority.guns[0].nextFireAt=400;
  expect(pgFireReady(300,"ground",authority,0)).toBe(false);
  expect(pgFireReady(400,"sprint",authority,0)).toBe(false);
  expect(pgFireReady(400,"mantle",authority,0)).toBe(false);
  expect(pgFireReady(400,"ground",authority,0)).toBe(true);
  authority.guns[0].reloadUntil=900;
  expect(pgFireReady(500,"ground",authority,0)).toBe(false);
  expect(authority.guns[0].magazine).toBe(5);
 });
});
