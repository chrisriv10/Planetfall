import {describe,expect,it,vi} from "vitest";
import {DEFAULT_COSMETICS,PG_OBJECTIVES,PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_FORGE_SITE,PG_ZOMBIE_PRICES,PG_ZOMBIE_TONIC_SOCKETS,pgCreateGun,pgSpawnMotion,type PgPlayer,type PgZombiePilot} from "@planetfall/shared";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombies} from "./pg-zombies.js";

function player(id:string):PgPlayer{return {...pgSpawnMotion({x:-28,y:0,z:-9}),id,name:id,color:"#fff",team:"solar",isBot:false,connected:true,ready:true,hp:100,kills:0,deaths:0,lifeId:1,deadAt:0,respawnAt:0,protectedUntil:0,lastDamageAt:0,lastAttacker:null,lastInputSequence:0,loadout:{primary:"pulse",secondary:"orbit"},slot:0,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],adsSince:0,fireReadyAt:0,fallbucks:250,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:[]};}
function setup(){
 const p=player("owner"),other=player("other"),players=new Map([[p.id,p],[other.id,other]]),world=new PgModeWorld();
 const mode=new PgZombies({players,world,finish:vi.fn(),damage:()=>0,respawn:(pilot,now,loadout,position)=>{Object.assign(pilot,pgSpawnMotion(position??pilot.position));pilot.lifeId++;pilot.hp=100;pilot.protectedUntil=now+1000;if(loadout)pilot.loadout=loadout;pilot.guns=[pgCreateGun(pilot.loadout.primary),pgCreateGun(pilot.loadout.secondary)];}});
 mode.start(0);
 const states=(mode as unknown as {pilots:Map<string,PgZombiePilot>}).pilots;
 for(const state of states.values())state.points=10000;
 const sequences=new Map<string,number>();
 const action=(pilot:PgPlayer,itemId:string,now:number)=>mode.action(pilot,{kind:"buy",itemId,sequence:next(pilot),lifeId:pilot.lifeId},now);
 function next(pilot:PgPlayer){const sequence=(sequences.get(pilot.id)??0)+1;sequences.set(pilot.id,sequence);return sequence;}
 for(const pilot of players.values()){pilot.position={...PG_OBJECTIVES.racks[0].position};expect(action(pilot,"rack-pulse",1000).ok).toBe(true);}
 p.position={...PG_OBJECTIVES.power};expect(mode.action(p,{kind:"interact",targetId:"power",held:true,sequence:next(p),lifeId:p.lifeId},1100).ok).toBe(true);
 mode.update(0,3100);expect(mode.snapshot().power).toBe(true);
 p.position={...PG_ZOMBIE_FORGE_SITE.interaction};other.position={...p.position};
 return {mode,p,other,state:states.get(p.id)!,otherState:states.get(other.id)!,action,next};
}

describe("PlanetZombies Forge and Ion Tonics integration",()=>{
 it("makes bots use the sidearm during insertion and confines primary upgrades to that weapon",()=>{
  const {mode,p,state,action}=setup();expect(action(p,"upgrade",3200).ok).toBe(true);
  mode.botAction(p,3201);expect(p.slot).toBe(1);expect(mode.weaponModifiers(p)).toEqual({damage:1,reload:1,interval:1});
  mode.update(0,5200);p.slot=0;expect(mode.weaponModifiers(p).damage).toBe(1.35);
  p.slot=1;expect(mode.weaponModifiers(p)).toEqual({damage:1,reload:1,interval:1});
  state.perks.push("perk-reload");expect(mode.weaponModifiers(p)).toEqual({damage:1,reload:.75,interval:1});
 });
 it("locks the inserted primary, allows sidearm fire, and releases the lock only on authoritative completion",()=>{
  const {mode,p,state,action}=setup(),gun=p.guns[0],before=state.points;
  expect(action(p,"upgrade",3200).ok).toBe(true);expect(state.points).toBe(before-900);expect(state.upgrade).toBe(0);
  expect(mode.snapshot().forge).toMatchObject({phase:"processing",ownerId:p.id,weaponId:"pulse",targetTier:1,startedAt:3200,completesAt:5200});
  expect(mode.allowSlot(p,0)).toBe(false);expect(mode.canFire(p)).toBe(false);
  p.slot=1;expect(mode.allowSlot(p,1)).toBe(true);expect(mode.canFire(p)).toBe(true);
  mode.update(0,5199);expect(state.upgrade).toBe(0);expect(mode.allowSlot(p,0)).toBe(false);expect(p.guns[0]).toBe(gun);
  mode.update(0,5200);expect(state.upgrade).toBe(1);expect(mode.allowSlot(p,0)).toBe(true);
  p.slot=0;expect(mode.canFire(p)).toBe(true);expect(p.guns[0]).toBe(gun);expect(mode.weaponModifiers(p).damage).toBeCloseTo(1.35);
  mode.update(0,5200);mode.update(0,6399);expect(state.upgrade).toBe(1);expect(state.points).toBe(before-900);expect(mode.snapshot().forge.phase).toBe("complete");
  mode.update(0,6400);expect(mode.snapshot().forge.phase).toBe("idle");expect(state.upgrade).toBe(1);
 });

 it("rejects duplicate and competing jobs without charging throughout processing and completion display",()=>{
  const {mode,p,other,state,otherState,action}=setup(),before=state.points,otherBefore=otherState.points,purchases=state.purchases;
  expect(action(p,"upgrade",3200).ok).toBe(true);
  expect(action(p,"upgrade",3201).ok).toBe(false);expect(action(other,"upgrade",3201).ok).toBe(false);
  expect(state.points).toBe(before-900);expect(otherState.points).toBe(otherBefore);expect(state.purchases).toBe(purchases+1);
  mode.update(0,5200);expect(action(p,"upgrade",5201).ok).toBe(false);expect(action(other,"upgrade",5201).ok).toBe(false);
  expect(state.points).toBe(before-900);expect(otherState.points).toBe(otherBefore);
  mode.update(0,6400);expect(action(p,"upgrade",6400).ok).toBe(true);expect(state.points).toBe(before-900-1600);
  expect(state.upgrade).toBe(1);mode.update(0,8400);expect(state.upgrade).toBe(2);
 });

 it("blocks primary rack replacement while inserted, permits sidearm purchases, and preserves the primary object",()=>{
  const {mode,p,state,action}=setup(),gun=p.guns[0];expect(action(p,"upgrade",3200).ok).toBe(true);const points=state.points;
  p.position={...PG_OBJECTIVES.racks[2].position};expect(action(p,"rack-photon",3201).ok).toBe(false);expect(state.points).toBe(points);expect(p.guns[0]).toBe(gun);
  expect(action(p,"rack-comet",3202).ok).toBe(true);expect(p.guns[1].id).toBe("comet");expect(p.slot).toBe(1);expect(mode.canFire(p)).toBe(true);
  expect(state.points).toBe(points-PG_ZOMBIE_PRICES["rack-comet"]);expect(p.guns[0]).toBe(gun);
  mode.update(0,5200);expect(state.upgrade).toBe(1);
  expect(action(p,"rack-photon",5201).ok).toBe(true);expect(p.guns[0].id).toBe("photon");expect(state.upgrade).toBe(0);
 });

 it("preserves a reserved Arsenal claim rejected during insertion until processing completes",()=>{
  const {mode,p,state,action,next}=setup();p.position={...PG_ZOMBIE_ARSENAL_SITE.interaction};expect(action(p,"anomaly-arsenal",3200).ok).toBe(true);
  p.position={...PG_ZOMBIE_FORGE_SITE.interaction};expect(action(p,"upgrade",4000).ok).toBe(true);const points=state.points,gun=p.guns[0];
  p.position={...PG_ZOMBIE_ARSENAL_SITE.interaction};
  const claim=(now:number)=>mode.action(p,{kind:"pickup",entityId:"arsenal-result",sequence:next(p),lifeId:p.lifeId},now);
  expect(mode.snapshot().arsenal.revealAt).toBe(5400);expect(claim(5400).ok).toBe(false);expect(p.guns[0]).toBe(gun);expect(state.points).toBe(points);expect(mode.snapshot().arsenal.ownerId).toBe(p.id);
  mode.update(0,6000);expect(state.upgrade).toBe(1);expect(claim(6000).ok).toBe(true);expect(state.upgrade).toBe(0);expect(mode.snapshot().arsenal.phase).toBe("idle");
 });

 it("cancels pending upgrades on owner leave and run reset",()=>{
  const {mode,p,state,action}=setup();expect(action(p,"upgrade",3200).ok).toBe(true);mode.leave(p.id,3300);
  expect(mode.snapshot().forge.phase).toBe("idle");mode.update(0,5200);expect(state.upgrade).toBe(0);
  mode.start(6000);const fresh=mode.snapshot().pilots[p.id];expect(fresh.upgrade).toBe(0);expect(mode.snapshot().forge.phase).toBe("idle");
  const pending=setup();expect(pending.action(pending.p,"upgrade",3200).ok).toBe(true);pending.mode.start(3300);pending.mode.update(0,5200);
  expect(pending.mode.snapshot().forge.phase).toBe("idle");expect(pending.mode.snapshot().pilots[pending.p.id].upgrade).toBe(0);
 });

 it.each(PG_ZOMBIE_TONIC_SOCKETS)("charges $price once at the dedicated $id socket and applies the existing effect",site=>{
  const {mode,p,state,action}=setup(),before=state.points;p.position={...PG_OBJECTIVES.station};
  expect(action(p,site.id,3200).ok).toBe(false);expect(state.points).toBe(before);
  const priorMovement=mode.movement(p);p.position={...site.interaction};expect(action(p,site.id,3201).ok).toBe(true);
  expect(state.points).toBe(before-site.price);expect(state.perks).toContain(site.id);
  if(site.id==="perk-vitality"){expect(mode.maxHp(p)).toBe(160);expect(state.hitCapacity).toBe(5);}
  if(site.id==="perk-reload")expect(mode.weaponModifiers(p).reload).toBeCloseTo(.75);
  if(site.id==="perk-stamina"){expect(mode.movement(p).sprintSpeed).toBeCloseTo(priorMovement.sprintSpeed*1.15);expect(mode.movement(p).maxSpeed).toBeCloseTo(priorMovement.maxSpeed*1.15);}
  expect(action(p,site.id,3202).ok).toBe(false);expect(state.points).toBe(before-site.price);
 });
});
