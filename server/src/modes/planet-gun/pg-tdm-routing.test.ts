import {describe,expect,it} from "vitest";
import {PG_MAP,PG_TACTICAL_MOVEMENT_RULES,pgCreateGun,pgSpawnMotion,pgStepMovement,type PgMap,type PgPlayer,type Vec3} from "@planetfall/shared";
import {pgBotInput,pgBotMemory} from "./pg-bots.js";

const point=(x:number,z:number):Vec3=>({x,y:0,z});
const player=(position:Vec3,id="tdm-solar")=>({...pgSpawnMotion(position),id,team:"solar",hp:100,grounded:true,lifeId:1,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:0} as PgPlayer);
const context=(map=PG_MAP)=>({map,goal:null,grounded:true,visible:()=>false});
const corners=[
 {name:"A south entrance",position:point(-27.8,0)},
 {name:"A interior partition",position:point(-20.2,-12.2)},
 {name:"B west entrance",position:point(12.2,16)},
 {name:"B service wing",position:point(36.2,-3.8)},
];

describe("TDM navigation without a mode objective",()=>{
 it.each(corners)("retains and physically completes patrol corners from $name, then continues patrolling",({position})=>{
  const p=player(position),memory=pgBotMemory(),ctx=context();
  pgBotInput(p,[p],1000,"normal",memory,ctx);
  const path=[...memory.path],goal={...memory.routeGoal!};
  pgBotInput(p,[p],1350,"normal",memory,ctx);
  expect(memory.path).toEqual(path);
  expect(memory.routeGoal).toEqual(goal);
  let arrived=false,continued=false;
  for(let tick=0;tick<60*60;tick++){
   const now=1400+tick*1000/60,{input}=pgBotInput(p,[p],now,"normal",memory,ctx);
   pgStepMovement(p,input,1/60,now,PG_MAP,PG_TACTICAL_MOVEMENT_RULES);
   if(Math.hypot(p.position.x-goal.x,p.position.y-goal.y,p.position.z-goal.z)<.85)arrived=true;
   if(arrived&&memory.routeGoal&&Math.hypot(memory.routeGoal.x-goal.x,memory.routeGoal.z-goal.z)>3){continued=true;break;}
  }
  expect(arrived,`stopped at ${JSON.stringify(p.position)}, path ${memory.path}, goal ${JSON.stringify(goal)}`).toBe(true);
  expect(continued).toBe(true);
 });

 it("keeps a safe connector and a blocked walk corner during visible pursuit",()=>{
  const p=player(point(-27.8,0)),enemy={...player(point(-24,-8),"enemy"),team:"void"} as PgPlayer,memory=pgBotMemory();
  const ctx={...context(),visible:()=>true};
  pgBotInput(p,[p,enemy],1000,"normal",memory,ctx);
  expect(memory.path[0]).toBe(21);
  const path=[...memory.path];
  pgBotInput(p,[p,enemy],1350,"normal",memory,ctx);
  expect(memory.path).toEqual(path);
  const panel={id:"test-door",kind:"structure" as const,center:{x:-24,y:1.4,z:-1},half:{x:2,y:1.4,z:.18},mantle:false};
  const map={...PG_MAP,solids:[...PG_MAP.solids,panel]};
  p.position=point(-24.8,0);memory.path=[21,20];memory.routeMap=map;memory.nextDecision=Infinity;
  pgBotInput(p,[p,enemy],1400,"normal",memory,{...ctx,map});
  expect(memory.path[0]).toBe(21);
 });

 it("recovers a stalled retained corner instead of jumping forever against it",()=>{
  const panel={id:"test-door",kind:"structure" as const,center:{x:-24,y:1.4,z:-1},half:{x:2,y:1.4,z:.18},mantle:false};
  const map={...PG_MAP,solids:[...PG_MAP.solids,panel]},start=point(-24.8,0),p=player(start),memory=pgBotMemory();
  memory.path=[21,20];memory.goal=20;memory.routeMap=map;memory.routeGoal={...map.navigation[20].position};memory.nextDecision=Infinity;memory.last={...start};
  let recovered=false,traveled=0;
  for(let tick=0;tick<60*20;tick++){
   const now=1000+tick*1000/60,before={...p.position},{input}=pgBotInput(p,[p],now,"normal",memory,context(map));
   pgStepMovement(p,input,1/60,now,map,PG_TACTICAL_MOVEMENT_RULES);
   traveled+=Math.hypot(p.position.x-before.x,p.position.z-before.z);
   if(memory.path[0]!==21)recovered=true;
  }
  expect(recovered).toBe(true);expect(traveled).toBeGreaterThan(10);
  expect(Math.hypot(p.position.x-start.x,p.position.z-start.z)).toBeGreaterThan(3);
 });

 it("selects patrols within the reachable component and keeps moving after arrival",()=>{
  const map:PgMap={...PG_MAP,solids:[PG_MAP.solids[0]],navigation:[
   {id:0,position:point(0,0),links:[{to:1,kind:"walk"}]},
   {id:1,position:point(8,0),links:[{to:0,kind:"walk"}]},
   {id:2,position:point(20,0),links:[]},
  ]};
  const p=player(point(0,0)),memory=pgBotMemory(),visited=new Set<number>();
  for(let tick=0;tick<60*10;tick++){
   const now=1000+tick*1000/60,{input}=pgBotInput(p,[p],now,"normal",memory,context(map));
   visited.add(memory.goal);expect(memory.goal).not.toBe(2);
   pgStepMovement(p,input,1/60,now,map,PG_TACTICAL_MOVEMENT_RULES);
  }
  expect([...visited].sort()).toEqual([0,1]);
 });
});
