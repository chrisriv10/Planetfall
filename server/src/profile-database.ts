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
