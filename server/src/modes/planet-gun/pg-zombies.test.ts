import {describe,expect,it,vi} from "vitest";
import {DEFAULT_COSMETICS,PG_MAP,PG_OBJECTIVES,PG_WEAPONS,PG_TACTICAL_MOVEMENT_RULES,pgStepMovement,pgCreateGun,pgSpawnMotion,type PgPlayer,type PgZombiePilot,type Vec3} from "@planetfall/shared";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombies,PG_ZOMBIE_RULES} from "./pg-zombies.js";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";

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
   for(const z of mode.snapshot().zombies){expect(nav.reachable(z.position,p.position)).toBe(true);const target=mode.targets(p).find(t=>t.id===z.id)!;expect(target.damage(10000,p,now)).toBe(z.hp);expect(target.damage(10000,p,now)).toBe(0);}
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
  p.position={...PG_OBJECTIVES.station};expect(buy(mode,p,"upgrade",4).ok).toBe(false);p.position={...PG_OBJECTIVES.power};expect(mode.action(p,{kind:"interact",sequence:5,lifeId:p.lifeId,targetId:"power",held:true},10000).ok).toBe(true);mode.update(0,12001);expect(mode.snapshot().power).toBe(true);
  p.position={...PG_OBJECTIVES.station};for(let sequence=6;sequence<=8;sequence++)expect(buy(mode,p,"upgrade",sequence).ok).toBe(true);expect(buy(mode,p,"upgrade",9).ok).toBe(false);expect(s.upgrade).toBe(3);expect(mode.weaponModifiers(p).damage).toBeCloseTo(2.05);expect(PG_WEAPONS.photon.damage).toBe(15);
  expect(buy(mode,p,"perk-vitality",10).ok).toBe(true);expect(mode.maxHp(p)).toBe(160);expect(buy(mode,p,"perk-vitality",11).ok).toBe(false);expect(p.fallbucks).toBe(250);
 });
 it("interrupts revives on movement and damage, then permits an uninterrupted teammate revive",()=>{
  const {mode,p,players}=setup(2),other=players.get("p1")!;other.position={...p.position,x:p.position.x+1};mode.eliminated(other,null,"orbit",5000);expect(mode.snapshot().pilots[other.id].life).toBe("downed");expect(mode.canMove(other)).toBe(true);expect(mode.canFire(other)).toBe(false);expect(mode.movement(other).maxSpeed).toBe(1.1);
  const hold=(sequence:number,now:number)=>mode.action(p,{kind:"interact",sequence,lifeId:p.lifeId,targetId:`revive:${other.id}`,held:true},now);
  expect(hold(1,5100).ok).toBe(true);p.position.x-=1;mode.update(0,6000);expect(mode.snapshot().pilots[p.id].interaction).toBeNull();p.position.x+=1;
  expect(hold(2,6100).ok).toBe(true);mode.damage(p,null,1,6200);mode.update(0,9700);expect(mode.snapshot().pilots[other.id].life).toBe("downed");
  expect(hold(3,10000).ok).toBe(true);mode.update(0,13501);expect(mode.snapshot().pilots[other.id].life).toBe("alive");expect(other.hp).toBe(50);expect(mode.snapshot().pilots[p.id].revives).toBe(1);
 });
 it("bleeds out, waits for a completed wave, and returns with a limited recovery loadout",()=>{
  const {mode,p,players}=setup(2),other=players.get("p1")!;mode.eliminated(other,null,"orbit",5000);mode.update(0,31000);expect(mode.snapshot().pilots[other.id].life).toBe("eliminated");expect(other.respawnAt).toBe(0);
  let now=31000;for(let i=0;i<60&&mode.snapshot().subphase==="wave";i++){for(const t of mode.targets(p))t.damage(99999,p,now);now+=500;mode.update(0,now);}
  expect(mode.snapshot().pilots[other.id].life).toBe("alive");expect(other.slot).toBe(1);expect(other.guns[0].magazine).toBe(0);expect(other.guns[1].reserve).toBe(30);
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
