import {profileConnection} from "./profile-connection.js";
import {migrateProfileSchema} from "./profile-migrations.js";
import {safeProfileDatabaseError} from "./profile-schema.js";

async function main():Promise<void> {
  const url=process.env.PLANETFALL_MIGRATION_DATABASE_URL;
  if(!url){
    console.error("Set PLANETFALL_MIGRATION_DATABASE_URL to an authorized direct PostgreSQL connection before running this command.");
    process.exitCode=1;
    return;
  }
  try{
    const connection=profileConnection(url,121000);
    try{
      const applied=await migrateProfileSchema(connection);
      console.log(applied.length?`Profile schema updated (${applied.join(", ")}).`:"Profile schema is already current.");
    }finally{await connection.end();}
  }catch(error){
    console.error(safeProfileDatabaseError(error,"Profile migration").message);
    process.exitCode=1;
  }
}

await main();
