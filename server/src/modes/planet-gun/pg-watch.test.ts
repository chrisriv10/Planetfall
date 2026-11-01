import {describe,expect,it} from "vitest";
import {PG_DEFAULT_MOVEMENT_RULES,PG_HERO_IDS,PG_HEROES,PG_MAP,PG_OBJECTIVES,pgCreateGun,pgSpawnMotion,type PgHeroId,type PgLoadout,type PgPlayer,type PgTeam,type Vec3} from "@planetfall/shared";
import {PgWatch} from "./pg-watch.js";
import {PgModeWorld} from "./pg-mode-world.js";
import type {PgModeContext} from "./pg-mode-runtime.js";

function pilot(id:string,team:PgTeam,index:number):PgPlayer {
 return {...pgSpawnMotion({x:(team==="solar"?-15:10)+index*2,y:0,z:32},-Math.PI/2),id,team,hp:100,lifeId:1,connected:true,isBot:false,crouched:false,grounded:true,slot:0,guns:[pgCreateGun("pulse"),pgCreateGun("comet")],loadout:{primary:"pulse",secondary:"comet"},adsSince:0,fireReadyAt:0,protectedUntil:0,lastDamageAt:0,lastAttacker:null,respawnAt:0} as PgPlayer;
}
function fixture(selections?:ReadonlyMap<string,string>,bots:readonly string[]=[]){
 const players=new Map<string,PgPlayer>();
 for(const team of ["solar","void"] as const)for(let i=0;i<6;i++){const p=pilot(`${team}-${i}`,team,i);players.set(p.id,p);}
 for(const id of bots)players.get(id)!.isBot=true;
 let winner:PgTeam|null|undefined,mode:PgWatch,time=13000;const world=new PgModeWorld();
 const ctx:PgModeContext={players,world,selections,respawn:(p,_now,loadout?:PgLoadout,position?:Vec3)=>{p.lifeId++;p.hp=100;if(position)p.position={...position};if(loadout){p.loadout=loadout;p.guns=[pgCreateGun(loadout.primary,loadout.primaryModules),pgCreateGun(loadout.secondary,loadout.secondaryModules)];}},damage:(target,attacker,amount,now)=>{const actual=mode.damage(target,attacker,amount,now);if(target.hp<=0)mode.eliminated(target,attacker,"pulse",now);return actual;},finish:team=>{winner=team;}};
 mode=new PgWatch(ctx);mode.start(10000);mode.update(0,time);
 const hero=(id:PgHeroId,team:PgTeam="solar")=>players.get(`${team}-${PG_HERO_IDS.indexOf(id)}`)!;
 const sequence=new Map<string,number>();
 const ability=(id:PgHeroId,slot:0|1|2,target?:PgPlayer,position?:Vec3,team:PgTeam="solar")=>{const p=hero(id,team),n=(sequence.get(p.id)??0)+1;sequence.set(p.id,n);return mode.action(p,{kind:"ability",sequence:n,lifeId:p.lifeId,slot,targetId:target?.id,position},time);};
 const tick=(seconds:number)=>{const steps=Math.ceil(seconds*10);for(let i=0;i<steps;i++){time+=100;mode.update(.1,time);}};
 const jump=(milliseconds:number)=>{time+=milliseconds;mode.update(0,time);};
 const earn=(id:PgHeroId)=>{
  const p=hero(id);
  for(let wave=0;wave<3&&mode.snapshot().pilots[p.id].ultimate<100;wave++){
   for(const enemy of players.values())if(enemy.team!==p.team)ctx.damage(enemy,p,10000,time);
   jump(8000);jump(2100);
  }
  expect(mode.snapshot().pilots[p.id].ultimate).toBe(100);
 };
 return {mode,ctx,players,world,hero,ability,tick,jump,earn,now:()=>time,winner:()=>winner};
}
const near=(p:PgPlayer,x:number,z=32)=>{p.position={x,y:0,z};p.grounded=true;p.velocity={x:0,y:0,z:0};};

describe("PlanetWatch authoritative hero and relay gameplay",()=>{
 it("does not refill equipment by selecting a hero while firing from the outer spawn area",()=>{
  const f=fixture(),p=f.hero("cairn"),spawn=PG_MAP.spawns.find(s=>s.team===p.team)!;
  p.position={...spawn.position,x:spawn.position.x+8};p.guns[0].magazine=2;p.guns[0].nextFireAt=f.now()+100;
  expect(f.mode.canFire(p)).toBe(true);
  expect(f.mode.action(p,{kind:"select",sequence:1,lifeId:p.lifeId,characterId:"cairn"},f.now()).ok).toBe(false);
  expect(p.guns[0].magazine).toBe(2);
  f.jump(6000);expect(f.mode.action(p,{kind:"select",sequence:2,lifeId:p.lifeId,characterId:"cairn"},f.now()).ok).toBe(true);
 });
 it("applies lobby reservations before defaults even when bots and unselected humans precede them",()=>{
  const f=fixture(new Map([["solar-5","cairn"],["solar-3","solace"],["solar-0","cairn"],["void-4","parallax"]]),["solar-0","solar-1"]);
  const pilots=f.mode.snapshot().pilots;
  expect(pilots["solar-5"].characterId).toBe("cairn");expect(pilots["solar-3"].characterId).toBe("solace");expect(pilots["void-4"].characterId).toBe("parallax");
  expect(pilots["solar-0"].characterId).not.toBe("cairn");
  for(const team of ["solar","void"] as const)expect(new Set([...f.players.values()].filter(p=>p.team===team).map(p=>pilots[p.id].characterId)).size).toBe(6);
 });
 it("gives Cairn's ultimate capped temporary shields only to nearby visible teammates",()=>{
  const f=fixture();f.earn("cairn");const p=f.hero("cairn"),ally=f.hero("cinder"),far=f.hero("solace"),enemy=f.hero("cinder","void");
  near(p,-10);near(ally,-6);near(far,20);near(enemy,-4);
  expect(f.ability("cairn",2).ok).toBe(true);expect(f.mode.snapshot().pilots[ally.id].shield).toBe(100);
  expect(f.mode.snapshot().pilots[far.id].shield).toBe(0);expect(f.mode.snapshot().pilots[enemy.id].shield).toBe(0);
  expect(f.ability("cairn",2).ok).toBe(false);const hp=ally.hp;f.ctx.damage(ally,enemy,110,f.now());expect(ally.hp).toBe(hp-10);
  f.tick(7.1);expect(f.mode.snapshot().pilots[p.id].shield).toBe(0);expect(f.mode.snapshot().pilots[ally.id].shield).toBe(0);
 });
 it("bounds Cinder overdrive cadence and cooling, and removes it on expiry or death",()=>{
  const f=fixture();f.earn("cinder");const p=f.hero("cinder");
  expect(f.ability("cinder",2).ok).toBe(true);expect(f.mode.weaponModifiers(p,f.now())).toMatchObject({fireIntervalMultiplier:.8,coolingMultiplier:1.35});
  f.tick(7.1);expect(f.mode.weaponModifiers(p,f.now())).toMatchObject({fireIntervalMultiplier:1,coolingMultiplier:1});
  f.earn("cinder");expect(f.ability("cinder",2).ok).toBe(true);f.ctx.damage(p,f.hero("cairn","void"),10000,f.now());
  expect(f.mode.weaponModifiers(p,f.now()).fireIntervalMultiplier).toBe(1);expect(f.mode.snapshot().effects.some(e=>e.ownerId===p.id)).toBe(false);
 });
 it("requires grounded stationary aim for Parallax's passive and expires precision ultimate handling",()=>{
  const f=fixture(),p=f.hero("parallax");
  expect(f.mode.weaponModifiers(p,f.now()).adsTimeMultiplier).toBe(.7);p.velocity.x=1;f.tick(.1);expect(f.mode.weaponModifiers(p,f.now()).adsTimeMultiplier).toBe(1);
  p.velocity.x=0;f.tick(.5);expect(f.mode.weaponModifiers(p,f.now()).adsTimeMultiplier).toBe(.7);p.grounded=false;expect(f.mode.weaponModifiers(p,f.now()).adsTimeMultiplier).toBe(1);p.grounded=true;
  f.earn("parallax");expect(f.ability("parallax",2).ok).toBe(true);
  expect(f.mode.weaponModifiers(p,f.now())).toMatchObject({precisionDamageMultiplier:1.2,recoilMultiplier:.7});expect(f.mode.weaponModifiers(p,f.now()).adsTimeMultiplier).toBeCloseTo(.7*.75);
  f.tick(7.1);expect(f.mode.weaponModifiers(p,f.now())).toMatchObject({precisionDamageMultiplier:1,recoilMultiplier:1,adsTimeMultiplier:.7});
 });
 it("caps each target's Solace ultimate recovery and cleans its healing on expiry",()=>{
  const f=fixture();f.earn("solace");const p=f.hero("solace"),ally=f.hero("cairn"),enemy=f.hero("cairn","void");near(p,-10);near(ally,-6);near(enemy,-5);
  ally.hp=1;enemy.hp=100;expect(f.ability("solace",2).ok).toBe(true);f.tick(6.2);
  expect(ally.hp).toBeCloseTo(181);expect(enemy.hp).toBe(100);const hp=ally.hp;f.tick(2);expect(ally.hp).toBe(hp);
  expect(f.mode.snapshot().effects.some(e=>e.ownerId===p.id)).toBe(false);
 });
 it("grants Spindle assist resource for recent enemy contributions, capped per life",()=>{
  const f=fixture(),p=f.hero("spindle"),ally=f.hero("cairn"),killer=f.hero("cinder");near(p,-10);near(ally,-6);
  // Advance only deadlines to isolate resource earned by assists from passive time recovery.
  for(let i=0;i<4;i++){expect(f.ability("spindle",0,ally).ok).toBe(true);f.jump(10000);}
  near(f.hero("spindle"),-10);expect(f.ability("spindle",0,ally).ok).toBe(false);
  const enemies=[...f.players.values()].filter(e=>e.team!==p.team);
  const assist=(enemy:PgPlayer)=>{f.ctx.damage(enemy,p,1,f.now());f.ctx.damage(enemy,killer,10000,f.now());};
  for(const enemy of enemies.slice(0,3))assist(enemy);
  expect(f.ability("spindle",0,ally).ok).toBe(false);assist(enemies[3]);expect(f.ability("spindle",0,ally).ok).toBe(true);
  assist(enemies[4]);assist(enemies[5]);f.jump(10000);f.jump(2100);assist(enemies[0]);
  expect(f.ability("spindle",0,ally).ok).toBe(false);
 });
 it("rejects invalid ally targets and stops beams at walls, range, death and resource depletion",()=>{
  const f=fixture(),p=f.hero("solace"),ally=f.hero("cairn"),enemy=f.hero("cairn","void");near(p,-10);near(ally,-6);
  expect(f.ability("solace",0,p).ok).toBe(false);expect(f.ability("solace",0,enemy).ok).toBe(false);near(ally,20);expect(f.ability("solace",0,ally).ok).toBe(false);
  near(ally,-6);ally.hp=1;expect(f.ability("solace",0,ally).ok).toBe(true);f.tick(4.2);expect(ally.hp).toBeLessThanOrEqual(121);const hp=ally.hp;f.tick(.5);expect(ally.hp).toBe(hp);
  f.tick(.5);expect(f.ability("solace",0,ally).ok).toBe(true);f.ctx.damage(ally,enemy,10000,f.now());f.tick(.1);expect(f.mode.snapshot().effects.some(e=>e.ownerId===p.id)).toBe(false);
  const shield=f.hero("spindle");near(shield,-10);expect(f.ability("spindle",0,ally).ok).toBe(false);
 });
 it("snapshots a healing link at the current caster and recipient without sharing mutable positions",()=>{
  const f=fixture(),caster=f.hero("solace"),ally=f.hero("cairn");near(caster,-10);near(ally,-6);ally.hp=1;
  expect(f.ability("solace",0,ally).ok).toBe(true);f.tick(.1);
  const before=f.mode.snapshot().effects.find(e=>e.ownerId===caster.id)!;
  expect(before.end).toEqual(caster.position);expect(before.position).toEqual(ally.position);
  near(caster,-9);near(ally,-5);f.tick(.1);
  const current=f.mode.snapshot().effects.find(e=>e.ownerId===caster.id)!;
  expect(current.end).toEqual(caster.position);expect(current.position).toEqual(ally.position);
  expect(before.end!.x).toBe(-10);expect(before.position.x).toBe(-6);
  current.end!.x=999;expect(caster.position.x).toBe(-9);
 });
 it("rejects nonfinite/duplicate actions, protected attackers and gadget damage charge farming",()=>{
  const f=fixture(),p=f.hero("cairn"),enemy=f.hero("cairn","void");near(p,-10);near(enemy,5);
  for(const other of f.players.values())if(other!==p&&other!==enemy)other.position.z=35;
  expect(f.ability("cairn",0,undefined,{x:NaN,y:0,z:32}).ok).toBe(false);expect(f.mode.snapshot().pilots[p.id].charges[0]).toBe(1);
  const action={kind:"ability" as const,sequence:100,lifeId:p.lifeId,slot:0 as const,position:{x:-7,y:0,z:32}};
  expect(f.mode.action(p,action,f.now()).ok).toBe(true);expect(f.mode.action(p,action,f.now()).ok).toBe(false);
  const before=f.mode.snapshot().pilots[enemy.id].ultimate;f.mode.targets(enemy)[0].damage(10000,enemy,f.now());expect(f.mode.snapshot().pilots[enemy.id].ultimate).toBe(before);
  enemy.protectedUntil=f.now()+5000;expect(f.mode.damage(p,enemy,100,f.now())).toBe(0);expect(f.mode.damage(p,p,100,f.now())).toBe(0);
  for(const n of [NaN,Infinity,-1,0])expect(f.mode.damage(p,null,n,f.now())).toBe(0);
 });
 it("captures only with eligible bodies, pauses while contested, rotates points and wins first to two",()=>{
  const f=fixture(),a=f.hero("cairn"),b=f.hero("cairn","void");
  a.position={...PG_OBJECTIVES.relay[0].position};b.position={...a.position};f.tick(5);
  expect(f.mode.snapshot().control.contested).toBe(true);expect(f.mode.snapshot().control.owner).toBeNull();
  near(b,15);a.protectedUntil=f.now()+2000;f.tick(1);expect(f.mode.snapshot().control.capture.solar).toBe(0);
  f.tick(5);expect(f.mode.snapshot().control.owner).toBe("solar");
  const before=f.mode.snapshot().control.progress.solar;b.position={...a.position};f.tick(3);expect(f.mode.snapshot().control.progress.solar).toBe(before);
  near(b,15);f.tick(51);expect(f.mode.snapshot().roundScores.solar).toBe(1);expect(f.mode.snapshot().subphase).toBe("round-break");
  f.tick(5);expect(f.mode.snapshot().control.point).toBe(1);a.position={...PG_OBJECTIVES.relay[1].position};f.tick(57);
  expect(f.mode.snapshot().roundScores.solar).toBe(2);expect(f.winner()).toBe("solar");
 });
 it("keeps earning an uncontested captured relay when empty and rejects damage in round breaks",()=>{
  const f=fixture(),p=f.hero("cairn"),enemy=f.hero("cairn","void");p.position={...PG_OBJECTIVES.relay[0].position};f.tick(4.1);near(p,-15);
  const before=f.mode.snapshot().control.progress.solar,charge=f.mode.snapshot().pilots[p.id].ultimate;f.tick(2);
  expect(f.mode.snapshot().control.progress.solar).toBeCloseTo(before+4);expect(f.mode.snapshot().pilots[p.id].ultimate).toBe(charge);
  f.tick(49);expect(f.mode.snapshot().subphase).toBe("round-break");const hp=enemy.hp;
  expect(f.mode.damage(enemy,null,100,f.now())).toBe(0);expect(enemy.hp).toBe(hp);expect(f.mode.canFire(p)).toBe(false);
 });
 it("checks continuous ally line of sight and removes beams when newly deployed cover blocks them",()=>{
  const f=fixture(),p=f.hero("solace"),ally=f.hero("cairn");near(p,-10);near(ally,-6);ally.hp=1;
  expect(f.ability("solace",0,ally).ok).toBe(true);f.tick(.2);const hp=ally.hp;
  f.world.add({id:"beam-cover",solid:{id:"beam-cover",kind:"structure",center:{x:-8,y:1,z:32},half:{x:.2,y:1,z:2},mantle:false},hp:100,maxHp:100,reinforced:false,active:true,revision:0},f.now());
  f.tick(.2);expect(ally.hp).toBe(hp);expect(f.mode.snapshot().effects.some(e=>e.ownerId===p.id)).toBe(false);
  near(f.hero("spindle"),-10);expect(f.ability("spindle",0,ally).ok).toBe(false);
 });
 it("resets deployed collision, private intel and active ultimate effects on restart",()=>{
  const f=fixture();f.earn("cinder");near(f.hero("cairn"),-10);near(f.hero("parallax"),-12);near(f.hero("cairn","void"),5);
  for(const other of f.players.values())if(other!==f.hero("cairn")&&other!==f.hero("parallax")&&other.team==="solar")other.position.z=35;
  expect(f.ability("cairn",0,undefined,{x:-7,y:0,z:32}).ok).toBe(true);expect(f.ability("cinder",2).ok).toBe(true);
  f.mode.start(f.now());expect(f.world.snapshot().panels).toEqual([]);expect(f.mode.snapshot().effects).toEqual([]);expect(f.mode.snapshot(f.hero("parallax").id).intel).toEqual([]);
  for(const p of Object.values(f.mode.snapshot().pilots)){expect(p.ultimate).toBe(0);expect(p.cooldowns).toEqual([0,0]);expect(p.life).toBe("alive");}
 });
 it("reserves all six unique heroes per team, rejects duplicate picks and honors human priority over bots",()=>{
  const f=fixture();const snapshot=f.mode.snapshot();
  for(const team of ["solar","void"] as const)expect(new Set([...f.players.values()].filter(p=>p.team===team).map(p=>snapshot.pilots[p.id].characterId)).size).toBe(6);
  const human=f.hero("cairn"),taken=f.hero("kepler");f.ctx.damage(human,f.hero("cinder","void"),1000,f.now());
  const pick={kind:"select" as const,sequence:1,lifeId:human.lifeId,characterId:"kepler"};
  expect(f.mode.action(human,pick,f.now()).ok).toBe(false);taken.isBot=true;
  expect(f.mode.action(human,{...pick,sequence:2},f.now()).ok).toBe(true);
  expect(f.mode.snapshot().pilots[human.id].characterId).toBe("kepler");expect(f.mode.snapshot().pilots[taken.id].characterId).toBe("cairn");
  expect(f.mode.snapshot().pilots[f.hero("kepler","void").id].characterId).toBe("kepler");
 });
 it("uses team respawn waves, preserves cooldowns and rejects spawn fire and stale life actions",()=>{
  const f=fixture(),p=f.hero("cinder"),enemy=f.hero("cairn","void");near(p,-10);p.yaw=-Math.PI/2;
  expect(f.ability("cinder",0,undefined,{x:-5,y:0,z:32}).ok).toBe(true);const cooldown=f.mode.snapshot().pilots[p.id].cooldowns[0],life=p.lifeId;
  f.ctx.damage(p,enemy,1000,f.now());expect(f.mode.snapshot().pilots[p.id].life).toBe("eliminated");f.tick(4.9);expect(p.lifeId).toBe(life);
  f.tick(.2);expect(p.lifeId).toBe(life+1);expect(p.hp).toBe(PG_HEROES.cinder.maxHp);expect(f.mode.canFire(p)).toBe(false);
  expect(f.mode.snapshot().pilots[p.id].cooldowns[0]).toBe(cooldown);
  expect(f.mode.action(p,{kind:"ability",sequence:100,lifeId:life,slot:0},f.now()).ok).toBe(false);
  p.position={...PG_MAP.spawns.find(s=>s.team===p.team)!.position};p.protectedUntil=0;f.tick(3);expect(f.mode.canFire(p)).toBe(false);
 });
 it("enforces effective damage, Kepler shielding, bounded guard and earned Cinder reload",()=>{
  const f=fixture(),kepler=f.hero("kepler"),enemy=f.hero("cinder","void");
  const hp=kepler.hp;expect(f.ctx.damage(kepler,enemy,50,f.now())).toBeCloseTo(42.5);expect(kepler.hp).toBe(hp);expect(f.mode.snapshot().pilots[kepler.id].shield).toBeCloseTo(17.5);
  expect(f.ability("kepler",1).ok).toBe(true);const before=kepler.hp;f.ctx.damage(kepler,enemy,100,f.now());expect(kepler.hp).toBe(before);
  f.tick(3);expect(f.mode.snapshot().pilots[kepler.id].shield).toBeCloseTo(17.5);
  expect(f.mode.knockbackMultiplier(f.hero("cairn"))).toBe(.55);
  kepler.hp=5;f.ctx.damage(kepler,enemy,1000,f.now());expect(f.mode.weaponModifiers(enemy,f.now()).reloadMultiplier).toBe(.8);f.tick(3.1);expect(f.mode.weaponModifiers(enemy,f.now()).reloadMultiplier).toBe(1);
  expect(f.ctx.damage(f.hero("cairn"),f.hero("spindle"),100,f.now())).toBe(0);
 });
 it("places real finite barriers and cleans their collision on destruction, death and round reset",()=>{
  const f=fixture(),cairn=f.hero("cairn"),enemy=f.hero("cairn","void");near(cairn,-10);near(enemy,5);cairn.yaw=-Math.PI/2;
  for(const other of f.players.values())if(other!==cairn&&other!==enemy)other.position.z=35;
  expect(f.ability("cairn",0,undefined,{x:-7,y:0,z:32}).ok).toBe(true);
  const panel=f.world.snapshot().panels.find(p=>p.active)!;expect(panel.hp).toBe(450);
  expect(f.world.visible({x:-10,y:1,z:32},{x:0,y:1,z:32})).toBe(false);
  const target=f.mode.targets(enemy).find(t=>t.id===panel.id)!;expect(target.damage(1000,enemy,f.now())).toBe(450);
  expect(f.world.snapshot().panels.find(p=>p.id===panel.id)?.active).toBe(false);expect(f.world.visible({x:-10,y:1,z:32},{x:0,y:1,z:32})).toBe(true);
  f.tick(17);expect(f.ability("cairn",0,undefined,{x:-7,y:0,z:32}).ok).toBe(true);f.ctx.damage(cairn,enemy,1000,f.now());expect(f.world.snapshot().panels.some(p=>p.active)).toBe(false);
 });
 it("applies frontal pulse damage and knockback only to visible enemies in the cone",()=>{
  const f=fixture(),p=f.hero("cairn"),front=f.hero("cinder","void"),behind=f.hero("parallax","void");near(p,-8);near(front,-5);near(behind,-11);p.yaw=-Math.PI/2;
  expect(f.ability("cairn",1).ok).toBe(true);expect(front.hp).toBe(PG_HEROES.cinder.maxHp-25);expect(front.velocity.x).toBeGreaterThan(0);expect(behind.hp).toBe(PG_HEROES.parallax.maxHp);
 });
 it("collision-checks dash and blink and does not consume cooldown on invalid destinations",()=>{
  const f=fixture(),cinder=f.hero("cinder"),parallax=f.hero("parallax");near(cinder,-10);near(parallax,-6);
  expect(f.ability("cinder",0,undefined,{x:-5,y:0,z:32}).ok).toBe(true);expect(cinder.position.x).toBe(-5);
  expect(f.ability("parallax",1,undefined,{x:-2,y:0,z:32}).ok).toBe(true);expect(parallax.position.x).toBe(-2);
  f.tick(10);near(parallax,-10,-18);expect(f.ability("parallax",1,undefined,{x:-40,y:0,z:-18}).ok).toBe(false);
  expect(f.mode.snapshot().pilots[parallax.id].charges[1]).toBe(1);
  near(parallax,-33,-18);expect(f.ability("parallax",1,undefined,{x:-37,y:0,z:-18}).ok).toBe(false);expect(parallax.position.x).toBe(-33);
 });
 it("telegraphs heat and gravity, slows enemies, pulls once and expires cleanly",()=>{
  const f=fixture(),cinder=f.hero("cinder"),kepler=f.hero("kepler"),enemy=f.hero("cairn","void");near(cinder,-10);near(kepler,-12);near(enemy,-5);
  expect(f.ability("cinder",1,undefined,{x:-5,y:0,z:32}).ok).toBe(true);const hp=enemy.hp;f.tick(.8);expect(enemy.hp).toBe(hp);f.tick(.3);expect(enemy.hp).toBeLessThan(hp);
  expect(f.ability("kepler",0,undefined,{x:-5,y:0,z:32}).ok).toBe(true);f.tick(.8);expect(f.mode.movement(enemy).walkSpeed).toBeLessThan(PG_DEFAULT_MOVEMENT_RULES.walkSpeed);
  // Ultimate charge is earned by effective enemy damage rather than injected in an action.
  for(let i=0;i<10;i++){const victim=f.hero("spindle","void");victim.hp=200;f.mode.damage(victim,kepler,200,f.now());}
  near(enemy,-2);expect(f.ability("kepler",2,undefined,{x:-5,y:0,z:32}).ok).toBe(true);f.tick(1.1);const after=enemy.position.x;expect(after).toBeLessThan(-2);f.tick(.5);expect(enemy.position.x).toBe(after);
  f.tick(7);expect(f.mode.movement(enemy).walkSpeed).toBe(PG_DEFAULT_MOVEMENT_RULES.walkSpeed);
 });
 it("reveals only visible enemies at scan time, only to teammates, with expiring historical positions",()=>{
  const f=fixture(),p=f.hero("parallax"),visible=f.hero("cairn","void"),hidden=f.hero("kepler","void");near(p,-10);near(visible,2);near(hidden,-30,-18);p.yaw=-Math.PI/2;
  expect(f.ability("parallax",0).ok).toBe(true);const intel=f.mode.snapshot(p.id).intel;
  expect(intel.some(i=>i.targetId===visible.id)).toBe(true);expect(intel.some(i=>i.targetId===hidden.id)).toBe(false);
  expect(f.mode.snapshot(visible.id).intel).toEqual([]);expect(f.mode.snapshot().intel).toEqual([]);near(visible,4);expect(f.mode.snapshot(p.id).intel.find(i=>i.targetId===visible.id)!.position.x).toBe(2);
  f.tick(2.1);expect(f.mode.snapshot(p.id).intel).toEqual([]);
 });
 it("heals real bounded HP with beam resources, destructible beacon, self recovery and capped recovery ultimate",()=>{
  const f=fixture(),solace=f.hero("solace"),ally=f.hero("cairn");near(solace,-10);near(ally,-6);ally.hp=100;
  const before=f.mode.snapshot().pilots[solace.id].ultimate;expect(f.ability("solace",0,ally).ok).toBe(true);f.tick(2);expect(ally.hp).toBeCloseTo(160);expect(f.mode.snapshot().pilots[solace.id].ultimate).toBeGreaterThan(before);
  near(ally,20);const hp=ally.hp;f.tick(1);expect(ally.hp).toBe(hp);
  near(ally,-6);expect(f.ability("solace",1,undefined,{x:-7,y:0,z:32}).ok).toBe(true);f.tick(1);expect(ally.hp).toBeGreaterThan(hp);
  expect(f.mode.targets(f.hero("cairn","void")).some(t=>t.kind==="gadget")).toBe(true);
  solace.hp=150;solace.lastDamageAt=f.now();f.tick(4.9);expect(solace.hp).toBeLessThan(PG_HEROES.solace.maxHp);f.tick(2);expect(solace.hp).toBeGreaterThan(150);
  // Effective eligible healing can earn a full ultimate; overheal never grants charge.
  for(let i=0;i<25;i++){ally.hp=0;ally.hp=1;f.tick(1);}
  const earned=f.mode.snapshot().pilots[solace.id].ultimate;expect(earned).toBeGreaterThan(0);
 });
 it("supports temporary rechargeable ally shields, destructible relay amplification and cleanup",()=>{
  const f=fixture(),spindle=f.hero("spindle"),ally=f.hero("cairn"),enemy=f.hero("cairn","void");near(spindle,-10);near(ally,-6);near(enemy,5);
  expect(f.ability("spindle",0,ally).ok).toBe(true);expect(f.mode.snapshot().pilots[ally.id].shield).toBe(40);
  const hp=ally.hp;f.ctx.damage(ally,enemy,30,f.now());expect(ally.hp).toBe(hp);expect(f.mode.snapshot().pilots[ally.id].shield).toBe(10);f.tick(1);expect(f.mode.snapshot().pilots[ally.id].shield).toBeCloseTo(18);
  expect(f.ability("spindle",1,undefined,{x:-8,y:0,z:32}).ok).toBe(true);expect(f.mode.movement(ally).walkSpeed).toBeGreaterThan(PG_DEFAULT_MOVEMENT_RULES.walkSpeed);expect(f.mode.weaponModifiers(ally,f.now()).reloadMultiplier).toBe(.85);
  for(let i=0;i<10;i++){enemy.hp=325;f.mode.damage(enemy,spindle,325,f.now());}
  expect(f.ability("spindle",2).ok).toBe(true);expect(f.mode.weaponModifiers(ally,f.now()).reloadMultiplier).toBe(.7);
  enemy.hp=325;const gadget=f.mode.targets(enemy).find(t=>t.kind==="gadget")!;gadget.damage(1000,enemy,f.now());expect(f.mode.weaponModifiers(ally,f.now()).reloadMultiplier).toBe(1);
  f.mode.leave(spindle.id,f.now());expect(f.mode.snapshot().effects.some(e=>e.ownerId===spindle.id)).toBe(false);expect(f.mode.snapshot().pilots[ally.id].shield).toBe(0);
 });
 it("never grants charge for friendly damage, overheal, invulnerable targets or gadgets",()=>{
  const f=fixture(),p=f.hero("solace"),ally=f.hero("cairn"),enemy=f.hero("cairn","void");
  const before=f.mode.snapshot().pilots[p.id].ultimate;expect(f.mode.damage(ally,p,200,f.now())).toBe(0);
  enemy.protectedUntil=f.now()+10000;expect(f.mode.damage(enemy,p,200,f.now())).toBe(0);
  expect(f.mode.snapshot().pilots[p.id].ultimate).toBe(before);near(p,-10);near(ally,-6);expect(f.ability("solace",0,ally).ok).toBe(true);f.tick(2);expect(f.mode.snapshot().pilots[p.id].ultimate).toBe(before);
 });
});
