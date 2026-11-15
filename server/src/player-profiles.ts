import {createHash,randomBytes} from "node:crypto";
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {DEFAULT_COSMETICS,PLANET_PASS_REWARDS,type GuestProfile,type PlanetPassReward} from "@planetfall/shared";
import type {ProfileDatabase,ProfileDocument} from "./profile-database.js";
import {passFallbucksAlreadyGranted,reconcilePassRewards} from "./pass-reconciliation.js";

export type PlayerProgress=GuestProfile&{lobbyBadge?:string};
export type ProgressCapture=Map<GuestProfile,PlanetPassReward[]>;
export type ProgressHandler=(players:Iterable<GuestProfile>)=>void|ProgressCapture;
type Binding={key:string;baseline:PlayerProgress};
const copy=(p:PlayerProgress):PlayerProgress=>({...p,ownedCosmetics:[...p.ownedCosmetics],equippedCosmetics:{...DEFAULT_COSMETICS,...p.equippedCosmetics},unlockedPassRewards:[...p.unlockedPassRewards]});
const empty=():PlayerProgress=>({fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"]});
const keyFor=(token:string)=>createHash("sha256").update(token).digest("hex");

/** Durable server-owned guest economy. The browser holds only an opaque bearer
 * token; balances and owned items never come from client storage or payloads. */
export class PlayerProfiles {
  onChange?:(key:string,profile:PlayerProgress)=>void;
  private readonly records=new Map<string,PlayerProgress>();
  private readonly pendingClaims=new Set<string>();
  private readonly claimed=new Set<string>();
  private readonly bindings=new WeakMap<PlayerProgress,Binding>();
  private readonly players=new Set<WeakRef<PlayerProgress>>();
  private dirty=false;
  private lastRetry=0;
  constructor(private readonly file?:string,initial?:ProfileDocument,private readonly database?:ProfileDatabase){
    if(initial||file&&existsSync(file)){
      const data=initial??JSON.parse(readFileSync(file!,"utf8"));
      if(data.version!==1||!data.profiles||typeof data.profiles!=="object")throw new Error("Invalid player profile store; refusing to overwrite it.");
      for(const [key,value]of Object.entries(data.profiles)){
        const p=value as PlayerProgress;
        if(!/^[a-f0-9]{64}$/.test(key)||![p.fallbucks,p.crowns,p.sessionTotalXp].every(n=>Number.isSafeInteger(n)&&n>=0)||!Array.isArray(p.ownedCosmetics)||!Array.isArray(p.unlockedPassRewards)||!p.equippedCosmetics)throw new Error("Invalid saved player profile; refusing to overwrite it.");
        const restored=copy(p);reconcilePassRewards(restored);
        this.records.set(key,restored);if(JSON.stringify(restored)!==JSON.stringify(p))this.dirty=true;
      }
    }
  }
  open(rawToken:unknown):{token:string;key:string}{
    const valid=typeof rawToken==="string"&&/^[a-f0-9]{64}$/.test(rawToken);
    if(valid&&this.pendingClaims.has(keyFor(rawToken)))throw new Error("Guest identity transfer pending");
    const existing=this.guestKey(rawToken);
    if(valid&&existing)return {token:rawToken,key:existing};
    const token=randomBytes(32).toString("hex"),key=keyFor(token);
    this.records.set(key,empty());this.dirty=true;this.flush();return {token,key};
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
  holdGuest(key:string):void {this.claimed.add(key);this.pendingClaims.delete(key);}
  releaseGuest(key:string):void {this.pendingClaims.delete(key);}
  boundKey(player:PlayerProgress):string|undefined {return this.bindings.get(player)?.key;}
  hasProgress(key:string):boolean {
    const p=this.view(key);
    return p.fallbucks!==0||p.crowns!==0||p.sessionTotalXp!==0||p.ownedCosmetics.length!==0||
      p.unlockedPassRewards.some(id=>id!=="default")||Boolean(p.lobbyBadge)||
      Object.entries(DEFAULT_COSMETICS).some(([category,id])=>p.equippedCosmetics[category as keyof typeof DEFAULT_COSMETICS]!==id);
  }
  bind(player:PlayerProgress,key:string):void {
    if(this.bindings.has(player))return;
    const profile=this.records.get(key);if(!profile)throw new Error("Unknown player profile");
    Object.assign(player,copy(profile));this.bindings.set(player,{key,baseline:copy(profile)});this.players.add(new WeakRef(player));
  }
  view(key:string):PlayerProgress {const p=this.records.get(key);if(!p)throw new Error("Unknown player profile");return copy(p);}
  capture(players:Iterable<PlayerProgress>):ProgressCapture {
    // Capture all deltas before syncing other room representations. The same
    // guest can have two tabs; one room must not erase the other's earned reward.
    const requested=[...players],candidates=new Set(requested),receipts:ProgressCapture=new Map();
    for(const player of requested)if(this.bindings.has(player))receipts.set(player,[]);
    // A callback from one room must not sync away another tab's pending earnings.
    for(const ref of this.players){const player=ref.deref();if(player)candidates.add(player);else this.players.delete(ref);}
    const changes:Array<{player:PlayerProgress;binding:Binding;current:PlayerProgress}>=[];
    for(const player of candidates){const binding=this.bindings.get(player);if(binding&&JSON.stringify(playerProgress(player))!==JSON.stringify(binding.baseline))changes.push({player,binding,current:copy(playerProgress(player))});}
    if(!changes.length)return receipts;
    const staged=new Map<string,{record:PlayerProgress;bucks:number;crowns:number;recipient:PlayerProgress}>(),knownIDs=new Set(PLANET_PASS_REWARDS.map(reward=>reward.id));
    for(const {player,binding,current}of changes){
      if(![current.fallbucks,current.crowns,current.sessionTotalXp].every(validAmount))throw new RangeError("Invalid room profile economy");
      let pending=staged.get(binding.key);
      if(!pending){pending={record:copy(this.records.get(binding.key)!),bucks:0,crowns:0,recipient:requested.find(p=>this.bindings.get(p)?.key===binding.key)??player};staged.set(binding.key,pending);}
      const record=pending.record,old=binding.baseline;
      record.sessionTotalXp=safeAmount(record.sessionTotalXp+Math.max(0,current.sessionTotalXp-old.sessionTotalXp));
      pending.bucks=safeDelta(pending.bucks+current.fallbucks-old.fallbucks-passFallbucksAlreadyGranted(old.unlockedPassRewards,current.unlockedPassRewards));
      pending.crowns=safeDelta(pending.crowns+current.crowns-old.crowns);
      record.ownedCosmetics=[...new Set([...record.ownedCosmetics,...current.ownedCosmetics])];
      record.unlockedPassRewards=[...new Set([...record.unlockedPassRewards,...current.unlockedPassRewards.filter(id=>!knownIDs.has(id))])];
      for(const category of Object.keys(current.equippedCosmetics) as Array<keyof typeof current.equippedCosmetics>)if(current.equippedCosmetics[category]!==old.equippedCosmetics[category])Object.assign(record.equippedCosmetics,{[category]:current.equippedCosmetics[category]});
    }
    // Reconcile before signed spends are clamped: a just-earned room reward may already be spent.
    for(const {record,bucks,crowns,recipient}of staged.values()){
      receipts.set(recipient,reconcilePassRewards(record));
      record.fallbucks=safeAmount(Math.max(0,safeDelta(record.fallbucks+bucks)));
      record.crowns=safeAmount(Math.max(0,safeDelta(record.crowns+crowns)));
    }
    for(const [key,{record}]of staged)this.records.set(key,record);
    for(const ref of this.players){const player=ref.deref();if(!player){this.players.delete(ref);continue;}const binding=this.bindings.get(player)!;const record=this.records.get(binding.key)!;Object.assign(player,copy(record));binding.baseline=copy(record);}
    this.dirty=true;
    try{this.flush();}catch(error){console.error("Player profile save failed; retaining rewards for retry.",error);}
    for(const key of new Set(changes.map(change=>change.binding.key)))this.onChange?.(key,this.view(key));
    return receipts;
  }
  retry(now:number):void {if(now-this.lastRetry>=1000){this.lastRetry=now;this.database?.retry();if(this.dirty)try{this.flush();}catch(error){console.error("Player profile save retry failed.",error);}}}
  async close():Promise<void>{this.flush();await this.database?.close();}
  flush():void {
    if(!this.dirty)return;
    const document:ProfileDocument={version:1,profiles:Object.fromEntries([...this.records].map(([key,p])=>[key,copy(p)]))};
    if(this.database)this.database.enqueue(document);
    else if(this.file){mkdirSync(dirname(this.file),{recursive:true});const temporary=`${this.file}.tmp`;writeFileSync(temporary,JSON.stringify(document),{mode:0o600});renameSync(temporary,this.file);}
    this.dirty=false;
  }
}
function playerProgress(p:PlayerProgress):PlayerProgress{return {fallbucks:p.fallbucks,crowns:p.crowns,sessionTotalXp:p.sessionTotalXp,sessionLevel:p.sessionLevel,sessionXp:p.sessionXp,ownedCosmetics:p.ownedCosmetics,equippedCosmetics:p.equippedCosmetics,unlockedPassRewards:p.unlockedPassRewards,...(p.lobbyBadge!==undefined?{lobbyBadge:p.lobbyBadge}:{})};}
const validAmount=(n:number)=>Number.isSafeInteger(n)&&n>=0;
function safeAmount(n:number):number{if(!validAmount(n))throw new RangeError("Invalid profile economy total");return n;}
function safeDelta(n:number):number{if(!Number.isSafeInteger(n))throw new RangeError("Invalid profile economy delta");return n;}
