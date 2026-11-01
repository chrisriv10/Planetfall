import {
 PG_CINDER_HEAT,PG_BALANCE,PG_DEFAULT_MOVEMENT_RULES,PG_HEROES,PG_HERO_IDS,PG_MAP,PG_OBJECTIVES,PG_PASSIVES,
 pgAim,pgCapsuleClear,pgCharacterDefaultLoadout,pgCreateGun,pgResolveHero,pgValidateHeroLoadout,
 type PgAbilityDefinition,type PgHeroDefinition,type PgHeroId,type PgModeAction,type PgModeActionResult,
 type PgModeEffect,type PgModeIntel,type PgModePilot,type PgModeSnapshot,type PgMovementRules,
 type PgPlayer,type PgSolid,type PgTeam,type PgWeaponId,type Vec3,
} from "@planetfall/shared";
import {pgModeDistance,pgModeError,pgModeOk,pgModePilot} from "./pg-mode-base.js";
import type {PgModeContext,PgModeRuntime,PgModeTarget} from "./pg-mode-runtime.js";

interface WatchPilot {
 public:PgModePilot;
 personalShield:number;
 guard:number;
 guardUntil:number;
 resource:number;
 resourceEarned:number;
 earnedReloadUntil:number;
 stationarySince:number;
 ultimateUntil:number;
 lastSequence:number;
 nextBotAt:number;
}
interface WatchEffect extends PgModeEffect {
 ability:PgAbilityDefinition;
 targetId?:string;
 pool:number;
 caps:Map<string,number>;
 pulled:boolean;
 shield:number;
}
type WatchSnapshot=Extract<PgModeSnapshot,{id:"planetwatch"}>;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const eye=(p:Vec3):Vec3=>({x:p.x,y:p.y+1.3,z:p.z});
const finitePosition=(p:Vec3|undefined):p is Vec3=>!!p&&[p.x,p.y,p.z].every(Number.isFinite);
const allies=(a:PgPlayer,b:PgPlayer)=>a.team===b.team;
const WAVE_MS=8000,SPAWN_SAFE_RADIUS=3,SWAP_RADIUS=8,CAPTURE_MS=4000,PROGRESS_PER_SECOND=2;

/** PlanetWatch owns only its round, hero and effect state. Player bodies remain room-owned. */
export class PgWatch implements PgModeRuntime {
 readonly id="planetwatch" as const;
 private pilots=new Map<string,WatchPilot>();
 private effects=new Map<string,WatchEffect>();
 private intel:Record<PgTeam,Map<string,PgModeIntel>>={solar:new Map(),void:new Map()};
 private contributors=new Map<string,Map<string,{at:number;damage:number}>>();
 private scores:Record<PgTeam,number>={solar:0,void:0};
 private capture:Record<PgTeam,number>={solar:0,void:0};
 private progress:Record<PgTeam,number>={solar:0,void:0};
 private owner:PgTeam|null=null;
 private contested=false;
 private round=1;
 private subphase="control";
 private deadline=0;
 private nextWave=0;
 private now=0;
 private serial=0;
 private finished=false;
 constructor(private ctx:PgModeContext) {this.assignRoster();}

 start(now:number):void {
  this.now=now;this.finished=false;this.scores={solar:0,void:0};this.round=1;
  this.assignRoster();this.beginRound(now);
 }
 private assignRoster():void {
  // Human picks occupy reservations first. Bots always take a remaining character.
  const priority=(p:PgPlayer)=>Number(p.isBot)*2+Number(!pgResolveHero(this.ctx.selections?.get(p.id)));
  for(const p of [...this.ctx.players.values()].sort((a,b)=>priority(a)-priority(b))){
   if(this.pilots.has(p.id))continue;
   const used=new Set([...this.ctx.players.values()].filter(other=>other.team===p.team&&other.id!==p.id).map(other=>this.pilots.get(other.id)?.public.characterId));
   const selected=pgResolveHero(this.ctx.selections?.get(p.id));
   const hero=selected&&!used.has(selected.id)?selected.id:PG_HERO_IDS.find(id=>!used.has(id));if(!hero)continue;
   const state=pgModePilot(p,PG_HEROES[hero].maxHp);state.characterId=hero;state.charges=[1,1];
   this.pilots.set(p.id,{public:state,personalShield:0,guard:0,guardUntil:0,resource:100,resourceEarned:0,earnedReloadUntil:0,stationarySince:0,ultimateUntil:0,lastSequence:-1,nextBotAt:0});
  }
 }
 private hero(p:PgPlayer):PgHeroDefinition {return pgResolveHero(this.pilots.get(p.id)?.public.characterId)??PG_HEROES.cairn;}
 private state(p:PgPlayer):WatchPilot {let state=this.pilots.get(p.id);if(!state){this.assignRoster();state=this.pilots.get(p.id);}if(!state)throw new Error("PlanetWatch roster exceeds six players per team");return state;}
 private beginRound(now:number):void {
  this.clearEffects(now);this.ctx.world.reset([],now);this.capture={solar:0,void:0};this.progress={solar:0,void:0};
  this.owner=null;this.contested=false;this.subphase="control";this.deadline=0;this.nextWave=now+WAVE_MS;
  this.intel={solar:new Map(),void:new Map()};this.contributors.clear();
  for(const p of this.ctx.players.values()){
   const s=this.state(p);s.public.ultimate=0;s.public.cooldowns=[0,0];s.public.charges=[1,1];s.resource=100;s.resourceEarned=0;s.ultimateUntil=0;s.earnedReloadUntil=0;
   this.spawn(p,now);
  }
 }
 private spawn(p:PgPlayer,now:number):void {
  const s=this.state(p),hero=this.hero(p);
  this.ctx.respawn(p,now,pgValidateHeroLoadout(hero.id,this.ctx.selectedLoadouts?.get(p.id))??pgCharacterDefaultLoadout(hero));p.hp=hero.maxHp;p.protectedUntil=now+2000;
  s.public.life="alive";s.public.maxHp=hero.maxHp;s.public.interaction=null;s.personalShield=hero.id==="kepler"?PG_PASSIVES.shielded.initialPersonalShield:0;
  s.guard=0;s.guardUntil=0;s.resourceEarned=0;s.stationarySince=now;s.ultimateUntil=0;p.respawnAt=0;this.syncShield(p);
 }
 private inSpawn(p:PgPlayer,radius=SPAWN_SAFE_RADIUS):boolean {
  return PG_MAP.spawns.some(spawn=>spawn.team===p.team&&pgModeDistance(spawn.position,p.position)<=radius);
 }
 private protected(p:PgPlayer):boolean {return this.now<p.protectedUntil||this.inSpawn(p);}
 private living(p:PgPlayer):boolean {return p.hp>0&&this.state(p).public.life==="alive";}
 canMove(p:PgPlayer):boolean {return !this.finished&&this.subphase==="control"&&this.living(p);}
 canFire(p:PgPlayer):boolean {return this.canMove(p)&&!this.protected(p);}
 maxHp(p:PgPlayer):number {return this.hero(p).maxHp;}
 movement(p:PgPlayer):PgMovementRules {
  let slow=1,boost=1;
  for(const e of this.effects.values()){
   if(this.now<e.startsAt||this.now>=e.endsAt)continue;
   if(e.team!==p.team&&e.kind==="gravity"&&this.inEffect(p,e)&&!this.protected(p))slow=Math.min(slow,e.ability.effect.speedMultiplier??1);
   if(e.team===p.team&&e.kind==="relay"&&this.inEffect(p,e))boost=Math.max(boost,this.relayValue(e,"speedMultiplier"));
  }
  const scale=slow*boost;
  return scale===1?PG_DEFAULT_MOVEMENT_RULES:{...PG_DEFAULT_MOVEMENT_RULES,walkSpeed:PG_DEFAULT_MOVEMENT_RULES.walkSpeed*scale,crouchSpeed:PG_DEFAULT_MOVEMENT_RULES.crouchSpeed*scale,sprintSpeed:PG_DEFAULT_MOVEMENT_RULES.sprintSpeed*scale,maxSpeed:PG_DEFAULT_MOVEMENT_RULES.maxSpeed*scale};
 }
 weaponModifiers(p:PgPlayer,now:number) {
  const hero=this.hero(p),s=this.state(p);
  let reloadMultiplier=now<s.earnedReloadUntil?PG_PASSIVES["earned-reload"].reloadMultiplier:1;
  for(const e of this.effects.values())if(e.team===p.team&&e.kind==="relay"&&now>=e.startsAt&&now<e.endsAt&&this.inEffect(p,e))reloadMultiplier=Math.min(reloadMultiplier,this.relayValue(e,"reloadMultiplier"));
  const active=now<s.ultimateUntil;
  const buff=active?hero.ultimate.effect:{};
  return {...(hero.id==="cinder"?PG_CINDER_HEAT:{}),reloadMultiplier,fireIntervalMultiplier:buff.fireIntervalMultiplier??1,adsTimeMultiplier:(hero.id==="parallax"&&p.grounded&&Math.hypot(p.velocity.x,p.velocity.z)<.15&&now-s.stationarySince>=PG_PASSIVES["steady-aim"].stationaryDelayMs?PG_PASSIVES["steady-aim"].adsTimeMultiplier:1)*(buff.adsTimeMultiplier??1),precisionDamageMultiplier:buff.precisionDamageMultiplier??1,recoilMultiplier:buff.recoilMultiplier??1,coolingMultiplier:buff.coolingMultiplier??1};
 }
 knockbackMultiplier(p:PgPlayer):number {return this.hero(p).id==="cairn"?PG_PASSIVES.braced.knockbackMultiplier:1;}
 private relayValue(e:WatchEffect,key:string):number {
  const surge=[...this.effects.values()].find(s=>s.ability.id==="spindle-ultimate"&&s.ownerId===e.ownerId&&this.now>=s.startsAt&&this.now<s.endsAt);
  return surge?.ability.effect[key]??e.ability.effect[key]??1;
 }
 private inEffect(p:PgPlayer,e:WatchEffect):boolean {return pgModeDistance(p.position,e.position)<=e.radius&&this.ctx.world.visible(eye(e.position),eye(p.position));}
 private syncShield(p:PgPlayer):void {
  const s=this.state(p);s.public.shield=s.personalShield+(this.now<s.guardUntil?s.guard:0);
  for(const e of this.effects.values())if(e.targetId===p.id&&this.now<e.endsAt)s.public.shield+=e.shield;
 }
 private charge(p:PgPlayer,amount:number):void {if(amount>0&&Number.isFinite(amount))this.state(p).public.ultimate=Math.min(100,this.state(p).public.ultimate+amount/this.hero(p).ultimateCost*100);}
 damage(target:PgPlayer,attacker:PgPlayer|null,amount:number,now:number):number {
  this.now=now;
  if(!Number.isFinite(amount)||amount<=0||!this.canMove(target)||this.protected(target)||attacker?.team===target.team||attacker&&!this.canFire(attacker))return 0;
  const s=this.state(target);let remaining=amount;
  if(this.hero(target).id==="kepler"&&s.personalShield>0)remaining*=PG_PASSIVES.shielded.damageMultiplier;
  const absorb=(available:number)=>{const hit=Math.min(remaining,available);remaining-=hit;return hit;};
  const before=remaining;
  if(now<s.guardUntil)s.guard-=absorb(s.guard);
  for(const e of this.effects.values())if(e.targetId===target.id&&now>=e.startsAt&&now<e.endsAt&&e.shield>0)e.shield-=absorb(e.shield);
  s.personalShield-=absorb(s.personalShield);const hp=absorb(target.hp);target.hp-=hp;
  const effective=before-remaining;
  if(effective>0){target.lastDamageAt=now;target.lastAttacker=attacker?.id??null;s.public.interaction=null;
   if(attacker&&attacker.id!==target.id&&this.living(attacker)&&!this.protected(attacker)){
    this.charge(attacker,effective);const ledger=this.contributors.get(target.id)??new Map();const prior=ledger.get(attacker.id);
    ledger.set(attacker.id,{at:now,damage:(prior?.damage??0)+effective});this.contributors.set(target.id,ledger);
   }
  }
  this.syncShield(target);return effective;
 }
 private heal(target:PgPlayer,owner:PgPlayer,amount:number,charge=true):number {
  if(!allies(target,owner)||!this.living(target)||!this.living(owner)||amount<=0)return 0;
  const healed=Math.min(Math.max(0,this.maxHp(target)-target.hp),amount);target.hp+=healed;
  if(charge&&target.id!==owner.id&&!this.protected(owner))this.charge(owner,healed);
  return healed;
 }
 eliminated(p:PgPlayer,killer:PgPlayer|null,_weapon:PgWeaponId,now:number):void {
  this.now=now;const s=this.state(p);if(s.public.life!=="alive")return;
  s.public.life="eliminated";s.public.interaction=null;s.personalShield=0;s.guard=0;s.ultimateUntil=0;
  p.hp=0;p.respawnAt=Math.max(now+1,this.nextWave);p.velocity={x:0,y:0,z:0};
  const ledger=this.contributors.get(p.id);
  if(killer&&killer.team!==p.team&&ledger?.has(killer.id)&&this.living(killer)&&this.hero(killer).id==="cinder")this.state(killer).earnedReloadUntil=now+PG_PASSIVES["earned-reload"].durationMs;
  for(const [id,entry] of ledger??[]){const helper=this.ctx.players.get(id);if(!helper||helper.id===killer?.id||helper.team===p.team||now-entry.at>10000||this.hero(helper).id!=="spindle"||!this.living(helper))continue;
   const helperState=this.state(helper),grant=Math.min(PG_PASSIVES["assist-resource"].resourcePerAssist,PG_PASSIVES["assist-resource"].maxResourcePerLife-helperState.resourceEarned,100-helperState.resource);
   helperState.resource+=Math.max(0,grant);helperState.resourceEarned+=Math.max(0,grant);
  }
  this.contributors.delete(p.id);
  for(const e of [...this.effects.values()])if(e.ownerId===p.id||e.targetId===p.id)this.removeEffect(e,now);
  this.syncShield(p);
 }

 action(p:PgPlayer,action:PgModeAction,now:number):PgModeActionResult {
  this.now=now;const s=this.state(p);
  if(!Number.isSafeInteger(action.sequence)||action.sequence<0||action.sequence<=s.lastSequence||action.lifeId!==p.lifeId)return pgModeError("Stale hero action");
  s.lastSequence=action.sequence;
  if(this.finished)return pgModeError("Match complete");
  if(action.kind==="select")return this.select(p,action.characterId,action.loadout,now);
  if(action.kind!=="ability")return pgModeError("Unavailable hero action");
  if(!this.canFire(p))return pgModeError("Abilities require a living, unprotected hero");
  return this.activate(p,action.slot,action.targetId,action.position,now);
 }
 private select(p:PgPlayer,id:unknown,rawLoadout:unknown,now:number):PgModeActionResult {
  const hero=pgResolveHero(id),s=this.state(p);
  if(!hero)return pgModeError("Unknown hero");
  if(this.living(p)&&(!this.inSpawn(p,SWAP_RADIUS)||now-p.lastDamageAt<5000||now-Math.max(...p.guns.map(g=>g.nextFireAt))<5000))return pgModeError("Change hero in spawn after leaving combat, or while eliminated");
  if(rawLoadout!==undefined&&!pgValidateHeroLoadout(hero.id,rawLoadout))return pgModeError("Illegal hero loadout");
  const occupant=[...this.ctx.players.values()].find(other=>other.id!==p.id&&other.team===p.team&&this.state(other).public.characterId===hero.id);
  if(occupant&&!occupant.isBot)return pgModeError("Hero reserved by teammate");
  if(occupant){
   if(p.isBot)return pgModeError("Hero reserved by teammate");
   // Transfer the human's previous hero to a displaced bot atomically.
   const previous=pgResolveHero(s.public.characterId)!;this.applySelection(occupant,previous,undefined,now);
  }
  this.applySelection(p,hero,rawLoadout,now);return pgModeOk();
 }
 private applySelection(p:PgPlayer,hero:PgHeroDefinition,rawLoadout:unknown,now:number):void {
  const s=this.state(p),changed=s.public.characterId!==hero.id;
  if(changed){for(const e of [...this.effects.values()])if(e.ownerId===p.id)this.removeEffect(e,now);s.public.ultimate=0;s.ultimateUntil=0;s.guard=0;s.personalShield=0;}
  s.public.characterId=hero.id;s.public.maxHp=hero.maxHp;p.hp=Math.min(p.hp,hero.maxHp);
  const loadout=rawLoadout===undefined?pgCharacterDefaultLoadout(hero):pgValidateHeroLoadout(hero.id,rawLoadout)!;
  p.loadout=loadout;p.guns=[pgCreateGun(loadout.primary,loadout.primaryModules),pgCreateGun(loadout.secondary,loadout.secondaryModules)];p.slot=0;
  // Preserve cooldowns and resources across swaps; combat cannot refill via selection.
  this.syncShield(p);
 }
 private validGround(position:Vec3):boolean {
  const map=this.ctx.world.map;
  if(Math.abs(position.x)>map.halfWidth-PG_BALANCE.radius||Math.abs(position.z)>map.halfDepth-PG_BALANCE.radius||!pgCapsuleClear(position,PG_BALANCE.height,map))return false;
  return map.solids.some(s=>Math.abs(s.center.y+s.half.y-position.y)<.25&&Math.abs(position.x-s.center.x)<=s.half.x&&Math.abs(position.z-s.center.z)<=s.half.z);
 }
 private destination(p:PgPlayer,requested:Vec3|undefined,range:number):Vec3|null {
  const direction=pgAim(p.yaw,0),point=requested??{x:p.position.x+direction.x*range,y:p.position.y,z:p.position.z+direction.z*range};
  if(!finitePosition(point)||pgModeDistance(p.position,point)>range+.01||Math.abs(point.y-p.position.y)>.65)return null;
  return {...point};
 }
 private sweptMove(p:PgPlayer,destination:Vec3,truncate:boolean):Vec3|null {
  const from=p.position,distance=pgModeDistance(from,destination),steps=Math.max(1,Math.ceil(distance/.18));let last={...from};
  for(let i=1;i<=steps;i++){
   const t=i/steps,next={x:from.x+(destination.x-from.x)*t,y:from.y+(destination.y-from.y)*t,z:from.z+(destination.z-from.z)*t};
   if(!pgCapsuleClear(next,p.crouched?PG_BALANCE.crouchHeight:PG_BALANCE.height,this.ctx.world.map))return truncate&&pgModeDistance(from,last)>.4&&this.validGround(last)?last:null;
   last=next;
  }
  return this.validGround(last)?last:null;
 }
 private activate(p:PgPlayer,slot:0|1|2,targetId:string|undefined,requested:Vec3|undefined,now:number):PgModeActionResult {
  const s=this.state(p),hero=this.hero(p),a=slot===2?hero.ultimate:hero.abilities[slot];
  if(!a)return pgModeError("Unknown ability slot");
  if(slot===2?s.public.ultimate<100:s.public.cooldowns[slot]>now)return pgModeError("Ability not ready");
  if(a.id==="solace-beam"&&s.resource<1)return pgModeError("Healing resource empty");
  if(a.id==="spindle-shield"&&s.resource<25)return pgModeError("Shield resource empty");
  let target:PgPlayer|undefined,position={...p.position};
  if(a.target==="ally"){
   target=targetId?this.ctx.players.get(targetId):undefined;
   if(!target||target.id===p.id||!allies(p,target)||!this.living(target)||pgModeDistance(p.position,target.position)>a.range||!this.ctx.world.visible(eye(p.position),eye(target.position)))return pgModeError("Target a visible living ally in range");
   position={...target.position};
  }else if(a.target==="ground"&&a.id!=="spindle-ultimate"){
   const point=this.destination(p,requested,a.range);if(!point||!this.validGround(point)||!this.ctx.world.visible(eye(p.position),eye(point)))return pgModeError("Choose reachable visible ground in range");position=point;
  }
  if(a.primitive==="dash"||a.primitive==="blink"){
   const point=this.destination(p,requested,a.range),landing=point?this.sweptMove(p,point,a.primitive==="dash"):null;
   if(!landing)return pgModeError("Displacement path blocked");p.position=landing;p.velocity.x=0;p.velocity.z=0;position={...landing};
  }
  if(a.primitive==="barrier"){
   const facing=pgAim(p.yaw,0),alongX=Math.abs(facing.z)>=Math.abs(facing.x);
   const solid:PgSolid={id:`watch-panel-${++this.serial}`,kind:"structure",center:{...position,y:position.y+(a.effect.height??2)/2},half:{x:alongX?(a.effect.width??3)/2:(a.effect.depth??.3)/2,y:(a.effect.height??2)/2,z:alongX?(a.effect.depth??.3)/2:(a.effect.width??3)/2},mantle:false};
   if(this.ctx.world.map.solids.some(other=>Math.abs(solid.center.x-other.center.x)<solid.half.x+other.half.x-.02&&Math.abs(solid.center.y-other.center.y)<solid.half.y+other.half.y-.02&&Math.abs(solid.center.z-other.center.z)<solid.half.z+other.half.z-.02)||[...this.ctx.players.values()].some(other=>this.living(other)&&Math.abs(other.position.x-position.x)<solid.half.x+PG_BALANCE.radius&&Math.abs(other.position.z-position.z)<solid.half.z+PG_BALANCE.radius&&Math.abs(other.position.y-position.y)<2))return pgModeError("Barrier placement overlaps an obstacle or player");
   this.replaceOwned(a.id,p.id,now);
   if(!this.ctx.world.add({id:solid.id,solid,hp:a.deployableHp,maxHp:a.deployableHp,reinforced:false,active:true,revision:0},now))return pgModeError("Barrier placement failed");
   this.addEffect(p,a,position,now,undefined,solid.id);
  }else if(a.primitive==="pulse"){
   const facing=pgAim(p.yaw,0);
   for(const enemy of this.ctx.players.values())if(enemy.team!==p.team&&this.living(enemy)&&pgModeDistance(p.position,enemy.position)<=a.range&&this.ctx.world.visible(eye(p.position),eye(enemy.position))){
    const distance=Math.max(.01,Math.hypot(enemy.position.x-p.position.x,enemy.position.z-p.position.z)),dx=(enemy.position.x-p.position.x)/distance,dz=(enemy.position.z-p.position.z)/distance;
    if(dx*facing.x+dz*facing.z<(a.effect.coneCosine??0))continue;
    this.ctx.damage(enemy,p,a.effect.damage??0,now);
    if(this.living(enemy)&&!this.protected(enemy)){const power=(a.effect.knockback??0)*this.knockbackMultiplier(enemy);enemy.velocity.x=clamp(enemy.velocity.x+dx*power,-12.6,12.6);enemy.velocity.z=clamp(enemy.velocity.z+dz*power,-12.6,12.6);}
   }
   this.addEffect(p,a,position,now);
  }else if(a.primitive==="guard"){
   s.guard=a.effect.absorptionCap??0;s.guardUntil=now+a.durationMs;this.addEffect(p,a,position,now,p.id);this.syncShield(p);
  }else if(a.primitive==="shield"){
   if(target){
    // One shield family per target; strongest replaces weaker without additive stacking.
    for(const e of [...this.effects.values()])if(e.targetId===target.id&&e.ability.id===a.id)this.removeEffect(e,now);
    const e=this.addEffect(p,a,position,now,target.id);e.shield=Math.min(a.effect.shieldCap??60,a.effect.shield??0);this.syncShield(target);s.resource-=25;
   }else for(const ally of this.ctx.players.values())if(ally.team===p.team&&this.living(ally)&&pgModeDistance(p.position,ally.position)<=a.radius&&this.ctx.world.visible(eye(p.position),eye(ally.position))){
    for(const e of [...this.effects.values()])if(e.targetId===ally.id&&e.ability.id===a.id)this.removeEffect(e,now);
    const e=this.addEffect(p,a,ally.position,now,ally.id);e.shield=Math.min(a.effect.shieldCap??100,a.effect.shield??0);this.syncShield(ally);
   }
  }else if(a.primitive==="weapon-buff"){
   s.ultimateUntil=now+a.durationMs;this.addEffect(p,a,position,now,p.id);
  }else if(a.id==="spindle-ultimate"){
   const relay=[...this.effects.values()].find(e=>e.ownerId===p.id&&e.ability.id==="spindle-relay"&&now<e.endsAt&&pgModeDistance(p.position,e.position)<=a.range);
   if(!relay)return pgModeError("Deploy a nearby relay first");position={...relay.position};this.addEffect(p,a,position,now);
  }else if(a.primitive==="recon"){
   this.replaceOwned(a.id,p.id,now);const effect=this.addEffect(p,a,position,now);this.scan(p,effect,now);effect.pulled=true;
  }else if(a.primitive!=="dash"&&a.primitive!=="blink"){
   this.replaceOwned(a.id,p.id,now);this.addEffect(p,a,position,now,target?.id);
  }else this.addEffect(p,a,position,now);
  if(slot===2)s.public.ultimate=0;else {s.public.cooldowns[slot]=now+a.cooldownMs;s.public.charges[slot]=0;}
  return pgModeOk();
 }
 private scan(owner:PgPlayer,e:WatchEffect,now:number):void {
  const a=e.ability,facing=pgAim(owner.yaw,0);
  for(const target of this.ctx.players.values())if(target.team!==owner.team&&this.living(target)&&pgModeDistance(owner.position,target.position)<=a.range&&this.ctx.world.visible(eye(owner.position),eye(target.position))){
   const distance=Math.max(.01,pgModeDistance(owner.position,target.position)),dot=((target.position.x-owner.position.x)*facing.x+(target.position.z-owner.position.z)*facing.z)/distance;
   if(dot>=(a.effect.coneCosine??0))this.intel[owner.team].set(target.id,{targetId:target.id,position:{...target.position},at:now,expiresAt:now+(a.effect.intelExpiryMs??2000)});
  }
 }
 private replaceOwned(abilityId:string,ownerId:string,now:number):void {for(const e of [...this.effects.values()])if(e.ownerId===ownerId&&e.ability.id===abilityId)this.removeEffect(e,now);}
 private addEffect(p:PgPlayer,a:PgAbilityDefinition,position:Vec3,now:number,targetId?:string,id?:string):WatchEffect {
  const kind:PgModeEffect["kind"]=a.primitive==="field"?(a.effect.damagePerSecond?"heat":a.effect.healingPerSecond?"heal":"gravity"):a.primitive==="heal-beam"||a.primitive==="beacon"?"heal":a.primitive==="recon"?"recon":a.primitive==="relay"?"relay":"shield";
  const e:WatchEffect={id:id??`watch-${++this.serial}`,kind,ownerId:p.id,team:p.team,position:{...position},radius:a.radius,startsAt:now+a.warningMs,endsAt:now+a.warningMs+Math.max(a.durationMs,350),hp:a.deployableHp,maxHp:a.deployableHp,ability:a,targetId,pool:a.effect.healingPool??Infinity,caps:new Map(),pulled:false,shield:0};
  this.effects.set(e.id,e);return e;
 }
 private removeEffect(e:WatchEffect,now:number):void {
  this.effects.delete(e.id);
  if(e.ability.id==="spindle-relay")for(const surge of [...this.effects.values()])if(surge.ownerId===e.ownerId&&surge.ability.id==="spindle-ultimate")this.removeEffect(surge,now);
  if(e.ability.primitive==="barrier")this.ctx.world.damage(e.id,Number.MAX_SAFE_INTEGER,now,true);
  if(e.targetId){const target=this.ctx.players.get(e.targetId);if(target)this.syncShield(target);}
 }
 private clearEffects(now:number):void {for(const e of [...this.effects.values()])this.removeEffect(e,now);}

 update(dt:number,now:number):void {
  this.now=now;if(this.finished||!Number.isFinite(dt)||dt<0)return;
  // Simulation grants no more than a bounded step, even after a paused event loop.
  dt=Math.min(dt,.25);
  if(this.subphase==="round-break"){if(now>=this.deadline){this.round++;this.beginRound(now);}return;}
  this.assignRoster();
  for(const p of this.ctx.players.values()){
   const s=this.state(p);
   if(this.living(p)){
    if(Math.hypot(p.velocity.x,p.velocity.z)>=.15||!p.grounded)s.stationarySince=now;
    if(s.guardUntil<=now)s.guard=0;
    const beaming=[...this.effects.values()].some(e=>e.ownerId===p.id&&e.ability.primitive==="heal-beam");
    if(!beaming)s.resource=Math.min(100,s.resource+15*dt);
    if(this.hero(p).id==="solace"&&now-p.lastDamageAt>=PG_PASSIVES.recovery.combatDelayMs)this.heal(p,p,PG_PASSIVES.recovery.healingPerSecond*dt,false);
   }
   for(const slot of [0,1] as const)if(now>=s.public.cooldowns[slot])s.public.charges[slot]=1;
   this.syncShield(p);
  }
  this.updateEffects(dt,now);
  if(now>=this.nextWave){
   for(const p of this.ctx.players.values())if(this.state(p).public.life==="eliminated")this.spawn(p,now);
   this.nextWave=now+WAVE_MS;
  }
  for(const team of ["solar","void"] as const)for(const [id,value] of this.intel[team])if(value.expiresAt<=now)this.intel[team].delete(id);
  this.updateControl(dt,now);
 }
 private updateEffects(dt:number,now:number):void {
  for(const e of [...this.effects.values()]){
   const owner=this.ctx.players.get(e.ownerId);
   if(!owner||!this.living(owner)||now>=e.endsAt||(e.maxHp>0&&e.hp<=0)){this.removeEffect(e,now);continue;}
   if(now<e.startsAt)continue;
   const a=e.ability;
   if(e.targetId){
    const target=this.ctx.players.get(e.targetId);
    if(!target||!this.living(target)){this.removeEffect(e,now);continue;}
    e.position={...target.position};
    if(a.lineOfSight==="continuous"&&(pgModeDistance(owner.position,target.position)>a.range||!this.ctx.world.visible(eye(owner.position),eye(target.position)))){this.removeEffect(e,now);continue;}
    if(a.primitive==="heal-beam"){
     const state=this.state(owner),seconds=Math.min(dt,state.resource/(a.effect.resourcePerSecond??25));
     this.heal(target,owner,(a.effect.healingPerSecond??0)*seconds);state.resource=Math.max(0,state.resource-(a.effect.resourcePerSecond??25)*seconds);
     if(state.resource<=0)this.removeEffect(e,now);
    }else if(a.primitive==="shield"&&a.effect.rechargePerSecond){e.shield=Math.min(a.effect.shieldCap??60,e.shield+a.effect.rechargePerSecond*dt);this.syncShield(target);}
   }
   if(a.primitive==="field"||a.primitive==="beacon"){
    for(const target of this.ctx.players.values())if(this.living(target)&&this.inEffect(target,e)){
     if(target.team!==owner.team){
      if(a.effect.damagePerSecond&&!this.protected(owner))this.ctx.damage(target,owner,a.effect.damagePerSecond*dt,now);
      if(a.effect.pullDistance&&!e.pulled&&!this.protected(target)){
       const distance=Math.hypot(target.position.x-e.position.x,target.position.z-e.position.z),pull=Math.min(a.effect.pullDistance,Math.max(0,distance-.75));
       if(distance>.01){const point={x:target.position.x+(e.position.x-target.position.x)/distance*pull,y:target.position.y,z:target.position.z+(e.position.z-target.position.z)/distance*pull};const landing=this.sweptMove(target,point,true);if(landing)target.position=landing;}
      }
     }else if(a.effect.healingPerSecond){
      const used=e.caps.get(target.id)??0,remaining=(a.effect.healingCapPerTarget??Infinity)-used,amount=Math.min(a.effect.healingPerSecond*dt,remaining,e.pool);
      const healed=this.heal(target,owner,amount);e.pool-=healed;e.caps.set(target.id,used+healed);
     }
    }
    if(a.effect.pullDistance)e.pulled=true;
    if(e.pool<=0)this.removeEffect(e,now);
   }
  }
 }
 private updateControl(dt:number,now:number):void {
  const point=PG_OBJECTIVES.relay[(this.round-1)%PG_OBJECTIVES.relay.length];
  const present:Record<PgTeam,PgPlayer[]>={solar:[],void:[]};
  for(const p of this.ctx.players.values())if(this.living(p)&&!this.protected(p)&&pgModeDistance(p.position,point.position)<=point.radius)present[p.team].push(p);
  this.contested=present.solar.length>0&&present.void.length>0;
  if(this.contested)return;
  const team=present.solar.length?"solar":present.void.length?"void":null;
  if(team){
   const other=team==="solar"?"void":"solar";
   if(this.owner!==team){this.capture[team]=Math.min(100,this.capture[team]+dt*100000/CAPTURE_MS);this.capture[other]=Math.max(0,this.capture[other]-dt*100000/CAPTURE_MS);if(this.capture[team]>=100){this.owner=team;this.capture[other]=0;}}
   else this.progress[team]=Math.min(100,this.progress[team]+dt*PROGRESS_PER_SECOND);
   for(const p of present[team]){this.state(p).public.contribution+=dt;this.charge(p,dt*6);}
  }else if(this.owner)this.progress[this.owner]=Math.min(100,this.progress[this.owner]+dt*PROGRESS_PER_SECOND);
  const scoring=this.owner;
  if(scoring&&this.progress[scoring]>=100){
   this.scores[scoring]++;this.clearEffects(now);this.intel={solar:new Map(),void:new Map()};
   if(this.scores[scoring]>=2){this.finished=true;this.subphase="results";this.ctx.finish(scoring);}
   else {this.subphase="round-break";this.deadline=now+5000;}
  }
 }
 snapshot(viewerId?:string):WatchSnapshot {
  const viewer=viewerId?this.ctx.players.get(viewerId):undefined;
  const effects=[...this.effects.values()].filter(e=>e.kind!=="recon"||e.team===viewer?.team).map(e=>({id:e.id,kind:e.kind,ownerId:e.ownerId,team:e.team,position:{...e.position},...(e.ability.primitive==="heal-beam"?{end:{...this.ctx.players.get(e.ownerId)!.position}}:{}),radius:e.radius,startsAt:e.startsAt,endsAt:e.endsAt,hp:e.hp,maxHp:e.maxHp}));
  const pilots:Record<string,PgModePilot>={};for(const [id,s] of this.pilots)pilots[id]=structuredClone(s.public);
  return {id:this.id,collision:this.ctx.world.snapshot(),effects,pilots,round:this.round,subphase:this.subphase,deadline:this.deadline,control:{owner:this.owner,capture:{...this.capture},progress:{...this.progress},contested:this.contested,point:(this.round-1)%3},roundScores:{...this.scores},intel:viewer?[...this.intel[viewer.team].values()].map(i=>({...i,position:{...i.position}})):[]};
 }
 botGoal(p:PgPlayer,_now:number):Vec3|null {
  if(!this.canMove(p))return null;
  const point=PG_OBJECTIVES.relay[(this.round-1)%3].position,hero=this.hero(p);
  if(hero.role==="support"){
   const wounded=[...this.ctx.players.values()].filter(other=>other.id!==p.id&&other.team===p.team&&this.living(other)&&other.hp<this.maxHp(other)*.65&&pgModeDistance(other.position,point)<20).sort((a,b)=>a.hp/this.maxHp(a)-b.hp/this.maxHp(b))[0];
   if(wounded&&pgModeDistance(p.position,wounded.position)>7)return {...wounded.position};
  }
  const index=PG_HERO_IDS.indexOf(hero.id),angle=index/6*Math.PI*2;
  return {x:point.x+Math.cos(angle)*2.2,y:point.y,z:point.z+Math.sin(angle)*2.2};
 }
 botAction(p:PgPlayer,now:number):void {
  this.now=now;const s=this.state(p);if(!this.canFire(p)||now<s.nextBotAt)return;s.nextBotAt=now+700;
  const hero=this.hero(p),enemy=[...this.ctx.players.values()].filter(other=>other.team!==p.team&&this.living(other)&&!this.protected(other)&&this.ctx.world.visible(eye(p.position),eye(other.position))).sort((a,b)=>pgModeDistance(a.position,p.position)-pgModeDistance(b.position,p.position))[0];
  const ally=[...this.ctx.players.values()].filter(other=>other.id!==p.id&&other.team===p.team&&this.living(other)&&this.ctx.world.visible(eye(p.position),eye(other.position))).sort((a,b)=>a.hp/this.maxHp(a)-b.hp/this.maxHp(b))[0];
  if(s.public.ultimate>=100&&(enemy||ally&&ally.hp<this.maxHp(ally)*.65))this.activate(p,2,undefined,enemy?.position,now);
  for(const slot of [0,1] as const){
   const a=hero.abilities[slot];if(s.public.cooldowns[slot]>now)continue;
   if(a.target==="ally"){if(ally&&(a.primitive==="shield"||ally.hp<this.maxHp(ally)*.8))this.activate(p,slot,ally.id,undefined,now);continue;}
   if(a.primitive==="beacon"||a.primitive==="relay"){const ground=this.findNearbyGround(p,2);if(ground)this.activate(p,slot,undefined,ground,now);continue;}
   if(!enemy)continue;
   const distance=pgModeDistance(p.position,enemy.position);
   if(a.primitive==="field"&&distance<=a.range)this.activate(p,slot,undefined,enemy.position,now);
   else if(a.primitive==="pulse"&&distance<=a.range)this.activate(p,slot,undefined,undefined,now);
   else if(a.primitive==="recon"||a.primitive==="guard")this.activate(p,slot,undefined,undefined,now);
   else if(a.primitive==="barrier"){const ground=this.findNearbyGround(p,3);if(ground)this.activate(p,slot,undefined,ground,now);}
   else if((a.primitive==="dash"||a.primitive==="blink")&&distance>7){const direction=pgAim(p.yaw,0),point={x:p.position.x+direction.x*a.range,y:p.position.y,z:p.position.z+direction.z*a.range};this.activate(p,slot,undefined,point,now);}
  }
 }
 private findNearbyGround(p:PgPlayer,distance:number):Vec3|null {
  for(const turn of [0,Math.PI/2,-Math.PI/2,Math.PI]){const direction=pgAim(p.yaw+turn,0),point={x:p.position.x+direction.x*distance,y:p.position.y,z:p.position.z+direction.z*distance};if(this.validGround(point))return point;}return null;
 }
 targets(shooter:PgPlayer):PgModeTarget[] {
  return [...this.effects.values()].filter(e=>e.maxHp>0&&e.hp>0&&e.team!==shooter.team).map(e=>({id:e.id,kind:e.ability.primitive==="barrier"?"panel":"gadget",position:{...e.position,y:e.position.y+(e.ability.primitive==="barrier"?1:.45)},half:e.ability.primitive==="barrier"?this.ctx.world.snapshot().panels.find(panel=>panel.id===e.id)?.solid.half:{x:.4,y:.45,z:.4},damage:(amount:number,attacker:PgPlayer,now:number)=>{
   if(!Number.isFinite(amount)||amount<=0||attacker.team===e.team||!this.canFire(attacker)||!this.effects.has(e.id))return 0;
   const actual=e.ability.primitive==="barrier"?this.ctx.world.damage(e.id,amount,now):Math.min(e.hp,amount);e.hp=Math.max(0,e.hp-actual);if(e.hp<=0)this.removeEffect(e,now);return actual;
  }}));
 }
 leave(id:string,now:number):void {
  for(const e of [...this.effects.values()])if(e.ownerId===id||e.targetId===id)this.removeEffect(e,now);
  this.pilots.delete(id);this.contributors.delete(id);for(const team of ["solar","void"] as const)this.intel[team].delete(id);
 }
}
