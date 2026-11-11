import {describe,expect,it} from "vitest";
import {pgRayBox} from "./math.js";
import type {PgSolid} from "./types.js";

const box:PgSolid={id:"slab-test",kind:"structure",center:{x:4,y:3,z:-2},half:{x:1,y:2,z:3},mantle:false};
describe("PlanetGun visibility slab intersections",()=>{
 it("finds the first surface from either direction on every axis",()=>{
  for(const axis of ["x","y","z"] as const)for(const sign of [-1,1]){
   const origin={...box.center,[axis]:box.center[axis]+sign*(box.half[axis]+6)},direction={x:0,y:0,z:0};direction[axis]=-sign;
   expect(pgRayBox(origin,direction,box)).toBe(6);
  }
 });
 it("rejects parallel rays outside a slab and boxes behind the ray",()=>{
  expect(pgRayBox({x:0,y:0,z:0},{x:1,y:0,z:0},box)).toBeNull();
  expect(pgRayBox({x:8,y:3,z:-2},{x:1,y:0,z:0},box)).toBeNull();
 });
 it("keeps inclusive edge contacts and zero-distance hits from inside/on a surface",()=>{
  expect(pgRayBox({x:0,y:1,z:1},{x:1,y:0,z:0},box)).toBe(3);
  expect(pgRayBox({...box.center},{x:0,y:0,z:-1},box)).toBe(0);
  expect(pgRayBox({x:5,y:3,z:-2},{x:1,y:0,z:0},box)).toBe(0);
 });
 it("returns world distance for an oblique normalized ray",()=>{
  const n=Math.sqrt(2);expect(pgRayBox({x:0,y:3,z:-6},{x:1/n,y:0,z:1/n},box)).toBeCloseTo(3*n,12);
 });
});
