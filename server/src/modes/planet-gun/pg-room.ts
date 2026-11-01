import {randomBytes,randomUUID} from "node:crypto";
import type {Server,Socket} from "socket.io";
import {DEFAULT_COSMETICS,SHOP_CATALOG,PLANET_PASS_REWARDS,PG_BALANCE as B,pgGunProfile,pgUpdateGunHeat,pgValidateLoadout,pgCreateGun,pgFinishReload,pgSanitizeInput,pgSpawnMotion,pgStartReload,pgStepMovement,sessionLevelForXp,sessionXpInLevel,type ClientToServerEvents,type ServerToClientEvents,type GuestProfile,type PgPlayer,type PgInput,type PgJoinResult,type PgRoomView,type PgConfiguration,type PgLoadout,type PgSnapshot,type PgFireRequest} from "@planetfall/shared";
import {PgCombat} from "./pg-combat.js";
import {PgMatch} from "./pg-match.js";
import {pgChooseSpawn,type PgSpawnDanger} from "./pg-spawns.js";
import {pgBotInput,pgBotMemory,type PgBotMemory} from "./pg-bots.js";
import {pgCoolModeGun,pgValidateHeroLoadout,pgValidateOperatorLoadout,pgValidateModeAction,pgModeId,PG_MODES,PG_HERO_IDS,PG_HEROES,PG_OPERATOR_IDS,PG_OPERATORS,type PgModeAction,type PgModeActionResult,type PgTeam,type PgWeaponId} from "@planetfall/shared";
import {PgModeWorld} from "./pg-mode-world.js";
import type {PgModeRuntime,PgModeTarget,PgModeContext} from "./pg-mode-runtime.js";
import {PgStrike} from "./pg-strike.js";
import {PgWatch} from "./pg-watch.js";
import {PgSiege} from "./pg-siege.js";
import {PgZombies} from "./pg-zombies.js";
type GameServer=Server<ClientToServerEvents,ServerToClientEvents>;
type GameSocket=Socket<ClientToServerEvents,ServerToClientEvents>;
interface Pilot extends PgPlayer {socketId:string|null;sessionToken:string;disconnectedAt:number|null;input:PgInput;lastInputAt:number;bot:PgBotMemory;fireSequence:number;}
const idle=():PgInput=>({sequence:0,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,ads:false});
const publicPlayer=(p:Pilot):PgPlayer=>{const {socketId,sessionToken,disconnectedAt,input,lastInputAt,bot,fireSequence,...state}=p;return structuredClone(state);};
export class PlanetGunRoom {
  readonly family="planet-gun" as const;readonly players=new Map<string,Pilot>();
  hostId="";configuration:PgConfiguration={targetPlayers:12,fillBots:true,botDifficulty:"normal",scoreLimit:75};
  private match=new PgMatch();private combat=new PgCombat();private accumulator=0;private lastSnapshot=0;private startedAt=0;private rewarded=false;private feed:PgSnapshot["feed"]=[];private deathDanger:PgSpawnDanger[]=[];
  private mode:PgModeRuntime|null=null;private readonly world=new PgModeWorld();private modeStarted=false;
  private readonly actionSequences=new Map<string,number>();private readonly selections=new Map<string,string>();private readonly savedKits=new Map<string,PgLoadout>();private readonly selectedLoadouts=new Map<string,PgLoadout>();
  onProgress?:(players:Iterable<GuestProfile>)=>void;
  constructor(readonly code:string,private readonly io:GameServer){}
  get phase(){return this.match.phase;}
  view(viewerId?:string):PgRoomView{const viewer=viewerId?this.players.get(viewerId):undefined;return {gameFamily:this.family,code:this.code,hostId:this.hostId,phase:this.phase,...(viewerId?{lastActionSequence:this.actionSequences.get(viewerId)??-1}:{}),configuration:{...this.configuration},players:[...this.players.values()].map(p=>{const state=publicPlayer(p);const selected=this.selectedLoadouts.get(p.id);if(this.configuration.mode==="planetsiege"&&viewer?.team!==p.team)this.hideEquipment(state);else if(this.phase==="lobby"&&selected)state.loadout=structuredClone(selected);return state;}),...(this.selections.size?{selections:Object.fromEntries([...this.selections].filter(([id])=>this.configuration.mode!=="planetsiege"||viewer?.team===this.players.get(id)?.team))}:{})};}
  snapshot(now:number,viewerId?:string):PgSnapshot{const mode=this.modeStarted?this.mode?.snapshot(viewerId):undefined;if(mode&&this.mode)mode.controls=Object.fromEntries([...this.players.values()].filter(p=>!viewerId||p.id===viewerId).map(p=>[p.id,{lastActionSequence:this.actionSequences.get(p.id)??-1,movement:this.mode!.movement(p),canMove:this.mode!.canMove(p),canFire:this.mode!.canFire(p),combat:this.mode!.weaponModifiers?.(p,now)??{},...(this.mode!.viewOrigin?{viewOrigin:this.mode!.viewOrigin(p)}:{})}]));return {phase:this.phase,serverTime:now,phaseEndsAt:mode?.deadline??this.match.phaseEndsAt,scores:mode&&"roundScores"in mode?{...mode.roundScores}:{...this.match.scores},winner:this.match.winner,feed:this.feed.map(k=>({...k})),players:[...this.players.values()].map(p=>{const {fallbucks,crowns,sessionTotalXp,sessionLevel,sessionXp,ownedCosmetics,unlockedPassRewards,...state}=publicPlayer(p);if(mode?.id==="planetsiege"&&!mode.pilots[p.id]?.characterId)this.hideEquipment(state);return state;}),...(mode?{mode}:{})};}
  join(socket:GameSocket,name:unknown,token?:string):PgJoinResult {
    const now=Date.now(),returning=token?[...this.players.values()].find(p=>p.sessionToken===token&&!p.connected&&p.disconnectedAt!==null&&now-p.disconnectedAt<B.disconnectGraceMs):undefined;
    if(!returning&&this.phase!=="lobby")return {ok:false,error:"This match has started. Reconnect using the original session."};
    if(!returning&&this.players.size>=(this.configuration.mode==="planetzombies"?4:B.maxPlayers))return {ok:false,error:"PlanetGun is full."};
    const p=returning??this.makePlayer(typeof name==="string"?name.trim().replace(/[^a-zA-Z0-9 _-]/g,"").slice(0,18)||"Pilot":"Pilot",false);
    if(returning)this.combat.forget(p.id);
    p.connected=true;p.disconnectedAt=null;p.socketId=socket.id;p.input={...idle(),yaw:p.yaw,pitch:p.pitch};p.lastInputAt=now;this.players.set(p.id,p);if(!this.hostId)this.hostId=p.id;
    void socket.join(this.code);socket.data.roomCode=this.code;socket.data.playerId=p.id;socket.data.gameFamily=this.family;
    this.emitRoom();this.io.to(socket.id).emit("pg:match:snapshot",this.snapshot(now,p.id));return {ok:true,room:this.view(p.id),playerId:p.id,sessionToken:p.sessionToken};
  }
  configure(id:string,p:Partial<PgConfiguration>):void{
    if(id!==this.hostId||this.phase!=="lobby"||!p||typeof p!=="object")return;
    const mode=p.mode===undefined?this.configuration.mode??"deathmatch":pgModeId(p.mode);if(!mode){this.error(id,"Unknown PlanetGun mode.");return;}
    const humans=[...this.players.values()].filter(v=>!v.isBot).length,maximum=PG_MODES[mode].maxPlayers;if(humans>maximum){this.error(id,"PlanetZombies supports at most four survivors. Leave this room intact and create a smaller crew.");return;}
    const sizes=mode==="planetzombies"?[1,2,3,4]:[4,8,12];if(p.targetPlayers!==undefined&&(!sizes.includes(p.targetPlayers)||p.targetPlayers<humans)){this.error(id,"Player target must fit everyone in the room.");return;}
    if(mode!==(this.configuration.mode??"deathmatch")){this.configuration.mode=mode;this.configuration.targetPlayers=mode==="planetzombies"?4:12;this.selections.clear();this.selectedLoadouts.clear();for(const player of this.players.values()){player.ready=false;if(mode==="planetzombies")player.team="solar";}if(mode!=="planetzombies"){let index=0;for(const player of this.players.values())player.team=index++%2?"void":"solar";}}
    if(p.targetPlayers!==undefined)this.configuration.targetPlayers=p.targetPlayers;if([25,50,75].includes(p.scoreLimit!))this.configuration.scoreLimit=p.scoreLimit!;if(typeof p.fillBots==="boolean")this.configuration.fillBots=p.fillBots;if(["easy","normal","hard"].includes(p.botDifficulty!))this.configuration.botDifficulty=p.botDifficulty!;this.emitRoom();
  }
  setReady(id:string,ready:boolean):void{const p=this.players.get(id);if(p&&this.phase==="lobby"){p.ready=!!ready;this.emitRoom();}}
  setLoadout(id:string,raw:unknown):void {
    const p=this.players.get(id),loadout=pgValidateLoadout(raw);if(!p||!loadout)return;
    if(this.configuration.mode&&this.configuration.mode!=="deathmatch"){this.savedKits.set(id,loadout);return;}
    if(this.phase==="lobby"||this.phase==="results"){
      p.loadout=loadout;delete p.queuedLoadout;p.guns=[pgCreateGun(loadout.primary,loadout.primaryModules),pgCreateGun(loadout.secondary,loadout.secondaryModules)];
    }else p.queuedLoadout=loadout;
    this.emitRoom();
  }
  start(id:string,now=Date.now()):boolean {
    if(id!==this.hostId||this.phase!=="lobby")return false;const humans=[...this.players.values()].filter(p=>!p.isBot&&p.connected);if(!humans.length||humans.some(p=>!p.ready))return false;if(humans.length>this.configuration.targetPlayers){this.error(id,"Increase the player target to fit this crew before starting.");return false;}
    for(const [key,p]of this.players)if(p.isBot)this.players.delete(key);
    if(this.configuration.fillBots)while(this.players.size<this.configuration.targetPlayers){const p=this.makePlayer(`Nova ${this.players.size+1}`,true);this.players.set(p.id,p);}
    if(this.players.size<(this.configuration.mode==="planetzombies"?1:2))return false;
    this.match=new PgMatch(this.configuration.scoreLimit);this.match.start(now);this.startedAt=now;this.rewarded=false;this.feed=[];this.deathDanger=[];this.combat.clear();this.accumulator=0;
    this.actionSequences.clear();this.modeStarted=false;this.world.reset([],now);
    const context:PgModeContext={players:this.players,world:this.world,selections:this.selections,selectedLoadouts:this.selectedLoadouts,emitShot:shot=>this.io.to(this.code).emit("pg:combat:shot",shot),respawn:(p,at,loadout,position)=>{this.respawn(this.players.get(p.id)!,at,loadout,position);},damage:(target,attacker,amount,at)=>this.modeDamage(target,attacker,amount,at),finish:winner=>this.match.finish(winner)};
    this.mode=this.configuration.mode==="planetstrike"?new PgStrike(context):this.configuration.mode==="planetwatch"?new PgWatch(context):this.configuration.mode==="planetsiege"?new PgSiege(context):this.configuration.mode==="planetzombies"?new PgZombies(context):null;
    let i=0;for(const p of this.players.values()){if(!this.mode)p.team=i++%2?"void":"solar";if(this.configuration.mode==="planetzombies")p.team="solar";if(this.mode&&!this.savedKits.has(p.id))this.savedKits.set(p.id,structuredClone(p.loadout));p.hp=0;p.kills=0;p.deaths=0;this.respawn(p,now);}
    this.combat.history.record(this.players.values(),now);this.emitRoom();return true;
  }
  setInput(id:string,raw:unknown):void {const p=this.players.get(id),input=pgSanitizeInput(raw);if(!p||p.isBot||p.hp<=0||!input||!["playing","overtime"].includes(this.phase)||input.sequence<=Math.max(p.lastInputSequence,p.input.sequence))return;if(this.mode&&input.collisionRevision!==this.world.revision){p.lastInputSequence=Math.max(p.lastInputSequence,input.sequence);return;}input.jump||=p.input.sequence>p.lastInputSequence&&p.input.jump;p.input=input;p.lastInputAt=Date.now();}
  fire(id:string,request:PgFireRequest,now=Date.now()):void {if(!["playing","overtime"].includes(this.phase))return;const p=this.players.get(id);if(!p||this.mode&&!this.mode.canFire(p))return;const targets:PgModeTarget[]=this.mode?[...this.panelTargets(),...this.mode.targets(p)]:[];const shots=this.combat.fire(p,request,this.players.values(),now,this.mode?{solids:this.world.shotSolids(Math.min(now,request?.clientTime??now),now),targets,damage:(victim,attacker,amount,at)=>this.modeDamage(victim,attacker,amount,at),modifiers:this.mode.weaponModifiers?.(p,now)}:undefined);for(const shot of shots){this.io.to(this.code).emit("pg:combat:shot",shot);if(shot.targetId){const victim=this.players.get(shot.targetId);if(victim&&victim.hp<=0)this.kill(victim,p,shot.weapon,shot.headshot,now);}}if(this.phase==="results"){this.reward(now);this.emitRoom();}}
  reload(id:string,now=Date.now()):void{const p=this.players.get(id);if(p&&p.hp>0&&["playing","overtime"].includes(this.phase)&&(!this.mode||this.mode.canFire(p))){const gun=p.guns[p.slot];if(pgStartReload(gun,now)){const modifiers=this.mode?.weaponModifiers?.(p,now);gun.reloadUntil=now+(gun.reloadUntil-now)*(modifiers?.reload??modifiers?.reloadMultiplier??1);}}}
  switchWeapon(id:string,slot:unknown,now=Date.now()):void {const p=this.players.get(id);if(!p||p.hp<=0||slot!==0&&slot!==1||p.slot===slot||this.mode?.allowSlot&&!this.mode.allowSlot(p,slot))return;p.guns[p.slot].reloadUntil=0;p.guns[p.slot].burstRemaining=0;p.slot=slot;p.adsSince=0;p.fireReadyAt=now+200;}
  update(dt:number,now:number):void {
    for(const [id,p]of this.players)if(!p.isBot&&!p.connected&&p.disconnectedAt!==null&&now-p.disconnectedAt>=B.disconnectGraceMs){this.onProgress?.([p]);this.mode?.leave(id,now);this.selections.delete(id);this.selectedLoadouts.delete(id);this.savedKits.delete(id);this.actionSequences.delete(id);this.players.delete(id);this.combat.forget(id);}
    const previous=this.phase;if(!this.mode||this.phase==="countdown")this.match.update(now);
    if(this.mode&&!this.modeStarted&&this.phase==="playing"){this.modeStarted=true;this.mode.start(now);}
    if(["playing","overtime"].includes(this.phase)){this.accumulator+=Math.max(0,Math.min(.1,dt));while(this.accumulator>=1/B.tickRate){this.accumulator-=1/B.tickRate;this.step(1/B.tickRate,now-this.accumulator*1000);if(this.phase==="results")break;}}
    if(this.phase==="results"&&!this.rewarded)this.reward(now);
    if(previous!==this.phase)this.emitRoom();
    if(this.phase!=="lobby"&&now-this.lastSnapshot>=1000/B.snapshotRate){this.lastSnapshot=now;if(this.mode){for(const p of this.players.values())if(p.socketId)this.io.to(p.socketId).emit("pg:match:snapshot",this.snapshot(now,p.id));}else this.io.to(this.code).emit("pg:match:snapshot",this.snapshot(now));}
  }
  private step(dt:number,now:number):void {
    const shots:{id:string;sequence:number}[]=[];
    for(const p of this.players.values()){
      if(p.hp<=0){if(!this.mode&&now>=p.respawnAt)this.respawn(p,now);else continue;}
      let input=p.input;
      if(p.isBot){this.mode?.botAction(p,now);const goal=this.mode?.botGoal(p,now)??null;const decision=pgBotInput(p,this.players.values(),now,this.configuration.botDifficulty,p.bot,this.mode?{map:this.world.map,goal,...(this.mode.botWaypoint?{steering:this.mode.botWaypoint(p,goal)}:{}),grounded:this.configuration.mode!=="planetwatch",visible:(a,b)=>this.world.visible(a,b)&&(this.mode?.visible?.(a,b)??true)}:undefined);input=decision.input;if(decision.fire)shots.push({id:p.id,sequence:++p.fireSequence});if(p.guns[p.slot].magazine===0)this.reload(p.id,now);}
      else if(!p.connected||now-p.lastInputAt>400)input={...idle(),sequence:p.input.sequence,yaw:p.yaw,pitch:p.pitch};
      if(this.mode&&p.isBot)input.collisionRevision=this.world.revision;if(this.mode&&!p.isBot&&input.collisionRevision!==this.world.revision)input={...idle(),sequence:input.sequence,yaw:p.yaw,pitch:p.pitch};
      const wasSprint=p.mode==="sprint";if(!this.mode||this.mode.canMove(p))pgStepMovement(p,input,dt,now,this.world.map,this.mode?.movement(p));else p.velocity={x:0,y:0,z:0};p.lastInputSequence=input.sequence;
      if(wasSprint&&p.mode!=="sprint")p.fireReadyAt=Math.max(p.fireReadyAt,now+pgGunProfile(p.guns[p.slot]).sprintDelayMs);
      if(input.ads&&p.mode!=="sprint"){if(!p.adsSince)p.adsSince=now;}else p.adsSince=0;
      for(const gun of p.guns){pgFinishReload(gun,now);pgUpdateGunHeat(gun,now);const modifiers=this.mode?.weaponModifiers?.(p,now);if(modifiers)pgCoolModeGun(gun,modifiers,now);gun.recoil=Math.max(0,gun.recoil-dt*.09);}
      if(!this.mode&&now-p.lastDamageAt>B.regenDelayMs)p.hp=Math.min(100,p.hp+B.regenPerSecond*dt);
      if(p.position.y<-8)this.kill(p,null,p.guns[p.slot].id,false,now);
    }
    this.combat.history.record(this.players.values(),now);
    for(const shot of shots){const p=this.players.get(shot.id)!;this.fire(p.id,{sequence:shot.sequence,clientTime:now,weapon:p.guns[p.slot].id,yaw:p.yaw,pitch:p.pitch},now);}
    this.mode?.update(dt,now);
    this.deathDanger=this.deathDanger.filter(d=>now-d.at<8000);
  }
  private kill(victim:Pilot,killer:Pilot|null,weapon:PgPlayer["guns"][0]["id"],headshot:boolean,now:number):void {
    if(this.mode){if(victim.deadAt===now||victim.hp<=0&&victim.respawnAt===Number.MAX_SAFE_INTEGER)return;victim.hp=0;victim.deaths++;victim.deadAt=now;victim.respawnAt=Number.MAX_SAFE_INTEGER;victim.velocity={x:0,y:0,z:0};this.mode.eliminated(victim,killer,weapon,now);if(killer&&killer.team!==victim.team){killer.kills++;this.feed.push({id:(this.feed.at(-1)?.id??0)+1,at:now,killerId:killer.id,victimId:victim.id,weapon,headshot});if(this.feed.length>8)this.feed.shift();}return;}
    if(!this.match.elimination(victim.id,victim.lifeId,killer?.team??null,victim.team))return;
    victim.hp=0;victim.deaths++;victim.deadAt=now;victim.respawnAt=now+B.respawnMs;victim.velocity={x:0,y:0,z:0};for(const gun of victim.guns)gun.burstRemaining=0;this.deathDanger.push({position:{...victim.position},at:now});
    if(killer&&killer.team!==victim.team){killer.kills++;this.feed.push({id:this.feed.length?this.feed.at(-1)!.id+1:1,at:now,killerId:killer.id,victimId:victim.id,weapon,headshot});if(this.feed.length>8)this.feed.shift();}
  }
  private respawn(p:Pilot,now:number,loadout?:PgLoadout,position?:PgPlayer["position"]):void {if(loadout)p.loadout=structuredClone(loadout);else if(!this.mode&&p.queuedLoadout){p.loadout=p.queuedLoadout;delete p.queuedLoadout;}const s=pgChooseSpawn(p.team,this.players.values(),this.deathDanger,now);Object.assign(p,pgSpawnMotion(position??s.position,s.yaw));p.hp=100;p.lifeId++;p.deadAt=0;p.respawnAt=0;p.protectedUntil=now+1000;p.lastDamageAt=now;p.lastAttacker=null;p.guns=[pgCreateGun(p.loadout.primary,p.loadout.primaryModules),pgCreateGun(p.loadout.secondary,p.loadout.secondaryModules)];p.slot=0;p.adsSince=0;p.fireReadyAt=now+150;p.input={...idle(),sequence:p.lastInputSequence,yaw:s.yaw};p.bot=pgBotMemory();}
  private reward(now:number):void {this.rewarded=true;if(now-this.startedAt<60000||!this.mode&&this.players.size<6)return;for(const p of this.players.values())if(!p.isBot){const contribution=this.mode?.snapshot(p.id).pilots[p.id]?.contribution??0;if(this.mode&&p.kills===0&&contribution<=0)continue;const old=p.sessionLevel,win=p.team===this.match.winner;p.fallbucks+=5+Math.min(15,p.kills+Math.floor(contribution/100))+(win?10:0);p.sessionTotalXp+=25+Math.min(100,p.kills*5+Math.floor(contribution/10))+(win?35:0);p.sessionLevel=sessionLevelForXp(p.sessionTotalXp);p.sessionXp=sessionXpInLevel(p.sessionTotalXp);for(const r of PLANET_PASS_REWARDS)if(r.level>old&&r.level<=p.sessionLevel&&!p.unlockedPassRewards.includes(r.id)){p.unlockedPassRewards.push(r.id);p.fallbucks+=r.fallbucks??0;if(r.cosmeticId&&!p.ownedCosmetics.includes(r.cosmeticId))p.ownedCosmetics.push(r.cosmeticId);}}this.onProgress?.(this.players.values());}
  leave(id:string):void {this.onProgress?.(this.players.values());this.mode?.leave(id,Date.now());this.selections.delete(id);this.selectedLoadouts.delete(id);this.savedKits.delete(id);this.actionSequences.delete(id);this.players.delete(id);this.combat.forget(id);if(this.hostId===id)this.migrateHost();this.emitRoom();}
  disconnect(id:string):void{const p=this.players.get(id);if(p){p.connected=false;p.socketId=null;p.disconnectedAt=Date.now();p.input=idle();if(this.hostId===id)this.migrateHost();this.emitRoom();}}
  isEmpty():boolean{return ![...this.players.values()].some(p=>!p.isBot&&(p.connected||p.disconnectedAt!==null&&Date.now()-p.disconnectedAt<B.disconnectGraceMs));}
  dispose():void{this.onProgress?.(this.players.values());this.players.clear();this.combat.clear();}
  returnToLobby(id:string):void{if(id!==this.hostId||this.phase!=="results")return;for(const [key,p]of this.players)if(p.isBot)this.players.delete(key);else {p.ready=false;const kit=this.savedKits.get(p.id);if(kit)p.loadout=structuredClone(kit);}this.savedKits.clear();this.mode=null;this.modeStarted=false;this.world.reset([],Date.now());this.match=new PgMatch(this.configuration.scoreLimit);this.emitRoom();}
  buyShopItem(id:string,itemId:string):{ok:boolean;error?:string}{const p=this.players.get(id),item=SHOP_CATALOG.find(i=>i.id===itemId&&!i.passLevel&&i.category!=="planet");if(!p||!item||!["lobby","results"].includes(this.phase))return {ok:false,error:"Shop is available between matches."};if(p.ownedCosmetics.includes(itemId)||p.fallbucks<item.price)return {ok:false,error:"Already owned or insufficient Fallbucks."};p.fallbucks-=item.price;p.ownedCosmetics.push(itemId);this.emitRoom();return {ok:true};}
  equipShopItem(id:string,itemId:string):{ok:boolean;error?:string}{const p=this.players.get(id),item=SHOP_CATALOG.find(i=>i.id===itemId);if(!p||!item||item.category==="planet"||item.category==="emote"||!p.ownedCosmetics.includes(itemId)||!["lobby","results"].includes(this.phase))return {ok:false,error:"Cannot equip that item here."};p.equippedCosmetics[item.category]=item.id;this.emitRoom();return {ok:true};}
  private hideEquipment(state:Pick<PgPlayer,"loadout"|"queuedLoadout"|"guns"|"slot"|"hp">):void{state.hp=state.hp>0?100:0;state.loadout={primary:"pulse",secondary:"orbit"};delete state.queuedLoadout;state.slot=0;state.guns=[pgCreateGun("pulse"),pgCreateGun("orbit")];for(const gun of state.guns){gun.magazine=0;gun.reserve=0;}}
  private migrateHost():void{this.hostId=[...this.players.values()].find(p=>!p.isBot&&p.connected)?.id??"";}
  private emitRoom():void{this.onProgress?.(this.players.values());if(this.configuration.mode==="planetsiege"){for(const p of this.players.values())if(p.socketId)this.io.to(p.socketId).emit("pg:room:state",this.view(p.id));}else this.io.to(this.code).emit("pg:room:state",this.view());}
  private error(id:string,message:string){const socket=this.players.get(id)?.socketId;if(socket)this.io.to(socket).emit("pg:error",{message});}
  private panelTargets():PgModeTarget[]{return this.world.snapshot().panels.filter(p=>p.active).map(panel=>({id:panel.solid.id,kind:"panel",position:panel.solid.center,half:panel.solid.half,damage:(amount,_shooter,now)=>this.mode?.id==="planetzombies"&&panel.maxHp>=1000000?0:this.world.damage(panel.id,amount,now)}));}
  private modeDamage(target:PgPlayer,attacker:PgPlayer|null,amount:number,now:number){if(!this.mode)return 0;const wasAlive=target.hp>0,result=this.mode.damage(target,attacker,amount,now);if(wasAlive&&target.hp<=0)this.kill(this.players.get(target.id)!,attacker?this.players.get(attacker.id)??null:null,attacker?.guns[attacker.slot].id??"comet",false,now);return result;}
  modeAction(id:string,raw:unknown,now=Date.now()):PgModeActionResult{
    const p=this.players.get(id),a=pgValidateModeAction(raw);if(!p||!a)return {ok:false,error:"Invalid action."};
    if(!Number.isSafeInteger(a.sequence)||a.sequence<0||a.sequence<=(this.actionSequences.get(id)??-1)||a.lifeId!==p.lifeId||!["select","buy","interact","ability","deploy","drone","camera","pickup"].includes(a.kind))return {ok:false,error:"Stale or malformed action."};
    this.actionSequences.set(id,a.sequence);
    if(a.kind==="ability"&&(![0,1,2].includes(a.slot)||a.position&&![a.position.x,a.position.y,a.position.z].every(Number.isFinite)))return {ok:false,error:"Invalid ability target."};
    if(this.phase==="lobby"&&a.kind==="select"){
      const mode=this.configuration.mode,side=p.team==="solar"?"attack":"defend",ids=mode==="planetwatch"?PG_HERO_IDS:mode==="planetsiege"?PG_OPERATOR_IDS.filter(i=>PG_OPERATORS[i].side===side):[];
      if(!(ids as readonly string[]).includes(a.characterId))return {ok:false,error:"Invalid character for this team."};
      if([...this.selections].some(([key,value])=>key!==id&&value===a.characterId&&this.players.get(key)?.team===p.team))return {ok:false,error:"A teammate reserved that character."};if(a.loadout){const loadout=mode==="planetwatch"?pgValidateHeroLoadout(a.characterId,a.loadout):pgValidateOperatorLoadout(a.characterId,a.loadout);if(!loadout)return {ok:false,error:"Illegal character equipment."};this.selectedLoadouts.set(id,loadout);}else if(this.selections.get(id)!==a.characterId)this.selectedLoadouts.delete(id);this.selections.set(id,a.characterId);this.emitRoom();return {ok:true};
    }
    if(!this.mode||!this.modeStarted||!["playing","overtime"].includes(this.phase))return {ok:false,error:"This action is unavailable."};return this.mode.action(p,a,now);
  }
  private makePlayer(name:string,isBot:boolean):Pilot {const team=this.configuration.mode==="planetzombies"?"solar":[...this.players.values()].filter(p=>p.team==="solar").length<=[...this.players.values()].filter(p=>p.team==="void").length?"solar":"void";return {...pgSpawnMotion({x:0,y:0,z:0}),id:`pg-${randomUUID().slice(0,12)}`,name,color:team==="solar"?"#ffba62":"#80dfff",team,isBot,connected:!isBot,ready:isBot,hp:100,kills:0,deaths:0,lifeId:0,deadAt:0,respawnAt:0,protectedUntil:0,lastDamageAt:0,lastAttacker:null,lastInputSequence:-1,loadout:{primary:"pulse",secondary:"comet"},slot:0,guns:[pgCreateGun("pulse"),pgCreateGun("comet")],adsSince:0,fireReadyAt:0,fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"],socketId:null,sessionToken:randomBytes(24).toString("base64url"),disconnectedAt:null,input:idle(),lastInputAt:0,bot:pgBotMemory(),fireSequence:0};}
}
