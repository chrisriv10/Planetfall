import {randomBytes,randomUUID} from "node:crypto";
import type {Server,Socket} from "socket.io";
import {DEFAULT_COSMETICS,SHOP_CATALOG,PLANET_PASS_REWARDS,PG_BALANCE as B,PG_WEAPONS,PG_PRIMARY_WEAPONS,pgCreateGun,pgFinishReload,pgSanitizeInput,pgSpawnMotion,pgStartReload,pgStepMovement,sessionLevelForXp,sessionXpInLevel,type ClientToServerEvents,type ServerToClientEvents,type GuestProfile,type PgPlayer,type PgInput,type PgJoinResult,type PgRoomView,type PgConfiguration,type PgLoadout,type PgSnapshot,type PgFireRequest} from "@planetfall/shared";
import {PgCombat} from "./pg-combat.js";
import {PgMatch} from "./pg-match.js";
import {pgChooseSpawn,type PgSpawnDanger} from "./pg-spawns.js";
import {pgBotInput,pgBotMemory,type PgBotMemory} from "./pg-bots.js";
type GameServer=Server<ClientToServerEvents,ServerToClientEvents>;
type GameSocket=Socket<ClientToServerEvents,ServerToClientEvents>;
interface Pilot extends PgPlayer {socketId:string|null;sessionToken:string;disconnectedAt:number|null;input:PgInput;lastInputAt:number;bot:PgBotMemory;fireSequence:number;}
const idle=():PgInput=>({sequence:0,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,ads:false});
const publicPlayer=(p:Pilot):PgPlayer=>{const {socketId,sessionToken,disconnectedAt,input,lastInputAt,bot,fireSequence,...state}=p;return structuredClone(state);};
export class PlanetGunRoom {
  readonly family="planet-gun" as const;readonly players=new Map<string,Pilot>();
  hostId="";configuration:PgConfiguration={targetPlayers:12,fillBots:true,botDifficulty:"normal",scoreLimit:75};
  private match=new PgMatch();private combat=new PgCombat();private accumulator=0;private lastSnapshot=0;private startedAt=0;private rewarded=false;private feed:PgSnapshot["feed"]=[];private deathDanger:PgSpawnDanger[]=[];
  onProgress?:(players:Iterable<GuestProfile>)=>void;
  constructor(readonly code:string,private readonly io:GameServer){}
  get phase(){return this.match.phase;}
  view():PgRoomView{return {gameFamily:this.family,code:this.code,hostId:this.hostId,phase:this.phase,configuration:{...this.configuration},players:[...this.players.values()].map(publicPlayer)};}
  snapshot(now:number):PgSnapshot{return {phase:this.phase,serverTime:now,phaseEndsAt:this.match.phaseEndsAt,scores:{...this.match.scores},winner:this.match.winner,feed:this.feed.map(k=>({...k})),players:[...this.players.values()].map(p=>{const {fallbucks,crowns,sessionTotalXp,sessionLevel,sessionXp,ownedCosmetics,unlockedPassRewards,...state}=publicPlayer(p);return state;})};}
  join(socket:GameSocket,name:unknown,token?:string):PgJoinResult {
    const now=Date.now(),returning=token?[...this.players.values()].find(p=>p.sessionToken===token&&!p.connected&&p.disconnectedAt!==null&&now-p.disconnectedAt<B.disconnectGraceMs):undefined;
    if(!returning&&this.phase!=="lobby")return {ok:false,error:"This match has started. Reconnect using the original session."};
    if(!returning&&this.players.size>=B.maxPlayers)return {ok:false,error:"PlanetGun is full."};
    const p=returning??this.makePlayer(typeof name==="string"?name.trim().replace(/[^a-zA-Z0-9 _-]/g,"").slice(0,18)||"Pilot":"Pilot",false);
    if(returning)this.combat.forget(p.id);
    p.connected=true;p.disconnectedAt=null;p.socketId=socket.id;p.input={...idle(),yaw:p.yaw,pitch:p.pitch};p.lastInputAt=now;this.players.set(p.id,p);if(!this.hostId)this.hostId=p.id;
    void socket.join(this.code);socket.data.roomCode=this.code;socket.data.playerId=p.id;socket.data.gameFamily=this.family;
    this.emitRoom();this.io.to(socket.id).emit("pg:match:snapshot",this.snapshot(now));return {ok:true,room:this.view(),playerId:p.id,sessionToken:p.sessionToken};
  }
  configure(id:string,p:Partial<PgConfiguration>):void{if(id!==this.hostId||this.phase!=="lobby")return;if([4,8,12].includes(p.targetPlayers!))this.configuration.targetPlayers=p.targetPlayers!;if([25,50,75].includes(p.scoreLimit!))this.configuration.scoreLimit=p.scoreLimit!;if(typeof p.fillBots==="boolean")this.configuration.fillBots=p.fillBots;if(["easy","normal","hard"].includes(p.botDifficulty!))this.configuration.botDifficulty=p.botDifficulty!;this.emitRoom();}
  setReady(id:string,ready:boolean):void{const p=this.players.get(id);if(p&&this.phase==="lobby"){p.ready=!!ready;this.emitRoom();}}
  setLoadout(id:string,loadout:PgLoadout):void {const p=this.players.get(id);if(!p||!loadout||!PG_PRIMARY_WEAPONS.includes(loadout.primary)||loadout.secondary!=="comet"||!["lobby","results"].includes(this.phase)&&p.hp>0)return;p.loadout={primary:loadout.primary,secondary:"comet"};if(this.phase==="lobby")p.guns=[pgCreateGun(loadout.primary),pgCreateGun("comet")];this.emitRoom();}
  start(id:string,now=Date.now()):boolean {
    if(id!==this.hostId||this.phase!=="lobby")return false;const humans=[...this.players.values()].filter(p=>!p.isBot&&p.connected);if(!humans.length||humans.some(p=>!p.ready))return false;
    for(const [key,p]of this.players)if(p.isBot)this.players.delete(key);
    if(this.configuration.fillBots)while(this.players.size<this.configuration.targetPlayers){const p=this.makePlayer(`Nova ${this.players.size+1}`,true);this.players.set(p.id,p);}
    if(this.players.size<2)return false;
    this.match=new PgMatch(this.configuration.scoreLimit);this.match.start(now);this.startedAt=now;this.rewarded=false;this.feed=[];this.deathDanger=[];this.combat.clear();this.accumulator=0;
    let i=0;for(const p of this.players.values()){p.team=i++%2?"void":"solar";p.hp=0;p.kills=0;p.deaths=0;this.respawn(p,now);}
    this.combat.history.record(this.players.values(),now);this.emitRoom();return true;
  }
  setInput(id:string,raw:unknown):void {const p=this.players.get(id),input=pgSanitizeInput(raw);if(!p||p.isBot||p.hp<=0||!input||!["playing","overtime"].includes(this.phase)||input.sequence<=Math.max(p.lastInputSequence,p.input.sequence))return;input.jump||=p.input.sequence>p.lastInputSequence&&p.input.jump;p.input=input;p.lastInputAt=Date.now();}
  fire(id:string,request:PgFireRequest,now=Date.now()):void {if(!["playing","overtime"].includes(this.phase))return;const p=this.players.get(id);if(!p)return;const shots=this.combat.fire(p,request,this.players.values(),now);for(const shot of shots){this.io.to(this.code).emit("pg:combat:shot",shot);if(shot.targetId){const victim=this.players.get(shot.targetId);if(victim&&victim.hp<=0)this.kill(victim,p,shot.weapon,shot.headshot,now);}}if(this.phase==="results"){this.reward(now);this.emitRoom();}}
  reload(id:string,now=Date.now()):void{const p=this.players.get(id);if(p&&p.hp>0&&["playing","overtime"].includes(this.phase))pgStartReload(p.guns[p.slot],now);}
  switchWeapon(id:string,slot:unknown,now=Date.now()):void {const p=this.players.get(id);if(!p||p.hp<=0||slot!==0&&slot!==1||p.slot===slot)return;p.guns[p.slot].reloadUntil=0;p.slot=slot;p.adsSince=0;p.fireReadyAt=now+200;}
  update(dt:number,now:number):void {
    for(const [id,p]of this.players)if(!p.isBot&&!p.connected&&p.disconnectedAt!==null&&now-p.disconnectedAt>=B.disconnectGraceMs){this.onProgress?.([p]);this.players.delete(id);this.combat.forget(id);}
    const previous=this.phase;this.match.update(now);
    if(["playing","overtime"].includes(this.phase)){this.accumulator+=Math.max(0,Math.min(.1,dt));while(this.accumulator>=1/B.tickRate){this.accumulator-=1/B.tickRate;this.step(1/B.tickRate,now-this.accumulator*1000);if(this.phase==="results")break;}}
    if(this.phase==="results"&&!this.rewarded)this.reward(now);
    if(previous!==this.phase)this.emitRoom();
    if(this.phase!=="lobby"&&now-this.lastSnapshot>=1000/B.snapshotRate){this.lastSnapshot=now;this.io.to(this.code).emit("pg:match:snapshot",this.snapshot(now));}
  }
  private step(dt:number,now:number):void {
    const shots:{id:string;sequence:number}[]=[];
    for(const p of this.players.values()){
      if(p.hp<=0){if(now>=p.respawnAt)this.respawn(p,now);else continue;}
      let input=p.input;
      if(p.isBot){const decision=pgBotInput(p,this.players.values(),now,this.configuration.botDifficulty,p.bot);input=decision.input;if(decision.fire)shots.push({id:p.id,sequence:++p.fireSequence});if(p.guns[p.slot].magazine===0)this.reload(p.id,now);}
      else if(!p.connected||now-p.lastInputAt>400)input={...idle(),sequence:p.input.sequence,yaw:p.yaw,pitch:p.pitch};
      const wasSprint=p.mode==="sprint";pgStepMovement(p,input,dt,now);p.lastInputSequence=input.sequence;
      if(wasSprint&&p.mode!=="sprint")p.fireReadyAt=Math.max(p.fireReadyAt,now+PG_WEAPONS[p.guns[p.slot].id].sprintDelayMs);
      if(input.ads&&p.mode!=="sprint"){if(!p.adsSince)p.adsSince=now;}else p.adsSince=0;
      for(const gun of p.guns){pgFinishReload(gun,now);gun.recoil=Math.max(0,gun.recoil-dt*.09);}
      if(now-p.lastDamageAt>B.regenDelayMs)p.hp=Math.min(100,p.hp+B.regenPerSecond*dt);
      if(p.position.y<-8)this.kill(p,null,p.guns[p.slot].id,false,now);
    }
    this.combat.history.record(this.players.values(),now);
    for(const shot of shots){const p=this.players.get(shot.id)!;this.fire(p.id,{sequence:shot.sequence,clientTime:now,weapon:p.guns[p.slot].id,yaw:p.yaw,pitch:p.pitch},now);}
    this.deathDanger=this.deathDanger.filter(d=>now-d.at<8000);
  }
  private kill(victim:Pilot,killer:Pilot|null,weapon:PgPlayer["guns"][0]["id"],headshot:boolean,now:number):void {
    if(!this.match.elimination(victim.id,victim.lifeId,killer?.team??null,victim.team))return;
    victim.hp=0;victim.deaths++;victim.deadAt=now;victim.respawnAt=now+B.respawnMs;victim.velocity={x:0,y:0,z:0};this.deathDanger.push({position:{...victim.position},at:now});
    if(killer&&killer.team!==victim.team){killer.kills++;this.feed.push({id:this.feed.length?this.feed.at(-1)!.id+1:1,at:now,killerId:killer.id,victimId:victim.id,weapon,headshot});if(this.feed.length>8)this.feed.shift();}
  }
  private respawn(p:Pilot,now:number):void {const s=pgChooseSpawn(p.team,this.players.values(),this.deathDanger,now);Object.assign(p,pgSpawnMotion(s.position,s.yaw));p.hp=100;p.lifeId++;p.deadAt=0;p.respawnAt=0;p.protectedUntil=now+1000;p.lastDamageAt=now;p.lastAttacker=null;p.guns=[pgCreateGun(p.loadout.primary),pgCreateGun("comet")];p.slot=0;p.adsSince=0;p.fireReadyAt=now+150;p.input={...idle(),sequence:p.lastInputSequence,yaw:s.yaw};p.bot=pgBotMemory();}
  private reward(now:number):void {this.rewarded=true;if(now-this.startedAt<60000||this.players.size<6)return;for(const p of this.players.values())if(!p.isBot){const old=p.sessionLevel,win=p.team===this.match.winner;p.fallbucks+=5+Math.min(15,p.kills)+(win?10:0);p.sessionTotalXp+=25+Math.min(100,p.kills*5)+(win?35:0);p.sessionLevel=sessionLevelForXp(p.sessionTotalXp);p.sessionXp=sessionXpInLevel(p.sessionTotalXp);for(const r of PLANET_PASS_REWARDS)if(r.level>old&&r.level<=p.sessionLevel&&!p.unlockedPassRewards.includes(r.id)){p.unlockedPassRewards.push(r.id);p.fallbucks+=r.fallbucks??0;if(r.cosmeticId&&!p.ownedCosmetics.includes(r.cosmeticId))p.ownedCosmetics.push(r.cosmeticId);}}this.onProgress?.(this.players.values());}
  leave(id:string):void {this.onProgress?.(this.players.values());this.players.delete(id);this.combat.forget(id);if(this.hostId===id)this.migrateHost();this.emitRoom();}
  disconnect(id:string):void{const p=this.players.get(id);if(p){p.connected=false;p.socketId=null;p.disconnectedAt=Date.now();p.input=idle();if(this.hostId===id)this.migrateHost();this.emitRoom();}}
  isEmpty():boolean{return ![...this.players.values()].some(p=>!p.isBot&&(p.connected||p.disconnectedAt!==null&&Date.now()-p.disconnectedAt<B.disconnectGraceMs));}
  dispose():void{this.onProgress?.(this.players.values());this.players.clear();this.combat.clear();}
  returnToLobby(id:string):void{if(id!==this.hostId||this.phase!=="results")return;for(const [key,p]of this.players)if(p.isBot)this.players.delete(key);else p.ready=false;this.match=new PgMatch(this.configuration.scoreLimit);this.emitRoom();}
  buyShopItem(id:string,itemId:string):{ok:boolean;error?:string}{const p=this.players.get(id),item=SHOP_CATALOG.find(i=>i.id===itemId&&!i.passLevel&&i.category!=="planet");if(!p||!item||!["lobby","results"].includes(this.phase))return {ok:false,error:"Shop is available between matches."};if(p.ownedCosmetics.includes(itemId)||p.fallbucks<item.price)return {ok:false,error:"Already owned or insufficient Fallbucks."};p.fallbucks-=item.price;p.ownedCosmetics.push(itemId);this.emitRoom();return {ok:true};}
  equipShopItem(id:string,itemId:string):{ok:boolean;error?:string}{const p=this.players.get(id),item=SHOP_CATALOG.find(i=>i.id===itemId);if(!p||!item||item.category==="planet"||item.category==="emote"||!p.ownedCosmetics.includes(itemId)||!["lobby","results"].includes(this.phase))return {ok:false,error:"Cannot equip that item here."};p.equippedCosmetics[item.category]=item.id;this.emitRoom();return {ok:true};}
  private migrateHost():void{this.hostId=[...this.players.values()].find(p=>!p.isBot&&p.connected)?.id??"";}
  private emitRoom():void{this.onProgress?.(this.players.values());this.io.to(this.code).emit("pg:room:state",this.view());}
  private makePlayer(name:string,isBot:boolean):Pilot {const team=[...this.players.values()].filter(p=>p.team==="solar").length<=[...this.players.values()].filter(p=>p.team==="void").length?"solar":"void";return {...pgSpawnMotion({x:0,y:0,z:0}),id:`pg-${randomUUID().slice(0,12)}`,name,color:team==="solar"?"#ffba62":"#80dfff",team,isBot,connected:!isBot,ready:isBot,hp:100,kills:0,deaths:0,lifeId:0,deadAt:0,respawnAt:0,protectedUntil:0,lastDamageAt:0,lastAttacker:null,lastInputSequence:-1,loadout:{primary:"pulse",secondary:"comet"},slot:0,guns:[pgCreateGun("pulse"),pgCreateGun("comet")],adsSince:0,fireReadyAt:0,fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"],socketId:null,sessionToken:randomBytes(24).toString("base64url"),disconnectedAt:null,input:idle(),lastInputAt:0,bot:pgBotMemory(),fireSequence:0};}
}
