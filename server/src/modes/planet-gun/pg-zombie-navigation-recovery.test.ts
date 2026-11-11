import {describe,expect,it} from "vitest";
import {PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_DOORS,PG_ZOMBIE_QUARANTINE_WINGS,PG_TACTICAL_MOVEMENT_RULES,pgSpawnMotion,pgStepMovement,type Vec3} from "@planetfall/shared";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";

function survivalWorld(){
 const world=new PgModeWorld();
 world.reset([{id:PG_ZOMBIE_ARSENAL_SITE.solid.id,solid:PG_ZOMBIE_ARSENAL_SITE.solid},...PG_ZOMBIE_DOORS.map(d=>({id:d.id,solid:d.solid})),...PG_ZOMBIE_QUARANTINE_WINGS.map(solid=>({id:solid.id,solid}))].map(panel=>({...panel,hp:1000000,maxHp:1000000,active:true,reinforced:true,revision:0})),0);
 return world;
}
const rack={x:-22,y:0,z:6};
function follow(nav:PgZombieNavigation,world:PgModeWorld,from:Vec3){
 const motion=pgSpawnMotion(from);let destination:Vec3|null=null;
 for(let tick=0;tick<60*60;tick++){
  if(tick%21===0)destination=nav.destination(motion.position,rack);
  expect(destination,"A supported route must retain a next waypoint").not.toBeNull();
  const dx=destination!.x-motion.position.x,dz=destination!.z-motion.position.z,n=Math.hypot(dx,dz);
  pgStepMovement(motion,{sequence:tick,moveX:0,moveZ:-Math.min(1,n/.4),yaw:Math.atan2(-dx,-dz),pitch:0,jump:false,crouch:false,sprint:false,ads:false},1/60,tick*1000/60,world.map,{...PG_TACTICAL_MOVEMENT_RULES,jump:false,mantle:false,walkSpeed:2.3,maxSpeed:2.3});
  if(Math.hypot(motion.position.x-rack.x,motion.position.y-rack.y,motion.position.z-rack.z)<.6)return;
 }
 throw Error(`Survival rack route stalled: ${JSON.stringify({from,position:motion.position,destination})}`);
}

describe("survival navigation route progress",()=>{
 it.each([{x:-16,y:0,z:-8},{x:-16,y:0,z:-16},{x:-15.670078764825696,y:0,z:-12.339984368097833}])("walks from $x,$z through the purchased south door to the Pulse rack",from=>{
  const world=survivalWorld();world.damage("west-south",1000000,1,true);
  follow(new PgZombieNavigation(world.map),world,from);
 });
 it("invalidates route costs when a room topology is replaced",()=>{
  const world=survivalWorld(),from={x:-16,y:0,z:-8};world.damage("west-south",1000000,1,true);
  const nav=new PgZombieNavigation(world.map);nav.update(world.map,world.revision);
  expect(nav.destination(from,rack)).not.toBeNull();
  const closed=survivalWorld();nav.update(closed.map,world.revision+1);
  expect(nav.destination(from,rack)).toBeNull();
  nav.update(world.map,world.revision+2);follow(nav,world,from);
 });
});
