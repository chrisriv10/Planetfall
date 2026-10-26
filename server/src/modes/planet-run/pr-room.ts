import {randomBytes,randomUUID} from "node:crypto";
import type {Server,Socket} from "socket.io";
import {DEFAULT_COSMETICS,FREE_EMOTES,SHOP_CATALOG,PLANET_PASS_REWARDS,PR_BALANCE as B,PR_ROUNDS,PrTileState,prBump,prQualificationTarget,prRank,prSanitizeInput,prSelectRound,prRound,prSpawn,prStepMotion,sessionLevelForXp,sessionXpInLevel,type ClientToServerEvents,type GuestProfile,type PrConfiguration,type PrInput,type PrJoinResult,type PrPhase,type PrPlayerState,type PrRoomView,type PrRoundDefinition,type PrSnapshot,type ServerToClientEvents,type Vec3} from "@planetfall/shared";
import {prBotInput,PrCrowdGrid,PR_CROWD_LIMITS,type PrBotMemory} from "./pr-bots.js";
type GameServer=Server<ClientToServerEvents,ServerToClientEvents>;
type GameSocket=Socket<ClientToServerEvents,ServerToClientEvents>;
interface Record extends PrPlayerState {socketId:string|null;sessionToken:string;disconnectedAt:number|null;input:PrInput;lastInputAt:number;respawnAt:number;bot:PrBotMemory;eliminatedAt:number;}
const idle=():PrInput=>({sequence:0,moveX:0,moveZ:0,jump:false,dive:false});
const publicPlayer=(p:Record):PrPlayerState=>{const {socketId,sessionToken,disconnectedAt,input,lastInputAt,respawnAt,bot,eliminatedAt,...state}=p;return {...state,position:{...state.position},velocity:{...state.velocity},equippedCosmetics:{...state.equippedCosmetics},ownedCosmetics:[...state.ownedCosmetics],unlockedPassRewards:[...state.unlockedPassRewards]};};
const inside=(p:Vec3,box:{center:Vec3;half:Vec3})=>Math.abs(p.x-box.center.x)<=box.half.x&&Math.abs(p.y-box.center.y)<=box.half.y&&Math.abs(p.z-box.center.z)<=box.half.z;

export class PlanetRunRoom {
  readonly family="planet-run" as const;
  readonly players=new Map<string,Record>();
  hostId="";phase:PrPhase="lobby";configuration:PrConfiguration={targetPlayers:20,fillBots:true,botDifficulty:"normal"};
  round:PrRoundDefinition|null=null;roundIndex=0;seed=0;roundStartedAt=0;phaseEndsAt=0;qualificationTarget=0;winnerId:string|null=null;
  tiles=new PrTileState([]);onProgress?:(players:Iterable<GuestProfile>)=>void;
  private crowd:PrCrowdGrid|null=null;private crowdEpoch=-1;
  private accumulator=0;private lastSnapshot=0;private matchStartedAt=0;private rewarded=false;private finishOrder:string[]=[];private roundParticipants=new Set<string>();
  constructor(readonly code:string,private readonly io:GameServer){}
  view():PrRoomView{return {code:this.code,gameFamily:this.family,hostId:this.hostId,phase:this.phase,configuration:{...this.configuration},players:[...this.players.values()].map(publicPlayer)};}
  join(socket:GameSocket,name:unknown,sessionToken?:string):PrJoinResult {
    const returning=sessionToken?[...this.players.values()].find(p=>p.sessionToken===sessionToken&&!p.connected&&p.disconnectedAt!==null&&Date.now()-p.disconnectedAt<B.disconnectGraceMs):undefined;
    if(!returning&&this.phase!=="lobby")return {ok:false,error:"PlanetRun is already running. Reconnect with your original pilot session."};
    if(!returning&&this.players.size>=B.maxPlayers)return {ok:false,error:"This PlanetRun room is full."};
    const p=returning??this.makePlayer(typeof name==="string"?name.trim().replace(/[^a-zA-Z0-9 _-]/g,"").slice(0,18)||"Pilot":"Pilot",false);
    p.connected=true;p.disconnectedAt=null;p.socketId=socket.id;p.input=idle();this.players.set(p.id,p);
    if(!this.hostId)this.hostId=p.id;
    void socket.join(this.code);socket.data.roomCode=this.code;socket.data.playerId=p.id;socket.data.gameFamily=this.family;
    this.emitRoom();this.io.to(socket.id).emit("pr:match:snapshot",this.snapshot(Date.now(),true));
    return {ok:true,room:this.view(),playerId:p.id,sessionToken:p.sessionToken};
  }
  configure(id:string,payload:Partial<PrConfiguration>):void {
    if(id!==this.hostId||this.phase!=="lobby")return;
    if([10,20,30].includes(Number(payload.targetPlayers)))this.configuration.targetPlayers=payload.targetPlayers!;
    if(typeof payload.fillBots==="boolean")this.configuration.fillBots=payload.fillBots;
    if(["easy","normal","hard"].includes(String(payload.botDifficulty)))this.configuration.botDifficulty=payload.botDifficulty!;
    this.emitRoom();
  }
  setReady(id:string,ready:boolean):void{const p=this.players.get(id);if(this.phase==="lobby"&&p&&!p.isBot){p.ready=!!ready;this.emitRoom();}}
  start(id:string,now=Date.now()):boolean {
    if(id!==this.hostId||this.phase!=="lobby")return false;
    const humans=[...this.players.values()].filter(p=>!p.isBot&&p.connected);
    if(!humans.length||humans.some(p=>!p.ready))return false;
    for(const [key,p]of this.players)if(p.isBot)this.players.delete(key);
    if(this.configuration.fillBots)while(this.players.size<this.configuration.targetPlayers){const p=this.makePlayer(`Pilot ${this.players.size+1}`,true);this.players.set(p.id,p);}
    if(this.players.size<2)return false;
    this.seed=randomBytes(4).readUInt32LE();this.matchStartedAt=now;this.roundIndex=0;this.rewarded=false;this.winnerId=null;
    for(const p of this.players.values()){p.status="active";p.qualifiedRounds=0;p.place=0;}
    this.beginRound(now);return true;
  }
  setInput(id:string,raw:unknown):void {
    const p=this.players.get(id),input=prSanitizeInput(raw);
    if(!p||p.isBot||this.phase!=="running"||p.status!=="active"||!input||input.sequence<=Math.max(p.lastInputSequence,p.input.sequence))return;
    input.jump||=p.input.sequence>p.lastInputSequence&&p.input.jump;input.dive||=p.input.sequence>p.lastInputSequence&&p.input.dive;
    p.input=input;p.lastInputAt=Date.now();
  }
  leave(id:string):void{const p=this.players.get(id);if(!p)return;this.onProgress?.(this.players.values());this.players.delete(id);if(this.hostId===id)this.migrateHost();this.emitRoom();}
  disconnect(id:string):void {const p=this.players.get(id);if(!p)return;p.connected=false;p.socketId=null;p.disconnectedAt=Date.now();p.input=idle();if(id===this.hostId)this.migrateHost();this.emitRoom();}
  isEmpty():boolean{return ![...this.players.values()].some(p=>!p.isBot&&(p.connected||p.disconnectedAt!==null&&Date.now()-p.disconnectedAt<B.disconnectGraceMs));}
  dispose():void{this.onProgress?.(this.players.values());this.players.clear();this.tiles=new PrTileState([]);this.crowd=null;}
  returnToLobby(id:string):void{if(id!==this.hostId||this.phase!=="results")return;for(const [key,p]of this.players){if(p.isBot)this.players.delete(key);else {p.ready=false;p.status="active";}}this.phase="lobby";this.round=null;this.tiles=new PrTileState([]);this.emitRoom();}
  playEmote(id:string,emote:import("@planetfall/shared").EmoteType,now=Date.now()):void {
    const p=this.players.get(id),elapsed=now-this.roundStartedAt;
    if(!p||p.isBot||p.status!=="active"||this.phase!=="running"||!p.grounded||Math.hypot(p.velocity.x,p.velocity.z)>1||elapsed-p.emoteStartedAt<1800)return;
    if(!FREE_EMOTES.includes(emote)&&!SHOP_CATALOG.some(i=>i.category==="emote"&&i.emote===emote&&p.ownedCosmetics.includes(i.id)))return;
    p.emote=emote;p.emoteStartedAt=elapsed;
  }
  syncTiles(id:string):void{const p=this.players.get(id);if(p?.socketId)this.io.to(p.socketId).emit("pr:match:snapshot",this.snapshot(Date.now(),true));}
  update(dt:number,now:number):void {
    for(const [id,p]of this.players)if(!p.connected&&!p.isBot&&p.disconnectedAt!==null&&now-p.disconnectedAt>=B.disconnectGraceMs){this.onProgress?.([p]);this.players.delete(id);}
    if(this.phase==="intro"&&now>=this.phaseEndsAt){this.phase="countdown";this.phaseEndsAt=now+B.countdownMs;this.emitRoom();}
    else if(this.phase==="countdown"&&now>=this.phaseEndsAt){this.phase="running";this.roundStartedAt=now;this.phaseEndsAt=now+this.round!.timeoutMs;this.accumulator=0;this.emitRoom();}
    else if(this.phase==="round-results"&&now>=this.phaseEndsAt){this.roundIndex++;this.beginRound(now);}
    if(this.phase==="running"&&this.round){
      this.accumulator+=Math.max(0,Math.min(.1,dt));
      while(this.accumulator>=1/B.tickRate){this.accumulator-=1/B.tickRate;this.step(1/B.tickRate,now-this.accumulator*1000);if(this.phase!=="running")break;}
      if(this.phase==="running")this.resolveRound(now);
    }
    if(this.phase!=="lobby"&&now-this.lastSnapshot>=1000/B.snapshotRate){this.lastSnapshot=now;this.io.to(this.code).emit("pr:match:snapshot",this.snapshot(now,false));}
  }
  buyShopItem(id:string,itemId:string):{ok:boolean;error?:string} {
    const p=this.players.get(id),item=SHOP_CATALOG.find(i=>i.id===itemId&&!i.passLevel&&i.category!=="planet");
    if(!p||!item||!["lobby","results"].includes(this.phase))return {ok:false,error:"Shop is available between matches."};
    if(p.ownedCosmetics.includes(itemId))return {ok:false,error:"Already owned."};
    if(p.fallbucks<item.price)return {ok:false,error:"Not enough Fallbucks."};
    p.fallbucks-=item.price;p.ownedCosmetics.push(itemId);this.emitRoom();return {ok:true};
  }
  equipShopItem(id:string,itemId:string):{ok:boolean;error?:string} {
    const p=this.players.get(id),item=SHOP_CATALOG.find(i=>i.id===itemId);
    if(!p||!item||item.category==="emote"||item.category==="planet"||!p.ownedCosmetics.includes(itemId)||!["lobby","results"].includes(this.phase))return {ok:false,error:"You cannot equip that item here."};
    p.equippedCosmetics[item.category]=item.id;this.emitRoom();return {ok:true};
  }
  /** Called only by the explicitly enabled development review protocol. */
  startReview(id:string,roundId:import("@planetfall/shared").PrRoundId,seed:number,players:10|20|30,now=Date.now()):boolean {
    if(this.hostId!==id||this.phase!=="lobby"||!PR_ROUNDS.some(r=>r.id===roundId)||!Number.isSafeInteger(seed)||![10,20,30].includes(players))return false;
    this.configure(id,{targetPlayers:players,fillBots:true});this.setReady(id,true);if(!this.start(id,now))return false;
    this.seed=seed;this.round=prRound(roundId);this.tiles=new PrTileState(this.round.tiles);this.qualificationTarget=prQualificationTarget(this.players.size,this.round.category,0);
    let i=0;for(const p of this.players.values()){Object.assign(p,prSpawn(this.round.spawns[i++]));p.bot={goal:0,nextDecision:0,sequence:0};}
    this.io.to(this.code).emit("pr:match:snapshot",this.snapshot(now,true));return true;
  }
  private beginRound(now:number):void {
    this.crowd=null;this.crowdEpoch=-1;
    const active=[...this.players.values()].filter(p=>p.status!=="eliminated");
    if(active.length<=1){this.finish(active[0]?.id??null,now);return;}
    this.round=prSelectRound(PR_ROUNDS,active.length,this.roundIndex,this.round?.id??null,this.seed);this.tiles=new PrTileState(this.round.tiles);this.finishOrder=[];this.roundParticipants=new Set(active.map(p=>p.id));
    this.qualificationTarget=prQualificationTarget(active.length,this.round.category,this.roundIndex);
    for(let i=0;i<active.length;i++){const p=active[i];Object.assign(p,prSpawn(this.round.spawns[i]));p.status="active";p.checkpoint=0;p.bot={goal:0,nextDecision:0,sequence:0};p.input=idle();p.lastInputSequence=-1;p.respawnAt=0;p.eliminatedAt=0;p.emote=null;p.emoteStartedAt=-2000;}
    this.phase="intro";this.phaseEndsAt=now+B.introMs;this.roundStartedAt=now+B.introMs+B.countdownMs;this.emitRoom();
    this.io.to(this.code).emit("pr:match:snapshot",this.snapshot(now,true));
  }
  private step(dt:number,now:number):void {
    const round=this.round!,elapsed=now-this.roundStartedAt;
    const epoch=Math.floor(elapsed/PR_CROWD_LIMITS.decisionMs);
    if(!this.crowd||epoch!==this.crowdEpoch){this.crowdEpoch=epoch;this.crowd=new PrCrowdGrid([...this.players.values()].filter(p=>p.status==="active"&&!p.respawnAt),elapsed);}
    for(const p of this.players.values()){
      if(p.status!=="active")continue;
      if(p.respawnAt>now)continue;
      if(p.respawnAt){Object.assign(p,prSpawn(round.checkpoints[p.checkpoint]?.spawn??round.spawns[0]));p.respawnAt=0;p.bot={goal:0,nextDecision:0,sequence:p.bot.sequence,identitySeed:p.bot.identitySeed};}
      const input=p.isBot?prBotInput(p,round,this.tiles,elapsed,this.seed,this.configuration.botDifficulty,p.bot,this.crowd):now-p.lastInputAt<400?p.input:{...idle(),sequence:p.input.sequence};
      prStepMotion(p,input,dt,elapsed,round,this.seed,this.tiles);p.lastInputSequence=input.sequence;
      if(round.category==="race"){
        for(let i=p.checkpoint+1;i<round.checkpoints.length;i++)if(i===p.checkpoint+1&&inside(p.position,round.checkpoints[i]))p.checkpoint=i;
        if(round.finish&&p.checkpoint===round.checkpoints.length-1&&inside(p.position,round.finish)&&!this.finishOrder.includes(p.id)){
          p.status="qualified";this.finishOrder.push(p.id);p.place=this.finishOrder.length;
        }
      }
      if(p.position.y<round.killY){if(round.category==="race"){p.respawnAt=now+B.respawnDelayMs;p.velocity={x:0,y:0,z:0};}else {p.status="eliminated";p.eliminatedAt=elapsed;}}
    }
    const active=[...this.players.values()].filter(p=>p.status==="active"&&!p.respawnAt);
    for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)prBump(active[i],active[j]);
    const changes=[];
    for(const p of active)if(p.grounded&&p.supportId?.startsWith("tile:")){const delta=this.tiles.contact(Number(p.supportId.slice(5)),elapsed);if(delta)changes.push(delta);}
    if(changes.length)this.io.to(this.code).emit("pr:tiles:delta",{roundIndex:this.roundIndex,revision:this.tiles.revision,tiles:changes});
  }
  private resolveRound(now:number):void {
    const round=this.round!,all=[...this.players.values()],active=all.filter(p=>p.status==="active"),expired=now>=this.phaseEndsAt;
    if(round.category==="race"&&this.finishOrder.length<this.qualificationTarget&&!expired&&active.length)return;
    if(round.category!=="race"&&active.length>this.qualificationTarget&&!expired)return;
    if(round.category==="final"){
      const candidates=active.length?active:all.filter(p=>this.roundParticipants.has(p.id)&&p.eliminatedAt>0);
      const ranked=prRank(candidates.map(p=>({id:p.id,progress:active.length?p.position.y:0,survivedMs:p.eliminatedAt||now-this.roundStartedAt})));
      this.finish(ranked[0]?.id??null,now);return;
    }
    // Race timeout never qualifies someone who did not cross the finish.
    // Survival timeout advances every remaining pilot, without arbitrary ID cuts.
    const qualifiers=round.category==="race"?this.finishOrder.slice(0,this.qualificationTarget):prRank(active.map(p=>({id:p.id,progress:0,survivedMs:now-this.roundStartedAt}))).map(p=>p.id);
    for(const p of all)if(p.status!=="eliminated"){p.status=qualifiers.includes(p.id)?"qualified":"eliminated";if(p.status==="qualified")p.qualifiedRounds++;}
    if(qualifiers.length<=1){this.finish(qualifiers[0]??null,now);return;}
    this.phase="round-results";this.phaseEndsAt=now+B.rosterMs;this.emitRoom();
  }
  private finish(winner:string|null,now:number):void {
    this.winnerId=winner;this.phase="results";
    if(!this.rewarded){
      this.rewarded=true;
      // A tiny/abandoned tournament cannot pay repeated participation rewards.
      const eligible=now-this.matchStartedAt>=60000&&this.players.size>=6;
      for(const p of this.players.values())if(!p.isBot&&eligible){
        const old=p.sessionLevel;p.sessionTotalXp+=20+p.qualifiedRounds*15+(p.id===winner?60:0);p.fallbucks+=5+p.qualifiedRounds*3+(p.id===winner?20:0);if(p.id===winner)p.crowns++;
        p.sessionLevel=sessionLevelForXp(p.sessionTotalXp);p.sessionXp=sessionXpInLevel(p.sessionTotalXp);
        for(const r of PLANET_PASS_REWARDS)if(r.level>old&&r.level<=p.sessionLevel&&!p.unlockedPassRewards.includes(r.id)){p.unlockedPassRewards.push(r.id);p.fallbucks+=r.fallbucks??0;if(r.cosmeticId&&!p.ownedCosmetics.includes(r.cosmeticId))p.ownedCosmetics.push(r.cosmeticId);}
      }
    }
    this.emitRoom();
  }
  private snapshot(now:number,full:boolean):PrSnapshot{return {serverTime:now,roundStartedAt:this.roundStartedAt,phaseEndsAt:this.phaseEndsAt,phase:this.phase,roundId:this.round?.id??null,roundIndex:this.roundIndex,seed:this.seed,players:[...this.players.values()].map(p=>{const {fallbucks,crowns,sessionTotalXp,sessionLevel,sessionXp,ownedCosmetics,unlockedPassRewards,...state}=publicPlayer(p);return state;}),qualificationTarget:this.qualificationTarget,winnerId:this.winnerId,tileRevision:this.tiles.revision,tilesFull:full,tiles:full?this.tiles.full():[]};}
  private migrateHost():void{this.hostId=[...this.players.values()].find(p=>!p.isBot&&p.connected)?.id??"";}
  private emitRoom():void{this.onProgress?.(this.players.values());this.io.to(this.code).emit("pr:room:state",this.view());}
  private makePlayer(name:string,isBot:boolean):Record {
    return {...prSpawn({x:0,y:.6,z:0}),id:`pr-${randomUUID().slice(0,12)}`,name,isBot,color:["#ff976c","#75e5d0","#bca0ff","#f8dc77"][this.players.size%4],connected:!isBot,ready:isBot,emote:null,emoteStartedAt:-2000,status:"active",checkpoint:0,place:0,qualifiedRounds:0,lastInputSequence:-1,fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"],socketId:null,sessionToken:randomBytes(24).toString("base64url"),disconnectedAt:null,input:idle(),lastInputAt:0,respawnAt:0,bot:{goal:0,nextDecision:0,sequence:0},eliminatedAt:0};
  }
}
