import pg from "pg";
import type {PlayerProgress} from "./player-profiles.js";
export interface ProfileDocument {version:1;profiles:Record<string,PlayerProgress>;}
export interface ProfileDatabaseConnection {
  query(sql:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]} >;
  end():Promise<void>;
}
/** One authoritative server owns this ledger, as it owns room membership.
 * Writes are serialized and coalesced: at most one in-flight and one pending
 * snapshot, with the newest snapshot retained after a transient DB failure. */
export class ProfileDatabase {
  private pending:ProfileDocument|undefined;
  private inFlight:Promise<void>|undefined;
  private failure:unknown;
  private constructor(private connection:ProfileDatabaseConnection){}
  static async connect(url:string):Promise<{database:ProfileDatabase;document:ProfileDocument}>{
    const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,query_timeout:5000});
    pool.on("error",error=>console.error("Profile database connection interrupted.",error.message));
    return this.open({query:async(sql,values)=>({rows:(await pool.query(sql,values)).rows}),end:()=>pool.end()});
  }
  static async open(connection:ProfileDatabaseConnection):Promise<{database:ProfileDatabase;document:ProfileDocument}>{
    try{
      await connection.query("CREATE TABLE IF NOT EXISTS planetfall_guest_profiles (id text PRIMARY KEY, progress jsonb NOT NULL)");
      const rows=await connection.query("SELECT id, progress FROM planetfall_guest_profiles");
      return {database:new ProfileDatabase(connection),document:{version:1,profiles:Object.fromEntries(rows.rows.map(row=>[String(row.id),row.progress as PlayerProgress]))}};
    }catch(error){await connection.end();throw error;}
  }
  async accountKeys(enable:boolean):Promise<string[]> {
    if(enable)await this.connection.query(`CREATE TABLE IF NOT EXISTS planetfall_account_links (
      issuer text NOT NULL, auth_user_id text NOT NULL, profile_key text UNIQUE NOT NULL REFERENCES planetfall_guest_profiles(id),
      linked_at timestamptz NOT NULL DEFAULT now(),
      preferences jsonb, preferences_revision integer NOT NULL DEFAULT 0,
      PRIMARY KEY (issuer, auth_user_id),
      CHECK (preferences IS NULL OR octet_length(preferences::text) <= 12000)
    )`);
    else {
      const {rows}=await this.connection.query("SELECT to_regclass('planetfall_account_links') AS table_name");
      if(!rows[0]?.table_name)return [];
    }
    const {rows}=await this.connection.query("SELECT profile_key FROM planetfall_account_links");
    return rows.map(row=>String(row.profile_key));
  }
  async accountLink(issuer:string,userId:string):Promise<string|undefined> {
    const {rows}=await this.connection.query("SELECT profile_key FROM planetfall_account_links WHERE issuer=$1 AND auth_user_id=$2",[issuer,userId]);
    return rows[0]?.profile_key as string|undefined;
  }
  async linkedProfile(key:string):Promise<boolean> {
    const {rows}=await this.connection.query("SELECT 1 FROM planetfall_account_links WHERE profile_key=$1",[key]);
    return rows.length>0;
  }
  async claimProfile(issuer:string,userId:string,key:string):Promise<boolean> {
    await this.flush();
    const {rows}=await this.connection.query("INSERT INTO planetfall_account_links (issuer,auth_user_id,profile_key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING profile_key",[issuer,userId,key]);
    return rows.length>0;
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
  enqueue(document:ProfileDocument):void {this.pending=document;this.start();}
  retry():void {this.start();}
  private start():void {
    if(this.inFlight||!this.pending)return;
    this.failure=undefined;
    this.inFlight=this.drain().catch(error=>{this.failure=error;console.error("Profile database save failed; retaining pending rewards.",error instanceof Error?error.message:"Unknown database error");}).finally(()=>{this.inFlight=undefined;});
  }
  private async drain():Promise<void>{
    while(this.pending){
      const document=this.pending;this.pending=undefined;
      try{await this.connection.query("INSERT INTO planetfall_guest_profiles (id, progress) SELECT key, value FROM jsonb_each($1::jsonb) ON CONFLICT (id) DO UPDATE SET progress = EXCLUDED.progress",[JSON.stringify(document.profiles)]);}
      catch(error){this.pending??=document;throw error;}
    }
  }
  async flush():Promise<void>{while(this.pending||this.inFlight){this.start();await this.inFlight;if(this.failure)throw this.failure;}}
  async close():Promise<void>{try{await this.flush();}finally{await this.connection.end();}}
}
