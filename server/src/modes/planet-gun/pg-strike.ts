import {PG_MAP,PG_OBJECTIVES,PG_TACTICAL_MOVEMENT_RULES,pgCreateGun,pgWeaponValid,type PgModeAction,type PgModeDrop,type PgModeEffect,type PgPlayer,type PgStrikePilot,type PgTeam,type PgWeaponId,type Vec3} from "@planetfall/shared";
import {pgModeDistance,pgModeError,pgModeOk,pgModePilot,pgOtherTeam,pgRawModeDamage} from "./pg-mode-base.js";
import type {PgModeContext,PgModeRuntime} from "./pg-mode-runtime.js";
import {PgRoundSeries} from "./pg-round-series.js";
import {pgSupportedModeDrop} from "./pg-mode-drops.js";

import {PG_STRIKE_PRICES} from "@planetfall/shared";
export {PG_STRIKE_PRICES} from "@planetfall/shared";
const BUY_MS=20000,ACTION_MS=105000,CHARGE_MS=35000,RESULT_MS=5000;
type Hold={targetId:string;startedAt:number;lastAt:number;position:Vec3;damageAt:number;durationMs:number;};
type Inventory={primary:boolean;utilities:[number,number,number];};
type StrikeSnapshot=Extract<ReturnType<PgModeRuntime["snapshot"]>,{id:"planetstrike"}>;

/** Tactical round state and credits are ephemeral and owned by this match. */
export class PgStrike implements PgModeRuntime {
 readonly id="planetstrike" as const;
 private series=new PgRoundSeries(6);
 private pilots:Record<string,PgStrikePilot>={};
 private inventory=new Map<string,Inventory>();
 private holds=new Map<string,Hold>();
 private flashes=new Map<string,number>();
 private effects:PgModeEffect[]=[];
 private drops:PgModeDrop[]=[];
 private losses:Record<PgTeam,number>={solar:0,void:0};
 private subphase="buy";
 private deadline=0;
 private serial=0;
 private carrierPosition:Vec3|null=null;
 private charge:StrikeSnapshot["charge"]={carrierId:null,position:null,site:null,detonatesAt:0};
 constructor(private ctx:PgModeContext){}
 start(now:number):void {
  this.series=new PgRoundSeries(6);this.pilots={};this.inventory.clear();this.losses={solar:0,void:0};
  for(const p of this.ctx.players.values()){this.pilots[p.id]={...pgModePilot(p),carrying:false,credits:800,primaryUnlocked:false,utilities:[0,0,0]};this.inventory.set(p.id,{primary:false,utilities:[0,0,0]});}
  this.round(now,true);
 }
 private state(p:PgPlayer){return this.pilots[p.id];}
 private sync(p:PgPlayer){const inventory=this.inventory.get(p.id)!;Object.assign(this.state(p),{primaryUnlocked:inventory.primary,utilities:[...inventory.utilities],charges:[inventory.utilities[0],inventory.utilities[1]]});}
 private alive(p:PgPlayer){return p.hp>0&&this.state(p)?.life==="alive";}
 private credit(p:PgPlayer,amount:number){const s=this.state(p);if(s)s.credits=Math.min(16000,s.credits+amount);}
 private spawnPosition(p:PgPlayer):Vec3 {return PG_MAP.spawns.find(s=>s.team===p.team)?.position??p.position;}
 private inBuyZone(p:PgPlayer){return PG_MAP.spawns.some(s=>s.team===p.team&&pgModeDistance(s.position,p.position)<5);}
 private round(now:number,initial=false):void {
  this.subphase="buy";this.deadline=now+BUY_MS;this.holds.clear();this.flashes.clear();this.effects=[];this.drops=[];this.charge={carrierId:null,position:null,site:null,detonatesAt:0};this.ctx.world.reset([],now);
  // Survivors retain purchased weapons, armor and unspent utilities. Every new
  // round refills magazines/reserves from the canonical profile, without modules.
  // Death removes equipment and returns a fresh Orbit sidearm. Overtime resets
  // both teams to equal 6000-credit shopping rounds and fresh sidearms.
  for(const p of this.ctx.players.values()){
   const state=this.state(p);if(!state)continue;
   const inventory=this.inventory.get(p.id)!;
   const survives=!initial&&state.life==="alive"&&p.hp>0;
   const reset=!survives||this.series.overtime;
   const primary=reset?"pulse":p.guns[0].id,secondary=reset?"orbit":p.guns[1].id;
   if(reset){inventory.primary=false;inventory.utilities=[0,0,0];state.armor=0;}
   if(this.series.overtime)state.credits=6000;
   this.ctx.respawn(p,now,{primary:primary as "pulse",secondary:secondary as "orbit",primaryModules:[],secondaryModules:[]});
   p.guns=[pgCreateGun(primary),pgCreateGun(secondary)];if(!inventory.primary){p.guns[0].magazine=0;p.guns[0].reserve=0;}
   p.slot=inventory.primary?0:1;p.hp=100;p.protectedUntil=now;state.life="alive";state.carrying=false;state.interaction=null;state.side=p.team===this.series.attackTeam?"attack":"defend";this.sync(p);
  }
  const carrier=[...this.ctx.players.values()].find(p=>this.alive(p)&&p.team===this.series.attackTeam);
  if(carrier)this.carry(carrier);
 }
 private carry(p:PgPlayer){this.charge.carrierId=p.id;this.charge.position=null;this.carrierPosition={...p.position};this.state(p).carrying=true;this.drops=this.drops.filter(d=>d.kind!=="charge");}
 private releaseCharge(p:PgPlayer):void {
  if(this.charge.carrierId!==p.id)return;
  const position=pgSupportedModeDrop(p.position,this.ctx.world.map);
  this.state(p).carrying=false;this.charge.carrierId=null;this.charge.position=position;
  this.drops=this.drops.filter(d=>d.kind!=="charge");this.drops.push({id:"charge",kind:"charge",position:{...position},magazine:0,reserve:0});
 }
 update(_dt:number,now:number):void {
  if(this.subphase==="finished")return;
  const carrier=this.charge.carrierId?this.ctx.players.get(this.charge.carrierId):null;if(carrier)this.carrierPosition={...carrier.position};
  this.effects=this.effects.filter(e=>e.endsAt>now);
  if(this.subphase==="round-end"){if(now>=this.deadline)this.round(now);return;}
  if(this.subphase==="buy"){if(now>=this.deadline){this.subphase="action";this.deadline=now+ACTION_MS;}return;}
  // Deadlines are exclusive: a completion timestamp equal to detonation or
  // action expiry loses. After valid completions, resolve eliminations; a
  // simultaneous pre-plant wipe favors defenders, while a planted charge lives.
  if(this.charge.detonatesAt&&now>=this.charge.detonatesAt){this.resolve(this.series.attackTeam,now);return;}
  if(!this.charge.site&&now>=this.deadline){this.resolve(pgOtherTeam(this.series.attackTeam),now);return;}
  for(const [id,hold]of this.holds){
   const p=this.ctx.players.get(id);
   if(!p||!this.alive(p)||now-hold.lastAt>450||pgModeDistance(p.position,hold.position)>.12||p.lastDamageAt>hold.damageAt||!this.validInteraction(p,hold.targetId)){this.cancel(id);continue;}
   if(now-hold.startedAt>=hold.durationMs){this.complete(p,hold.targetId,now);this.cancel(id);if(this.subphase!=="action")return;}
  }
  const alive=[...this.ctx.players.values()].filter(p=>this.alive(p));
  if(!alive.some(p=>p.team===this.series.attackTeam)&&!this.charge.site)this.resolve(pgOtherTeam(this.series.attackTeam),now);
  else if(!alive.some(p=>p.team!==this.series.attackTeam))this.resolve(this.series.attackTeam,now);
 }
 private resolve(winner:PgTeam,now:number):void {
  if(this.subphase!=="action")return;
  const loser=pgOtherTeam(winner);this.losses[winner]=0;this.losses[loser]=Math.min(3,this.losses[loser]+1);
  for(const p of this.ctx.players.values()){this.credit(p,p.team===winner?3000:1400+500*this.losses[loser]);this.cancel(p.id);}
  this.effects=[];this.flashes.clear();this.charge={carrierId:null,position:null,site:null,detonatesAt:0};this.drops=this.drops.filter(d=>d.kind!=="charge");for(const state of Object.values(this.pilots))state.carrying=false;this.series.resolve(winner);
  if(this.series.done){this.subphase="finished";this.deadline=now;this.ctx.finish(this.series.winner);}
  else {this.subphase="round-end";this.deadline=now+RESULT_MS;}
 }
 snapshot():StrikeSnapshot {
  return {id:this.id,collision:this.ctx.world.snapshot(),effects:structuredClone(this.effects),pilots:structuredClone(this.pilots),round:this.series.round,subphase:this.subphase,deadline:this.charge.detonatesAt||this.deadline,attackTeam:this.series.attackTeam,roundScores:{...this.series.scores},charge:structuredClone(this.charge),drops:structuredClone(this.drops)};
 }
 canMove(p:PgPlayer){return this.alive(p)&&(this.subphase==="action"||this.subphase==="buy");}
 canFire(p:PgPlayer){return this.alive(p)&&this.subphase==="action"&&!this.holds.has(p.id);}
 allowSlot(p:PgPlayer,slot:0|1){return slot===1||this.inventory.get(p.id)?.primary===true;}
 movement(_p:PgPlayer){return PG_TACTICAL_MOVEMENT_RULES;}
 maxHp(_p:PgPlayer){return 100;}
 damage(p:PgPlayer,attacker:PgPlayer|null,amount:number,now:number){
  if(this.subphase!=="action"||!this.state(p))return 0;
  const damage=pgRawModeDamage(p,this.state(p),amount,now,attacker);if(damage>0)this.cancel(p.id);return damage;
 }
 eliminated(p:PgPlayer,killer:PgPlayer|null,_weapon:PgWeaponId,_now:number):void {
  const state=this.state(p);if(!state||state.life==="eliminated")return;
  state.life="eliminated";this.cancel(p.id);this.releaseCharge(p);
  if(killer&&killer.team!==p.team){this.credit(killer,300);this.state(killer).contribution++;}
  const inventory=this.inventory.get(p.id)!;
  if(inventory.primary)this.dropWeapon(p,0);
  this.dropWeapon(p,1);inventory.primary=false;inventory.utilities=[0,0,0];state.armor=0;this.sync(p);
 }
 private dropWeapon(p:PgPlayer,slot:0|1){const gun=p.guns[slot];this.drops.push({id:`weapon-${++this.serial}`,kind:"weapon",weapon:gun.id,position:pgSupportedModeDrop(p.position,this.ctx.world.map),magazine:gun.magazine,reserve:gun.reserve});if(slot===0)this.inventory.get(p.id)!.primary=false;gun.magazine=0;gun.reserve=0;p.slot=1;this.sync(p);}
 private cancel(id:string){this.holds.delete(id);if(this.pilots[id])this.pilots[id].interaction=null;}
 private site(target:string){return PG_OBJECTIVES.strike.find(site=>target===`site-${site.id}`||target===site.id);}
 private validInteraction(p:PgPlayer,target:string):boolean {
  const site=this.site(target);
  if(site)return !this.charge.site&&this.charge.carrierId===p.id&&p.team===this.series.attackTeam&&pgModeDistance(p.position,site.position)<=site.radius&&this.ctx.world.visible({...p.position,y:p.position.y+1},{...site.position,y:site.position.y+1});
  return target==="charge"&&!!this.charge.site&&p.team!==this.series.attackTeam&&!!this.charge.position&&pgModeDistance(p.position,this.charge.position)<=2.2&&this.ctx.world.visible({...p.position,y:p.position.y+1},{...this.charge.position,y:this.charge.position.y+1});
 }
 private complete(p:PgPlayer,target:string,now:number){
  const site=this.site(target);
  if(site){this.state(p).carrying=false;this.charge={carrierId:null,position:{...p.position},site:site.id,detonatesAt:now+CHARGE_MS};this.drops=this.drops.filter(d=>d.kind!=="charge");this.credit(p,300);this.state(p).contribution+=3;}
  else {this.credit(p,300);this.state(p).contribution+=3;this.resolve(pgOtherTeam(this.series.attackTeam),now);}
 }
 action(p:PgPlayer,a:PgModeAction,now:number){
  if(a.kind==="interact"&&!a.held){this.cancel(p.id);return pgModeOk();}
  if(!this.alive(p))return pgModeError("You must be alive");
  if(a.kind==="buy")return this.buy(p,a.itemId,now);
  if(this.subphase!=="action")return pgModeError("Wait for the action phase");
  if(now>=(this.charge.detonatesAt||this.deadline))return pgModeError("Round deadline reached");
  if(a.kind==="interact"){
   if(!this.validInteraction(p,a.targetId)){this.cancel(p.id);return pgModeError("Invalid charge interaction");}
   const old=this.holds.get(p.id);
   if(old?.targetId===a.targetId){old.lastAt=now;return pgModeOk();}
   const durationMs=this.site(a.targetId)?4000:6000;
   this.holds.set(p.id,{targetId:a.targetId,startedAt:now,lastAt:now,position:{...p.position},damageAt:p.lastDamageAt,durationMs});this.state(p).interaction={targetId:a.targetId,startedAt:now,durationMs};return pgModeOk();
  }
  if(a.kind==="pickup")return this.pickup(p,a.entityId);
  if(a.kind==="ability")return this.utility(p,a.slot,a.position,now);
  return pgModeError("Action unavailable in PlanetStrike");
 }
 private buy(p:PgPlayer,item:string,now:number){
  const state=this.state(p),inventory=this.inventory.get(p.id)!;
  if(this.subphase!=="buy"||now>=this.deadline||!this.inBuyZone(p))return pgModeError("Buy only in your spawn purchase zone");
  const price=PG_STRIKE_PRICES[item];if(!price||state.credits<price)return pgModeError("Insufficient credits or unknown equipment");
  if(item==="armor"){if(state.armor>=50)return pgModeError("Armor full");state.armor=50;}
  else if(["smoke","flash","damage"].includes(item)){
   const slot=item==="smoke"?0:item==="flash"?1:2;if(inventory.utilities[slot]>=1)return pgModeError("Utility already owned");inventory.utilities[slot]++;state.charges=[inventory.utilities[0],inventory.utilities[1]];
  }else if(pgWeaponValid(item)){
   const slot=item==="orbit"||item==="comet"?1:0;
   p.guns[slot]=pgCreateGun(item);if(slot===0)inventory.primary=true;p.slot=slot;
  }else return pgModeError("Unknown equipment");
  state.credits-=price;this.sync(p);return pgModeOk();
 }
 private pickup(p:PgPlayer,id:string){
  if(id==="drop-charge"){if(this.charge.carrierId!==p.id)return pgModeError("You do not carry the charge");this.releaseCharge(p);return pgModeOk();}
  if(id==="drop-weapon"){if(!this.inventory.get(p.id)!.primary)return pgModeError("No primary to drop");this.dropWeapon(p,0);return pgModeOk();}
  const index=this.drops.findIndex(d=>d.id===id),drop=this.drops[index];
  if(!drop||pgModeDistance(p.position,drop.position)>2||!this.ctx.world.visible({...p.position,y:p.position.y+1},{...drop.position,y:drop.position.y+1}))return pgModeError("Pickup is out of reach");
  if(drop.kind==="charge"){
   if(p.team!==this.series.attackTeam||this.charge.site||this.charge.carrierId)return pgModeError("Only attackers can recover the charge");this.carry(p);return pgModeOk();
  }
  if(!drop.weapon)return pgModeError("Invalid weapon");
  this.drops.splice(index,1);const slot=drop.weapon==="orbit"||drop.weapon==="comet"?1:0;
  if(slot===0&&this.inventory.get(p.id)!.primary)this.dropWeapon(p,0);
  p.guns[slot]={...pgCreateGun(drop.weapon),magazine:drop.magazine,reserve:drop.reserve};if(slot===0)this.inventory.get(p.id)!.primary=true;p.slot=slot;this.sync(p);return pgModeOk();
 }
 private utility(p:PgPlayer,slot:0|1|2,requested:Vec3|undefined,now:number){
  const inventory=this.inventory.get(p.id)!;
  if(inventory.utilities[slot]<=0)return pgModeError("Buy this utility first");
  if(!requested||![requested.x,requested.y,requested.z].every(Number.isFinite)||pgModeDistance(p.position,requested)>16||!this.ctx.world.visible({...p.position,y:p.position.y+1},{...requested,y:requested.y+1}))return pgModeError("Invalid utility destination");
  inventory.utilities[slot]--;this.sync(p);
  this.effects.push({id:`strike-effect-${++this.serial}`,kind:slot===0?"smoke":slot===1?"flash":"heat",ownerId:p.id,team:p.team,position:{...requested},radius:slot===0?4:slot===1?7:4,startsAt:now,endsAt:now+(slot===0?12000:slot===1?1500:750),hp:0,maxHp:0});
  if(this.effects.length>32)this.effects.shift();
  if(slot!==0)for(const target of this.ctx.players.values()){
   if(!this.alive(target)||target.team===p.team||pgModeDistance(target.position,requested)>(slot===1?7:4)||!this.ctx.world.visible({...requested,y:requested.y+1},{...target.position,y:target.position.y+1}))continue;
   if(slot===1)this.flashes.set(target.id,now+1500);
   else this.ctx.damage(target,p,Math.round(70*(1-pgModeDistance(target.position,requested)/5)),now);
  }
  return pgModeOk();
 }
 /** Smoke obscures perception consistently for either team; it does not stop bullets. */
 visible(from:Vec3,to:Vec3):boolean {
  const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,n=dx*dx+dy*dy+dz*dz;
  return !this.effects.some(e=>{if(e.kind!=="smoke")return false;const t=n?Math.max(0,Math.min(1,((e.position.x-from.x)*dx+(e.position.y-from.y)*dy+(e.position.z-from.z)*dz)/n)):0;return Math.hypot(from.x+dx*t-e.position.x,from.y+dy*t-e.position.y,from.z+dz*t-e.position.z)<e.radius;});
 }
 botGoal(p:PgPlayer,now:number):Vec3|null {
  if(!this.alive(p))return null;
  if(this.subphase==="buy")return this.spawnPosition(p);
  if(this.subphase!=="action")return null;
  if((this.flashes.get(p.id)??0)>now)return {...p.position};
  if(this.charge.site)return this.charge.position;
  if(p.team===this.series.attackTeam&&this.charge.position)return this.charge.position;
  const roster=[...this.ctx.players.values()].filter(x=>x.team===p.team),index=Math.max(0,roster.indexOf(p));
  return PG_OBJECTIVES.strike[index%2].position;
 }
 botAction(p:PgPlayer,now:number):void {
  if(!this.alive(p))return;
  if(this.subphase==="buy"){
   if(!this.inventory.get(p.id)!.primary)this.buy(p,this.state(p).credits>=2400?"pulse":"nova",now);
   if(this.state(p).armor===0)this.buy(p,"armor",now);
   if(this.inventory.get(p.id)!.utilities[0]===0)this.buy(p,"smoke",now);return;
  }
  if(this.subphase!=="action"||(this.flashes.get(p.id)??0)>now)return;
  if(p.team===this.series.attackTeam&&this.charge.position&&!this.charge.site&&!this.charge.carrierId)this.pickup(p,"charge");
  const target=this.charge.site?"charge":`site-${PG_OBJECTIVES.strike.find(s=>pgModeDistance(p.position,s.position)<=s.radius)?.id??"A"}`;
  if(this.validInteraction(p,target))this.action(p,{kind:"interact",sequence:0,lifeId:p.lifeId,targetId:target,held:true},now);
 }
 targets(_p:PgPlayer){return [];}
 leave(id:string,_now:number):void {
  const p=this.ctx.players.get(id);
  if(p)this.releaseCharge(p);
  else if(this.charge.carrierId===id&&this.carrierPosition){this.charge.carrierId=null;this.charge.position=pgSupportedModeDrop(this.carrierPosition,this.ctx.world.map);this.drops=this.drops.filter(d=>d.kind!=="charge");this.drops.push({id:"charge",kind:"charge",position:{...this.charge.position},magazine:0,reserve:0});}
  this.cancel(id);if(this.pilots[id]){this.pilots[id].life="eliminated";this.pilots[id].carrying=false;}
 }
}
