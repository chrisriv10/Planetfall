import {describe,expect,it} from "vitest";
import {PG_MAP} from "./map.js";
import {PG_BALANCE} from "./balance.js";
import {PG_ZOMBIE_DOORS} from "./modes.js";
import {pgCapsuleClear} from "./movement.js";
import {pgHasLineOfSight} from "./mode-collision.js";
import {PG_ZOMBIE_SURVIVOR_SPAWNS,PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_FORGE_SITE,PG_ZOMBIE_TONIC_SOCKETS,PG_ZOMBIE_WALL_BUYS} from "./zombie-installations.js";

const sites=[PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_FORGE_SITE,...PG_ZOMBIE_TONIC_SOCKETS,...PG_ZOMBIE_WALL_BUYS];
const overlaps=(a:typeof sites[number]["solid"],b:typeof sites[number]["solid"])=>
 Math.abs(a.center.x-b.center.x)<a.half.x+b.half.x-.001&&Math.abs(a.center.y-b.center.y)<a.half.y+b.half.y-.001&&Math.abs(a.center.z-b.center.z)<a.half.z+b.half.z-.001;

describe("Zombies collision-backed installations",()=>{
 it("preserves every actual survivor spawn capsule",()=>{
  const map={...PG_MAP,solids:[...PG_MAP.solids,...sites.map(site=>site.solid)]};
  for(const [i,spawn]of PG_ZOMBIE_SURVIVOR_SPAWNS.entries())expect(pgCapsuleClear(spawn,PG_BALANCE.height,map),`survivor ${i+1}`).toBe(true);
 });
 it("keeps the existing access-door corridors walkable when their gate opens",()=>{
  const map={...PG_MAP,solids:[...PG_MAP.solids,...sites.map(site=>site.solid)]};
  for(const door of PG_ZOMBIE_DOORS){
   for(const at of door.approaches)expect(pgCapsuleClear(at,PG_BALANCE.height,map),door.id).toBe(true);
   const [a,b]=door.approaches;
   expect(pgHasLineOfSight({...a,y:1},{...b,y:1},map),door.id).toBe(true);
  }
 });
 it("keeps bodies separate from map structures and one another, with supported clear purchase approaches",()=>{
  const map={...PG_MAP,solids:[...PG_MAP.solids,...sites.map(site=>site.solid)]};
  for(const site of sites){
   expect(PG_MAP.solids.filter(solid=>overlaps(site.solid,solid)),site.id).toEqual([]);
   expect(sites.filter(other=>other!==site&&overlaps(site.solid,other.solid)).map(other=>other.id),site.id).toEqual([]);
   expect(pgCapsuleClear(site.interaction,PG_BALANCE.height,map),site.id).toBe(true);
   expect(pgCapsuleClear({...site.solid.center,y:0},PG_BALANCE.height,map),site.id).toBe(false);
   const at={...site.interaction,y:1},sin=Math.sin(site.yaw),cos=Math.cos(site.yaw);
   const depth=Math.abs(sin)*site.solid.half.x+Math.abs(cos)*site.solid.half.z+.04;
   const console={x:site.position.x-sin*depth,y:1,z:site.position.z-cos*depth};
   expect(pgHasLineOfSight(at,console,map),site.id).toBe(true);
   expect(PG_MAP.solids.some(s=>s.kind==="floor"&&Math.abs(s.center.x-at.x)<=s.half.x&&Math.abs(s.center.z-at.z)<=s.half.z&&Math.abs(s.center.y+s.half.y)<.05),site.id).toBe(true);
  }
 });
 it("binds six distinct displays to canonical weapons and prices while preserving primary purchase positions",()=>{
  expect(new Set(PG_ZOMBIE_WALL_BUYS.map(site=>site.id)).size).toBe(6);
  expect(PG_ZOMBIE_WALL_BUYS.map(site=>site.weaponId).sort()).toEqual(["comet","nova","orbit","photon","pulse","rail"]);
  for(const site of PG_ZOMBIE_WALL_BUYS){
   expect(site.price).toBeGreaterThan(0);
   expect(site.solid.half.y).toBe(site.bodyHalf.y);
   expect(site.solid.half.x).toBe(Math.abs(Math.sin(site.yaw))<.5?site.bodyHalf.x:site.bodyHalf.z);
  }
 });
});
