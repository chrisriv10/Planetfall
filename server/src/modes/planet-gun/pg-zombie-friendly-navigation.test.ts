import {describe,expect,it} from "vitest";
import {PG_MAP,PG_OBJECTIVES,PG_TACTICAL_MOVEMENT_RULES,PG_ZOMBIE_DOORS,PG_ZOMBIE_QUARANTINE_WINGS,pgSpawnMotion,pgStepMovement,type PgPlayer,type Vec3} from "@planetfall/shared";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombies} from "./pg-zombies.js";
import {pgBotInput,pgBotMemory} from "./pg-bots.js";
function fixture(){
 const world=new PgModeWorld();world.reset([...PG_ZOMBIE_DOORS.map(d=>({id:d.id,solid:d.solid})),...PG_ZOMBIE_QUARANTINE_WINGS.map(solid=>({id:solid.id,solid}))].map(p=>({...p,hp:1000000,maxHp:1000000,active:true,reinforced:true,revision:0})),0);
 const mode=new PgZombies({players:new Map(),world,damage:()=>0,finish:()=>{},respawn:()=>{}});return {world,mode};
}
function follow(from:Vec3,goal:Vec3,door="west-south"){
 const {world,mode}=fixture();world.damage(door,1000000,1,true);
 const p={...pgSpawnMotion(from),id:"friendly-bot",team:"solar",hp:100} as PgPlayer,memory=pgBotMemory();let crossedSouth=false;
 for(let tick=0;tick<60*25;tick++){
  const now=tick*1000/60,steering=mode.botWaypoint(p,goal),{input}=pgBotInput(p,[p],now,"hard",memory,{map:world.map,goal,steering,grounded:true,visible:(a,b)=>world.visible(a,b)});
  expect(input.jump).toBe(false);expect(input.crouch).toBe(false);
  const old={...p.position};pgStepMovement(p,input,1/60,now,world.map,PG_TACTICAL_MOVEMENT_RULES);
  if((old.z+1)*(p.position.z+1)<=0&&Math.abs(p.position.x+25)<2)crossedSouth=true;
  if(Math.hypot(p.position.x-goal.x,p.position.y-goal.y,p.position.z-goal.z)<.65)return {p,crossedSouth};
 }
 throw Error(`Friendly route stalled: ${JSON.stringify({from,goal,position:p.position,waypoint:mode.botWaypoint(p,goal)})}`);
}
describe("friendly physical survival routes",()=>{
 it.each([PG_OBJECTIVES.power,PG_OBJECTIVES.station,{x:-17.8,y:0,z:9.8}])("leaves the starting court through its purchased south opening toward $x,$z",goal=>{const result=follow({x:-28,y:0,z:-9},goal);expect(result.crossedSouth).toBe(true);});
 it("returns from the station through the south opening",()=>{expect(follow(PG_OBJECTIVES.station,{x:-28,y:0,z:-9}).crossedSouth).toBe(true);});
 it("uses the purchased court opening to follow a downed survivor",()=>{follow({x:-28,y:0,z:-9},{x:-17.8,y:0,z:9.8},"west-court-access");});
 it("treats explicit null steering as stop even with stale generic route memory",()=>{
  const p={...pgSpawnMotion({x:-28,y:0,z:-9}),id:"friendly-bot",team:"solar",hp:100} as PgPlayer,memory=pgBotMemory();memory.path=[999999];memory.goal=999999;
  const {input}=pgBotInput(p,[p],2000,"hard",memory,{map:PG_MAP,goal:PG_OBJECTIVES.power,steering:null,visible:()=>true});expect(Math.hypot(input.moveX,input.moveZ)).toBe(0);expect(input.jump).toBe(false);
 });
});
