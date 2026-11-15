import {PGlite} from "@electric-sql/pglite";
import {createPlanetfallServer} from "../../server/src/app.js";
import {GameRoom} from "../../server/src/game-room.js";
import {FixtureAccountProvider} from "./account-provider.js";

const database = new PGlite();
await database.waitReady;
const provider = new FixtureAccountProvider();
const server = await createPlanetfallServer({nodeEnv:"test",testAccounts:{provider,
  origin:"http://127.0.0.1:25173",connection:{query:(sql,values)=>database.query(sql,values),end:()=>database.close()},
}});
// This runner is used only by Playwright, and is outside the production build.
server.app.post("/__test/revoke",(req,res)=>{
  provider.sessions.delete(provider.credential(req.get("cookie")??""));
  res.status(204).end();
});
await server.listen();
// The production clock and reward path still resolve placement, XP and currency.
// Bound overtime in this fixture so a draw takes the same path as a decisive round.
setInterval(()=>{
  const deadline=Date.now()+1500;
  for(const room of server.manager.rooms.values()) {
    if(room instanceof GameRoom&&room.phase==="overtime"&&room.overtimeEndsAt&&room.overtimeEndsAt>deadline)
      room.overtimeEndsAt=room.matchEndsAt=deadline;
  }
},100).unref();
