import {createHash,randomBytes,randomUUID} from "node:crypto";
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {DEFAULT_COSMETICS,PLANET_PASS_REWARDS,sanitizeName,applyCareerResult,copyCareer,type CareerResult,type GameFamily,type GuestProfile,type PlanetPassReward} from "@planetfall/shared";
import type {LeaderboardScore,ProfileDatabase,ProfileDocument,RankedLeaderboardScore} from "./profile-database.js";
import {passFallbucksAlreadyGranted,reconcilePassRewards} from "./pass-reconciliation.js";
import {buyCosmetic,equipCosmetic,type ShopResult} from "./cosmetic-shop.js";

export type PlayerProgress=GuestProfile&{lobbyBadge?:string};
export type ProgressCapture=Map<GuestProfile,PlanetPassReward[]>;
export type ProgressHandler=(players:Iterable<GuestProfile>)=>void|ProgressCapture;
export type CareerEntry=CareerResult&{player:PlayerProgress};
type Binding={key:string;baseline:PlayerProgress;fingerprint:string};
type ProgressDelta={
  xp:number;bucks:number;crowns:number;
  owned:Set<string>;pass:Set<string>;equipped:Partial<PlayerProgress["equippedCosmetics"]>;
};
const passIds=new Set(PLANET_PASS_REWARDS.map(reward=>reward.id));
const copy=(p:PlayerProgress):PlayerProgress=>({...p,...(p.career?{career:copyCareer(p.career)}:{}),ownedCosmetics:[...p.ownedCosmetics],equippedCosmetics:{...DEFAULT_COSMETICS,...p.equippedCosmetics},unlockedPassRewards:[...p.unlockedPassRewards]});
const empty=():PlayerProgress=>({fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"]});
const keyFor=(token:string)=>createHash("sha256").update(token).digest("hex");
const leaderboardOrder=(a:LeaderboardScore,b:LeaderboardScore)=>b.xp-a.xp||(a.key<b.key?-1:a.key>b.key?1:0);

/** Durable server-owned guest economy. The browser holds only an opaque bearer
 * token; balances and owned items never come from client storage or payloads. */
export class PlayerProfiles {
  onChange?:(key:string,profile:PlayerProgress)=>void;
  onCareerSettled?:(key:string,family:GameFamily,settlementId:string)=>void;
  onSaveFailure?:(key:string)=>void;
  onGuestClaimed?:(key:string)=>void;
  private readonly records=new Map<string,PlayerProgress>();
  private readonly leaderboardNames=new Map<string,string>();
  private readonly pendingClaims=new Set<string>();
  private readonly claimed=new Set<string>();
  private readonly bindings=new WeakMap<PlayerProgress,Binding>();
  private readonly players=new Set<WeakRef<PlayerProgress>>();
  private readonly pending=new Map<string,ProgressDelta[]>();
  private readonly careerReceipts=new Set<string>();
  private readonly localCareerPending:Array<()=>void>=[];
  private dirty=false;
  private lastRetry=0;
  constructor(private readonly file?:string,initial?:ProfileDocument,private readonly database?:ProfileDatabase){
    if(initial||file&&existsSync(file)){
      const data=initial??JSON.parse(readFileSync(file!,"utf8"));
      if(data.version!==1||!data.profiles||typeof data.profiles!=="object")throw new Error("Invalid player profile store; refusing to overwrite it.");
      for(const id of data.careerReceipts??[])this.careerReceipts.add(id);
      for(const [key,value]of Object.entries(data.profiles)){
        const p=value as PlayerProgress;
        if(!/^[a-f0-9]{64}$/.test(key)||![p.fallbucks,p.crowns,p.sessionTotalXp].every(n=>Number.isSafeInteger(n)&&n>=0)||!Array.isArray(p.ownedCosmetics)||!Array.isArray(p.unlockedPassRewards)||!p.equippedCosmetics)throw new Error("Invalid saved player profile; refusing to overwrite it.");
        const restored=copy(p);reconcilePassRewards(restored);
        this.records.set(key,restored);
        if(!this.database&&JSON.stringify(restored)!==JSON.stringify(p))this.dirty=true;
        const publicName=data.leaderboardNames?.[key];
        if(typeof publicName==="string"&&publicName&&sanitizeName(publicName)===publicName)this.leaderboardNames.set(key,publicName);
      }
    }
  }
  open(rawToken:unknown):{token:string;key:string}{
    const valid=typeof rawToken==="string"&&/^[a-f0-9]{64}$/.test(rawToken);
    if(valid&&this.pendingClaims.has(keyFor(rawToken)))throw new Error("Guest identity transfer pending");
    const existing=this.guestKey(rawToken);
    if(valid&&existing)return {token:rawToken,key:existing};
    const token=randomBytes(32).toString("hex"),key=keyFor(token);
    const progress=empty();
    this.records.set(key,progress);
    if(this.database)this.database.enqueue(key,()=>this.database!.createProfile(key,progress));
    else {this.dirty=true;this.flush();}
    return {token,key};
  }
  get usesDatabase():boolean {return Boolean(this.database);}
  async connectGuest(token:unknown):Promise<{token:string;key:string}> {
    await this.lookupGuest(token);
    const identity=this.open(token);
    await this.database?.flush(identity.key);
    return identity;
  }
  async lookupGuest(token:unknown):Promise<string|undefined> {
    if(this.database&&typeof token==="string"&&/^[a-f0-9]{64}$/.test(token))await this.refresh(keyFor(token));
    return this.guestKey(token);
  }
  async refresh(key:string):Promise<boolean> {
    if(!this.database)return this.records.has(key);
    await this.database.flush(key);
    const stored=await this.database.readProfile(key);
    if(!stored)return false;
    if(stored.claimed)this.holdGuest(key);
    this.updateLeaderboardName(key,stored.name);
    this.syncCommitted(key,stored.progress);
    return true;
  }
  guestKey(token:unknown):string|undefined {
    if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token))return;
    const key=keyFor(token);
    return this.records.has(key)&&!this.claimed.has(key)&&!this.pendingClaims.has(key)?key:undefined;
  }
  ownsBearer(key:string,token:unknown):boolean {
    return typeof token==="string"&&/^[a-f0-9]{64}$/.test(token)&&keyFor(token)===key;
  }
  reserveGuest(key:string):void {this.pendingClaims.add(key);}
  holdGuest(key:string):void {
    this.pendingClaims.delete(key);
    if(this.claimed.has(key))return;
    this.claimed.add(key);
    this.onGuestClaimed?.(key);
  }
  releaseGuest(key:string):void {this.pendingClaims.delete(key);}
  boundKey(player:PlayerProgress):string|undefined {return this.bindings.get(player)?.key;}
  hasProgress(key:string):boolean {
    const p=this.view(key);
    return Boolean(p.career)||p.fallbucks!==0||p.crowns!==0||p.sessionTotalXp!==0||p.ownedCosmetics.length!==0||
      p.unlockedPassRewards.some(id=>id!=="default")||Boolean(p.lobbyBadge)||
      Object.entries(DEFAULT_COSMETICS).some(([category,id])=>p.equippedCosmetics[category as keyof typeof DEFAULT_COSMETICS]!==id);
  }
  bind(player:PlayerProgress,key:string):void {
    if(this.bindings.has(player))return;
    const profile=this.records.get(key);if(!profile)throw new Error("Unknown player profile");
    Object.assign(player,copy(profile));
    const baseline=copy(profile);
    this.bindings.set(player,{key,baseline,fingerprint:JSON.stringify(playerProgress(baseline))});
    this.players.add(new WeakRef(player));
  }
  view(key:string):PlayerProgress {const p=this.records.get(key);if(!p)throw new Error("Unknown player profile");return copy(p);}
  leaderboardName(key:string):string|null {return this.leaderboardNames.get(key)??null;}
  async setLeaderboardName(key:string,name:string|null,guest=false):Promise<void> {
    if(!this.records.has(key))throw new Error("Leaderboard profile unavailable");
    const previous=this.leaderboardName(key);
    if(!this.database&&name===previous)return;
    if(this.database)await this.database.setLeaderboardName(key,name,guest);
    this.updateLeaderboardName(key,name);
    if(!this.database){
      this.dirty=true;
      try{this.flush();}catch(error){this.updateLeaderboardName(key,previous);throw error;}
    }
  }
  async leaderboardTop():Promise<LeaderboardScore[]> {
    if(this.database)return this.database.leaderboardTop();
    const top:LeaderboardScore[]=[];
    for(const score of this.localLeaderboardScores()){
      const place=top.findIndex(other=>leaderboardOrder(score,other)<0);
      if(place>=0)top.splice(place,0,score);else if(top.length<10)top.push(score);
      if(top.length>10)top.pop();
    }
    return top;
  }
  async leaderboardRank(key:string):Promise<RankedLeaderboardScore|null> {
    if(this.database)return this.database.leaderboardRank(key);
    const name=this.leaderboardName(key);
    if(!name)return null;
    const me={key,name,xp:this.records.get(key)!.sessionTotalXp};
    let rank=1;
    for(const score of this.localLeaderboardScores())if(leaderboardOrder(score,me)<0)rank++;
    return {...me,rank};
  }
  private *localLeaderboardScores():Iterable<LeaderboardScore>{
    for(const [key,name] of this.leaderboardNames)yield {key,name,xp:this.records.get(key)!.sessionTotalXp};
  }
  private updateLeaderboardName(key:string,name:string|null):void{
    if(name===null)this.leaderboardNames.delete(key);else this.leaderboardNames.set(key,name);
  }
  capture(players:Iterable<PlayerProgress>):ProgressCapture {
    // Capture all deltas before syncing other room representations. The same
    // guest can have two tabs; one room must not erase the other's earned reward.
    const requested=[...players],candidates=new Set(requested),receipts:ProgressCapture=new Map();
    for(const player of requested)if(this.bindings.has(player))receipts.set(player,[]);
    // A callback from one room must not sync away another tab's pending earnings.
    for(const ref of this.players){const player=ref.deref();if(player)candidates.add(player);else this.players.delete(ref);}
    const changes:Array<{player:PlayerProgress;binding:Binding;current:PlayerProgress}>=[];
    for(const player of candidates){
      const binding=this.bindings.get(player);
      if(!binding)continue;
      const current=playerProgress(player);
      if(JSON.stringify(current)!==binding.fingerprint)changes.push({player,binding,current:copy(current)});
    }
    if(!changes.length)return receipts;
    const staged=new Map<string,{delta:ProgressDelta;recipient:PlayerProgress}>();
    for(const {player,binding,current}of changes){
      if(![current.fallbucks,current.crowns,current.sessionTotalXp].every(validAmount))throw new RangeError("Invalid room profile economy");
      let pending=staged.get(binding.key);
      if(!pending){pending={delta:newDelta(),recipient:requested.find(p=>this.bindings.get(p)?.key===binding.key)??player};staged.set(binding.key,pending);}
      const {delta}=pending,old=binding.baseline;
      delta.xp=safeAmount(delta.xp+Math.max(0,current.sessionTotalXp-old.sessionTotalXp));
      delta.bucks=safeDelta(delta.bucks+current.fallbucks-old.fallbucks-passFallbucksAlreadyGranted(old.unlockedPassRewards,current.unlockedPassRewards));
      delta.crowns=safeDelta(delta.crowns+current.crowns-old.crowns);
      for(const item of current.ownedCosmetics)if(!old.ownedCosmetics.includes(item))delta.owned.add(item);
      for(const item of current.unlockedPassRewards)if(!passIds.has(item)&&!old.unlockedPassRewards.includes(item))delta.pass.add(item);
      for(const category of Object.keys(current.equippedCosmetics) as Array<keyof typeof current.equippedCosmetics>)if(current.equippedCosmetics[category]!==old.equippedCosmetics[category])delta.equipped[category]=current.equippedCosmetics[category];
    }
    const updates=new Map<string,PlayerProgress>();
    for(const [key,{delta,recipient}]of staged){
      const progress=copy(this.records.get(key)!);
      receipts.set(recipient,applyDelta(progress,delta));
      updates.set(key,progress);
    }
    for(const [key,progress]of updates)this.records.set(key,progress);
    this.syncBindings(updates);
    if(this.database){
      for(const [key,{delta}]of staged)this.queueProgress(key,delta);
    }else{
      this.dirty=true;
      try{this.flush();}catch(error){console.error("Player profile save failed; retaining rewards for retry.",error);}
      for(const [key,progress]of updates)this.onChange?.(key,copy(progress));
    }
    return receipts;
  }
  private syncBindings(updates:Map<string,PlayerProgress>):void {
    for(const ref of this.players){
      const player=ref.deref();
      if(!player){this.players.delete(ref);continue;}
      const binding=this.bindings.get(player)!;
      const progress=updates.get(binding.key);
      if(progress){
        Object.assign(player,copy(progress));
        binding.baseline=copy(progress);
        binding.fingerprint=JSON.stringify(playerProgress(binding.baseline));
      }
    }
  }
  private syncCommitted(key:string,stored:PlayerProgress):void {
    this.capture([]);
    const projected=copy(stored);
    reconcilePassRewards(projected);
    for(const delta of this.pending.get(key)??[])applyDelta(projected,delta);
    this.records.set(key,projected);
    this.syncBindings(new Map([[key,projected]]));
  }
  private queueProgress(key:string,delta:ProgressDelta):void {
    const database=this.database!,id=randomUUID();
    const queue=this.pending.get(key)??[];
    if(!queue.length)this.pending.set(key,queue);
    queue.push(delta);
    let reported=false;
    database.enqueue(key,async()=>{
      let progress:PlayerProgress;
      let claimed:boolean;
      try{
        ({progress,claimed}=await database.mutate(key,id,false,current=>{
          const next=copy(current);
          applyDelta(next,delta);
          return {value:null,progress:next};
        }));
      }catch(error){
        if(!reported){reported=true;this.onSaveFailure?.(key);}
        throw error;
      }
      queue.shift();
      if(!queue.length)this.pending.delete(key);
      if(claimed)this.holdGuest(key);
      this.syncCommitted(key,progress);
      this.onChange?.(key,copy(progress));
    });
  }
  /** Called only by authoritative match endings with their stable server UUID.
   * Bound objects establish identity; no client-provided key or statistics enter here. */
  recordCareer(family:GameFamily,settlementId:string,entries:Iterable<CareerEntry>):void {
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(settlementId))throw new RangeError("Invalid Career settlement UUID");
    const at=new Date().toISOString(),staged=new Map<string,{id:string;result:CareerResult}>();
    for(const entry of entries){
      const key=this.bindings.get(entry.player)?.key;
      if(!key||staged.has(key))continue;
      const {won,eliminations,qualifications,repairs,scrap,waves}=entry;
      const result={won,eliminations,qualifications,repairs,scrap,waves};
      applyCareerResult(undefined,family,result,at); // Validate the entire batch before queuing writes.
      staged.set(key,{id:careerReceipt(settlementId,key),result});
    }
    this.capture([]);
    for(const [key,{id,result}]of staged){
      if(this.database){
        let reported=false;
        this.database.enqueue(key,async()=>{
          let committed;
          try{
            committed=await this.database!.mutate(key,id,false,current=>({
              value:null,progress:{...copy(current),career:applyCareerResult(current.career,family,result,at)},
            }));
          }catch(error){if(!reported){reported=true;this.onSaveFailure?.(key);}throw error;}
          if(committed.claimed)this.holdGuest(key);
          this.syncCommitted(key,committed.progress);
          this.onChange?.(key,copy(committed.progress));
          this.onCareerSettled?.(key,family,settlementId);
        });
      }else{
        this.localCareerPending.push(()=>{
          if(this.careerReceipts.has(id)){this.onCareerSettled?.(key,family,settlementId);return;}
          const previous=this.records.get(key)!,next={...copy(previous),career:applyCareerResult(previous.career,family,result,at)};
          this.records.set(key,next);this.careerReceipts.add(id);this.dirty=true;
          try{this.flush();}catch(error){this.records.set(key,previous);this.careerReceipts.delete(id);this.dirty=true;throw error;}
          this.syncBindings(new Map([[key,next]]));this.onChange?.(key,copy(next));this.onCareerSettled?.(key,family,settlementId);
        });
      }
    }
    this.flushLocalCareer();
  }
  private flushLocalCareer():void {
    while(this.localCareerPending.length){
      try{this.localCareerPending[0]();this.localCareerPending.shift();}
      catch(error){console.error("Career save failed; retaining result for retry.",error instanceof Error?error.message:"Unknown save error");break;}
    }
  }
  async shop(key:string,guest:boolean,action:"buy"|"equip",itemId:unknown,family:GameFamily,phase:()=>string):Promise<ShopResult>{
    const database=this.database;
    if(!database)throw new Error("Shop requires database");
    this.capture([]);
    await database.flush(key);
    const id=randomUUID();
    const commit=()=>database.mutate<ShopResult>(key,id,guest,current=>{
      const next=copy(current);
      reconcilePassRewards(next);
      const result=action==="buy"?buyCosmetic(next,phase(),itemId):equipCosmetic(next,phase(),itemId,family);
      return result.ok?{value:{ok:true},progress:next}:{value:result};
    });
    const {value,progress,claimed}=await commit().catch(()=>commit());
    if(claimed)this.holdGuest(key);
    this.syncCommitted(key,progress);
    this.onChange?.(key,copy(progress));
    return value;
  }
  retry(now:number):void {if(now-this.lastRetry>=1000){this.lastRetry=now;this.database?.retry();this.flushLocalCareer();if(this.dirty)try{this.flush();}catch(error){console.error("Player profile save retry failed.",error);}}}
  async close():Promise<void>{this.flushLocalCareer();this.flush();await this.database?.close();}
  flush():void {
    if(!this.dirty)return;
    const document:ProfileDocument={version:1,profiles:Object.fromEntries([...this.records].map(([key,p])=>[key,copy(p)])),...(this.careerReceipts.size?{careerReceipts:[...this.careerReceipts]}:{})};
    if(this.file){document.leaderboardNames=Object.fromEntries(this.leaderboardNames);mkdirSync(dirname(this.file),{recursive:true});const temporary=`${this.file}.tmp`;writeFileSync(temporary,JSON.stringify(document),{mode:0o600});renameSync(temporary,this.file);}
    this.dirty=false;
  }
}
function careerReceipt(settlementId:string,key:string):string {
  const hex=createHash("sha256").update(`planetfall:career:v1:${settlementId.toLowerCase()}:${key}`).digest("hex");
  // UUID-shaped namespaced digest fits the existing bounded uuid receipt column.
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
function playerProgress(p:PlayerProgress):PlayerProgress{return {fallbucks:p.fallbucks,crowns:p.crowns,sessionTotalXp:p.sessionTotalXp,sessionLevel:p.sessionLevel,sessionXp:p.sessionXp,ownedCosmetics:p.ownedCosmetics,equippedCosmetics:p.equippedCosmetics,unlockedPassRewards:p.unlockedPassRewards,...(p.lobbyBadge!==undefined?{lobbyBadge:p.lobbyBadge}:{})};}
const validAmount=(n:number)=>Number.isSafeInteger(n)&&n>=0;
function safeAmount(n:number):number{if(!validAmount(n))throw new RangeError("Invalid profile economy total");return n;}
function safeDelta(n:number):number{if(!Number.isSafeInteger(n))throw new RangeError("Invalid profile economy delta");return n;}
function newDelta():ProgressDelta {
  return {xp:0,bucks:0,crowns:0,owned:new Set(),pass:new Set(),equipped:{}};
}
function applyDelta(progress:PlayerProgress,delta:ProgressDelta):PlanetPassReward[] {
  progress.sessionTotalXp=safeAmount(progress.sessionTotalXp+delta.xp);
  progress.ownedCosmetics=[...new Set([...progress.ownedCosmetics,...delta.owned])];
  progress.unlockedPassRewards=[...new Set([...progress.unlockedPassRewards,...delta.pass])];
  Object.assign(progress.equippedCosmetics,delta.equipped);
  const rewards=reconcilePassRewards(progress);
  progress.fallbucks=safeAmount(Math.max(0,safeDelta(progress.fallbucks+delta.bucks)));
  progress.crowns=safeAmount(Math.max(0,safeDelta(progress.crowns+delta.crowns)));
  return rewards;
}
