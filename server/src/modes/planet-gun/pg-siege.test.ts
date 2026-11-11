import {describe,it,expect,vi} from "vitest";
import {PG_MAP,PG_OBJECTIVES,PG_PANEL_SOCKETS,PG_OPERATORS,PG_SIEGE_CAMERAS,pgLeanEye,pgCreateGun,pgSpawnMotion,pgCapsuleClear,type PgOperatorId,type PgPlayer,type PgTeam,type PgModeAction,type PgModeSnapshot,type Vec3} from "@planetfall/shared";
import {PgSiege} from "./pg-siege.js";
import {PgModeWorld} from "./pg-mode-world.js";
import type {PgModeContext} from "./pg-mode-runtime.js";
const open={x:0,y:0,z:-16};
function setup(picks:Record<string,PgOperatorId>={a:"rivet",b:"brace"},extra:readonly [string,PgTeam,boolean][]=[]){
 const players=new Map<string,PgPlayer>();
 for(const [id,team,isBot]of [["a","solar",false],["b","void",false],...extra]as [string,PgTeam,boolean][]){players.set(id,{...pgSpawnMotion(PG_MAP.spawns.find(s=>s.team===team)!.position),id,team,isBot,lifeId:0,hp:100,lastDamageAt:-1000,protectedUntil:0,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:0}as PgPlayer);}
 const finish=vi.fn();let mode:PgSiege;
 const ctx:PgModeContext={players,world:new PgModeWorld(),selections:new Map(Object.entries(picks)),finish,respawn(p,now,loadout,position){Object.assign(p,pgSpawnMotion(position??PG_MAP.spawns.find(s=>s.team===p.team)!.position));p.lifeId++;p.hp=100;p.protectedUntil=now;p.guns=[pgCreateGun(loadout?.primary??"pulse"),pgCreateGun(loadout?.secondary??"orbit")];},damage(p,who,amount,now){const value=mode.damage(p,who,amount,now);if(p.hp<=0)mode.eliminated(p,who,"pulse",now);return value;}};
 mode=new PgSiege(ctx);mode.start(0);const a=players.get("a")!,b=players.get("b")!;return {mode,ctx,finish,a,b};
}
function snap(mode:PgSiege,viewer="a"){const result=mode.snapshot(viewer);if(result.id!=="planetsiege")throw Error("Wrong mode");return result;}
function act(mode:PgSiege,p:PgPlayer,body:Omit<Extract<PgModeAction,{kind:"ability"}>,"lifeId"|"sequence">,now=35100){return mode.action(p,{...body,lifeId:p.lifeId,sequence:1},now);}
function start(game:ReturnType<typeof setup>){game.mode.update(0,35000);game.a.position={...open};game.b.position={x:35,y:0,z:-30};}
function deploy(game:ReturnType<typeof setup>,p:PgPlayer,position:Vec3,now=35100){return act(game.mode,p,{kind:"ability",slot:0,position},now);}
function panel(game:ReturnType<typeof setup>,index=0,now=100){const socket=PG_PANEL_SOCKETS[index];game.b.position={...socket.approaches[0]};expect(act(game.mode,game.b,{kind:"ability",slot:1,targetId:socket.id},now).ok).toBe(true);return socket;}

describe("PlanetSiege authority",()=>{
 it("uses destroyable enemy camera hardware and never restores a destroyed feed by selecting it again",()=>{
  const g=setup();start(g);const camera=PG_SIEGE_CAMERAS[0];
  expect(g.mode.action(g.b,{kind:"camera",cameraId:camera.id,sequence:1,lifeId:g.b.lifeId},35100).ok).toBe(true);
  expect(g.mode.targets(g.b).some(target=>target.id===camera.id)).toBe(false);
  const target=g.mode.targets(g.a).find(target=>target.id===camera.id)!;expect(target).toBeDefined();
  expect(target.damage(Number.NaN,g.a,35200)).toBe(0);expect(target.damage(-10,g.a,35200)).toBe(0);
  expect(target.damage(15,g.a,35200)).toBe(15);expect(snap(g.mode,"b").cameras.find(state=>state.id===camera.id)?.hp).toBe(20);
  expect(g.mode.viewOrigin(g.b)).toEqual(camera.position);
  expect(target.damage(50,g.a,35300)).toBe(20);expect(target.damage(50,g.a,35301)).toBe(0);
  expect(g.mode.targets(g.a).some(target=>target.id===camera.id)).toBe(false);expect(g.mode.viewOrigin(g.b)).toBeNull();
  expect(g.mode.action(g.b,{kind:"camera",cameraId:camera.id,sequence:2,lifeId:g.b.lifeId},35400).ok).toBe(false);
  expect(snap(g.mode,"b").cameras.find(state=>state.id===camera.id)).toMatchObject({hp:0,maxHp:35,disabled:true});
  expect(g.mode.action(g.b,{kind:"camera",cameraId:null,sequence:3,lifeId:g.b.lifeId},35500).ok).toBe(true);
  expect(g.mode.viewOrigin(g.b)).toEqual(pgLeanEye(g.b));
 });
 it("gives six defenders separate clear preparation positions across both entrances",()=>{
  const extra:[string,PgTeam,boolean][]=[];for(let i=0;i<5;i++)extra.push([`s${i}`,"solar",true],[`v${i}`,"void",true]);
  const g=setup({},extra),defenders=[...g.ctx.players.values()].filter(p=>p.team==="void"),goals=defenders.map(p=>g.mode.botGoal(p,100)!);
  expect(new Set(goals.map(p=>`${p.x}:${p.y}:${p.z}`)).size).toBe(6);
  expect(goals.filter(p=>p.x===-33.8)).toHaveLength(3);expect(goals.filter(p=>p.z===-2.2)).toHaveLength(3);
  for(const goal of goals)expect(pgCapsuleClear(goal,1.95,g.ctx.world.map)).toBe(true);
  for(let a=0;a<goals.length;a++)for(let b=a+1;b<goals.length;b++)expect(Math.hypot(goals[a].x-goals[b].x,goals[a].z-goals[b].z)).toBeGreaterThanOrEqual(1);
 });
 it("keeps attack goals stable near deployed cover that is not a doorway",()=>{
  const g=setup();start(g);g.a.position={x:-40,y:0,z:-22};const before=g.mode.botGoal(g.a,35001);
  g.ctx.world.add({id:"cover-regression",solid:{id:"cover-regression-solid",kind:"utility",center:{x:-40,y:1,z:-25},half:{x:.5,y:1,z:.3},mantle:false},hp:100,maxHp:100,reinforced:false,active:true,revision:1},35002);
  expect(g.mode.botGoal(g.a,35003)).toEqual(before);
  g.a.position.z=-20;expect(g.mode.botGoal(g.a,35004)).toEqual(before);
 });
 it("distributes six attacker goals inside the objective without placing a pilot in a stair",()=>{
  const extra:[string,PgTeam,boolean][]=[];for(let i=0;i<5;i++)extra.push([`s${i}`,"solar",true],[`v${i}`,"void",true]);
  const g=setup({},extra);start(g);
  for(const team of ["solar"]as const){
   const goals=[...g.ctx.players.values()].filter(p=>p.team===team).map(p=>g.mode.botGoal(p,35001)!);
   expect(new Set(goals.map(p=>`${p.x}:${p.y}:${p.z}`)).size).toBe(6);
   for(const goal of goals){expect(pgCapsuleClear(goal,1.95,g.ctx.world.map)).toBe(true);expect(Math.hypot(goal.x+28,goal.z+9)).toBeLessThanOrEqual(PG_OBJECTIVES.uplink[0].radius);}
  }
 });
 it("rechecks capture slots when newly deployed physical cover blocks one",()=>{
  const g=setup();start(g);const old=g.mode.botGoal(g.a,35001)!;
  g.ctx.world.add({id:"objective-cover",solid:{id:"objective-cover-solid",kind:"utility",center:{...old,y:1},half:{x:.5,y:1,z:.5},mantle:false},hp:100,maxHp:100,reinforced:false,active:true,revision:1},35002);
  const next=g.mode.botGoal(g.a,35003)!;expect(next).not.toEqual(old);expect(pgCapsuleClear(next,1.95,g.ctx.world.map)).toBe(true);
 });
 it("hides identifying health until an operator is visible without changing trusted health",()=>{
  const g=setup({a:"null",b:"brace"});start(g);
  expect(g.mode.maxHp(g.a)).toBe(105);expect(g.mode.maxHp(g.b)).toBe(125);
  expect(snap(g.mode,"b").pilots.a).toMatchObject({characterId:null,maxHp:100});
  expect(snap(g.mode,"a").pilots.a).toMatchObject({characterId:"null",maxHp:105});
  g.b.position={x:2,y:0,z:-16};
  expect(snap(g.mode,"b").pilots.a).toMatchObject({characterId:"null",maxHp:105});
  expect(g.mode.maxHp(g.a)).toBe(105);expect(g.a.hp).toBe(105);
 });
 it("publishes the consumed common breach charge without replenishing it after a rejected repeat",()=>{
  const g=setup(),socket=panel(g);g.mode.update(0,35000);g.a.position={...socket.approaches[1]};g.b.position={x:35,y:0,z:-30};
  expect(snap(g.mode).pilots.a.charges[1]).toBe(1);
  expect(act(g.mode,g.a,{kind:"ability",slot:1,targetId:socket.id}).ok).toBe(true);
  expect(snap(g.mode).pilots.a.charges[1]).toBe(0);
  expect(act(g.mode,g.a,{kind:"ability",slot:1,targetId:socket.id},35200).ok).toBe(false);
  expect(snap(g.mode).pilots.a.charges[1]).toBe(0);
 });
 it("lets a human take an auto-filled operator while keeping reservations unique and spent bot charges bounded",()=>{
  const g=setup({a:"rivet",b:"brace"},[["bot","solar",true]]),bot=g.ctx.players.get("bot")!;
  const before=snap(g.mode).pilots[bot.id].characterId!;
  expect(before).not.toBe("rivet");
  const result=g.mode.action(g.a,{kind:"select",sequence:10,lifeId:g.a.lifeId,characterId:before},100);
  expect(result.ok).toBe(true);
  const after=snap(g.mode).pilots;
  expect(after.a.characterId).toBe(before);expect(after[bot.id].characterId).toBe("rivet");
  expect(new Set([after.a.characterId,after[bot.id].characterId]).size).toBe(2);
  expect(after[bot.id].charges[0]).toBeLessThanOrEqual(PG_OPERATORS.rivet.signature.charges);
 });
 it("honors lobby picks, reserves all twelve distinct operators, and assigns humans before bots",()=>{
  const ids=Object.keys(PG_OPERATORS)as PgOperatorId[],picks:Record<string,PgOperatorId>={a:"patch",b:"shroud"};
  const extra: [string,PgTeam,boolean][]=[];for(let i=0;i<5;i++){extra.push([`s${i}`,"solar",i<4],[`v${i}`,"void",i<4]);}picks.s4="lumen";picks.v4="hush";
  const g=setup(picks,extra),solar=snap(g.mode).pilots,voids=snap(g.mode,"b").pilots;
  expect(solar.a.characterId).toBe("patch");expect(solar.s4.characterId).toBe("lumen");expect(voids.b.characterId).toBe("shroud");expect(voids.v4.characterId).toBe("hush");
  for(const team of ["solar","void"]as const){const chosen=[...g.ctx.players.values()].filter(p=>p.team===team).map(p=>(team==="solar"?solar:voids)[p.id].characterId);expect(new Set(chosen).size).toBe(6);expect(chosen.every(id=>ids.includes(id as PgOperatorId))).toBe(true);}
 });
 it("gates prep combat, operator/loadout changes, reinforcement and one-life movement",()=>{
  const g=setup();expect(g.mode.canFire(g.a)).toBe(false);expect(g.mode.canMove(g.a)).toBe(false);expect(g.mode.canMove(g.b)).toBe(true);expect(g.mode.damage(g.b,g.a,50,100)).toBe(0);
  expect(g.mode.action(g.a,{kind:"select",characterId:"brace",sequence:1,lifeId:g.a.lifeId},100).ok).toBe(false);
  expect(g.mode.action(g.a,{kind:"select",characterId:"patch",loadout:{primary:"rail",secondary:"comet"},sequence:2,lifeId:g.a.lifeId},100).ok).toBe(false);
  start(g);expect(g.mode.canMove(g.a)).toBe(true);expect(g.mode.canFire(g.a)).toBe(true);expect(g.mode.action(g.a,{kind:"select",characterId:"patch",sequence:3,lifeId:g.a.lifeId},35001).ok).toBe(false);
  g.ctx.damage(g.a,g.b,200,35010);expect(g.mode.canMove(g.a)).toBe(false);expect(snap(g.mode).pilots.a.life).toBe("eliminated");expect(g.a.respawnAt).toBe(Number.MAX_SAFE_INTEGER);
 });
 it("keeps another doorway open, reinforces only in prep, and Rivet opens real reinforced collision with a warning",()=>{
  const g=setup(),socket=panel(g);expect(pgCapsuleClear(socket.approaches[0],1.95,g.ctx.world.map)).toBe(true);
  const midpoint={x:socket.solid.center.x,y:0,z:socket.solid.center.z};expect(pgCapsuleClear(midpoint,1.95,g.ctx.world.map)).toBe(false);
  g.b.position={...PG_PANEL_SOCKETS[1].approaches[0]};expect(act(g.mode,g.b,{kind:"ability",slot:1,targetId:PG_PANEL_SOCKETS[1].id},200).ok).toBe(false);
  g.b.position={...socket.approaches[0]};expect(g.mode.action(g.b,{kind:"deploy",socketId:socket.id,sequence:2,lifeId:g.b.lifeId},200).ok).toBe(true);
  g.mode.update(0,35000);g.a.position={...socket.approaches[1]};g.b.position={x:35,y:0,z:-30};
  expect(act(g.mode,g.a,{kind:"ability",slot:1,targetId:socket.id}).ok).toBe(false);
  expect(act(g.mode,g.a,{kind:"ability",slot:0,targetId:socket.id}).ok).toBe(true);expect(snap(g.mode).effects.some(e=>e.kind==="breach")).toBe(true);
  g.mode.update(.1,36399);expect(pgCapsuleClear(midpoint,1.95,g.ctx.world.map)).toBe(false);g.mode.update(.001,36400);expect(pgCapsuleClear(midpoint,1.95,g.ctx.world.map)).toBe(true);expect(g.ctx.world.visible({...socket.approaches[0],y:1}, {...socket.approaches[1],y:1})).toBe(true);
 });
 it("Brace shutters toggle collision and stay destructible while open",()=>{
  const g=setup(),socket=PG_PANEL_SOCKETS[0];g.b.position={...socket.approaches[0]};expect(act(g.mode,g.b,{kind:"ability",slot:0,targetId:socket.id},100).ok).toBe(true);
  const toggle=(now:number)=>g.mode.action(g.b,{kind:"interact",targetId:socket.id,held:true,sequence:2,lifeId:g.b.lifeId},now);
  expect(toggle(200).ok).toBe(true);expect(g.ctx.world.snapshot().panels[0].active).toBe(false);expect(toggle(300).ok).toBe(false);expect(toggle(1700).ok).toBe(true);expect(g.ctx.world.snapshot().panels[0].active).toBe(true);
  const target=g.mode.targets(g.a).find(t=>t.id===`panel-${socket.id}`)!;expect(target).toBeDefined();target.damage(1000,g.a,1800);expect(g.ctx.world.snapshot().panels[0].active).toBe(false);
 });
 it("Strut low cover blocks movement and disappears when its finite-health target is destroyed",()=>{
  const g=setup({a:"strut",b:"brace"});start(g);const position={x:2,y:0,z:-16};expect(deploy(g,g.a,position).ok).toBe(true);expect(pgCapsuleClear(position,1.95,g.ctx.world.map)).toBe(false);
  const target=g.mode.targets(g.b).find(t=>t.id.startsWith("cover-"))!;expect(target).toBeDefined();expect(target.damage(999,g.b,35200)).toBe(300);expect(pgCapsuleClear(position,1.95,g.ctx.world.map)).toBe(true);
 });
 it("Patch heals living allies with finite charges and cannot resurrect",()=>{
  const g=setup({a:"patch",b:"brace"},[["ally","solar",false]]);start(g);const ally=g.ctx.players.get("ally")!;ally.position={x:1,y:0,z:-16};ally.hp=10;
  for(let n=0;n<3;n++){expect(act(g.mode,g.a,{kind:"ability",slot:0,targetId:ally.id},35100+n).ok).toBe(true);ally.hp=10;}expect(act(g.mode,g.a,{kind:"ability",slot:0,targetId:ally.id},35200).ok).toBe(false);expect(snap(g.mode).pilots.a.charges[0]).toBe(0);
  const dead=setup({a:"patch",b:"brace"},[["ally","solar",false]]);start(dead);const corpse=dead.ctx.players.get("ally")!;corpse.position={...open};corpse.hp=0;expect(act(dead.mode,dead.a,{kind:"ability",slot:0,targetId:corpse.id}).ok).toBe(false);
 });
 it("healing cannot farm healthy targets, ignore walls, or refill spent resources by reselection",()=>{
  const g=setup({a:"patch",b:"brace"},[["ally","solar",false]]);start(g);const ally=g.ctx.players.get("ally")!;ally.position={x:1,y:0,z:-16};ally.hp=g.mode.maxHp(ally);
  expect(act(g.mode,g.a,{kind:"ability",slot:0,targetId:ally.id}).ok).toBe(false);expect(snap(g.mode).pilots.a).toMatchObject({charges:[3,1],contribution:0});
  g.a.position={x:-25,y:0,z:-19};ally.position={x:-25,y:0,z:-23};ally.hp=1;expect(act(g.mode,g.a,{kind:"ability",slot:0,targetId:ally.id}).ok).toBe(false);expect(ally.hp).toBe(1);
  g.a.position={...open};ally.position={x:1,y:0,z:-16};ally.hp=g.mode.maxHp(ally)-1;expect(act(g.mode,g.a,{kind:"ability",slot:0,targetId:ally.id}).ok).toBe(true);expect(ally.hp).toBe(g.mode.maxHp(ally));expect(snap(g.mode).pilots.a.contribution).toBe(1);
  expect(g.mode.action(g.a,{kind:"select",characterId:"patch",lifeId:g.a.lifeId,sequence:9},35200).ok).toBe(false);expect(snap(g.mode).pilots.a.charges[0]).toBe(2);
 });
 it("Lumen sends team-only directional intel with short expiry, while Hush blocks hostile sensing and drones",()=>{
  const g=setup({a:"lumen",b:"hush"});start(g);g.b.position={x:0,y:0,z:-20};g.a.yaw=0;expect(deploy(g,g.a,{x:0,y:0,z:-18}).ok).toBe(true);g.mode.update(.1,35200);expect(snap(g.mode).intel.map(i=>i.targetId)).toContain("b");expect(snap(g.mode,"b").intel).toEqual([]);
  expect(deploy(g,g.b,{x:1,y:0,z:-20},35300).ok).toBe(true);g.mode.update(.1,37400);expect(snap(g.mode).intel).toEqual([]);
  const drone=snap(g.mode).drones[0];g.a.position={...drone.position};g.b.position={...drone.position,x:drone.position.x+1};expect(deploy(g,g.b,{...drone.position,x:drone.position.x+2},37500).ok).toBe(true);
  g.mode.update(.1,37600);expect(snap(g.mode).drones[0].disabledUntil).toBeGreaterThan(37600);expect(g.mode.action(g.a,{kind:"drone",control:true,moveX:0,moveZ:-1,yaw:0,pitch:0,sequence:1,lifeId:g.a.lifeId},37610).ok).toBe(false);
 });
 it("Null EMP disables a hostile jammer after its warning, then the jammer recovers",()=>{
  const g=setup({a:"null",b:"hush"});start(g);const drone=snap(g.mode).drones[0];
  g.a.position={...drone.position};g.b.position={...drone.position,x:drone.position.x+3};
  const jammerPosition={...drone.position,x:drone.position.x+2};expect(deploy(g,g.b,jammerPosition).ok).toBe(true);
  g.mode.update(.1,35200);expect(snap(g.mode).drones[0].disabledUntil).toBeGreaterThan(35200);
  expect(deploy(g,g.a,jammerPosition,35300).ok).toBe(true);g.mode.update(.1,35999);expect(snap(g.mode).drones[0].disabledUntil).toBeGreaterThan(35999);
  g.mode.update(.001,36000);g.mode.update(.1,36600);
  const control=(now:number)=>g.mode.action(g.a,{kind:"drone",control:true,moveX:0,moveZ:0,yaw:0,pitch:0,sequence:1,lifeId:g.a.lifeId},now);
  expect(control(36600).ok).toBe(true);g.mode.update(.1,42100);expect(control(42100).ok).toBe(false);
  expect(snap(g.mode,"b").effects.some(e=>e.kind==="jammer")).toBe(true);
 });
 it("Thread triggers once, marks the enemy for allies, and applies a bounded slow",()=>{
  const g=setup({a:"thread",b:"brace"});start(g);expect(deploy(g,g.a,{x:0,y:0,z:-18}).ok).toBe(true);g.b.position={x:0,y:0,z:-18};g.mode.update(.1,35200);expect(snap(g.mode).intel.some(i=>i.targetId==="b")).toBe(true);expect(g.mode.movement(g.b).walkSpeed).toBeLessThan(g.mode.movement(g.a).walkSpeed);g.mode.update(.1,37300);expect(snap(g.mode).intel).toEqual([]);expect(g.mode.movement(g.b).walkSpeed).toBe(g.mode.movement(g.a).walkSpeed);expect(g.mode.targets(g.b).filter(t=>t.id.startsWith("gadget-"))).toEqual([]);
 });
 it("Thread authors a bounded visible segment, rejects blocked lines, and triggers crossings away from its anchors",()=>{
  const g=setup({a:"thread",b:"brace"});start(g);
  expect(deploy(g,g.a,{x:7,y:0,z:-16}).ok).toBe(false);expect(deploy(g,g.a,{...open}).ok).toBe(false);
  g.a.position={x:-25,y:0,z:-19};expect(deploy(g,g.a,{x:-25,y:0,z:-23}).ok).toBe(false);
  g.a.position={...open};g.b.position={x:3,y:0,z:-14};expect(deploy(g,g.a,{x:6,y:0,z:-16}).ok).toBe(true);const wire=snap(g.mode).effects.find(e=>e.kind==="trip")!;
  expect(wire.position).toEqual(open);expect(wire.end).toEqual({x:6,y:0,z:-16});expect(wire.radius).toBe(.12);
  g.b.position={x:3,y:0,z:-14};g.mode.update(.1,35200);expect(snap(g.mode).intel).toEqual([]);
  g.b.position={x:3,y:0,z:-18};g.mode.update(.1,35300);expect(snap(g.mode).intel.some(i=>i.targetId==="b")).toBe(true);
 });
 it("exposes either destructible Thread endpoint without broadcasting a hidden trap",()=>{
  const g=setup({a:"thread",b:"brace"});start(g);expect(deploy(g,g.a,{x:6,y:0,z:-16}).ok).toBe(true);
  expect(snap(g.mode,"b").effects.filter(e=>e.kind==="trip")).toEqual([]);const end=g.mode.targets(g.b).find(t=>t.id.endsWith("-end"))!;expect(end).toBeDefined();expect(end.damage(25,g.b,35200)).toBe(25);g.mode.update(.1,35200);expect(snap(g.mode).effects.filter(e=>e.kind==="trip")).toEqual([]);
 });
 it("fixed camera intel uses its physical lens, expires behind smoke, and stays team-private",()=>{
  const g=setup({a:"rivet",b:"shroud"});start(g);const camera=PG_SIEGE_CAMERAS[0],point=PG_OBJECTIVES.uplink[0].position;
  const dx=point.x-camera.position.x,dz=point.z-camera.position.z,len=Math.hypot(dx,dz);
  const candidate=PG_MAP.navigation.map(n=>n.position).find(p=>{const px=p.x-camera.position.x,pz=p.z-camera.position.z;return Math.hypot(px,pz)<12&&(dx*px+dz*pz)/(len*Math.hypot(px,pz))>.8&&pgCapsuleClear(p,1.95,g.ctx.world.map)&&g.ctx.world.visible(camera.position,{...p,y:p.y+1.3});});expect(candidate).toBeDefined();g.a.position={...candidate!};g.b.position={x:-33,y:0,z:-18};
  expect(g.mode.action(g.b,{kind:"camera",cameraId:camera.id,sequence:1,lifeId:g.b.lifeId},35100).ok).toBe(true);expect(g.mode.viewOrigin(g.b)).toEqual(camera.position);g.mode.update(.1,35200);expect(snap(g.mode,"b").intel.some(i=>i.targetId==="a")).toBe(true);expect(snap(g.mode).intel).toEqual([]);
  expect(deploy(g,g.b,candidate!,35300).ok).toBe(true);g.mode.update(.1,37400);expect(snap(g.mode,"b").intel).toEqual([]);expect(g.mode.visible(camera.position,{...candidate!,y:candidate!.y+1.3})).toBe(false);
 });
 it("EMP blanks fixed camera feeds for a bounded period",()=>{
  const g=setup({a:"null",b:"brace"});start(g);const camera=PG_SIEGE_CAMERAS[0];g.a.position={x:-32,y:0,z:-18};
  expect(g.mode.action(g.b,{kind:"camera",cameraId:camera.id,sequence:1,lifeId:g.b.lifeId},35100).ok).toBe(true);expect(deploy(g,g.a,{x:-33,y:0,z:-18},35200).ok).toBe(true);g.mode.update(.1,35899);expect(g.mode.viewOrigin(g.b)).toEqual(camera.position);g.mode.update(.001,35900);expect(g.mode.viewOrigin(g.b)).toBeNull();g.mode.update(.1,42000);expect(g.mode.viewOrigin(g.b)).toEqual(camera.position);
 });
 it("Glint requires a nearby wall and pings moving enemies only",()=>{
  const g=setup({a:"rivet",b:"glint"});start(g);g.b.position={...open};expect(deploy(g,g.b,{x:0,y:0,z:-18}).ok).toBe(false);
  g.b.position={x:-25,y:0,z:-18};g.b.yaw=0;expect(deploy(g,g.b,{x:-25,y:0,z:-19}).ok).toBe(true);g.a.position={x:-25,y:0,z:-20};g.a.velocity={x:0,y:0,z:0};g.mode.update(.1,35200);expect(snap(g.mode,"b").intel).toEqual([]);g.a.velocity.x=1;g.mode.update(.1,36200);expect(snap(g.mode,"b").intel.some(i=>i.targetId==="a")).toBe(true);
 });
 it("Coil floor strips deal capped damage and a temporary slow",()=>{
  const g=setup({a:"rivet",b:"coil"});start(g);g.b.position={x:2,y:0,z:-16};expect(deploy(g,g.b,{x:0,y:0,z:-18}).ok).toBe(true);g.a.position={x:0,y:0,z:-18};for(let n=0;n<10;n++)g.mode.update(1,35200+n*1000);expect(g.a.hp).toBe(88);expect(g.mode.movement(g.a).walkSpeed).toBeLessThan(g.mode.movement(g.b).walkSpeed);
 });
 it("Mend shares bounded healing throughput and pool across living allies",()=>{
  const g=setup({a:"rivet",b:"mend"},[["c","void",false],["d","void",false]]);start(g);g.b.position={...open};expect(deploy(g,g.b,{x:0,y:0,z:-18}).ok).toBe(true);const allies=[g.b,g.ctx.players.get("c")!,g.ctx.players.get("d")!];for(const p of allies){p.position={x:0,y:0,z:-18};p.hp=1;}g.mode.update(1,35200);expect(allies.reduce((n,p)=>n+p.hp-1,0)).toBe(24);for(let n=1;n<20;n++)g.mode.update(1,35200+n*1000);expect(allies.reduce((n,p)=>n+p.hp-1,0)).toBe(240);
 });
 it("Shroud obscures sensing and bot visibility after warning, without blocking shots or movement",()=>{
  const g=setup({a:"rivet",b:"shroud"});start(g);g.b.position={x:2,y:0,z:-16};const from={x:0,y:1.3,z:-16},to={x:0,y:1.3,z:-22};expect(deploy(g,g.b,{x:0,y:0,z:-19}).ok).toBe(true);g.mode.update(.1,35599);expect(g.mode.visible(from,to)).toBe(true);g.mode.update(.001,35600);expect(g.mode.visible(from,to)).toBe(false);expect(g.ctx.world.visible(from,to)).toBe(true);expect(pgCapsuleClear({x:0,y:0,z:-19},1.95,g.ctx.world.map)).toBe(true);g.mode.update(.1,45600);expect(g.mode.visible(from,to)).toBe(true);
 });
 it("drone control holds the vulnerable body stationary and cannot fire, escapes control immediately, and rejects malformed input",()=>{
  const g=setup();start(g);const before={...g.a.position};const control=(control:boolean,x=0)=>g.mode.action(g.a,{kind:"drone",control,moveX:x,moveZ:-1,yaw:0,pitch:0,sequence:1,lifeId:g.a.lifeId},35100);
  expect(control(true,NaN).ok).toBe(false);expect(control(true).ok).toBe(true);expect(g.mode.canMove(g.a)).toBe(false);expect(g.mode.canFire(g.a)).toBe(false);g.mode.update(.1,35200);expect(g.a.position).toEqual(before);expect(g.mode.damage(g.a,g.b,10,35200)).toBe(10);expect(control(false).ok).toBe(true);expect(g.mode.canMove(g.a)).toBe(true);
 });
 it("contests capture, decays after vacancy grace and ignores eliminated occupants",()=>{
  const g=setup();start(g);g.a.position={...PG_OBJECTIVES.uplink[0].position};g.mode.update(5,35100);expect(snap(g.mode).capture).toBeCloseTo(1/3);g.b.position={...g.a.position};g.mode.update(3,38100);expect(snap(g.mode).capture).toBeCloseTo(1/3);g.a.position={...open};g.b.position={x:35,y:0,z:-30};g.mode.update(.1,38200);g.mode.update(1,40000);expect(snap(g.mode).capture).toBeCloseTo(1/3);g.mode.update(1,41000);expect(snap(g.mode).capture).toBeCloseTo(1/3-.1);
 });
 it("resolves uncontested control, defense deadline, and simultaneous elimination deterministically",()=>{
  const captured=setup();start(captured);captured.a.position={...PG_OBJECTIVES.uplink[0].position};captured.mode.update(15,50000);expect(snap(captured.mode).roundScores.solar).toBe(1);
  const timed=setup();start(timed);timed.mode.update(0,185000);expect(snap(timed.mode).roundScores.void).toBe(1);
  const mutual=setup();start(mutual);for(const p of [mutual.a,mutual.b]){p.hp=0;mutual.mode.eliminated(p,null,"pulse",35100);}mutual.mode.update(15,185000);expect(snap(mutual.mode).roundScores.void).toBe(1);
 });
 it("moves and destroys finite-health drones and opens the drone-height doorway after breaching",()=>{
  const g=setup(),socket=PG_PANEL_SOCKETS[0];panel(g);g.mode.update(0,35000);
  // Movement uses the real room collision map; the authored doorway also blocks at drone height.
  const drone=snap(g.mode).drones[0];const initial={...drone.position};
  const command=(x:number,z:number,yaw:number,now:number)=>g.mode.action(g.a,{kind:"drone",control:true,moveX:x,moveZ:z,yaw,pitch:0,sequence:1,lifeId:g.a.lifeId},now);
  expect(command(1,0,0,35100).ok).toBe(true);g.mode.update(.1,35200);expect(snap(g.mode).drones[0].position.x).toBeGreaterThan(initial.x);
  const target=g.mode.targets(g.b).find(t=>t.id===drone.id)!;expect(target.damage(100,g.b,35300)).toBe(35);expect(command(1,0,0,35400).ok).toBe(false);
  expect(g.ctx.world.visible({...socket.approaches[0],y:.2},{...socket.approaches[1],y:.2})).toBe(false);g.ctx.world.damage(socket.id,1000,35400,true);expect(g.ctx.world.visible({...socket.approaches[0],y:.2},{...socket.approaches[1],y:.2})).toBe(true);
 });
 it("swaps roles at halftime and bounds paired overtime at three pairs",()=>{
  const g=setup();let now=35000;for(let round=1;round<=12;round++){
   if(snap(g.mode).subphase==="prepare")g.mode.update(0,now);
   const winner=round%2?"solar":"void",victim=winner==="solar"?g.b:g.a;victim.hp=0;g.mode.eliminated(victim,null,"pulse",now+1);g.mode.update(0,now+1);
   if(round===3){g.mode.update(0,now+5001);expect(snap(g.mode).attackTeam).toBe("void");expect(snap(g.mode).pilots.a.side).toBe("defend");expect(PG_OPERATORS[snap(g.mode).pilots.a.characterId as PgOperatorId].side).toBe("defend");now+=40001;}else if(round<12){g.mode.update(0,now+5001);now+=40001;}
  }expect(snap(g.mode).subphase).toBe("complete");expect(g.finish).toHaveBeenCalledExactlyOnceWith(null);
 });
});
