import pg from "pg";
import {DEFAULT_COSMETICS} from "@planetfall/shared";
import {ProfileDatabase} from "../src/profile-database.js";
import {PlayerProfiles,type PlayerProgress} from "../src/player-profiles.js";

export type Command =
  | {kind:"create"}
  | {kind:"bind";key:string}
  | {kind:"earn";key:string;xp:number;bucks:number;crowns?:number}
  | {kind:"shop";key:string;item:string;action:"buy"|"equip";guest?:boolean}
  | {kind:"visibility";key:string;name:string|null}
  | {kind:"claim";key:string}
  | {kind:"legacySave";key:string;bucks:number}
  | {kind:"holdUncommitted";key:string}
  | {kind:"close"};

const url=process.env.PLANETFALL_TEST_PG_WORKER_URL!;
const start=performance.now();
const {database,document}=await ProfileDatabase.connect(url);
const legacySnapshot=structuredClone(document.profiles);
const store=new PlayerProfiles(undefined,document,database);
for(const key of await database.accountKeys())store.holdGuest(key);
const players=new Map<string,PlayerProgress>();
let held:pg.Client|undefined;

function pilot(key:string):PlayerProgress{
  const player=players.get(key);
  if(!player)throw new Error("Fixture has no bound pilot");
  return player;
}

async function run(command:Command):Promise<unknown>{
  switch(command.kind){
    case "create":return store.connectGuest(undefined);
    case "bind":{
      const player:PlayerProgress={
        fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,
        ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"],
      };
      await store.refresh(command.key);
      store.bind(player,command.key);
      players.set(command.key,player);
      return player;
    }
    case "earn":{
      const started=performance.now();
      const player=pilot(command.key);
      player.sessionTotalXp+=command.xp;
      player.fallbucks+=command.bucks;
      player.crowns+=command.crowns??0;
      store.capture([player]);
      await database.flush(command.key);
      return {saveMs:performance.now()-started};
    }
    case "shop":return store.shop(command.key,command.guest??true,command.action,command.item,"planetfall",()=>"lobby");
    case "visibility":return store.setLeaderboardName(command.key,command.name,true);
    case "claim":return database.claimProfile("integration-issuer","integration-user",command.key);
    case "legacySave":{
      // The retiring version starts from its own stale hydration and sends all rows.
      legacySnapshot[command.key].fallbucks+=command.bucks;
      const connection=new pg.Client({connectionString:url});
      await connection.connect();
      try{
        await connection.query("INSERT INTO planetfall_guest_profiles (id, progress) SELECT key, value FROM jsonb_each($1::jsonb) ON CONFLICT (id) DO UPDATE SET progress = EXCLUDED.progress",[JSON.stringify(legacySnapshot)]);
      }finally{await connection.end();}
      return;
    }
    case "holdUncommitted":{
      held=new pg.Client({connectionString:url});
      await held.connect();
      await held.query("BEGIN");
      await held.query("UPDATE planetfall_guest_profiles SET progress=jsonb_set(progress,'{fallbucks}','999999') WHERE id=$1",[command.key]);
      return;
    }
    case "close":return store.close();
  }
}

process.on("message",({id,command}:{id:number;command:Command})=>{
  void run(command).then(
    value=>process.send?.({id,value},()=>{if(command.kind==="close")process.disconnect?.();}),
    error=>process.send?.({id,error:error instanceof Error?error.message:"Fixture operation failed"}),
  );
});
process.send?.({pid:process.pid,startupMs:performance.now()-start});
