import {describe,it,expect,vi} from "vitest";
import {PG_MAP,PG_OBJECTIVES,pgCreateGun,pgSpawnMotion,type PgLoadout,type PgModeAction,type PgPlayer,type PgTeam} from "@planetfall/shared";
import {PgStrike} from "./pg-strike.js";
import {PgModeWorld} from "./pg-mode-world.js";
import type {PgModeContext} from "./pg-mode-runtime.js";

function setup(){
 const players=new Map<string,PgPlayer>();
 for(const [id,team]of [["a","solar"],["b","void"]]as const)players.set(id,{...pgSpawnMotion(PG_MAP.spawns.find(s=>s.team===team)!.position),id,team,lifeId:0,connected:true,hp:100,lastDamageAt:-1000,protectedUntil:0,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:1} as PgPlayer);
 const finish=vi.fn();let mode:PgStrike;
 const ctx:PgModeContext={players,world:new PgModeWorld(),finish,respawn(p,now,loadout?:PgLoadout){Object.assign(p,pgSpawnMotion(PG_MAP.spawns.find(s=>s.team===p.team)!.position));p.lifeId++;p.hp=100;p.lastDamageAt=-1000;p.protectedUntil=now;p.guns=[pgCreateGun(loadout?.primary??"pulse"),pgCreateGun(loadout?.secondary??"orbit")];},damage(target,attacker,amount,now){const damage=mode.damage(target,attacker,amount,now);if(target.hp<=0)mode.eliminated(target,attacker,"pulse",now);return damage;}};
 mode=new PgStrike(ctx);mode.start(0);return {mode,ctx,finish,a:players.get("a")!,b:players.get("b")!};
}
const action=(p:PgPlayer,part:Omit<Extract<PgModeAction,{kind:"interact"}>,"sequence"|"lifeId">)=>({...part,sequence:0,lifeId:p.lifeId});
function plant(game:ReturnType<typeof setup>,start=20100){
 const {mode,a}=game;a.position={...PG_OBJECTIVES.strike[0].position};
 for(let t=start;t<=start+4000;t+=200){expect(mode.action(a,action(a,{kind:"interact",targetId:"site-A",held:true}),t).ok).toBe(true);mode.update(.2,t);}
 return start+4000;
}
function kill(game:ReturnType<typeof setup>,who:PgPlayer,at:number){who.hp=0;game.mode.eliminated(who,null,"pulse",at);}
describe("PlanetStrike authority",()=>{
 it("acknowledges stale hold cancellation across phases and death without granting an action",()=>{
  const {mode,a}=setup(),cancel=action(a,{kind:"interact",targetId:"charge",held:false}),before=mode.snapshot();
  expect(mode.action(a,cancel,100).ok).toBe(true);
  expect(mode.action(a,{...cancel,held:true},100).ok).toBe(false);
  a.hp=0;expect(mode.action(a,cancel,200).ok).toBe(true);expect(mode.action(a,{...cancel,held:true},200).ok).toBe(false);
  expect(mode.snapshot()).toEqual(before);
 });
 it("starts sidearm-only, charges server prices, respects purchase zones and phase",()=>{
  const {mode,a}=setup();expect(mode.allowSlot(a,0)).toBe(false);expect(a.guns[0].magazine).toBe(0);
  const buy=(itemId:string,now=100)=>mode.action(a,{kind:"buy",sequence:0,lifeId:a.lifeId,itemId},now);
  expect(buy("rail").ok).toBe(false);expect(buy("armor").ok).toBe(true);expect(mode.snapshot().pilots.a.credits).toBe(150);expect(mode.snapshot().pilots.a.armor).toBe(50);
  expect(buy("armor").ok).toBe(false);expect(mode.snapshot().pilots.a.credits).toBe(150);
  a.position={x:0,y:0,z:0};expect(buy("orbit").ok).toBe(false);
  a.position={...PG_MAP.spawns[0].position};expect(buy("orbit",20000).ok).toBe(false);
  mode.update(.01,20000);expect(mode.snapshot().subphase).toBe("action");expect(buy("orbit",20100).ok).toBe(false);
 });
 it("requires held, stationary, undamaged, in-range charge interaction",()=>{
  const game=setup(),{mode,a,b}=game;mode.update(.01,20000);
  expect(mode.action(a,action(a,{kind:"interact",targetId:"site-A",held:true}),20100).ok).toBe(false);
  a.position={...PG_OBJECTIVES.strike[0].position};expect(mode.action(b,action(b,{kind:"interact",targetId:"site-A",held:true}),20100).ok).toBe(false);
  mode.action(a,action(a,{kind:"interact",targetId:"site-A",held:true}),20100);a.position.x+=.2;mode.update(.2,20300);expect(mode.snapshot().pilots.a.interaction).toBeNull();
  mode.action(a,action(a,{kind:"interact",targetId:"site-A",held:true}),20500);mode.damage(a,b,1,20600);mode.update(.1,20600);expect(mode.snapshot().pilots.a.interaction).toBeNull();
  mode.action(a,action(a,{kind:"interact",targetId:"site-A",held:true}),20700);mode.update(.5,21200);expect(mode.snapshot().pilots.a.interaction).toBeNull();expect(mode.snapshot().charge.site).toBeNull();
 });
 it("plants, keeps ticking after attackers die, and resolves detonation",()=>{
  const game=setup();game.mode.update(.01,20000);const plantedAt=plant(game);expect(game.mode.snapshot().charge.site).toBe("A");
  kill(game,game.a,plantedAt+100);game.mode.update(.1,plantedAt+100);expect(game.mode.snapshot().subphase).toBe("action");
  game.mode.update(35,plantedAt+35000);expect(game.mode.snapshot().roundScores.solar).toBe(1);
 });
 it("defuses with six seconds of held interaction",()=>{
  const game=setup();game.mode.update(.01,20000);const plantedAt=plant(game);game.b.position={...game.mode.snapshot().charge.position!};
  for(let t=plantedAt+100;t<=plantedAt+6100;t+=200){game.mode.action(game.b,action(game.b,{kind:"interact",targetId:"charge",held:true}),t);game.mode.update(.2,t);}
  expect(game.mode.snapshot().roundScores.void).toBe(1);expect(game.mode.snapshot().pilots.b.contribution).toBe(3);
 });
 it("gives detonation priority when defuse completes at exactly its deadline",()=>{
  const game=setup();game.mode.update(.01,20000);const plantedAt=plant(game),end=plantedAt+35000;game.b.position={...game.mode.snapshot().charge.position!};
  for(let t=end-6000;t<end;t+=200){game.mode.action(game.b,action(game.b,{kind:"interact",targetId:"charge",held:true}),t);game.mode.update(.2,t);}
  game.mode.update(.2,end);expect(game.mode.snapshot().roundScores.solar).toBe(1);expect(game.mode.snapshot().roundScores.void).toBe(0);
 });
 it("times out and favors defense for a simultaneous pre-plant wipe",()=>{
  const timeout=setup();timeout.mode.update(.01,20000);timeout.mode.update(105,125000);expect(timeout.mode.snapshot().roundScores.void).toBe(1);
  const wipe=setup();wipe.mode.update(.01,20000);kill(wipe,wipe.a,21000);kill(wipe,wipe.b,21000);wipe.mode.update(.1,21000);expect(wipe.mode.snapshot().roundScores.void).toBe(1);
 });
 it("drops the carrier charge on death and only a nearby visible attacker recovers it",()=>{
  const game=setup(),{mode,a,b}=game;mode.update(.01,20000);a.position={x:0,y:0,z:0};
  expect(mode.action(a,{kind:"pickup",sequence:0,lifeId:a.lifeId,entityId:"drop-charge"},20100).ok).toBe(true);
  b.position={...a.position};expect(mode.action(b,{kind:"pickup",sequence:0,lifeId:b.lifeId,entityId:"charge"},20200).ok).toBe(false);
  a.position.x=10;expect(mode.action(a,{kind:"pickup",sequence:0,lifeId:a.lifeId,entityId:"charge"},20300).ok).toBe(false);
  a.position.x=0;expect(mode.action(a,{kind:"pickup",sequence:0,lifeId:a.lifeId,entityId:"charge"},20400).ok).toBe(true);
  kill(game,a,20500);expect(mode.snapshot().charge.carrierId).toBeNull();expect(mode.snapshot().drops.filter(d=>d.kind==="charge")).toHaveLength(1);
 });
 it("supports smoke, bounded flash and damaging utility with authoritative ownership",()=>{
  const {mode,a,b}=setup();
  expect(mode.action(a,{kind:"buy",sequence:0,lifeId:a.lifeId,itemId:"smoke"},100).ok).toBe(true);
  expect(mode.action(a,{kind:"buy",sequence:0,lifeId:a.lifeId,itemId:"flash"},100).ok).toBe(true);
  expect(mode.snapshot().pilots.a.utilities).toEqual([1,1,0]);mode.update(.01,20000);a.position={x:0,y:0,z:0};b.position={x:2,y:0,z:0};
  expect(mode.action(a,{kind:"ability",sequence:0,lifeId:a.lifeId,slot:0,position:{x:0,y:0,z:0}},20100).ok).toBe(true);
  expect(mode.visible({x:-3,y:1,z:0},{x:3,y:1,z:0})).toBe(false);
  expect(mode.action(a,{kind:"ability",sequence:0,lifeId:a.lifeId,slot:0,position:{x:0,y:0,z:0}},20200).ok).toBe(false);
  expect(mode.action(a,{kind:"ability",sequence:0,lifeId:a.lifeId,slot:1,position:{x:2,y:0,z:0}},20300).ok).toBe(true);expect(mode.botGoal(b,20400)).toEqual(b.position);
  mode.update(13,34000);expect(mode.visible({x:-3,y:1,z:0},{x:3,y:1,z:0})).toBe(true);
 });
 it("preserves survivor equipment and restores ammo, while dead players lose equipment",()=>{
  const game=setup(),{mode,a,b}=game;
  mode.action(a,{kind:"buy",sequence:0,lifeId:a.lifeId,itemId:"comet"},100);a.guns[1].magazine=1;
  mode.update(.01,20000);kill(game,b,20100);mode.update(.1,20100);mode.update(5,25100);
  expect(a.guns[1].id).toBe("comet");expect(a.guns[1].magazine).toBe(9);expect(b.guns[1].id).toBe("orbit");expect(mode.snapshot().pilots.a.credits).toBe(3300);expect(mode.snapshot().drops).toEqual([]);
 });
 it("preserves weapon ammunition through one atomic pickup and blocks pickup through walls",()=>{
  const game=setup(),{mode,a,b}=game;mode.update(.01,20000);kill(game,b,20100);mode.update(.1,20100);mode.update(5,25100);
  expect(mode.action(a,{kind:"buy",sequence:0,lifeId:a.lifeId,itemId:"pulse"},25200).ok).toBe(true);mode.update(20,45100);
  a.position={x:-35.9,y:0,z:-17};b.position={x:-34.1,y:0,z:-17};a.guns[0].magazine=7;a.guns[0].reserve=12;
  mode.action(a,{kind:"pickup",sequence:0,lifeId:a.lifeId,entityId:"drop-weapon"},45200);const drop=mode.snapshot().drops.find(d=>d.kind==="weapon")!;
  expect(mode.allowSlot(a,0)).toBe(false);expect(mode.action(b,{kind:"pickup",sequence:0,lifeId:b.lifeId,entityId:drop.id},45300).ok).toBe(false);
  b.position={...a.position};expect(mode.action(b,{kind:"pickup",sequence:0,lifeId:b.lifeId,entityId:drop.id},45400).ok).toBe(true);expect(b.guns[0].magazine).toBe(7);expect(b.guns[0].reserve).toBe(12);expect(mode.allowSlot(b,0)).toBe(true);
  expect(mode.action(a,{kind:"pickup",sequence:0,lifeId:a.lifeId,entityId:drop.id},45500).ok).toBe(false);
 });
 it("consumes damaging utility only for a finite legal destination and applies real damage",()=>{
  const {mode,a,b}=setup();mode.action(a,{kind:"buy",sequence:0,lifeId:a.lifeId,itemId:"damage"},100);mode.update(.01,20000);a.position={x:0,y:0,z:0};b.position={x:2,y:0,z:0};
  expect(mode.action(a,{kind:"ability",sequence:0,lifeId:a.lifeId,slot:2,position:{x:NaN,y:0,z:0}},20100).ok).toBe(false);expect(mode.snapshot().pilots.a.utilities[2]).toBe(1);
  expect(mode.action(a,{kind:"ability",sequence:0,lifeId:a.lifeId,slot:2,position:{x:2,y:0,z:0}},20200).ok).toBe(true);expect(b.hp).toBe(30);expect(a.hp).toBe(100);expect(mode.snapshot().pilots.a.utilities[2]).toBe(0);
 });
 it("drops the shared charge even when a leave arrives after roster removal",()=>{
  const {mode,ctx,a}=setup();ctx.players.delete(a.id);mode.leave(a.id,100);expect(mode.snapshot().charge.carrierId).toBeNull();expect(mode.snapshot().drops.filter(d=>d.kind==="charge")).toHaveLength(1);
 });
 it("plays twelve regulation rounds, swaps sides, then bounds tied overtime",()=>{
  const game=setup();let now=0;
  for(let round=1;round<=18;round++){
   now+=20000;game.mode.update(20,now);const snapshot=game.mode.snapshot(),winner:PgTeam=round<=6?"solar":round<=12?"void":round%2?"solar":"void";
   const victim=winner==="solar"?game.b:game.a;kill(game,victim,now+100);game.mode.update(.1,now+100);
   if(round===6)expect(game.mode.snapshot().attackTeam).toBe("void");
   if(round>=13)expect(snapshot.pilots.a.credits).toBe(6000);
   now+=5100;if(round<18)game.mode.update(5,now);
  }
  expect(game.finish).toHaveBeenCalledExactlyOnceWith(null);expect(game.mode.snapshot().subphase).toBe("finished");
 });
 it("bots carry, plant, retake and defuse the objective",()=>{
  const game=setup();game.mode.update(.01,20000);game.a.position={...game.mode.botGoal(game.a,20100)!};
  for(let now=20100;now<=24100;now+=200){game.mode.botAction(game.a,now);game.mode.update(.2,now);}
  expect(game.mode.snapshot().charge.site).toBe("A");game.b.position={...game.mode.botGoal(game.b,24200)!};
  for(let now=24200;now<=30200;now+=200){game.mode.botAction(game.b,now);game.mode.update(.2,now);}
  expect(game.mode.snapshot().roundScores.void).toBe(1);
 });
});
