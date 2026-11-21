import {sanitizeName,type LeaderboardData,type LeaderboardEntry,type LeaderboardVisibilityResult} from "@planetfall/shared";
import type {LeaderboardScore,RankedLeaderboardScore} from "./profile-database.js";
import type {PlayerProfiles} from "./player-profiles.js";

const REFRESH_MS=20_000;
const RETRY_MS=5_000;
const RANK_CACHE_LIMIT=512;
type Cached<T>={expires:number; result:Promise<T>; pending:boolean};
type LeaderboardSource=Pick<PlayerProfiles,"leaderboardTop"|"leaderboardRank"|"leaderboardName"|"setLeaderboardName">;
const publicEntry=(score:LeaderboardScore,rank:number,key?:string):LeaderboardEntry=>({
  rank,name:score.name,xp:score.xp,isYou:score.key===key,
});

export class GlobalLeaderboard {
  private top?:Cached<LeaderboardScore[]>;
  private ranks=new Map<string,Cached<RankedLeaderboardScore|null>>();
  private writes=new Set<string>();
  private revision=0;
  constructor(private readonly profiles:LeaderboardSource,private readonly now=Date.now){}

  async read(key?:string):Promise<LeaderboardData> {
    const revision=this.revision,top=await this.readTop();
    const entries=top.map((score,index)=>publicEntry(score,index+1,key));
    let currentPlayer=entries.find(row=>row.isYou)??null;
    if(!currentPlayer&&key){
      const score=await this.readRank(key);
      if(score)currentPlayer=publicEntry(score,score.rank,key);
    }
    // A visibility change invalidates reads already in flight on the previous board.
    if(revision!==this.revision)return this.read(key);
    return {entries,currentPlayer,publicName:currentPlayer?.name??null};
  }

  async setVisibility(key:string|undefined,value:unknown,guest=false):Promise<LeaderboardVisibilityResult> {
    if(!key)return {ok:false,error:"Connect your player profile to share a leaderboard entry."};
    const name=typeof value==="string"&&value.length<=20?value.trim():null;
    if(value!==null&&(!name||sanitizeName(name)!==name))
      return {ok:false,error:"Use 1–18 letters, numbers, spaces, underscores or hyphens."};
    if(this.writes.has(key))return {ok:false,error:"A leaderboard update is already in progress."};
    this.writes.add(key);
    try{
      await this.profiles.setLeaderboardName(key,name,guest);
      this.revision++;
      this.top=undefined;
      this.ranks.clear();
      return {ok:true};
    }catch{
      return {ok:false,error:"Leaderboard settings are temporarily unavailable. Try again."};
    }finally{
      this.writes.delete(key);
    }
  }

  private readTop():Promise<LeaderboardScore[]> {
    if(!this.top||(!this.top.pending&&this.top.expires<=this.now()))this.top=this.cache(()=>this.profiles.leaderboardTop());
    return this.top.result;
  }
  private readRank(key:string):Promise<RankedLeaderboardScore|null> {
    const cached=this.ranks.get(key);
    if(cached&&(cached.pending||cached.expires>this.now()))return cached.result;
    this.ranks.delete(key);
    if(this.ranks.size>=RANK_CACHE_LIMIT)this.ranks.delete(this.ranks.keys().next().value!);
    const next=this.cache(()=>this.profiles.leaderboardRank(key));
    this.ranks.set(key,next);
    return next.result;
  }
  private cache<T>(read:()=>Promise<T>):Cached<T> {
    const entry:Cached<T>={expires:0,pending:true,result:Promise.resolve().then(read)};
    void entry.result.then(
      ()=>{entry.expires=this.now()+REFRESH_MS;entry.pending=false;},
      ()=>{entry.expires=this.now()+RETRY_MS;entry.pending=false;},
    );
    return entry;
  }
}
