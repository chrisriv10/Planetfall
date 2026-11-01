import {describe,expect,it} from "vitest";
import {PG_MAP,PG_ZOMBIE_DOORS,PG_ZOMBIE_QUARANTINE_WINGS,PG_TACTICAL_MOVEMENT_RULES,pgSpawnMotion,pgStepMovement,type Vec3} from "@planetfall/shared";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";
function quarantine(){const world=new PgModeWorld();world.reset([...PG_ZOMBIE_DOORS.map(d=>({id:d.id,solid:d.solid})),...PG_ZOMBIE_QUARANTINE_WINGS.map(solid=>({id:solid.id,solid}))].map(p=>({...p,hp:1000000,maxHp:1000000,active:true,reinforced:true,revision:0})),0);return world;}
function follow(from:Vec3,to:Vec3,map=PG_MAP){const nav=new PgZombieNavigation(map),motion=pgSpawnMotion(from);let destination:Vec3|null=null;for(let tick=0;tick<60*60;tick++){if(tick%21===0)destination=nav.destination(motion.position,to);if(!destination)break;const dx=destination.x-motion.position.x,dz=destination.z-motion.position.z,n=Math.hypot(dx,dz);pgStepMovement(motion,{sequence:tick,moveX:0,moveZ:-Math.min(1,n/.4),yaw:Math.atan2(-dx,-dz),pitch:0,jump:false,crouch:false,sprint:false,ads:false},1/60,tick*1000/60,map,{...PG_TACTICAL_MOVEMENT_RULES,jump:false,mantle:false,walkSpeed:2.3,maxSpeed:2.3});if(Math.hypot(motion.position.x-to.x,motion.position.y-to.y,motion.position.z-to.z)<.6)return motion.position;}return motion.position;}
describe("infected physical navigation",()=>{
 it("sweeps the entire standing footprint on a flat support",()=>{
  const floor={id:"floor",kind:"floor" as const,center:{x:0,y:-.5,z:0},half:{x:8,y:.5,z:8},mantle:false};
  const obstacle={id:"low-blocker",kind:"structure" as const,center:{x:0,y:.3,z:0},half:{x:.01,y:.3,z:.01},mantle:false};
  const nav=new PgZombieNavigation({...PG_MAP,navigation:[],solids:[floor,obstacle]});
  expect(nav.reachable({x:-4,y:0,z:.3},{x:4,y:0,z:.3})).toBe(false);
  expect(nav.reachable({x:-4,y:0,z:1},{x:4,y:0,z:1})).toBe(true);
 });
 it("does not bridge a gap between disconnected supports at the same height",()=>{
  const solids=[-3,3].map(x=>({id:`ledge-${x}`,kind:"floor" as const,center:{x,y:3,z:0},half:{x:1,y:.5,z:2},mantle:false}));
  const nav=new PgZombieNavigation({...PG_MAP,navigation:[],solids});
  expect(nav.reachable({x:-3,y:3.5,z:0},{x:3,y:3.5,z:0})).toBe(false);
 });
 it("walks between supported roof fallback entries without a ground anchor",()=>{const from={x:-30.5,y:6.8,z:-19},to={x:-22.5,y:6.8,z:-15.5},position=follow(from,to,quarantine().map);expect(Math.hypot(position.x-to.x,position.y-to.y,position.z-to.z)).toBeLessThan(.65);});
 it.each([{x:-32,y:0,z:-16},{x:-16,y:0,z:-16},{x:-31,y:3.5,z:-13}])("reaches the quarantined survivor from $x,$y,$z",from=>{const to={x:-28,y:0,z:-5.25},position=follow(from,to,quarantine().map);expect(Math.hypot(position.x-to.x,position.y-to.y,position.z-to.z),JSON.stringify(position)).toBeLessThan(.65);});
 it.each([{from:{x:-28,y:0,z:-3},to:{x:-25,y:3.5,z:-15}},{from:{x:-25,y:3.5,z:-15},to:{x:-28,y:0,z:-3}},{from:{x:32,y:0,z:4},to:{x:28,y:3.5,z:20}},{from:{x:28,y:3.5,z:20},to:{x:32,y:0,z:4}}])("walks a gallery stair route in either direction: $from -> $to",({from,to})=>{const position=follow(from,to);expect(Math.hypot(position.x-to.x,position.y-to.y,position.z-to.z),JSON.stringify(position)).toBeLessThan(.65);});
});
