import {describe,expect,it} from "vitest";
import {PG_MAP} from "./map.js";
import {PG_BALANCE} from "./balance.js";
import {PG_ZOMBIE_DOORS,PG_ZOMBIE_QUARANTINE_WINGS} from "./modes.js";
import {PG_ZOMBIE_SURVIVOR_SPAWNS,PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_FORGE_SITE,PG_ZOMBIE_TONIC_SOCKETS,PG_ZOMBIE_WALL_BUYS} from "./zombie-installations.js";
import {PG_ZOMBIE_BARRICADE_SITES} from "./zombie-barricade-sites.js";
import {pgCapsuleClear,pgSpawnMotion,pgStepMovement} from "./movement.js";
import {PG_TACTICAL_MOVEMENT_RULES} from "./movement-rules.js";
import type {PgSolid} from "./types.js";
const machines=[PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_FORGE_SITE,...PG_ZOMBIE_TONIC_SOCKETS,...PG_ZOMBIE_WALL_BUYS];
const environment=[...PG_MAP.solids,...PG_ZOMBIE_DOORS.map(door=>door.solid),...PG_ZOMBIE_QUARANTINE_WINGS,...machines.map(machine=>machine.solid)];
const boards=PG_ZOMBIE_BARRICADE_SITES.flatMap(site=>site.boards.map(board=>board.solid));
const posts=PG_ZOMBIE_BARRICADE_SITES.flatMap(site=>site.posts.map(post=>post.solid));
const overlaps=(a:PgSolid,b:PgSolid)=>(["x","y","z"] as const).every(axis=>Math.abs(a.center[axis]-b.center[axis])<a.half[axis]+b.half[axis]-.001);
describe("authored zombie entry barricades",()=>{
 it("keeps nine physical planks separate from all structures, doors and machines",()=>{
  expect(PG_ZOMBIE_BARRICADE_SITES).toHaveLength(3);expect(boards).toHaveLength(9);
  expect(new Set(boards.map(board=>board.id)).size).toBe(9);
  expect(posts).toHaveLength(6);
  for(const board of [...boards,...posts]){expect(environment.filter(solid=>overlaps(board,solid)).map(solid=>solid.id),board.id).toEqual([]);expect([...boards,...posts].filter(other=>other!==board&&overlaps(board,other)),board.id).toEqual([]);}
 });
 it("preserves standing entry/repair approaches, survivor spawns, and every machine/door approach",()=>{
  const map={...PG_MAP,solids:[...environment,...boards,...posts]};
  const positions=[...PG_ZOMBIE_SURVIVOR_SPAWNS,...PG_ZOMBIE_BARRICADE_SITES.flatMap(site=>[site.entry,site.interaction]),...machines.map(machine=>machine.interaction)];
  for(const position of positions){expect(pgCapsuleClear(position,PG_BALANCE.height,map),JSON.stringify(position)).toBe(true);expect(map.solids.some(solid=>solid.kind==="floor"&&Math.abs(position.y-solid.center.y-solid.half.y)<.001&&Math.abs(position.x-solid.center.x)<=solid.half.x&&Math.abs(position.z-solid.center.z)<=solid.half.z)).toBe(true);}
  const opened={...map,solids:map.solids.filter(solid=>!PG_ZOMBIE_DOORS.some(door=>door.solid.id===solid.id))};
  for(const door of PG_ZOMBIE_DOORS)for(const point of door.approaches)expect(pgCapsuleClear(point,PG_BALANCE.height,opened),door.id).toBe(true);
 });
 it.each(PG_ZOMBIE_BARRICADE_SITES)("blocks ordinary standing passage at $id until its planks are removed",site=>{
  const plane=site.boards[0].solid,axis=plane.half.x<plane.half.z?"x":"z",sign=Math.sign(site.entry[axis]-site.position[axis]),from={...site.position,[axis]:site.position[axis]+sign*.8},goal={...site.position,[axis]:site.position[axis]-sign*.8};
  const walk=(solids:PgSolid[])=>{const motion=pgSpawnMotion(from);for(let tick=0;tick<120;tick++){const dx=goal.x-motion.position.x,dz=goal.z-motion.position.z;pgStepMovement(motion,{sequence:tick,moveX:0,moveZ:-1,yaw:Math.atan2(-dx,-dz),pitch:0,jump:false,sprint:false,crouch:false,ads:false},1/60,tick*1000/60,{...PG_MAP,solids},{...PG_TACTICAL_MOVEMENT_RULES,jump:false,mantle:false,walkSpeed:2.3,maxSpeed:2.3});}return motion.position;};
  expect(sign*(walk([...environment,...posts,...boards])[axis]-site.position[axis])).toBeGreaterThan(0);
  expect(sign*(walk([...environment,...posts])[axis]-site.position[axis])).toBeLessThan(0);
 });
});
