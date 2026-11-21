import type {ProfileDatabaseConnection} from "./profile-connection.js";
import {
  accountTable,leaderboardCheck,leaderboardOrder,profileSchemaProblems,ProfileSchemaError,
  profileTable,rankingIndex,readProfileSchema,receiptTable,
} from "./profile-schema.js";

function requireCompatible(problems:string[]):void {
  if(problems.length)throw new ProfileSchemaError(`Profile migration stopped: ${problems.join("; ")}. Inspect these objects with the migration role before retrying. No migration changes were committed.`);
}

export function migrateProfileSchema(connection:ProfileDatabaseConnection):Promise<string[]> {
  return connection.transaction(async query=>{
    await query("SET LOCAL lock_timeout='5s'");
    await query("SET LOCAL statement_timeout='120s'");
    await query("SELECT pg_advisory_xact_lock(16795611, 1)");
    const schema=await readProfileSchema(query);
    requireCompatible(profileSchemaProblems(schema,"upgrade"));
    const applied:string[]=[];
    const profiles=schema.tables.get(profileTable);
    if(!profiles){
      await query(`CREATE TABLE ${profileTable} (
        id text PRIMARY KEY, progress jsonb NOT NULL, leaderboard_name text CHECK (${leaderboardCheck})
      )`);
      applied.push(profileTable);
    }else if(!profiles.columns.leaderboard_name){
      await query(`ALTER TABLE ${profileTable} ADD COLUMN leaderboard_name text CHECK (${leaderboardCheck})`);
      applied.push(`${profileTable}.leaderboard_name`);
    }else if(!profiles.publicationChecks.length){
      await query(`ALTER TABLE ${profileTable} ADD CONSTRAINT planetfall_guest_profiles_leaderboard_name_check CHECK (${leaderboardCheck})`);
      applied.push(`${profileTable} publication check`);
    }
    if(!schema.indexExists){
      await query(`CREATE INDEX ${rankingIndex} ON ${profileTable} (${leaderboardOrder}) WHERE leaderboard_name IS NOT NULL`);
      applied.push(rankingIndex);
    }
    if(!schema.tables.has(receiptTable)){
      await query(`CREATE TABLE ${receiptTable} (
        id uuid PRIMARY KEY, profile_key text NOT NULL REFERENCES ${profileTable}(id), result jsonb NOT NULL
      )`);
      applied.push(receiptTable);
    }
    if(!schema.tables.has(accountTable)){
      await query(`CREATE TABLE ${accountTable} (
        issuer text NOT NULL, auth_user_id text NOT NULL, profile_key text UNIQUE NOT NULL REFERENCES ${profileTable}(id),
        linked_at timestamptz NOT NULL DEFAULT now(), preferences jsonb, preferences_revision integer NOT NULL DEFAULT 0,
        PRIMARY KEY (issuer, auth_user_id),
        CHECK (preferences IS NULL OR octet_length(preferences::text) <= 12000)
      )`);
      applied.push(accountTable);
    }
    if(applied.length)requireCompatible(profileSchemaProblems(await readProfileSchema(query),"migrated"));
    return applied;
  });
}
