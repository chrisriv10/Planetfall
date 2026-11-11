import {describe,expect,it,vi} from "vitest";
import {DEFAULT_COSMETICS,PG_MAP,PG_OBJECTIVES,PG_WEAPONS,PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_FORGE_SITE,PG_ZOMBIE_TONIC_SOCKETS,PG_ZOMBIE_PRICES,PG_BALANCE,pgCapsuleClear,PG_TACTICAL_MOVEMENT_RULES,pgStepMovement,pgCreateGun,pgSpawnMotion,type PgPlayer,type PgZombiePilot,type Vec3} from "@planetfall/shared";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombies,PG_ZOMBIE_RULES} from "./pg-zombies.js";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";
import {PG_ZOMBIE_BARRICADE_SITES,pgCollisionMap} from "@planetfall/shared";

function pilot(id:string):PgPlayer{return {...pgSpawnMotion({x:-28,y:0,z:-9}),id,name:id,color:"#fff",team:"solar",isBot:false,connected:true,ready:true,hp:100,kills:0,deaths:0,lifeId:1,deadAt:0,respawnAt:0,protectedUntil:0,lastDamageAt:0,lastAttacker:null,lastInputSequence:0,loadout:{primary:"pulse",secondary:"orbit"},slot:0,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],adsSince:0,fireReadyAt:0,fallbucks:250,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:[]};}
function setup(count=1){
 const players=new Map(Array.from({length:count},(_,i)=>{const p=pilot(`p${i}`);return [p.id,p];})),world=new PgModeWorld(),finish=vi.fn();let mode:PgZombies;
 mode=new PgZombies({players,world,finish,respawn:(p,now,loadout,position)=>{Object.assign(p,pgSpawnMotion(position??p.position));p.lifeId++;p.hp=100;p.protectedUntil=now+1000;if(loadout)p.loadout=loadout;p.guns=[pgCreateGun(p.loadout.primary),pgCreateGun(p.loadout.secondary)];},damage:(p,a,n,now)=>{const hit=mode.damage(p,a,n,now);if(p.hp<=0)mode.eliminated(p,a,"orbit",now);return hit;}});
 mode.start(0);return {mode,players,world,finish,p:players.get("p0")!};
}
type Internals={pilots:Map<string,PgZombiePilot>;wave:number;zombies:Map<string,{position:Vec3;motion:ReturnType<typeof pgSpawnMotion>;lastMovedAt:number;windupUntil:number;nextThink:number;targetId:string|null;nextAttack:number}>};
const internals=(mode:PgZombies)=>mode as unknown as Internals;
function buy(mode:PgZombies,p:PgPlayer,itemId:string,sequence:number,now=10000){return mode.action(p,{kind:"buy",itemId,lifeId:p.lifeId,sequence},now);}
describe("PlanetZombies authority",()=>{
 it.each(["danger","equipped","unfunded"])("avoids irrelevant rack navigation while %s without changing its useful goal",scenario=>{
  const g=setup(),state=internals(g.mode).pilots.get(g.p.id)!;g.p.isBot=true;
  state.points=0;state.primaryUnlocked=scenario==="equipped";
  if(scenario==="danger"){
   g.mode.update(1/30,4001);const zombie=[...internals(g.mode).zombies.values()][0];expect(zombie).toBeDefined();
   zombie.position={...g.p.position,x:g.p.position.x+2};
  }
  const query=vi.spyOn(PgZombieNavigation.prototype,"reachable");
  try{
   const goal=g.mode.botGoal(g.p,4002);
   const rackQueries=query.mock.calls.filter(([,target])=>PG_OBJECTIVES.racks.some(r=>r.position===target));
   expect(rackQueries).toHaveLength(0);
   if(scenario==="danger")expect(goal).toEqual([...internals(g.mode).zombies.values()][0].position);
   else expect(goal).toEqual(PG_OBJECTIVES.power);
  }finally{query.mockRestore();}
 });
 it("still routes a safe funded low-ammo bot to the closest reachable rack",()=>{
  const g=setup(),state=internals(g.mode).pilots.get(g.p.id)!;g.p.isBot=true;state.primaryUnlocked=true;state.points=500;g.p.guns[g.p.slot].reserve=0;
  const navigation=new PgZombieNavigation(g.world.map),metric=(p:Vec3)=>Math.hypot(p.x-g.p.position.x,p.y-g.p.position.y,p.z-g.p.position.z);
  const expected=PG_OBJECTIVES.racks.filter(r=>navigation.reachable(g.p.position,r.position)).sort((a,b)=>metric(a.position)-metric(b.position))[0];expect(expected).toBeDefined();
  expect(g.mode.botGoal(g.p,1)).toEqual(expected.position);
 });

 it("assigns distinct clear escort goals while retaining rescue priority",()=>{
  const {mode,players,p,world}=setup(4);p.position={x:-20.041755,y:0,z:-3.589629};
  p.position={...PG_OBJECTIVES.power};mode.action(p,{kind:"interact",targetId:"power",held:true,sequence:1,lifeId:p.lifeId},1000);mode.update(0,3000);
  p.position={x:-20.041755,y:0,z:-3.589629};const bots=[...players.values()].filter(bot=>bot!==p);
  for(const bot of bots){bot.isBot=true;bot.position={...p.position};const state=internals(mode).pilots.get(bot.id)!;state.primaryUnlocked=true;state.upgrade=3;state.points=0;}
  const goals=bots.map(bot=>mode.botGoal(bot,3001)!);
  expect(new Set(goals.map(goal=>JSON.stringify(goal))).size).toBe(3);
  for(const goal of goals){expect(Math.hypot(goal.x-p.position.x,goal.z-p.position.z)).toBeGreaterThan(2.5);expect(pgCapsuleClear(goal,PG_BALANCE.height,world.map)).toBe(true);}
  internals(mode).pilots.get(p.id)!.life="downed";
  expect(mode.botGoal(bots[0],3002)).toEqual(p.position);
 });
 it("authorizes a powered, funded, nearby Arsenal transaction and reserves its real primary exactly once",()=>{
  const g=setup(2),pilot=internals(g.mode).pilots.get(g.p.id)!;pilot.points=2000;
  g.p.position={...PG_OBJECTIVES.power};expect(g.mode.action(g.p,{kind:"interact",targetId:"power",held:true,sequence:1,lifeId:g.p.lifeId},1000).ok).toBe(true);g.mode.update(0,3000);expect(g.mode.snapshot().power).toBe(true);
  g.p.position={...PG_ZOMBIE_ARSENAL_SITE.interaction};expect(buy(g.mode,g.p,"anomaly-arsenal",2,3500).ok).toBe(true);expect(pilot.points).toBe(1400);expect(pilot.purchases).toBe(1);expect(g.mode.snapshot().arsenal).toMatchObject({phase:"revealing",ownerId:g.p.id,weaponId:null,revealAt:5700});
  expect(buy(g.mode,g.p,"anomaly-arsenal",2,3500).ok).toBe(false);expect(buy(g.mode,g.p,"anomaly-arsenal",3,3501).ok).toBe(false);expect(pilot.points).toBe(1400);
  const friend=g.players.get("p1")!;friend.position={...g.p.position};expect(g.mode.action(friend,{kind:"pickup",entityId:"arsenal-result",sequence:1,lifeId:friend.lifeId},5700).ok).toBe(false);
  expect(g.mode.action(g.p,{kind:"pickup",entityId:"arsenal-result",sequence:4,lifeId:g.p.lifeId},5699).ok).toBe(false);
  expect(g.mode.action(g.p,{kind:"pickup",entityId:"arsenal-result",sequence:5,lifeId:g.p.lifeId},5700).ok).toBe(true);expect(pilot.primaryUnlocked).toBe(true);expect(g.p.guns[0].magazine).toBeGreaterThan(0);expect(g.p.loadout.primary).toBe(g.p.guns[0].id);expect(g.p.slot).toBe(0);expect(g.mode.snapshot().arsenal.phase).toBe("idle");
  expect(g.mode.action(g.p,{kind:"pickup",entityId:"arsenal-result",sequence:6,lifeId:g.p.lifeId},5701).ok).toBe(false);expect(pilot.points).toBe(1400);
 });
 it("keeps the installation collision-backed with a reachable front, and rejects unpowered or distant purchases",()=>{
  const g=setup(),state=internals(g.mode).pilots.get(g.p.id)!;state.points=2000;g.p.position={...PG_ZOMBIE_ARSENAL_SITE.interaction};
  expect(pgCapsuleClear(g.p.position,PG_BALANCE.height,g.world.map)).toBe(true);expect(new PgZombieNavigation(g.world.map).reachable({x:-28,y:0,z:-9},g.p.position)).toBe(true);
  expect(g.world.snapshot().panels.find(panel=>panel.id===PG_ZOMBIE_ARSENAL_SITE.solid.id)?.solid).toEqual(PG_ZOMBIE_ARSENAL_SITE.solid);
  expect(buy(g.mode,g.p,"anomaly-arsenal",1,1000).ok).toBe(false);expect(state.points).toBe(2000);
  g.p.position={...PG_OBJECTIVES.power};g.mode.action(g.p,{kind:"interact",targetId:"power",held:true,sequence:2,lifeId:g.p.lifeId},1001);g.mode.update(0,3001);
  expect(buy(g.mode,g.p,"anomaly-arsenal",3,3002).ok).toBe(false);expect(state.points).toBe(2250);expect(g.mode.snapshot().arsenal.phase).toBe("idle");
  g.mode.start(4000);expect(g.mode.snapshot().arsenal.phase).toBe("idle");expect(g.mode.snapshot().pilots[g.p.id].points).toBe(500);
 });
 it.each([.001,14,22,38,999999])("counts positive NPC damage %s as one hit, downing on exactly the third accepted hit",amount=>{
  const {mode,p}=setup();const hit=(at:number)=>mode["ctx"].damage(p,null,amount,at);
  expect(hit(2000)).toBe(33);expect(mode.snapshot().pilots[p.id].hitCount).toBe(1);expect(p.hp).toBe(67);
  expect(hit(2700)).toBe(34);expect(mode.snapshot().pilots[p.id].hitCount).toBe(2);expect(p.hp).toBe(33);
  expect(hit(3400)).toBe(33);expect(mode.snapshot().pilots[p.id].life).toBe("downed");expect(mode.snapshot().pilots[p.id].hitCount).toBe(3);expect(p.hp).toBe(1);
 });
 it("accepts only one crowd hit per global 700ms window without extending the window on rejected hits",()=>{
  const {mode,p}=setup();expect(mode.damage(p,null,38,2000)).toBe(33);
  for(const at of [2000,2001,2300,2699])expect(mode.damage(p,null,999999,at)).toBe(0);
  expect(mode.snapshot().pilots[p.id]).toMatchObject({hitCount:1,hitGraceUntil:2700,hitRecoveryAt:7000});expect(p.lastDamageAt).toBe(2000);
  expect(mode.damage(p,null,1,2700)).toBe(34);expect(mode.snapshot().pilots[p.id].hitCount).toBe(2);
 });
 it("recovers one accumulated hit after five safe seconds and another each second, independently of tick rate",()=>{
  const {mode,p}=setup();mode.damage(p,null,38,2000);mode.damage(p,null,14,2700);
  mode.update(0,7699);expect(mode.snapshot().pilots[p.id].hitCount).toBe(2);expect(p.hp).toBe(33);
  mode.update(0,7700);expect(mode.snapshot().pilots[p.id]).toMatchObject({hitCount:1,hitRecoveryAt:8700});expect(p.hp).toBe(67);
  mode.update(0,8699);expect(mode.snapshot().pilots[p.id].hitCount).toBe(1);
  mode.update(0,20000);expect(mode.snapshot().pilots[p.id]).toMatchObject({hitCount:0,hitRecoveryAt:0});expect(p.hp).toBe(100);
 });
 it("recovers elapsed danger before a new hit even between updates, then restarts the recovery delay",()=>{
  const {mode,p}=setup();mode.damage(p,null,22,2000);mode.damage(p,null,22,2700);mode.damage(p,null,22,7700);
  expect(mode.snapshot().pilots[p.id]).toMatchObject({hitCount:2,hitRecoveryAt:12700});expect(p.hp).toBe(33);expect(p.lastDamageAt).toBe(7700);
 });
 it("rejects invalid damage, non-enemy sources, invalid time, and protected hits without changing danger",()=>{
  const {mode,p,players}=setup(2),before=mode.snapshot().pilots[p.id];
  for(const amount of [NaN,Infinity,-Infinity,0,-1])expect(mode.damage(p,null,amount,2000)).toBe(0);
  expect(mode.damage(p,null,22,NaN)).toBe(0);expect(mode.damage(p,null,22,Infinity)).toBe(0);
  expect(mode.damage(p,players.get("p1")!,22,2000)).toBe(0);expect(mode.damage(p,p,22,2000)).toBe(0);expect(mode.damage(p,null,22,999)).toBe(0);
  expect(mode.snapshot().pilots[p.id]).toEqual(before);expect(p.hp).toBe(100);expect(p.lastDamageAt).toBe(0);
 });
 it("uses hit state as authority even if the room compatibility HP is changed",()=>{
  const {mode,p}=setup();p.hp=1;mode.damage(p,null,999999,2000);expect(p.hp).toBe(67);expect(mode.snapshot().pilots[p.id].life).toBe("alive");
  p.hp=100;mode.damage(p,null,.001,2700);expect(p.hp).toBe(33);expect(mode.snapshot().pilots[p.id].hitCount).toBe(2);
 });
 it("vitality adds two hit slots without erasing wounds or stacking, and takes five total hits to down",()=>{
  const {mode,p}=setup(),state=internals(mode).pilots.get(p.id)!;mode.damage(p,null,22,2000);state.points=2000;p.position={...PG_ZOMBIE_TONIC_SOCKETS.find(site=>site.id==="perk-vitality")!.interaction};
  expect(buy(mode,p,"perk-vitality",1,2200).ok).toBe(true);expect(state.hitCount).toBe(1);expect(state.hitCapacity).toBe(5);expect(p.hp).toBe(128);
  const points=state.points;expect(buy(mode,p,"perk-vitality",2,2300).ok).toBe(false);expect(state.points).toBe(points);expect(state.hitCapacity).toBe(5);
  for(let i=2;i<=5;i++){mode["ctx"].damage(p,null,i%2?1:999999,2000+(i-1)*700);expect(state.hitCount).toBe(i);expect(state.life).toBe(i===5?"downed":"alive");}
 });
 it("freezes downed danger, restores partial hit capacity on solo recovery, then resets all danger on a fresh run",()=>{
  const {mode,p}=setup();for(let i=0;i<3;i++)mode["ctx"].damage(p,null,22,2000+i*700);
  mode.update(0,8399);expect(mode.snapshot().pilots[p.id]).toMatchObject({life:"downed",hitCount:3,hitRecoveryAt:0});expect(p.hp).toBe(1);
  mode.update(0,8400);expect(mode.snapshot().pilots[p.id]).toMatchObject({life:"alive",hitCount:1,hitRecoveryAt:13400});expect(p.hp).toBe(67);expect(mode.damage(p,null,22,9899)).toBe(0);
  mode.start(100000);expect(mode.snapshot().pilots[p.id]).toMatchObject({hitCount:0,hitCapacity:3,hitGraceUntil:0,hitRecoveryAt:0,selfRecovery:true});expect(p.hp).toBe(100);
 });
 it("stages the real habitat court and upper escape routes until an access door is purchased",()=>{
  const {mode,p,world}=setup(),nav=new PgZombieNavigation(world.map);nav.update(world.map,world.revision);
  expect(nav.reachable(p.position,PG_OBJECTIVES.power)).toBe(false);
  const roof=pgSpawnMotion({x:-26.5,y:6.8,z:-20});roof.grounded=true;
  for(let i=0;i<120;i++)pgStepMovement(roof,{sequence:i,moveX:0,moveZ:-1,yaw:0,pitch:0,jump:true,sprint:true,crouch:false,ads:false},1/60,i*1000/60,world.map,PG_TACTICAL_MOVEMENT_RULES);
  expect(roof.position.z).toBeGreaterThanOrEqual(-20.43);
  internals(mode).pilots.get(p.id)!.points=1000;p.position={x:-25,y:0,z:-3};expect(buy(mode,p,"door:west-south",1).ok).toBe(true);nav.update(world.map,world.revision);expect(nav.reachable(p.position,PG_OBJECTIVES.power)).toBe(true);
 });
 it("continues finite spawning on a supported roof when survivors leave the ground graph",()=>{
  const {mode,p,players}=setup(2);p.position={x:-30.5,y:6.8,z:-19};players.get("p1")!.position={x:-22.5,y:6.8,z:-15.5};mode.update(0,4000);
  const snapshot=mode.snapshot();expect(snapshot.zombies.length).toBe(1);expect(snapshot.zombies[0].position.y).toBe(6.8);expect(snapshot.remaining).toBe(10);expect(snapshot.queued).toBe(9);expect(Math.hypot(snapshot.zombies[0].position.x-p.position.x,snapshot.zombies[0].position.z-p.position.z)).toBeGreaterThanOrEqual(3.5);
 });
 it("starts with limited sidearm ammo, genuinely locked primary, and isolated run points",()=>{
  const {mode,p}=setup();expect(p.slot).toBe(1);expect(p.guns[0].magazine).toBe(0);expect(p.guns[1].reserve).toBe(30);expect(mode.allowSlot(p,0)).toBe(false);p.slot=0;expect(mode.canFire(p)).toBe(false);expect(p.fallbucks).toBe(250);expect(mode.snapshot().pilots[p.id].points).toBe(500);
 });
 it("spawns finite reachable waves, awards effective hits, and completes without leftover required enemies",()=>{
  const {mode,p}=setup();let now=4000;mode.update(1/30,now);expect(mode.snapshot().wave).toBe(1);expect(mode.snapshot().remaining).toBe(8);
  const nav=new PgZombieNavigation(mode["ctx"].world.map);
  for(let i=0;i<100&&mode.snapshot().subphase==="wave";i++){
   for(const z of mode.snapshot().zombies){
    const entry=PG_ZOMBIE_BARRICADE_SITES.find(site=>site.id===mode["zombies"].get(z.id)?.barricadeId);
    if(!entry)expect(nav.reachable(z.position,p.position)).toBe(true);
    else{
     expect(Math.hypot(z.position.x-entry.entry.x,z.position.y-entry.entry.y,z.position.z-entry.entry.z)).toBeLessThan(.5);
     expect(nav.supported(entry.entry)).toBe(true);
     const collision=mode["ctx"].world.snapshot(),ids=new Set(entry.boards.map(board=>board.id));
     expect(collision.panels.filter(panel=>ids.has(panel.id)&&panel.active)).toHaveLength(3);
     for(const board of entry.boards)expect(mode["ctx"].world.map.solids.some(solid=>solid.id===board.solid.id)).toBe(true);
     const breached=pgCollisionMap({...collision,panels:collision.panels.map(panel=>ids.has(panel.id)?{...panel,active:false,hp:0}:panel)}),after=new PgZombieNavigation(breached);
     expect(after.supported(entry.entry)).toBe(true);expect(after.reachable(entry.entry,p.position)).toBe(true);
    }
    const target=mode.targets(p).find(t=>t.id===z.id)!;expect(target.damage(10000,p,now)).toBe(z.hp);expect(target.damage(10000,p,now)).toBe(0);
   }
   now+=500;mode.update(1/30,now);
  }
  expect(mode.snapshot().remaining).toBe(0);expect(mode.snapshot().subphase).toBe("intermission");expect(p.kills).toBe(8);expect(mode.snapshot().pilots[p.id].points).toBeGreaterThan(1000);expect(p.fallbucks).toBe(250);
 });
 it("caps late waves at 32 active with a finite queued backlog and all three archetypes",()=>{
  const {mode,p}=setup(4);internals(mode).wave=24;p.position={x:0,y:0,z:16};
  for(let i=0;i<500;i++)mode.update(0,4000+i*200);
  const snapshot=mode.snapshot();expect(snapshot.wave).toBe(25);expect(snapshot.zombies.length).toBe(32);expect(snapshot.queued).toBeGreaterThan(0);expect(snapshot.remaining).toBeLessThanOrEqual(180);expect(new Set(snapshot.zombies.map(z=>z.kind)).size).toBe(3);
 });
 it("uses bounded windup and line of sight before applying melee damage",()=>{
  const {mode,p}=setup();mode.update(1/30,4000);const z=internals(mode).zombies.values().next().value!;expect(z).toBeDefined();
  p.position={x:-28,y:0,z:-9};z.motion=pgSpawnMotion({x:-28,y:0,z:-8});z.position=z.motion.position;z.targetId=p.id;z.nextThink=100000;z.nextAttack=0;
  mode.update(0,5000);expect(z.windupUntil).toBeGreaterThan(5000);expect(p.hp).toBe(100);mode.update(0,5700);expect(p.hp).toBeLessThan(100);
  const hp=p.hp;z.position={x:-25,y:0,z:-2};z.motion.position=z.position;p.position={x:-25,y:0,z:0};z.windupUntil=5800;mode.update(0,5900);expect(p.hp).toBe(hp);
 });
 it("validates purchase range, ownership, points, sequence, real doors, power and three upgrade tiers",()=>{
  const {mode,p,world}=setup();const s=internals(mode).pilots.get(p.id)!;s.points=20000;
  expect(buy(mode,p,"rack-pulse",1).ok).toBe(false);p.position={...PG_OBJECTIVES.racks[2].position};expect(buy(mode,p,"rack-photon",2).ok).toBe(true);expect(mode.allowSlot(p,0)).toBe(true);expect(p.guns[0].id).toBe("photon");const spent=s.points;expect(buy(mode,p,"rack-photon",2).ok).toBe(false);expect(s.points).toBe(spent);
  p.position={x:-25,y:0,z:-3};const revision=world.revision;expect(buy(mode,p,"door:west-south",3).ok).toBe(true);expect(world.revision).toBeGreaterThan(revision);expect(world.snapshot().panels.find(d=>d.id==="west-south")!.active).toBe(false);expect(mode.snapshot().unlocked).toContain("west-south");
  p.position={...PG_ZOMBIE_FORGE_SITE.interaction};expect(buy(mode,p,"upgrade",4).ok).toBe(false);p.position={...PG_OBJECTIVES.power};expect(mode.action(p,{kind:"interact",sequence:5,lifeId:p.lifeId,targetId:"power",held:true},10000).ok).toBe(true);mode.update(0,12001);expect(mode.snapshot().power).toBe(true);
  p.position={...PG_ZOMBIE_FORGE_SITE.interaction};const beforeUpgrades=s.points;
  for(let sequence=6;sequence<=8;sequence++){
   const startedAt=13000+(sequence-6)*3200;
   expect(buy(mode,p,"upgrade",sequence,startedAt).ok).toBe(true);expect(s.upgrade).toBe(sequence-6);
   mode.update(0,startedAt+2000);expect(s.upgrade).toBe(sequence-5);mode.update(0,startedAt+3200);
  }
  expect(s.points).toBe(beforeUpgrades-PG_ZOMBIE_PRICES.upgrade.reduce((sum,price)=>sum+price,0));
  expect(buy(mode,p,"upgrade",9,22600).ok).toBe(false);expect(s.upgrade).toBe(3);expect(mode.weaponModifiers(p).damage).toBeCloseTo(2.05);expect(PG_WEAPONS.photon.damage).toBe(15);
  p.position={...PG_ZOMBIE_TONIC_SOCKETS.find(site=>site.id==="perk-vitality")!.interaction};
  expect(buy(mode,p,"perk-vitality",10,23000).ok).toBe(true);expect(mode.maxHp(p)).toBe(160);expect(buy(mode,p,"perk-vitality",11,23001).ok).toBe(false);expect(p.fallbucks).toBe(250);
 });
 it("interrupts revives on movement and damage, then permits an uninterrupted teammate revive",()=>{
  const {mode,p,players}=setup(2),other=players.get("p1")!;other.position={...p.position,x:p.position.x+1};mode.eliminated(other,null,"orbit",5000);expect(mode.snapshot().pilots[other.id].life).toBe("downed");expect(mode.canMove(other)).toBe(true);expect(mode.canFire(other)).toBe(false);expect(mode.movement(other).maxSpeed).toBe(1.1);
  const hold=(sequence:number,now:number)=>mode.action(p,{kind:"interact",sequence,lifeId:p.lifeId,targetId:`revive:${other.id}`,held:true},now);
  expect(hold(1,5100).ok).toBe(true);p.position.x-=1;mode.update(0,6000);expect(mode.snapshot().pilots[p.id].interaction).toBeNull();p.position.x+=1;
  expect(hold(2,6100).ok).toBe(true);mode.damage(p,null,1,6200);mode.update(0,9700);expect(mode.snapshot().pilots[other.id].life).toBe("downed");
  expect(hold(3,10000).ok).toBe(true);mode.update(0,13501);expect(mode.snapshot().pilots[other.id].life).toBe("alive");expect(other.hp).toBe(67);expect(mode.snapshot().pilots[other.id].hitCount).toBe(1);expect(mode.snapshot().pilots[p.id].revives).toBe(1);
 });
 it("bleeds out, waits for a completed wave, and returns with a limited recovery loadout",()=>{
  const {mode,p,players}=setup(2),other=players.get("p1")!;mode.eliminated(other,null,"orbit",5000);mode.update(0,31000);expect(mode.snapshot().pilots[other.id].life).toBe("eliminated");expect(other.respawnAt).toBe(0);
  let now=31000;for(let i=0;i<60&&mode.snapshot().subphase==="wave";i++){for(const t of mode.targets(p))t.damage(99999,p,now);now+=500;mode.update(0,now);}
  expect(mode.snapshot().pilots[other.id]).toMatchObject({life:"alive",hitCount:0,hitRecoveryAt:0,hitGraceUntil:0});expect(other.hp).toBe(100);expect(other.slot).toBe(1);expect(other.guns[0].magazine).toBe(0);expect(other.guns[1].reserve).toBe(30);
 });
 it("allows exactly one solo recovery, resolves team defeat, and resets a fresh run",()=>{
  const {mode,p,finish}=setup();mode.eliminated(p,null,"orbit",5000);expect(mode.snapshot().pilots[p.id].selfRecovery).toBe(false);expect(finish).not.toHaveBeenCalled();mode.update(0,10001);expect(mode.snapshot().pilots[p.id].life).toBe("alive");mode.eliminated(p,null,"orbit",11000);expect(finish).toHaveBeenCalledTimes(1);expect(mode.snapshot().subphase).toBe("defeated");mode.update(0,999999);expect(finish).toHaveBeenCalledTimes(1);
  mode.start(1000000);expect(mode.snapshot().wave).toBe(0);expect(mode.snapshot().remaining).toBe(0);expect(mode.snapshot().pilots[p.id].selfRecovery).toBe(true);expect(mode.snapshot().pilots[p.id].points).toBe(500);expect(mode.snapshot().power).toBe(false);
 });
 it("keeps navigation inside intact panels and restores routes after unlocking",()=>{
  const {world}=setup();const nav=new PgZombieNavigation(world.map);nav.update(world.map,world.revision);expect(nav.clear({x:-25,y:0,z:-3},{x:-25,y:0,z:1})).toBe(false);world.damage("west-south",1000000,5000,true);nav.update(world.map,world.revision);expect(nav.clear({x:-25,y:0,z:-3},{x:-25,y:0,z:1})).toBe(true);expect(PG_MAP.solids.some(s=>s.id==="panel-west-south")).toBe(false);
 });
 it("friendly bots spend their own points, replenish, reload and damage actual PvE targets",()=>{
  const {mode,p,players}=setup(2),bot=players.get("p1")!;bot.isBot=true;const state=internals(mode).pilots.get(bot.id)!;state.points=3000;bot.position={...PG_OBJECTIVES.racks[2].position};mode.botAction(bot,2000);expect(state.primaryUnlocked).toBe(true);expect(p.fallbucks).toBe(250);expect(mode.snapshot().pilots[p.id].points).toBe(500);
  bot.guns[0].magazine=0;bot.guns[0].reserve=0;mode.botAction(bot,2500);expect(bot.guns[0].magazine).toBeGreaterThan(0);expect(state.points).toBe(1850);
  mode.update(0,4000);const z=internals(mode).zombies.values().next().value!;z.position={x:bot.position.x,y:bot.position.y,z:bot.position.z+3};z.motion.position=z.position;const before=mode.snapshot().zombies[0].hp;mode.botAction(bot,4500);expect(mode.snapshot().zombies.length===0||mode.snapshot().zombies[0].hp<before).toBe(true);
  bot.guns[0].magazine=0;bot.guns[0].reserve=10;mode.botAction(bot,5000);expect(bot.guns[0].reloadUntil).toBeGreaterThan(5000);
 });
 it("recovers stuck enemies without losing required wave population",()=>{
  const {mode,p}=setup();mode.update(0,4000);const z=internals(mode).zombies.values().next().value!,before=mode.snapshot().remaining;z.position={x:200,y:-20,z:200};z.motion.position=z.position;z.lastMovedAt=0;z.nextThink=100000;mode.update(0,30000);expect(mode.snapshot().remaining).toBe(before);expect(mode.snapshot().zombies.every(enemy=>Math.abs(enemy.position.x)<47)).toBe(true);expect(mode.snapshot().subphase).toBe("wave");expect(mode.canFire(p)).toBe(true);
 });
});
