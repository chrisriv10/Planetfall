import {PG_ZOMBIE_DOORS,PG_ZOMBIE_ENTRIES,PG_ZOMBIE_QUARANTINE_WINGS,PG_BALANCE,PG_DOWNED_MOVEMENT_RULES,PG_TACTICAL_MOVEMENT_RULES,PG_OBJECTIVES,PG_PANEL_SOCKETS,pgCreateGun,pgDamage,pgFinishReload,pgGunProfile,pgSpawnMotion,pgStartReload,pgStepMovement,type PgInput,type PgModeAction,type PgModeActionResult,type PgModeSnapshot,type PgPlayer,type PgWeaponId,type PgZombie,type PgZombiePilot,type PgMotion,type Vec3} from "@planetfall/shared";
import type {PgModeContext,PgModeRuntime,PgModeTarget} from "./pg-mode-runtime.js";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";

const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const eye=(p:Vec3)=>({...p,y:p.y+1});
const START={x:-28,y:0,z:-9};
export const PG_ZOMBIE_RULES=Object.freeze({activeCap:32,intermissionMs:9000,bleedoutMs:25000,reviveMs:3500,soloRecoveryMs:5000,spawnIntervalMs:450,maxPoints:50000});
import {PG_ZOMBIE_PRICES} from "@planetfall/shared";
export {PG_ZOMBIE_PRICES} from "@planetfall/shared";
const ARCHETYPES={drifter:{hp:85,speed:2.3,damage:22,windup:650,cooldown:1300},skitter:{hp:55,speed:3.9,damage:14,windup:420,cooldown:1000},bulwark:{hp:240,speed:1.65,damage:38,windup:1050,cooldown:1900}} as const;
const STAMINA_MOVEMENT=Object.freeze({...PG_TACTICAL_MOVEMENT_RULES,sprintSpeed:PG_TACTICAL_MOVEMENT_RULES.sprintSpeed*1.15,maxSpeed:PG_TACTICAL_MOVEMENT_RULES.maxSpeed*1.15});
interface Infected extends PgZombie {motion:PgMotion;targetId:string|null;nextThink:number;nextAttack:number;lastMovedAt:number;lastPosition:Vec3;destination:Vec3|null;recoveryAt:number;}
interface HeldInteraction {targetId:string;startedAt:number;durationMs:number;damageAt:number;origin:Vec3;}

/** Run-local PvE authority. Zombies never enter the room's player roster. */
export class PgZombies implements PgModeRuntime {
 readonly id="planetzombies" as const;
 private pilots=new Map<string,PgZombiePilot>();
 private zombies=new Map<string,Infected>();
 private interactions=new Map<string,HeldInteraction>();
 private sequences=new Map<string,number>();
 private navigation:PgZombieNavigation;
 private unlocked=new Set<string>();
 private wave=0;private queued=0;private nextSpawn=0;private serial=0;
 private subphase:"intermission"|"wave"|"defeated"="intermission";
 private deadline=0;private power=false;private reason:string|null=null;
 private soloRecoverAt=0;
 private shotSerial=0;private recoveryCandidates:{at:number;revision:number;points:Vec3[]}|null=null;
 constructor(private ctx:PgModeContext){this.navigation=new PgZombieNavigation(ctx.world.map);}
 start(now:number):void {
  this.pilots.clear();this.zombies.clear();this.interactions.clear();this.sequences.clear();this.unlocked.clear();
  this.wave=0;this.queued=0;this.serial=0;this.recoveryCandidates=null;this.shotSerial=0;this.power=false;this.reason=null;this.soloRecoverAt=0;this.subphase="intermission";this.deadline=now+4000;
  this.ctx.world.reset([...PG_ZOMBIE_DOORS.map(s=>({id:s.id,solid:structuredClone(s.solid),active:true,hp:1000000,maxHp:1000000,reinforced:true,revision:0})),...PG_ZOMBIE_QUARANTINE_WINGS.map(solid=>({id:solid.id,solid:structuredClone(solid),active:true,hp:1000000,maxHp:1000000,reinforced:true,revision:0}))],now);
  this.navigation.update(this.ctx.world.map,this.ctx.world.revision);
  const solo=this.ctx.players.size===1;
  let i=0;
  for(const player of this.ctx.players.values()){
   player.team="solar";
   const state:PgZombiePilot={life:"alive",maxHp:100,shield:0,characterId:null,side:"defend",credits:0,armor:0,cooldowns:[0,0],charges:[0,0],ultimate:0,contribution:0,interaction:null,points:500,upgrade:0,perks:[],primaryUnlocked:false,bleedoutAt:0,selfRecovery:solo,revives:0,purchases:0};
   this.pilots.set(player.id,state);this.recoveryLoadout(player,now,{x:START.x+(i++%2)*1.4,y:0,z:START.z+Math.floor((i-1)/2)*1.4});
  }
 }
 private recoveryLoadout(player:PgPlayer,now:number,position:Vec3=START):void {
  this.ctx.respawn(player,now,{primary:"pulse",secondary:"orbit",primaryModules:[],secondaryModules:[]},position);
  const state=this.pilots.get(player.id)!;state.life="alive";state.primaryUnlocked=false;state.upgrade=0;state.bleedoutAt=0;
  player.hp=this.maxHp(player);player.slot=1;player.guns[0].magazine=player.guns[0].reserve=0;player.guns[1].reserve=30;
 }
 canMove(player:PgPlayer):boolean{const p=this.pilots.get(player.id);return this.subphase!=="defeated"&&!!p&&p.life!=="eliminated";}
 canFire(player:PgPlayer):boolean{return this.subphase!=="defeated"&&this.pilots.get(player.id)?.life==="alive"&&!this.interactions.has(player.id)&&this.allowSlot(player,player.slot);}
 allowSlot(player:PgPlayer,slot:0|1):boolean{return slot===1||this.pilots.get(player.id)?.primaryUnlocked===true;}
 movement(player:PgPlayer){const p=this.pilots.get(player.id);if(p?.life==="downed")return PG_DOWNED_MOVEMENT_RULES;return p?.perks.includes("perk-stamina")?STAMINA_MOVEMENT:PG_TACTICAL_MOVEMENT_RULES;}
 maxHp(player:PgPlayer):number{return this.pilots.get(player.id)?.perks.includes("perk-vitality")?160:100;}
 weaponModifiers(player:PgPlayer):{damage:number;reload:number;interval:number}{const p=this.pilots.get(player.id);return {damage:1+(p?.upgrade??0)*.35,reload:(p?.perks.includes("perk-reload")?.75:1)*(1-(p?.upgrade??0)*.05),interval:1-(p?.upgrade??0)*.06};}
 damage(target:PgPlayer,attacker:PgPlayer|null,amount:number,now:number):number {
  const state=this.pilots.get(target.id);
  if(!state||state.life!=="alive"||this.subphase==="defeated"||!Number.isFinite(amount)||amount<=0||attacker||now<target.protectedUntil)return 0;
  const effective=Math.min(target.hp,amount);target.hp-=effective;target.lastDamageAt=now;target.lastAttacker=null;
  if(effective)this.cancelInteraction(target.id);return effective;
 }
 eliminated(player:PgPlayer,_killer:PgPlayer|null,_weapon:PgWeaponId,now:number):void {
  const state=this.pilots.get(player.id);if(!state||state.life!=="alive"||this.subphase==="defeated")return;
  this.cancelInteraction(player.id);state.life="downed";state.bleedoutAt=now+PG_ZOMBIE_RULES.bleedoutMs;
  // Positive HP preserves authoritative crawl input; the explicit life state gates weapons/interactions.
  player.hp=1;player.respawnAt=0;player.protectedUntil=0;player.velocity={x:0,y:0,z:0};player.slot=1;
  this.resolveDefeat(now);
 }
 update(dt:number,now:number):void {
  if(this.subphase==="defeated"||!Number.isFinite(dt)||dt<0)return;
  this.navigation.update(this.ctx.world.map,this.ctx.world.revision);
  for(const [id,state]of this.pilots){
   const player=this.ctx.players.get(id);if(!player)continue;
   if(state.life==="downed"&&now>=state.bleedoutAt){state.life="eliminated";state.bleedoutAt=0;player.hp=0;player.respawnAt=0;}
   if(state.life==="alive"&&state.perks.includes("perk-stamina"))player.ion=Math.min(100,player.ion+12*Math.min(dt,.1));
  }
  this.updateInteractions(now);
  if(this.soloRecoverAt&&now>=this.soloRecoverAt){
   this.soloRecoverAt=0;const entry=[...this.pilots].find(([,s])=>s.life==="downed");
   if(entry){const player=this.ctx.players.get(entry[0]);if(player)this.revive(player,now);}
  }
  this.resolveDefeat(now);if(this.reason!==null)return;
  if(this.subphase==="intermission"){if(now>=this.deadline)this.beginWave(now);else return;}
  if(this.queued>0&&this.zombies.size<PG_ZOMBIE_RULES.activeCap&&now>=this.nextSpawn){if(this.spawn(now)){this.queued--;this.nextSpawn=now+Math.max(120,PG_ZOMBIE_RULES.spawnIntervalMs-this.wave*12);}else this.nextSpawn=now+300;}
  for(const zombie of this.zombies.values())this.updateZombie(zombie,Math.min(dt,1/30),now);
  if(this.queued===0&&this.zombies.size===0){
   this.subphase="intermission";this.deadline=now+PG_ZOMBIE_RULES.intermissionMs;
   const living=[...this.ctx.players.values()].find(p=>this.pilots.get(p.id)?.life==="alive");
   for(const [id,state]of this.pilots){
    this.award(id,200+Math.min(400,this.wave*25));const player=this.ctx.players.get(id);
    if(player&&state.life==="eliminated")this.recoveryLoadout(player,now,living?.position??START);
   }
  }
 }
 private beginWave(now:number):void {this.wave++;this.subphase="wave";this.deadline=0;this.queued=Math.min(180,5+this.wave*3+Math.max(0,this.pilots.size-1)*(2+Math.floor(this.wave*.8)));this.nextSpawn=now;}
 private spawn(now:number):boolean {
  const survivors=[...this.ctx.players.values()].filter(p=>this.pilots.get(p.id)?.life==="alive");if(!survivors.length)return false;
  // Authored map waypoints are supported and share the exact current collision graph.
  const goals=survivors.map(target=>({target,goal:this.navigation.nearest(target.position)})).filter((entry):entry is {target:PgPlayer;goal:number}=>entry.goal!==null);if(!goals.length){const target=survivors[this.serial%survivors.length],entries=PG_ZOMBIE_ENTRIES.filter(position=>this.navigation.supported(position)&&this.navigation.reachable(position,target.position)&&survivors.every(p=>distance(p.position,position)>=3.5));const position=entries[this.serial%entries.length];if(!position)return false;return this.spawnAt(position,target,now);}const {target,goal}=goals[this.serial%goals.length];
  const field=this.navigation.field(goal);
  const entryNodes=[...this.ctx.world.map.navigation,...PG_ZOMBIE_ENTRIES.map((position,id)=>({id:this.navigation.nearest(position)??-1,position,links:[]}))];
  const safeDistance=entryNodes.some(n=>field.has(n.id)&&this.navigation.supported(n.position)&&survivors.every(p=>distance(p.position,n.position)>=5))?5:3.5;
  const candidates=entryNodes.filter(n=>field.has(n.id)&&this.navigation.supported(n.position)&&survivors.every(p=>distance(p.position,n.position)>=safeDistance)).map(node=>({node,score:Math.min(...survivors.map(p=>distance(p.position,node.position)))+(survivors.every(p=>!this.ctx.world.visible(eye(p.position),eye(node.position)))?40:0)}));
  candidates.sort((a,b)=>b.score-a.score);
  // A camper cannot freeze spawning: choose a valid reachable entrance, including a visible one.
  const entry=candidates[this.serial%Math.min(4,candidates.length)]?.node;if(!entry)return false;
  return this.spawnAt(entry.position,target,now);
 }
 private spawnAt(position:Vec3,target:PgPlayer,now:number):boolean {
  const kind:PgZombie["kind"]=this.wave>=3&&this.serial%7===0?"bulwark":this.wave>=2&&this.serial%3===0?"skitter":"drifter";
  const stats=ARCHETYPES[kind],hp=Math.round(stats.hp*(1+Math.min(2,(this.wave-1)*.12))),motion=pgSpawnMotion(position);
  const zombie:Infected={id:`zombie-${++this.serial}`,kind,position:motion.position,yaw:0,hp,maxHp:hp,windupUntil:0,motion,targetId:target.id,nextThink:now,nextAttack:now+700,lastMovedAt:now,lastPosition:{...position},destination:null,recoveryAt:now+12000};
  this.zombies.set(zombie.id,zombie);return true;
 }
 private updateZombie(z:Infected,dt:number,now:number):void {
  const stats=ARCHETYPES[z.kind];
  if(now>=z.nextThink){
   z.nextThink=now+350+(Number(z.id.slice(7))%5)*25;
   const choices=[...this.ctx.players.values()].filter(p=>this.pilots.get(p.id)?.life==="alive");
   choices.sort((a,b)=>distance(z.position,a.position)-distance(z.position,b.position));
   const target=choices.find(p=>this.navigation.reachable(z.position,p.position));
   z.targetId=target?.id??null;z.destination=target?this.navigation.destination(z.position,target.position):null;
  }
  const target=z.targetId?this.ctx.players.get(z.targetId):undefined;
  if(target&&z.windupUntil){
   if(now>=z.windupUntil){z.lastMovedAt=now;z.windupUntil=0;z.nextAttack=now+stats.cooldown;
    if(this.pilots.get(target.id)?.life==="alive"&&distance(z.position,target.position)<2.1&&this.ctx.world.visible(eye(z.position),eye(target.position))){
     this.ctx.damage(target,null,stats.damage+Math.min(15,this.wave),now);
     if(z.kind==="bulwark"&&this.pilots.get(target.id)?.life==="alive"){
      const n=Math.max(.1,distance(z.position,target.position)),next={x:target.position.x+(target.position.x-z.position.x)/n*.8,y:target.position.y,z:target.position.z+(target.position.z-z.position.z)/n*.8};
      if(this.navigation.clear(target.position,next))target.position=next;
     }
    }
   }
   return;
  }
  if(target&&this.pilots.get(target.id)?.life==="alive"&&distance(z.position,target.position)<1.65&&now>=z.nextAttack&&this.ctx.world.visible(eye(z.position),eye(target.position))){z.windupUntil=now+stats.windup;return;}
  if(dt>0&&z.destination){
   let dx=z.destination.x-z.position.x,dz=z.destination.z-z.position.z;
   for(const other of this.zombies.values()){if(other===z)continue;const d=distance(z.position,other.position);if(d>.01&&d<.9){dx+=(z.position.x-other.position.x)/d*.6;dz+=(z.position.z-other.position.z)/d*.6;}}
   const n=Math.hypot(dx,dz),yaw=Math.atan2(-dx,-dz),speed=stats.speed*(1+Math.min(.35,this.wave*.015));
   const input:PgInput={sequence:0,moveX:0,moveZ:-Math.min(1,n/.4),yaw,pitch:0,jump:false,sprint:false,crouch:false,ads:false};
   const rules={...PG_TACTICAL_MOVEMENT_RULES,mantle:false,jump:false,walkSpeed:speed,maxSpeed:speed};
   pgStepMovement(z.motion,input,dt,now,this.ctx.world.map,rules);z.position=z.motion.position;z.yaw=yaw;
  }
  if(distance(z.lastPosition,z.position)>.6){z.lastPosition={...z.position};z.lastMovedAt=now;}
  if((z.position.y< -3||Math.abs(z.position.x)>47||Math.abs(z.position.z)>39||now-z.lastMovedAt>12000)&&now>=z.recoveryAt){
   z.recoveryAt=now+700+(Number(z.id.slice(7))%7)*80;
   if(!this.recoveryCandidates||now-this.recoveryCandidates.at>500||this.recoveryCandidates.revision!==this.ctx.world.revision){const living=[...this.ctx.players.values()].filter(p=>this.pilots.get(p.id)?.life==="alive");this.recoveryCandidates={at:now,revision:this.ctx.world.revision,points:this.ctx.world.map.navigation.filter(n=>this.navigation.supported(n.position)&&living.every(p=>distance(p.position,n.position)>7&&!this.ctx.world.visible(eye(p.position),eye(n.position)))).map(n=>n.position)};}
   const point=this.recoveryCandidates.points.find(position=>target&&this.navigation.reachable(position,target.position));
   if(point){z.motion=pgSpawnMotion(point);z.position=z.motion.position;z.lastPosition={...z.position};z.lastMovedAt=now;z.nextThink=now;}
   else if(now-z.lastMovedAt>22000){this.zombies.delete(z.id);this.queued++;} // Explicit replacement, never silently discard a required enemy.
  }
 }
 targets(shooter:PgPlayer):PgModeTarget[]{if(!this.canFire(shooter))return [];return [...this.zombies.values()].map(z=>({id:z.id,kind:"zombie",position:z.position,crouched:false,damage:(amount,p,now)=>this.hitZombie(z.id,amount,p,now)}));}
 private hitZombie(id:string,amount:number,shooter:PgPlayer,_now:number):number {
  const z=this.zombies.get(id),state=this.pilots.get(shooter.id);if(!z||!state||state.life!=="alive"||!Number.isFinite(amount)||amount<=0)return 0;
  const hit=Math.min(z.hp,amount);z.hp-=hit;state.contribution+=hit;this.award(shooter.id,Math.max(1,Math.round(hit*.12)));
  if(z.hp<=0){this.zombies.delete(id);shooter.kills++;this.award(shooter.id,z.kind==="bulwark"?100:60);}return hit;
 }
 private award(id:string,amount:number){const s=this.pilots.get(id);if(s)s.points=Math.min(PG_ZOMBIE_RULES.maxPoints,s.points+amount);}
 private near(player:PgPlayer,position:Vec3,range=3):boolean{return distance(player.position,position)<=range&&this.ctx.world.visible(eye(player.position),eye(position));}
 action(player:PgPlayer,action:PgModeAction,now:number):PgModeActionResult {
  const state=this.pilots.get(player.id);
  if(!state||!action||!Number.isSafeInteger(action.sequence)||action.sequence<0||action.sequence<=(this.sequences.get(player.id)??-1)||action.lifeId!==player.lifeId)return {ok:false,error:"Stale run action"};
  this.sequences.set(player.id,action.sequence);
  if(this.subphase==="defeated"||state.life!=="alive")return {ok:false,error:"A living survivor is required"};
  if(action.kind==="buy")return typeof action.itemId==="string"?this.buy(player,action.itemId,now):{ok:false,error:"Malformed run purchase"};
  if(action.kind==="interact"){
   if(typeof action.targetId!=="string"||typeof action.held!=="boolean")return {ok:false,error:"Malformed interaction"};
   if(!action.held){this.cancelInteraction(player.id);return {ok:true};}
   if(action.targetId==="power"){
    if(this.power||!this.near(player,PG_OBJECTIVES.power))return {ok:false,error:"Reach the station power console"};
    this.hold(player,"power",now,2000);return {ok:true};
   }
   const target=this.ctx.players.get(action.targetId.replace(/^revive:/,""));
   if(!target||target.id===player.id||this.pilots.get(target.id)?.life!=="downed"||!this.near(player,target.position,2.4))return {ok:false,error:"Reach a downed teammate"};
   this.hold(player,`revive:${target.id}`,now,PG_ZOMBIE_RULES.reviveMs);return {ok:true};
  }
  return {ok:false,error:"Action unavailable in PlanetZombies"};
 }
 private buy(player:PgPlayer,itemId:string,now:number):PgModeActionResult {
  const state=this.pilots.get(player.id)!;
  let price=0,apply:(()=>void)|null=null;
  const rack=PG_OBJECTIVES.racks.find(r=>r.id===itemId);
  if(rack){
   if(!this.near(player,rack.position))return {ok:false,error:"Reach the weapon rack"};
   price=PG_ZOMBIE_PRICES[rack.id];
   apply=()=>{player.loadout={primary:rack.weapon,secondary:player.loadout.secondary,primaryModules:[],secondaryModules:[]};player.guns[0]=pgCreateGun(rack.weapon);state.primaryUnlocked=true;state.upgrade=0;player.slot=0;};
  }else if(itemId==="rack-comet"||itemId==="rack-orbit"){
   if(!this.near(player,PG_OBJECTIVES.racks[2].position))return {ok:false,error:"Reach the starting sidearm rack"};
   const weapon=itemId==="rack-comet"?"comet":"orbit";
   price=PG_ZOMBIE_PRICES[itemId];apply=()=>{player.loadout={...player.loadout,secondary:weapon,secondaryModules:[]};player.guns[1]=pgCreateGun(weapon);player.slot=1;};
  }else if(itemId.startsWith("door:")){
   const door=this.ctx.world.snapshot().panels.find(p=>p.id===itemId.slice(5)&&p.active);
   const socket=PG_ZOMBIE_DOORS.find(s=>s.id===door?.id);
   if(!door||!socket||!socket.approaches.some(p=>this.near(player,p,3.8)))return {ok:false,error:"Reach a locked access door"};
   price=PG_ZOMBIE_PRICES.door;apply=()=>{this.ctx.world.damage(door.id,door.hp,now,true);this.unlocked.add(door.id);};
  }else if(itemId==="ammo"){
   if(!this.near(player,PG_OBJECTIVES.station)&&!PG_OBJECTIVES.racks.some(r=>this.near(player,r.position)))return {ok:false,error:"Reach an ammunition rack"};
   const guns=player.guns.filter((_,i)=>i===1||state.primaryUnlocked);if(guns.every(g=>g.magazine===pgGunProfile(g).magazine&&g.reserve===pgGunProfile(g).reserve))return {ok:false,error:"Ammunition is full"};
   price=PG_ZOMBIE_PRICES.ammo;apply=()=>{for(const gun of guns){const w=pgGunProfile(gun);gun.magazine=w.magazine;gun.reserve=w.reserve;gun.reloadUntil=0;}};
  }else if(itemId==="upgrade"){
   if(!this.power||!this.near(player,PG_OBJECTIVES.station)||state.upgrade>=3||!state.primaryUnlocked||player.slot!==0)return {ok:false,error:"Power and a purchased primary at the upgrade station are required"};
   price=PG_ZOMBIE_PRICES.upgrade[state.upgrade as 0|1|2];apply=()=>{state.upgrade=(state.upgrade+1) as 1|2|3;};
  }else if(itemId==="perk-vitality"||itemId==="perk-reload"||itemId==="perk-stamina"){
   if(!this.near(player,PG_OBJECTIVES.station)||state.perks.includes(itemId))return {ok:false,error:"Reach the perk station; each perk may be bought once"};
   price=PG_ZOMBIE_PRICES[itemId];apply=()=>{state.perks.push(itemId);state.maxHp=this.maxHp(player);if(itemId==="perk-vitality")player.hp=Math.min(state.maxHp,player.hp+60);};
  }
  if(!apply)return {ok:false,error:"Unknown run purchase"};
  if(state.points<price)return {ok:false,error:`Requires ${price} run points`};
  state.points-=price;state.purchases++;apply();return {ok:true};
 }
 private hold(player:PgPlayer,targetId:string,now:number,durationMs:number):void {
  if(this.interactions.get(player.id)?.targetId===targetId)return;
  this.interactions.set(player.id,{targetId,startedAt:now,durationMs,damageAt:player.lastDamageAt,origin:{...player.position}});
  this.pilots.get(player.id)!.interaction={targetId,startedAt:now,durationMs};
 }
 private cancelInteraction(id:string):void{this.interactions.delete(id);const p=this.pilots.get(id);if(p)p.interaction=null;}
 private updateInteractions(now:number):void {
  for(const [id,held]of this.interactions){
   const p=this.ctx.players.get(id),targetId=held.targetId.slice(7),target=this.ctx.players.get(targetId);
   const valid=p&&this.pilots.get(id)?.life==="alive"&&(p.connected||p.isBot)&&p.lastDamageAt===held.damageAt&&distance(p.position,held.origin)<.8&&(held.targetId==="power"?!this.power&&this.near(p,PG_OBJECTIVES.power):target&&this.pilots.get(targetId)?.life==="downed"&&this.near(p,target.position,2.4));
   if(!valid){this.cancelInteraction(id);continue;}
   if(now<held.startedAt+held.durationMs)continue;
   if(held.targetId==="power"){this.power=true;this.award(id,250);}else if(target){this.revive(target,now);this.pilots.get(id)!.revives++;this.pilots.get(id)!.contribution+=100;this.award(id,180);}
   this.cancelInteraction(id);
  }
 }
 private revive(player:PgPlayer,now:number):void {const s=this.pilots.get(player.id)!;s.life="alive";s.bleedoutAt=0;player.hp=Math.round(this.maxHp(player)*.5);player.protectedUntil=now+1500;player.respawnAt=0;player.lastDamageAt=now;}
 private resolveDefeat(now:number):void {
  if(this.subphase==="defeated")return;
  const living=[...this.pilots.values()].filter(p=>p.life==="alive");if(living.length)return;
  if(this.pilots.size===1){const s=[...this.pilots.values()][0];if(s.life==="downed"&&s.selfRecovery){s.selfRecovery=false;this.soloRecoverAt=now+PG_ZOMBIE_RULES.soloRecoveryMs;return;}if(this.soloRecoverAt)return;}
  this.subphase="defeated";this.reason="No survivor can continue or revive";this.deadline=now;this.interactions.clear();for(const s of this.pilots.values())s.interaction=null;this.ctx.finish(null);
 }
 botWaypoint(player:PgPlayer,goal:Vec3|null):Vec3|null {
  this.navigation.update(this.ctx.world.map,this.ctx.world.revision);
  return goal?this.navigation.destination(player.position,goal):null;
 }
 botGoal(player:PgPlayer,_now:number):Vec3|null {
  const held=this.interactions.get(player.id);if(held)return held.origin;
  if(!this.canMove(player)||this.pilots.get(player.id)?.life!=="alive")return null;
  const state=this.pilots.get(player.id)!;
  const downed=[...this.ctx.players.values()].find(p=>this.pilots.get(p.id)?.life==="downed"&&this.navigation.reachable(player.position,p.position));
  const danger=[...this.zombies.values()].some(z=>distance(z.position,player.position)<5);
  if(downed&&!danger)return downed.position;
  const accessibleRacks=PG_OBJECTIVES.racks.filter(r=>this.navigation.reachable(player.position,r.position)).sort((a,b)=>distance(player.position,a.position)-distance(player.position,b.position));
  const gun=player.guns[player.slot];
  if(!danger&&gun.reserve<pgGunProfile(gun).magazine&&state.points>=PG_ZOMBIE_PRICES.ammo&&accessibleRacks.length)return accessibleRacks[0].position;
  if(!danger&&!state.primaryUnlocked){const rack=accessibleRacks.find(r=>state.points>=(r.weapon==="rail"?1800:r.weapon==="photon"?950:700));if(rack)return rack.position;}
  if(!danger&&!this.power){
   if(this.navigation.reachable(player.position,PG_OBJECTIVES.power))return PG_OBJECTIVES.power;
   if(state.points>=PG_ZOMBIE_PRICES.door){const door=PG_ZOMBIE_DOORS.filter(s=>this.ctx.world.snapshot().panels.some(p=>p.id===s.id&&p.active)).flatMap(s=>s.approaches).filter(p=>this.navigation.reachable(player.position,p)).sort((a,b)=>distance(a,player.position)-distance(b,player.position))[0];if(door)return door;}
  }
  if(!danger&&this.power&&state.primaryUnlocked&&state.upgrade<3&&state.points>=PG_ZOMBIE_PRICES.upgrade[state.upgrade as 0|1|2])return PG_OBJECTIVES.station;
  const human=[...this.ctx.players.values()].find(p=>!p.isBot&&this.pilots.get(p.id)?.life==="alive");if(human)return human.position;
  const z=[...this.zombies.values()].sort((a,b)=>distance(a.position,player.position)-distance(b.position,player.position))[0];return z?.position??PG_OBJECTIVES.power;
 }
 botAction(player:PgPlayer,now:number):void {
  const state=this.pilots.get(player.id);if(!state||state.life!=="alive"||this.subphase==="defeated")return;
  const danger=[...this.zombies.values()].some(z=>distance(z.position,player.position)<5);
  const downed=[...this.ctx.players.values()].find(p=>this.pilots.get(p.id)?.life==="downed"&&this.near(player,p.position,2.4));
  if(downed&&!danger){this.hold(player,`revive:${downed.id}`,now,PG_ZOMBIE_RULES.reviveMs);return;}
  if(danger)this.cancelInteraction(player.id);
  if(!danger&&!this.power&&this.near(player,PG_OBJECTIVES.power)){this.hold(player,"power",now,2000);return;}
  if(!danger){
   for(const socket of PG_ZOMBIE_DOORS)if(!this.power&&socket.approaches.some(p=>this.near(player,p,2))&&this.ctx.world.snapshot().panels.some(p=>p.id===socket.id&&p.active)){if(this.buy(player,`door:${socket.id}`,now).ok)break;}
   const rack=PG_OBJECTIVES.racks.find(r=>this.near(player,r.position));if(!state.primaryUnlocked&&rack)this.buy(player,rack.id,now);
   const gun=player.guns[player.slot];if(gun.reserve<pgGunProfile(gun).magazine)this.buy(player,"ammo",now);
   if(this.power&&state.primaryUnlocked&&state.upgrade<3&&this.near(player,PG_OBJECTIVES.station)){player.slot=0;this.buy(player,"upgrade",now);}
  }
  player.slot=state.primaryUnlocked?0:1;
  const gun=player.guns[player.slot],profile=pgGunProfile(gun),mod=this.weaponModifiers(player);pgFinishReload(gun,now);
  if(!gun.magazine){if(!gun.reloadUntil&&pgStartReload(gun,now))gun.reloadUntil=now+profile.reloadMs*mod.reload;return;}
  if(gun.reloadUntil||now<gun.nextFireAt)return;
  const origin={...player.position,y:player.position.y+(player.crouched?PG_BALANCE.crouchEye:PG_BALANCE.eye)};
  const target=[...this.zombies.values()].filter(z=>distance(player.position,z.position)<Math.min(35,profile.range)&&this.ctx.world.visible(origin,eye(z.position))).sort((a,b)=>distance(a.position,player.position)-distance(b.position,player.position))[0];
  if(target){
   gun.magazine--;gun.nextFireAt=now+profile.intervalMs*mod.interval;gun.shots++;player.protectedUntil=0;player.yaw=Math.atan2(player.position.x-target.position.x,player.position.z-target.position.z);
   const end=eye(target.position),damage=this.hitZombie(target.id,pgDamage(gun.id,distance(origin,end),false)*profile.pellets*mod.damage,player,now);
   this.ctx.emitShot?.({id:-(++this.shotSerial),at:now,shooterId:player.id,weapon:gun.id,origin,end,targetId:target.id,damage,headshot:false});
  }
 }
 snapshot():Extract<PgModeSnapshot,{id:"planetzombies"}>{return {id:this.id,collision:this.ctx.world.snapshot(),effects:[],pilots:Object.fromEntries([...this.pilots].map(([id,s])=>[id,structuredClone(s)])),round:this.wave,subphase:this.subphase,deadline:this.deadline,wave:this.wave,remaining:this.zombies.size+this.queued,queued:this.queued,zombies:[...this.zombies.values()].map(({id,kind,position,yaw,hp,maxHp,windupUntil})=>({id,kind,position:{...position},yaw,hp,maxHp,windupUntil})),power:this.power,unlocked:[...this.unlocked],reason:this.reason};}
 leave(id:string,now:number):void{this.pilots.delete(id);this.interactions.delete(id);this.sequences.delete(id);for(const [actor,h]of this.interactions)if(h.targetId===`revive:${id}`)this.cancelInteraction(actor);this.resolveDefeat(now);}
}
