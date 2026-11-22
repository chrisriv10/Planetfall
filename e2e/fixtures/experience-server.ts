import {join} from "node:path";
import {tmpdir} from "node:os";
import {createPlanetfallServer} from "../../server/dist/app.js";
// Local-only gameplay fixture: real simulation and result settlement, disk save.
if(process.env.NODE_ENV!=="test")throw new Error("Experience fixture requires test mode");
const app=await createPlanetfallServer({port:25480,host:"127.0.0.1",nodeEnv:"test",clientOrigins:["http://127.0.0.1:25481"],profileFile:join(tmpdir(),"planetfall-beyond-launch-browser",process.env.PLANETFALL_EXPERIENCE_RUN??"local","profiles.json")});
await app.listen();
process.send?.({ready:true});
process.on("message",message=>{if(message==="stop")void app.close().then(()=>process.exit(0));});
for(const event of ["SIGTERM","SIGINT"] as const)process.on(event,()=>void app.close().then(()=>process.exit(0)));
