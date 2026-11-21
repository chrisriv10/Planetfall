import pg from "pg";

export type ProfileQuery=(sql:string,values?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>;
export interface ProfileDatabaseConnection {
  query:ProfileQuery;
  transaction<T>(run:(query:ProfileQuery)=>Promise<T>):Promise<T>;
  end():Promise<void>;
}

export function profileConnection(url:string,queryTimeout=6000):ProfileDatabaseConnection {
  // Keep runtime compatible with transaction poolers that restrict startup parameters.
  const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,query_timeout:queryTimeout});
  pool.on("error",()=>console.error("Profile database connection interrupted."));
  return {
    query:(sql,values)=>pool.query(sql,values),
    async transaction(run){
      const client=await pool.connect();
      try{
        await client.query("BEGIN");
        const result=await run((sql,values)=>client.query(sql,values));
        await client.query("COMMIT");
        client.release();
        return result;
      }catch(error){
        try{await client.query("ROLLBACK");}catch{/* the connection may already be gone */}
        client.release(true);
        throw error;
      }
    },
    end:()=>pool.end(),
  };
}
