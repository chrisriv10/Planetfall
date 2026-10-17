import {createHash,randomBytes} from "node:crypto";
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {DEFAULT_COSMETICS,sessionLevelForXp,sessionXpInLevel,type GuestProfile} from "@planetfall/shared";
import type {ProfileDatabase,ProfileDocument} from "./profile-database.js";

export type PlayerProgress=GuestProfile;
type Binding={key:string;baseline:PlayerProgress};
const copy=(p:PlayerProgress):PlayerProgress=>({...p,ownedCosmetics:[...p.ownedCosmetics],equippedCosmetics:{...p.equippedCosmetics},unlockedPassRewards:[...p.unlockedPassRewards]});
const empty=():PlayerProgress=>({fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"]});
const keyFor=(token:string)=>createHash("sha256").update(token).digest("hex");

/** Durable server-owned guest economy. The browser holds only an opaque bearer
 * token; balances and owned items never come from client storage or payloads. */
export class PlayerProfiles {
  onChange?:(key:string,profile:PlayerProgress)=>void;
  private readonly records=new Map<string,PlayerProgress>();
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
        this.records.set(key,copy({...p,sessionLevel:sessionLevelForXp(p.sessionTotalXp),sessionXp:sessionXpInLevel(p.sessionTotalXp)}));
      }
    }
  }
  open(rawToken:unknown):{token:string;key:string}{
    const valid=typeof rawToken==="string"&&/^[a-f0-9]{64}$/.test(rawToken);
    if(valid&&this.records.has(keyFor(rawToken)))return {token:rawToken,key:keyFor(rawToken)};
    const token=randomBytes(32).toString("hex"),key=keyFor(token);
    this.records.set(key,empty());this.dirty=true;this.flush();return {token,key};
  }
  bind(player:PlayerProgress,key:string):void {
    if(this.bindings.has(player))return;
    const profile=this.records.get(key);if(!profile)throw new Error("Unknown player profile");
    Object.assign(player,copy(profile));this.bindings.set(player,{key,baseline:copy(profile)});this.players.add(new WeakRef(player));
  }
  view(key:string):PlayerProgress {const p=this.records.get(key);if(!p)throw new Error("Unknown player profile");return copy(p);}
  capture(players:Iterable<PlayerProgress>):void {
    // Capture all deltas before syncing other room representations. The same
    // guest can have two tabs; one room must not erase the other's earned reward.
    const changes:Array<{binding:Binding;current:PlayerProgress}>=[];
    for(const player of players){const binding=this.bindings.get(player);if(binding&&JSON.stringify(playerProgress(player))!==JSON.stringify(binding.baseline))changes.push({binding,current:copy(playerProgress(player))});}
    if(!changes.length)return;
    for(const {binding,current}of changes){
      const record=this.records.get(binding.key)!,old=binding.baseline;
      record.fallbucks=Math.max(0,record.fallbucks+current.fallbucks-old.fallbucks);
      record.crowns=Math.max(0,record.crowns+current.crowns-old.crowns);
      record.sessionTotalXp=Math.max(0,record.sessionTotalXp+current.sessionTotalXp-old.sessionTotalXp);
      record.sessionLevel=sessionLevelForXp(record.sessionTotalXp);record.sessionXp=sessionXpInLevel(record.sessionTotalXp);
      record.ownedCosmetics=[...new Set([...record.ownedCosmetics,...current.ownedCosmetics])];
      record.unlockedPassRewards=[...new Set([...record.unlockedPassRewards,...current.unlockedPassRewards])];
      for(const category of ["suit","trail","victory","planet"] as const)if(current.equippedCosmetics[category]!==old.equippedCosmetics[category])record.equippedCosmetics[category]=current.equippedCosmetics[category];
    }
    for(const ref of this.players){const player=ref.deref();if(!player){this.players.delete(ref);continue;}const binding=this.bindings.get(player)!;const record=this.records.get(binding.key)!;Object.assign(player,copy(record));binding.baseline=copy(record);}
    this.dirty=true;
    try{this.flush();}catch(error){console.error("Player profile save failed; retaining rewards for retry.",error);}
    for(const key of new Set(changes.map(change=>change.binding.key)))this.onChange?.(key,this.view(key));
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
function playerProgress(p:PlayerProgress):PlayerProgress{return {fallbucks:p.fallbucks,crowns:p.crowns,sessionTotalXp:p.sessionTotalXp,sessionLevel:p.sessionLevel,sessionXp:p.sessionXp,ownedCosmetics:p.ownedCosmetics,equippedCosmetics:p.equippedCosmetics,unlockedPassRewards:p.unlockedPassRewards};}
