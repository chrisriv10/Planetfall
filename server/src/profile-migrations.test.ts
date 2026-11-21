import {spawn,type ChildProcess} from "node:child_process";
import {once} from "node:events";
import pg from "pg";
import {expect,it,vi} from "vitest";
import {DEFAULT_COSMETICS} from "@planetfall/shared";
import {createPlanetfallServer} from "./app.js";
import {ProfileDatabase} from "./profile-database.js";
import {profileConnection} from "./profile-connection.js";
import {migrateProfileSchema} from "./profile-migrations.js";
import {earnedXp,leaderboardCheck,leaderboardOrder} from "./profile-schema.js";
import {profileTestDatabase,withProfilePostgres} from "../test/profile-postgres-fixture.js";

const native=it.skipIf(!profileTestDatabase);
const profiles="planetfall_guest_profiles";
const accountLinks="planetfall_account_links";
const operations="planetfall_profile_operations";
const rankIndex="planetfall_leaderboard_rank_idx";
const legacy=`CREATE TABLE ${profiles} (id text PRIMARY KEY, progress jsonb NOT NULL)`;
const key="a".repeat(64),privateKey="b".repeat(64);
const progress={
  fallbucks:247,crowns:3,sessionTotalXp:640,sessionLevel:3,sessionXp:40,
  ownedCosmetics:["solar-gold"],equippedCosmetics:{...DEFAULT_COSMETICS,suit:"solar-gold"},
  unlockedPassRewards:["default","bucks-50","bucks-75"],
};

async function expectHealthy(url:string):Promise<void> {
  const health=await fetch(`${url}/health`);
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ok:true,rooms:0,uptime:expect.any(Number),profileStorage:"postgresql"});
}

native("migrates fresh storage once and starts actual HTTP service repeatedly with DML-only columns",async()=>{
  await withProfilePostgres(async({owner,runtimeUrl,migrate,grantRuntime})=>{
    const first=await migrate();
    expect(first).toEqual([profiles,rankIndex,operations,accountLinks]);
    const inspect=()=>owner.query(`SELECT oid,relname,relowner FROM pg_class
      WHERE relnamespace=current_schema()::regnamespace ORDER BY relname`);
    const before=(await inspect()).rows;
    expect(await migrate()).toEqual([]);
    expect((await inspect()).rows).toEqual(before);
    await grantRuntime();

    const role=new pg.Client({connectionString:runtimeUrl});
    await role.connect();
    try{
      const {rows:[permissions]}=await role.query(`SELECT
        has_schema_privilege(current_schema(),'CREATE') AS can_create,
        has_database_privilege(current_database(),'CREATE') AS can_create_schema,
        has_table_privilege('${profiles}','DELETE') AS can_delete,
        has_column_privilege('${profiles}','id','UPDATE') AS can_change_key,
        pg_has_role((SELECT relowner FROM pg_class WHERE oid='${profiles}'::regclass),'MEMBER') AS can_own`);
      expect(permissions).toEqual({can_create:false,can_create_schema:false,can_delete:false,can_change_key:false,can_own:false});
      for(const sql of [
        "CREATE TABLE rejected (id integer)",
        `ALTER TABLE ${profiles} ADD COLUMN rejected integer`,
        `CREATE INDEX rejected ON ${profiles}(id)`,
        `DELETE FROM ${profiles} WHERE false`,
      ])await expect(role.query(sql)).rejects.toMatchObject({code:"42501"});
    }finally{await role.end();}
    for(let attempt=0;attempt<2;attempt++){
      const start=performance.now();
      const server=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"test",profileDatabaseUrl:runtimeUrl});
      try{
        const {url}=await server.listen();
        await expectHealthy(url);
        console.info({restrictedAppStartupMs:performance.now()-start,attempt:attempt+1});
      }finally{await server.close();}
    }
    const {database}=await ProfileDatabase.connect(runtimeUrl);
    try{
      await database.createProfile(key,progress);
      expect(await database.claimProfile("issuer","user",key)).toBe(true);
      expect(await database.saveAccountPreferences(key,0,{version:1})).toBe(true);
      expect(await database.accountPreferences(key)).toEqual({revision:1,value:{version:1}});
      const id="b51eb2f2-1ac9-477a-ac56-994278d423a5";
      const mutate=()=>database.mutate(key,id,false,value=>({value:"success",progress:{...value,fallbucks:value.fallbucks+1}}));
      expect((await mutate()).progress.fallbucks).toBe(248);
      expect((await mutate()).progress.fallbucks).toBe(248);
      await database.setLeaderboardName(key,"Public Pilot");
      expect(await database.leaderboardRank(key)).toMatchObject({xp:640,name:"Public Pilot",rank:1});
      await database.setLeaderboardName(key,null);
      expect(await database.leaderboardTop()).toEqual([]);
    }finally{await database.close();}
  });
},20000);

native("upgrades the historical account and leaderboard schema without changing existing rows",async()=>{
  await withProfilePostgres(async({owner,runtimeUrl,migrate,grantRuntime})=>{
    await owner.query(`
      ${legacy};
      ALTER TABLE ${profiles} ADD COLUMN leaderboard_name text CHECK (${leaderboardCheck});
      CREATE INDEX ${rankIndex} ON ${profiles} (${leaderboardOrder}) WHERE leaderboard_name IS NOT NULL;
      CREATE TABLE ${accountLinks} (
        issuer text NOT NULL, auth_user_id text NOT NULL, profile_key text UNIQUE NOT NULL REFERENCES ${profiles}(id),
        linked_at timestamptz NOT NULL DEFAULT now(), preferences jsonb, preferences_revision integer NOT NULL DEFAULT 0,
        PRIMARY KEY (issuer, auth_user_id),
        CHECK (preferences IS NULL OR octet_length(preferences::text) <= 12000)
      );
    `);
    await owner.query(`INSERT INTO ${profiles} (id,progress,leaderboard_name) VALUES ($1,$2,'Saved Pilot'),($3,$2,NULL)`,[key,progress,privateKey]);
    await owner.query(`INSERT INTO ${accountLinks} (issuer,auth_user_id,profile_key,preferences,preferences_revision)
      VALUES ('old-issuer','old-account',$1,'{"version":1}',3)`,[key]);
    const before=(await owner.query(`SELECT * FROM ${profiles} ORDER BY id`)).rows;
    const links=(await owner.query(`SELECT * FROM ${accountLinks}`)).rows;
    expect(await migrate()).toEqual([operations]);
    expect(await migrate()).toEqual([]);
    expect((await owner.query(`SELECT * FROM ${profiles} ORDER BY id`)).rows).toEqual(before);
    expect((await owner.query(`SELECT * FROM ${accountLinks}`)).rows).toEqual(links);
    await grantRuntime();
    const {database,document}=await ProfileDatabase.connect(runtimeUrl);
    try{
      expect(document.profiles[key]).toEqual(progress);
      expect(document.leaderboardNames).toEqual({[key]:"Saved Pilot"});
      expect((await database.readProfile(key))?.claimed).toBe(true);
      expect(await database.accountPreferences(key)).toEqual({value:{version:1},revision:3});
      expect(await database.leaderboardTop()).toEqual([{key,name:"Saved Pilot",xp:640}]);
    }finally{await database.close();}
    await owner.query(`INSERT INTO ${profiles} (id,progress,leaderboard_name)
      SELECT md5(i::text),jsonb_build_object('sessionTotalXp',i),CASE WHEN i%10=0 THEN 'Test Pilot' END
      FROM generate_series(1,10000) AS i`);
    await owner.query(`ANALYZE ${profiles}`);
    const role=new pg.Client({connectionString:runtimeUrl});
    await role.connect();
    try{
      const {rows}=await role.query(`EXPLAIN (COSTS OFF)
        SELECT id,leaderboard_name,${earnedXp} AS xp FROM ${profiles}
        WHERE leaderboard_name IS NOT NULL ORDER BY ${leaderboardOrder} LIMIT 10`);
      const plan=rows.map(row=>row["QUERY PLAN"]).join("\n");
      expect(plan).toContain(`Index Scan using ${rankIndex}`);
      console.info(plan);
    }finally{await role.end();}
  });
},20000);

native("rolls back interruption, repairs additive partial state and refuses to replace an incompatible index",async()=>{
  await withProfilePostgres(async({owner,ownerUrl,runtimeUrl,migrate})=>{
    await owner.query(legacy);
    await owner.query(`INSERT INTO ${profiles} VALUES ($1,$2)`,[key,progress]);
    const restricted=profileConnection(runtimeUrl);
    try{await expect(migrateProfileSchema(restricted)).rejects.toMatchObject({code:"42501"});}
    finally{await restricted.end();}
    const connection=profileConnection(ownerUrl);
    try{
      const interrupted={...connection,transaction:<T>(run:Parameters<typeof connection.transaction<T>>[0])=>
        connection.transaction(query=>run((sql,values)=>{
          if(sql.startsWith("CREATE INDEX"))throw new Error("Migration interrupted after adding a column");
          return query(sql,values);
        }))};
      await expect(migrateProfileSchema(interrupted)).rejects.toThrow("Migration interrupted");
    }finally{await connection.end();}
    expect((await owner.query(`SELECT * FROM ${profiles}`)).rows).toEqual([{id:key,progress}]);
    await expect(createPlanetfallServer({port:0,nodeEnv:"test",profileDatabaseUrl:runtimeUrl})).rejects.toThrow(`missing ${operations}`);
    expect((await owner.query(`SELECT to_regclass('${operations}') AS receipts`)).rows).toEqual([{receipts:null}]);
    await owner.query(`ALTER TABLE ${profiles} ADD COLUMN leaderboard_name text`);
    await owner.query(`CREATE INDEX ${rankIndex} ON ${profiles}(id)`);
    await expect(migrate()).rejects.toThrow(`incompatible ${rankIndex}`);
    expect((await owner.query(`SELECT to_regclass('${accountLinks}') AS links`)).rows).toEqual([{links:null}]);
    await owner.query(`DROP INDEX ${rankIndex}`);
    expect(await migrate()).toEqual([`${profiles} publication check`,rankIndex,operations,accountLinks]);
    await expect(owner.query(`UPDATE ${profiles} SET leaderboard_name='Invalid!' WHERE id=$1`,[key])).rejects.toMatchObject({code:"23514"});
    expect((await owner.query(`SELECT * FROM ${profiles}`)).rows).toEqual([{id:key,progress,leaderboard_name:null}]);
  });
},20000);

native("fails cleanly when runtime grants or login are wrong, then starts when grants are restored",async()=>{
  await withProfilePostgres(async({owner,runtimeUrl,migrate,grantRuntime})=>{
    await migrate();
    await grantRuntime();
    const runtime=new URL(runtimeUrl);
    const replica=new URL(runtime);
    replica.searchParams.set("options",`${replica.searchParams.get("options")} -c default_transaction_read_only=on`);
    await expect(ProfileDatabase.connect(replica.href)).rejects.toThrow("connection is read-only");
    await owner.query(`REVOKE UPDATE (leaderboard_name) ON ${profiles} FROM ${runtime.username}`);
    await expect(createPlanetfallServer({port:0,nodeEnv:"test",profileDatabaseUrl:runtimeUrl})).rejects.toThrow("missing UPDATE on planetfall_guest_profiles.leaderboard_name");
    const wrong=new URL(runtime);
    wrong.username="missing_planetfall_test_role";
    await expect(ProfileDatabase.connect(wrong.href)).rejects.toThrow(/^Profile database startup failed \((28000|28P01)\)/);
    await grantRuntime();
    const {database}=await ProfileDatabase.connect(runtimeUrl);
    await database.close();
  });
},20000);

native("reopens a terminated runtime session and preserves a committed receipt",async()=>{
  await withProfilePostgres(async({runtimeUrl,migrate,grantRuntime})=>{
    await migrate();
    await grantRuntime();
    const reconnect=new URL(runtimeUrl);
    reconnect.searchParams.set("application_name","planetfall_reconnect_test");
    const {database}=await ProfileDatabase.connect(reconnect.href);
    const controller=new pg.Client({connectionString:runtimeUrl});
    const interrupted=Promise.withResolvers<void>();
    const log=vi.spyOn(console,"error").mockImplementation(message=>{
      if(message==="Profile database connection interrupted.")interrupted.resolve();
    });
    try{
      await controller.connect();
      await database.createProfile(key,progress);
      const id="63655117-49e1-4d96-a256-d753df5cbb01";
      const mutation=()=>database.mutate(key,id,true,p=>({value:"bought",progress:{...p,fallbucks:p.fallbucks-100}}));
      expect((await mutation()).progress.fallbucks).toBe(147);
      const {rows}=await controller.query(`SELECT pg_terminate_backend(pid,1000) AS stopped
        FROM pg_stat_activity WHERE application_name='planetfall_reconnect_test'
          AND usename=current_user AND pid<>pg_backend_pid()`);
      expect(rows).toEqual([{stopped:true}]);
      await interrupted.promise;
      expect(await mutation()).toMatchObject({value:"bought",progress:{fallbucks:147}});
      expect((await database.readProfile(key))?.progress.fallbucks).toBe(147);
    }finally{
      log.mockRestore();
      await Promise.all([controller.end(),database.close()]);
    }
  });
},20000);

native("serializes explicit migrations and lets two restricted server processes start during an advisory lock",async()=>{
  await withProfilePostgres(async({owner,runtimeUrl,migrate,grantRuntime})=>{
    const [a,b]=await Promise.all([migrate(),migrate()]);
    expect([a.length,b.length].sort()).toEqual([0,4]);
    await grantRuntime();
    const source=`
      import {createPlanetfallServer} from ${JSON.stringify(new URL("./app.ts",import.meta.url).href)};
      const app=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"test",profileDatabaseUrl:process.env.PLANETFALL_TEST_RUNTIME_URL});
      process.send(await app.listen());
      process.on("message",async()=>{try{await app.close();}finally{process.disconnect();}});
    `;
    const children:ChildProcess[]=[];
    await owner.query("SELECT pg_advisory_lock(16795611,1)");
    try{
      const starts=Array.from({length:2},()=>{
        const child=spawn(process.execPath,["--import","tsx","--input-type=module","-e",source],{
          env:{...process.env,PLANETFALL_TEST_RUNTIME_URL:runtimeUrl},stdio:["ignore","ignore","inherit","ipc"],
        });
        children.push(child);
        return Promise.race([
          once(child,"message").then(([message])=>message as {url:string}),
          once(child,"exit").then(([code])=>{throw new Error(`Server exited before listening (${code})`);}),
        ]);
      });
      const servers=await Promise.all(starts);
      expect(children[0].pid).not.toBe(children[1].pid);
      await Promise.all(servers.map(server=>expectHealthy(server.url)));
    }finally{
      await owner.query("SELECT pg_advisory_unlock(16795611,1)");
      await Promise.all(children.map(async child=>{
        if(child.exitCode!==null||child.signalCode!==null)return;
        const ended=once(child,"exit");
        child.kill();
        await ended;
      }));
    }
  });
},20000);
