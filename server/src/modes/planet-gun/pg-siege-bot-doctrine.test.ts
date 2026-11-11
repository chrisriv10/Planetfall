import {describe,expect,it,vi} from "vitest";
import {PG_BALANCE,PG_SIEGE_CAMERAS,PG_MAP,PG_OBJECTIVES,PG_PANEL_SOCKETS,pgCapsuleClear,pgCreateGun,pgSpawnMotion,pgStepMovement,type PgPlayer,type PgTeam,type Vec3} from "@planetfall/shared";
import {PgSiege} from "./pg-siege.js";
import {PgModeWorld} from "./pg-mode-world.js";
import type {PgModeContext} from "./pg-mode-runtime.js";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";
import {pgBotInput,pgBotMemory} from "./pg-bots.js";

function game(site=0,bots=6){
 const players=new Map<string,PgPlayer>();
 for(const team of ["solar","void"]as const)for(let i=0;i<6;i++){
  const id=`${team}-${i}`;players.set(id,{...pgSpawnMotion(PG_MAP.spawns.find(s=>s.team===team)!.position),id,team,isBot:team==="void"?i<bots:true,lifeId:0,hp:100,lastDamageAt:-1000,protectedUntil:0,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:0}as PgPlayer);
 }
 let mode:PgSiege;
 const ctx:PgModeContext={players,world:new PgModeWorld(),finish:vi.fn(),respawn(p,now,loadout,position){Object.assign(p,pgSpawnMotion(position??PG_MAP.spawns.find(s=>s.team===p.team)!.position));p.lifeId++;p.hp=100;p.protectedUntil=now;p.guns=[pgCreateGun(loadout?.primary??"pulse"),pgCreateGun(loadout?.secondary??"orbit")];},damage(p,who,amount,now){const dealt=mode.damage(p,who,amount,now);if(p.hp<=0)mode.eliminated(p,who,"pulse",now);return dealt;}};
 mode=new PgSiege(ctx);mode.start(0);let now=35000;mode.update(0,now);
 if(site){for(const p of players.values())if(p.team==="void"){p.hp=0;mode.eliminated(p,null,"pulse",now+1);}mode.update(0,++now);mode.update(0,now+=5000);mode.update(0,now+=35000);}
 const defenders=[...players.values()].filter(p=>p.team==="void"&&p.isBot),point=PG_OBJECTIVES.uplink[site];
 // No combat mutations are needed to exercise the actual public capture signal.
 for(const p of players.values())p.position={...PG_MAP.spawns.find(s=>s.team===p.team)!.position};
 const goal=(p:PgPlayer,at=now+1)=>mode.botGoal(p,at)!;
 const capture=(at:number)=>{players.get("solar-0")!.position={...point.position};mode.update(1,at);};
 return {mode,ctx,players,defenders,point,now,goal,capture};
}
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const key=(p:Vec3)=>`${p.x}:${p.y}:${p.z}`;

describe("Siege bot defensive positioning",()=>{
 it("preserves attacker utility while travelling from spawn without a useful deployment",()=>{
  const g=game();
  for(const index of [1,2,3,4]){
   const p=g.players.get(`solar-${index}`)!,before=g.mode.snapshot(p.id);
   if(before.id!=="planetsiege")throw Error("Wrong mode");
   g.mode.botAction(p,g.now+10);
   const after=g.mode.snapshot(p.id);if(after.id!=="planetsiege")throw Error("Wrong mode");
   expect(after.pilots[p.id].charges[0],before.pilots[p.id].characterId??p.id).toBe(before.pilots[p.id].charges[0]);
  }
 });
 it("deploys a survey sensor facing the actual objective and avoids duplicate coverage",()=>{
  const g=game(),p=g.players.get("solar-1")!;p.position={x:-28,y:0,z:-14};p.yaw=Math.PI;
  g.mode.botAction(p,g.now+10);
  const first=g.mode.snapshot(p.id);if(first.id!=="planetsiege")throw Error("Wrong mode");
  expect(first.pilots[p.id].charges[0]).toBe(1);expect(first.effects.some(e=>e.ownerId===p.id&&e.kind==="sensor")).toBe(true);
  g.mode.botAction(p,g.now+2010);
  const after=g.mode.snapshot(p.id);if(after.id!=="planetsiege")throw Error("Wrong mode");
  expect(after.pilots[p.id].charges[0]).toBe(1);
 });
 it("throws an EMP at visible camera hardware regardless of its navigation facing",()=>{
  const g=game(),p=g.players.get("solar-2")!,camera=PG_SIEGE_CAMERAS[0];p.position={x:-34,y:0,z:-11};p.yaw=Math.PI;
  g.mode.botAction(p,g.now+10);g.mode.update(0,g.now+810);
  const after=g.mode.snapshot(p.id);if(after.id!=="planetsiege")throw Error("Wrong mode");
  expect(after.cameras.find(c=>c.id===camera.id)?.disabledUntil).toBeGreaterThan(g.now+810);
  expect(after.pilots[p.id].charges[0]).toBe(1);
 });
 it("places approach cover toward a visible side threat without blocking the entry corridor",()=>{
  const g=game(),p=g.players.get("solar-3")!,enemy=g.players.get("void-0")!;
  p.position={x:-25,y:0,z:3};p.yaw=0;enemy.position={x:-19,y:0,z:3};
  g.mode.botAction(p,g.now+10);
  const panel=g.ctx.world.snapshot().panels.find(panel=>panel.id.startsWith("cover-"));expect(panel).toBeDefined();
  expect(panel!.solid.center.x).toBeGreaterThan(p.position.x+1.6);
  // The ordinary ground entry remains traversable after deploying the real collider.
  const navigation=new PgZombieNavigation(g.ctx.world.map);
  expect(navigation.reachable(p.position,g.point.position)).toBe(true);
  expect(pgCapsuleClear(p.position,PG_BALANCE.height,g.ctx.world.map)).toBe(true);
 });
 it("preserves cover when its footprint would cut through a friendly approach corridor",()=>{
  const g=game(),p=g.players.get("solar-3")!,enemy=g.players.get("void-0")!;
  p.position={x:-38,y:0,z:-11};enemy.position={x:-38,y:0,z:-5};
  g.mode.botAction(p,g.now+10);
  const after=g.mode.snapshot(p.id);if(after.id!=="planetsiege")throw Error("Wrong mode");
  expect(after.pilots[p.id].charges[0],JSON.stringify({effects:after.effects,paths:[...(g.mode as any).botSteering].map(([id,c]:any)=>({id,path:c.path}))})).toBe(2);
  expect(g.ctx.world.snapshot().panels.some(panel=>panel.id.startsWith("cover-"))).toBe(false);
 });
 it("does not deploy cover in response to an enemy behind opaque geometry",()=>{
  const g=game(),p=g.players.get("solar-3")!,enemy=g.players.get("void-0")!;
  p.position={x:-25,y:0,z:3};enemy.position={x:-19,y:0,z:3};
  g.ctx.world.add({id:"opaque-threat-wall",solid:{id:"opaque-threat-wall",kind:"structure",center:{x:-22,y:1.5,z:3},half:{x:.2,y:1.5,z:2},mantle:false},hp:300,maxHp:300,reinforced:false,active:true,revision:1},g.now+1);
  g.mode.botAction(p,g.now+10);
  const after=g.mode.snapshot(p.id);if(after.id!=="planetsiege")throw Error("Wrong mode");
  expect(after.pilots[p.id].charges[0]).toBe(2);
 });
 it("keeps a second EMP while the observed camera is already disabled",()=>{
  const g=game(),p=g.players.get("solar-2")!;p.position={x:-34,y:0,z:-11};p.yaw=Math.PI;
  g.mode.botAction(p,g.now+10);g.mode.update(0,g.now+810);g.mode.botAction(p,g.now+2010);
  const after=g.mode.snapshot(p.id);if(after.id!=="planetsiege")throw Error("Wrong mode");
  expect(after.pilots[p.id].charges[0]).toBe(1);
 });
 it("places a flank thread at a real compound entrance and saves duplicate charges",()=>{
  const g=game(),p=g.players.get("solar-4")!;p.position={x:-25,y:0,z:1};
  g.mode.botAction(p,g.now+10);g.mode.botAction(p,g.now+2010);
  const after=g.mode.snapshot(p.id);if(after.id!=="planetsiege")throw Error("Wrong mode");
  expect(after.pilots[p.id].charges[0]).toBe(1);expect(after.effects.filter(e=>e.ownerId===p.id&&e.kind==="trip")).toHaveLength(1);
 });
 it("keeps an attacker already controlling the uplink at its capture slot instead of seeking another breach",()=>{
  const g=game(),p=g.players.get("solar-0")!,socket=PG_PANEL_SOCKETS.find(socket=>socket.id==="west-south")!;
  g.ctx.world.reset([{id:socket.id,solid:socket.solid,hp:600,maxHp:600,reinforced:true,active:true,revision:1}],g.now+1);
  p.position={...g.point.position};
  expect(distance(g.goal(p),g.point.position)).toBeLessThan(g.point.radius);
  expect(g.ctx.world.snapshot().panels.find(panel=>panel.id===socket.id)!.active).toBe(true);
 });
 it("routes an attacker without a reinforced breach through the alternative opening",()=>{
  const g=game(),p=g.players.get("solar-2")!,socket=PG_PANEL_SOCKETS.find(socket=>socket.id==="west-south")!;
  g.ctx.world.reset([{id:socket.id,solid:socket.solid,hp:600,maxHp:600,reinforced:true,active:true,revision:1}],g.now+1);
  p.position={x:-25,y:0,z:.2};p.grounded=true;
  const goal=g.goal(p);
  expect(distance(goal,g.point.position)).toBeLessThan(g.point.radius);
  const memory=pgBotMemory();
  for(let tick=1;tick<=1500&&distance(p.position,goal)>.65;tick++){
   const now=g.now+tick*1000/60;g.mode.update(0,now);
   const steering=g.mode.botWaypoint(p,goal),{input}=pgBotInput(p,[p],now,"hard",memory,{map:g.ctx.world.map,goal,steering,grounded:true,visible:()=>false});
   pgStepMovement(p,input,1/60,now,g.ctx.world.map,g.mode.movement(p));
   expect(pgCapsuleClear(p.position,PG_BALANCE.height,g.ctx.world.map)).toBe(true);
  }
  expect(distance(p.position,goal)).toBeLessThan(.65);
  expect(g.ctx.world.snapshot().panels.find(panel=>panel.id===socket.id)!.active).toBe(true);
 });
 it("walks a defender from the actual west spawn to its preparation doorway post",()=>{
  const g=game();g.mode.start(0);const p=g.players.get("void-1")!,memory=pgBotMemory(),goal=g.mode.botGoal(p,0)!,trace:unknown[]=[];
  for(let tick=1;tick<=1200&&distance(p.position,goal)>.65;tick++){
   const now=tick*1000/60;g.mode.update(0,now);
   const steering=g.mode.botWaypoint(p,goal),{input}=pgBotInput(p,[p],now,"hard",memory,{map:g.ctx.world.map,goal,steering,grounded:true,visible:()=>false});
   pgStepMovement(p,input,1/60,now,g.ctx.world.map,g.mode.movement(p));
   if(tick%120===0)trace.push({tick,position:{...p.position},steering});
  }
  expect(distance(p.position,goal),JSON.stringify({position:p.position,goal,trace})).toBeLessThan(.65);
 });
 it("physically walks a west entry attacker around the stair flight to its ground capture slot",()=>{
  const g=game(),p=g.players.get("solar-2")!,memory=pgBotMemory();
  p.position={x:-38,y:0,z:-11};p.grounded=true;
  const goal=g.goal(p);
  for(let tick=1;tick<=1200&&distance(p.position,goal)>.65;tick++){
   const now=g.now+tick*1000/60;g.mode.update(0,now);
   const steering=g.mode.botWaypoint(p,goal),{input}=pgBotInput(p,[p],now,"hard",memory,{map:g.ctx.world.map,goal,steering,grounded:true,visible:()=>false});
   pgStepMovement(p,input,1/60,now,g.ctx.world.map,g.mode.movement(p));
   expect(pgCapsuleClear(p.position,PG_BALANCE.height,g.ctx.world.map),JSON.stringify({position:p.position,steering,goal})).toBe(true);
  }
  expect(distance(p.position,goal)).toBeLessThan(.65);expect(p.position.y).toBe(0);
 });
 it("bounds physical steering queries and immediately invalidates a blocked corridor",()=>{
  const g=game(),p=g.players.get("solar-2")!,goal=g.goal(p),query=vi.spyOn(PgZombieNavigation.prototype,"destination");
  try{
   const first=g.mode.botWaypoint(p,goal)!;expect(first).not.toBeNull();
   const count=query.mock.calls.length;
   for(let tick=1;tick<10;tick++){
    p.position={...p.position,x:p.position.x+.01};g.mode.update(0,g.now+tick*1000/60);
    expect(g.mode.botWaypoint(p,goal)).toEqual(first);
   }
   expect(query).toHaveBeenCalledTimes(count);
   g.ctx.world.add({id:"steering-block",solid:{id:"steering-block",kind:"structure",center:{...first,y:1},half:{x:.5,y:1,z:.5},mantle:false},hp:100,maxHp:100,reinforced:false,active:true,revision:1},g.now+160);
   g.mode.botWaypoint(p,goal);expect(query.mock.calls.length).toBeGreaterThan(count);
  }finally{query.mockRestore();}
 });
 for(const site of [0,1])for(const closed of [null,...PG_PANEL_SOCKETS.filter(socket=>socket.compound===(site===0?"west":"east")).map(socket=>socket.id)])it(`circulates through supported outer cover at site ${site}, closed ${closed??"none"}`,()=>{
  const g=game(site),socket=PG_PANEL_SOCKETS.find(socket=>socket.id===closed);
  if(socket)g.ctx.world.reset([{id:socket.id,solid:socket.solid,hp:600,maxHp:600,reinforced:true,active:true,revision:1}],g.now+1);
  const patrol=g.defenders[5],first=g.goal(patrol),navigation=new PgZombieNavigation(g.ctx.world.map);
  expect(first).toEqual(site===0?{x:-31,y:0,z:13}:{x:21,y:0,z:7});
  const plan=(g.mode as unknown as {defensePosts:{patrol:Vec3[]}}).defensePosts.patrol;
  expect(plan).toContainEqual(site===0?{x:-27,y:0,z:16}:{x:23,y:0,z:0});
  for(const [index,point]of plan.entries()){
   expect(pgCapsuleClear(point,PG_BALANCE.height,g.ctx.world.map)).toBe(true);
   expect(navigation.supported(point)).toBe(true);
   expect(navigation.reachable(g.point.position,point)).toBe(true);
   expect(navigation.reachable(point,plan[(index+1)%plan.length])).toBe(true);
   // Covered backs are visited and left on arrival; time alone never advances them.
   expect(g.goal(patrol,g.now+10000+index*1000)).toEqual(point);
   patrol.position={...point};
   expect(g.goal(patrol,g.now+10001+index*1000)).toEqual(plan[(index+1)%plan.length]);
  }
  expect(g.goal(patrol,g.now+30000)).toEqual(first);
 });
 for(const site of [0,1])it(`keeps one core, separate exterior crossfire and doorway posts at site ${site}`,()=>{
  const g=game(site),goals=g.defenders.map(p=>g.goal(p));
  expect(new Set(goals.map(key)).size).toBe(6);
  expect(goals.filter(p=>distance(p,g.point.position)<g.point.radius)).toHaveLength(1);
  for(const goal of goals)expect(pgCapsuleClear(goal,1.95,g.ctx.world.map)).toBe(true);
  for(const goal of goals.slice(1,3))expect(g.ctx.world.visible({...goal,y:1.3},{...g.point.position,y:1.3})).toBe(true);
  // Arriving changes only the patrol post; elapsed time alone never does.
  const patrol=g.defenders[5],before=g.goal(patrol);expect(g.goal(patrol,g.now+12000)).toEqual(before);
  patrol.position={...before};const after=g.goal(patrol,g.now+12001);expect(after).not.toEqual(before);expect(pgCapsuleClear(after,1.95,g.ctx.world.map)).toBe(true);
 });
 it("does not assign human input or reshuffle surviving bot posts after a death",()=>{
  const g=game(0,4),human=g.players.get("void-4")!,before=g.goal(g.defenders[3]);
  expect(g.mode.botGoal(human,g.now+1)).toBeNull();
  g.ctx.damage(g.defenders[1],g.players.get("solar-0")!,1000,g.now+2);
  expect(g.goal(g.defenders[3],g.now+3)).toEqual(before);
 });
 it("uses a core first for a small bot roster",()=>{
  const g=game(0,1);expect(distance(g.goal(g.defenders[0]),g.point.position)).toBeLessThan(g.point.radius);
 });
 it("revalidates blocked posts on topology change without targeting cover",()=>{
  const g=game(),bot=g.defenders[1],old=g.goal(bot);
  g.ctx.world.add({id:"blocked-defense-post",solid:{id:"blocked-defense-post",kind:"utility",center:{...old,y:1},half:{x:.55,y:1,z:.55},mantle:false},hp:100,maxHp:100,reinforced:false,active:true,revision:1},g.now+2);
  const next=g.goal(bot,g.now+3);expect(next).not.toEqual(old);expect(pgCapsuleClear(next,1.95,g.ctx.world.map)).toBe(true);expect(distance(next,g.point.position)).toBeGreaterThan(g.point.radius);
 });
 it("reacts to public capture with two distinct retakers and retains the other posts",()=>{
  const g=game(),before=g.defenders.map(p=>g.goal(p));g.capture(g.now+400);
  const during=g.defenders.map(p=>g.goal(p,g.now+401));
  expect(during.filter(p=>distance(p,g.point.position)<=g.point.radius)).toHaveLength(3);
  expect(new Set(during.map(key)).size).toBe(6);
  expect(during.filter((p,i)=>key(p)!==key(before[i]))).toHaveLength(2);
  const retakers=g.defenders.filter((_,i)=>i>0&&distance(during[i],g.point.position)<=g.point.radius);
  // A retaker death creates a vacancy, not a stale assignment to an eliminated pilot.
  g.ctx.damage(retakers[0],g.players.get("solar-0")!,1000,g.now+402);
  const remaining=g.defenders.filter(p=>p.hp>0).map(p=>g.goal(p,g.now+800));
  expect(remaining.filter(p=>distance(p,g.point.position)<=g.point.radius)).toHaveLength(3);
 });
 it("ranks retakers by physical walk routes and only recalculates on sensing ticks",()=>{
  const g=game(),[core,behindStairs,south,...others]=g.defenders;
  behindStairs.position={x:-36.2,y:0,z:-11};south.position={x:-25,y:0,z:3};
  for(const p of others)p.hp=0;
  expect(distance(behindStairs.position,g.point.position)).toBeLessThan(distance(south.position,g.point.position));
  const internals=g.mode as unknown as {retakers:string[];retakeRoute:(from:Vec3,to:Vec3)=>{distance:number;entry:string|null}};
  const query=vi.spyOn(internals,"retakeRoute");
  try{
   g.goal(core);g.capture(g.now+400);g.goal(core,g.now+401);
   expect(internals.retakers[0]).toBe(south.id);
   const calls=query.mock.calls.length;expect(calls).toBeGreaterThan(0);
   for(let tick=1;tick<18;tick++)g.goal(core,g.now+401+tick*1000/60);
   expect(query).toHaveBeenCalledTimes(calls);
  }finally{query.mockRestore();}
 });
 it("uses a reachable second entrance when its route is a reasonable alternative",()=>{
  const g=game(1),[core,westNear,westFar,east,...others]=g.defenders;
  westNear.position={x:17,y:0,z:16};westFar.position={x:16,y:0,z:15};east.position={x:38,y:0,z:15};
  for(const p of others)p.hp=0;
  g.goal(core);g.capture(g.now+400);g.goal(core,g.now+401);
  const retakers=(g.mode as unknown as {retakers:string[]}).retakers;
  expect(retakers).toEqual([westNear.id,east.id]);
  expect(retakers).not.toContain(westFar.id);
 });
 it("holds retake orders until capture has reset for a meaningful interval",()=>{
  const g=game();g.defenders.forEach(p=>g.goal(p));g.capture(g.now+400);
  const retake=g.defenders.map(p=>g.goal(p,g.now+401));
  g.players.get("solar-0")!.position={x:0,y:0,z:-30};
  g.mode.update(0,g.now+500);g.mode.update(1,g.now+3000); // Vacancy grace then real decay.
  expect(g.mode.snapshot().id).toBe("planetsiege");
  expect(g.defenders.map(p=>g.goal(p,g.now+3001))).toEqual(retake);
  g.defenders.forEach(p=>g.goal(p,g.now+5200));
  const released=g.defenders.map(p=>g.goal(p,g.now+5501));
  expect(released.filter(p=>distance(p,g.point.position)<g.point.radius)).toHaveLength(1);
 });
});







it("commits a breacher arriving at an open doorway to the objective instead of another exterior panel",()=>{
 const g=game(),p=g.players.get("solar-0")!,closed=PG_PANEL_SOCKETS.find(socket=>socket.id==="west-south")!;
 g.ctx.world.reset([{id:closed.id,solid:closed.solid,hp:600,maxHp:600,reinforced:true,active:true,revision:1}],g.now+1);
 p.position={x:-38,y:0,z:-11};p.grounded=true;
 expect(g.mode.snapshot(p.id).pilots[p.id].characterId).toBe("rivet");
 expect(distance(g.goal(p),g.point.position)).toBeLessThan(g.point.radius);
 const memory=pgBotMemory();let reached=false;
 for(let tick=1;tick<=1200;tick++){
  const now=g.now+tick*1000/60;g.mode.update(0,now);const goal=g.mode.botGoal(p,now)!;
  expect(distance(goal,g.point.position)).toBeLessThan(g.point.radius);
  if(distance(p.position,goal)<.65){reached=true;break;}
  const steering=g.mode.botWaypoint(p,goal),{input}=pgBotInput(p,[p],now,"hard",memory,{map:g.ctx.world.map,goal,steering,grounded:true,visible:()=>false});
  if(steering)expect(pgCapsuleClear(steering,PG_BALANCE.height,g.ctx.world.map),JSON.stringify({tick,steering})).toBe(true);
  pgStepMovement(p,input,1/60,now,g.ctx.world.map,g.mode.movement(p));
  // The standing navigation query inflates a box around corners. Motion uses
  // the rounded horizontal body and its canonical one-centimetre contact skin.
  const penetrating=g.ctx.world.map.solids.filter(b=>p.position.y<b.center.y+b.half.y-.04&&p.position.y+PG_BALANCE.height>b.center.y-b.half.y+.02&&Math.hypot(Math.max(0,Math.abs(p.position.x-b.center.x)-b.half.x),Math.max(0,Math.abs(p.position.z-b.center.z)-b.half.z))<PG_BALANCE.radius-.01-1e-6);
  expect(penetrating.map(b=>b.id),JSON.stringify({tick,position:p.position,goal,steering})).toEqual([]);
 }
 expect(reached).toBe(true);
 expect(g.ctx.world.snapshot().panels.find(panel=>panel.id===closed.id)!.active).toBe(true);
});
