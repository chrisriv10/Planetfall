import {randomBytes} from "node:crypto";
import pg from "pg";
import {profileConnection} from "../src/profile-connection.js";
import {migrateProfileSchema} from "../src/profile-migrations.js";

export const profileTestDatabase=process.env.PLANETFALL_TEST_PG_URL;

type Fixture={
  owner:pg.Client;ownerUrl:string;runtimeUrl:string;
  migrate:()=>Promise<string[]>;grantRuntime:()=>Promise<void>;
};

export async function withProfilePostgres(run:(fixture:Fixture)=>Promise<void>):Promise<void> {
  const url=new URL(profileTestDatabase!);
  if(!["127.0.0.1","localhost","[::1]"].includes(url.hostname))throw new Error("Use a disposable local PostgreSQL server");
  const schema=`pf_${randomBytes(8).toString("hex")}`;
  const migrator=`${schema}_migration`,runtime=`${schema}_runtime`,password=randomBytes(24).toString("hex");
  const admin=new pg.Client({connectionString:url.href});
  await admin.connect();
  const roleUrl=(role:string)=>{
    const connection=new URL(url);
    connection.username=role;
    connection.password=password;
    connection.searchParams.set("options",`-c search_path=${schema}`);
    return connection.href;
  };
  try{
    await admin.query(`CREATE ROLE ${migrator} LOGIN NOINHERIT PASSWORD '${password}'`);
    await admin.query(`CREATE ROLE ${runtime} LOGIN NOINHERIT PASSWORD '${password}'`);
    await admin.query(`ALTER ROLE ${runtime} SET statement_timeout='5s'`);
    await admin.query(`CREATE SCHEMA ${schema} AUTHORIZATION ${migrator}`);
    await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${runtime}`);
    const ownerUrl=roleUrl(migrator),runtimeUrl=roleUrl(runtime);
    const owner=new pg.Client({connectionString:ownerUrl});
    await owner.connect();
    try{
      await run({owner,ownerUrl,runtimeUrl,async migrate(){
        const connection=profileConnection(ownerUrl);
        try{return await migrateProfileSchema(connection);}finally{await connection.end();}
      },async grantRuntime(){
        await owner.query(`
          GRANT SELECT (id,progress,leaderboard_name), INSERT (id,progress), UPDATE (progress,leaderboard_name)
            ON planetfall_guest_profiles TO ${runtime};
          GRANT SELECT (id,profile_key,result), INSERT (id,profile_key,result)
            ON planetfall_profile_operations TO ${runtime};
          GRANT SELECT (issuer,auth_user_id,profile_key,preferences,preferences_revision),
            INSERT (issuer,auth_user_id,profile_key), UPDATE (preferences,preferences_revision)
            ON planetfall_account_links TO ${runtime};
        `);
      }});
    }finally{await owner.end();}
  }finally{
    try{await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; DROP ROLE IF EXISTS ${runtime}; DROP ROLE IF EXISTS ${migrator}`);}
    finally{await admin.end();}
  }
}
