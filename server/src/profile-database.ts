import {profileConnection,type ProfileDatabaseConnection,type ProfileQuery} from "./profile-connection.js";
import {earnedXp,leaderboardOrder,safeProfileDatabaseError,validateProfileSchema} from "./profile-schema.js";
import type {PlayerProgress} from "./player-profiles.js";
export type {ProfileDatabaseConnection,ProfileQuery} from "./profile-connection.js";
export interface ProfileDocument {version:1;profiles:Record<string,PlayerProgress>;leaderboardNames?:Record<string,string>;careerReceipts?:string[];}
export interface LeaderboardScore {key:string; name:string; xp:number;}
export interface RankedLeaderboardScore extends LeaderboardScore {rank:number;}
function leaderboardScore(row:Record<string,unknown>):LeaderboardScore {
  return {key:String(row.id),name:String(row.leaderboard_name),xp:Number(row.xp)};
}
export type StoredProfile={progress:PlayerProgress;name:string|null;claimed:boolean};
export type ProfileMutation<T>={value:T;progress?:PlayerProgress};
export class ProfileDatabase {
  private pending=new Map<string,Array<()=>Promise<void>>>();
  private inFlight:Promise<void>|undefined;
  private failures=new Map<string,unknown>();
  private constructor(private connection:ProfileDatabaseConnection){}
  static async connect(url:string):Promise<{database:ProfileDatabase;document:ProfileDocument}>{
    try{return await this.open(profileConnection(url));}
    catch(error){throw safeProfileDatabaseError(error,"Profile database startup");}
  }
  static async open(connection:ProfileDatabaseConnection):Promise<{database:ProfileDatabase;document:ProfileDocument}>{
    try{
      await validateProfileSchema(connection.query);
      const {rows}=await connection.query("SELECT id, progress, leaderboard_name FROM planetfall_guest_profiles");
      const profiles=Object.fromEntries(rows.map(row=>[String(row.id),row.progress as PlayerProgress]));
      const leaderboardNames=Object.fromEntries(rows.filter(row=>typeof row.leaderboard_name==="string").map(row=>[String(row.id),String(row.leaderboard_name)]));
      return {database:new ProfileDatabase(connection),document:{version:1,profiles,leaderboardNames}};
    }catch(error){await connection.end().catch(()=>{});throw error;}
  }
  async accountKeys():Promise<string[]> {
    try{
      const {rows}=await this.connection.query("SELECT profile_key FROM planetfall_account_links");
      return rows.map(row=>String(row.profile_key));
    }catch(error){throw safeProfileDatabaseError(error,"Account link hydration");}
  }
  async accountLink(issuer:string,userId:string):Promise<string|undefined> {
    const {rows}=await this.connection.query("SELECT profile_key FROM planetfall_account_links WHERE issuer=$1 AND auth_user_id=$2",[issuer,userId]);
    return rows[0]?.profile_key as string|undefined;
  }
  async linkedProfile(key:string):Promise<boolean> {
    const {rows}=await this.connection.query("SELECT 1 FROM planetfall_account_links WHERE profile_key=$1",[key]);
    return rows.length>0;
  }
  async linkedGuests(keys:string[]):Promise<string[]> {
    if(!keys.length)return [];
    const {rows}=await this.connection.query("SELECT profile_key FROM planetfall_account_links WHERE profile_key=ANY($1::text[])",[keys]);
    return rows.map(row=>String(row.profile_key));
  }
  async claimProfile(issuer:string,userId:string,key:string):Promise<boolean> {
    await this.flush(key);
    return this.connection.transaction(async query=>{
      await this.lockProfile(query,key);
      const {rows}=await query("INSERT INTO planetfall_account_links (issuer,auth_user_id,profile_key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING profile_key",[issuer,userId,key]);
      return rows.length>0;
    });
  }
  async readProfile(key:string):Promise<StoredProfile|undefined> {
    const {rows}=await this.connection.query(`SELECT progress,leaderboard_name,
      EXISTS(SELECT 1 FROM planetfall_account_links WHERE profile_key=$1) AS claimed FROM planetfall_guest_profiles WHERE id=$1`,[key]);
    return rows[0]?{progress:rows[0].progress as PlayerProgress,name:rows[0].leaderboard_name as string|null,claimed:rows[0].claimed===true}:undefined;
  }
  async createProfile(key:string,progress:PlayerProgress):Promise<void> {
    await this.connection.query("INSERT INTO planetfall_guest_profiles (id,progress) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING",[key,JSON.stringify(progress)]);
  }
  private async lockProfile(query:ProfileQuery,key:string):Promise<PlayerProgress> {
    const {rows}=await query("SELECT progress FROM planetfall_guest_profiles WHERE id=$1 FOR UPDATE",[key]);
    if(!rows[0])throw new Error("Player profile unavailable");
    return rows[0].progress as PlayerProgress;
  }
  private async assertOwner(query:ProfileQuery,key:string,guest:boolean):Promise<void> {
    if(guest&&(await query("SELECT 1 FROM planetfall_account_links WHERE profile_key=$1",[key])).rows.length)
      throw new Error("Guest profile has been linked");
  }
  /** The receipt and profile change commit together. A retry after a lost
   * response returns the prior outcome and the latest locked profile. */
  async mutate<T>(key:string,id:string,guest:boolean,apply:(progress:PlayerProgress)=>ProfileMutation<T>):Promise<{value:T;progress:PlayerProgress;claimed:boolean}> {
    return this.connection.transaction(async query=>{
      const progress=await this.lockProfile(query,key);
      const {rows:[receipt]}=await query(`SELECT applied.id,applied.result,
        EXISTS(SELECT 1 FROM planetfall_account_links WHERE profile_key=$2) AS claimed
        FROM (VALUES (1)) AS requested(dummy) LEFT JOIN planetfall_profile_operations applied
        ON applied.id=$1 AND applied.profile_key=$2`,[id,key]);
      const claimed=receipt.claimed===true;
      if(claimed&&guest)throw new Error("Guest profile has been linked");
      if(receipt.id)return {value:receipt.result as T,progress,claimed};
      const result=apply(progress);
      if(result.progress){
        await query("UPDATE planetfall_guest_profiles SET progress=$2 WHERE id=$1",[key,JSON.stringify(result.progress)]);
        await query("INSERT INTO planetfall_profile_operations (id,profile_key,result) VALUES ($1,$2,$3)",[id,key,JSON.stringify(result.value)]);
      }
      return {value:result.value,progress:result.progress??progress,claimed};
    });
  }
  async accountPreferences(key:string):Promise<{revision:number;value:unknown}> {
    const {rows}=await this.connection.query("SELECT preferences, preferences_revision FROM planetfall_account_links WHERE profile_key=$1",[key]);
    if(!rows[0])throw new Error("Account profile unavailable");
    return {revision:Number(rows[0].preferences_revision),value:rows[0].preferences};
  }
  async saveAccountPreferences(key:string,revision:number,value:unknown):Promise<boolean> {
    const {rows}=await this.connection.query("UPDATE planetfall_account_links SET preferences=$3::jsonb, preferences_revision=preferences_revision+1 WHERE profile_key=$1 AND preferences_revision=$2 RETURNING preferences_revision",[key,revision,JSON.stringify(value)]);
    return rows.length>0;
  }
  async leaderboardTop():Promise<LeaderboardScore[]> {
    const {rows}=await this.connection.query(`SELECT id, leaderboard_name, ${earnedXp} AS xp
      FROM planetfall_guest_profiles WHERE leaderboard_name IS NOT NULL ORDER BY ${leaderboardOrder} LIMIT 10`);
    return rows.map(leaderboardScore);
  }
  async leaderboardRank(key:string):Promise<RankedLeaderboardScore|null> {
    const {rows}=await this.connection.query(`WITH me AS (
      SELECT id, leaderboard_name, ${earnedXp} AS xp FROM planetfall_guest_profiles
      WHERE id=$1 AND leaderboard_name IS NOT NULL
    )
    SELECT me.*, 1+(
      SELECT count(*) FROM planetfall_guest_profiles entrant
      WHERE entrant.leaderboard_name IS NOT NULL AND
        (${earnedXp}>me.xp OR (${earnedXp}=me.xp AND entrant.id COLLATE "C"<me.id COLLATE "C"))
    ) AS rank FROM me`,[key]);
    return rows[0]?{...leaderboardScore(rows[0]),rank:Number(rows[0].rank)}:null;
  }
  async setLeaderboardName(key:string,name:string|null,guest=false):Promise<void> {
    await this.flush(key);
    await this.connection.transaction(async query=>{
      await this.lockProfile(query,key);
      await this.assertOwner(query,key,guest);
      await query("UPDATE planetfall_guest_profiles SET leaderboard_name=$2 WHERE id=$1",[key,name]);
    });
  }
  enqueue(key:string,run:()=>Promise<void>):void {
    let writes=this.pending.get(key);
    if(!writes){writes=[];this.pending.set(key,writes);}
    writes.push(run);
    this.failures.delete(key);
    this.start();
  }
  retry():void {this.failures.clear();this.start();}
  private start():void {
    if(this.inFlight||this.pending.size===this.failures.size)return;
    this.inFlight=this.drain().finally(()=>{this.inFlight=undefined;this.start();});
  }
  private async drain():Promise<void>{
    for(const [key,writes]of this.pending){
      if(this.failures.has(key))continue;
      try{
        while(writes.length){
          await writes[0]();
          writes.shift();
        }
        this.pending.delete(key);
      }catch(error){
        this.failures.set(key,error);
        console.error("Profile database save failed; retaining pending rewards.",error instanceof Error?error.message:"Unknown database error");
      }
    }
  }
  async flush(key?:string):Promise<void>{
    while(key===undefined?this.pending.size:this.pending.has(key)){
      if(key!==undefined&&this.failures.has(key))throw this.failures.get(key);
      this.start();
      if(!this.inFlight)throw this.failures.values().next().value;
      await this.inFlight;
    }
  }
  async close():Promise<void>{
    try{this.retry();await this.flush();}finally{await this.connection.end();}
  }
}
