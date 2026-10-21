import {afterEach,expect,it} from "vitest";
import {mkdtempSync,rmSync,rmdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createPlanetfallServer} from "./app.js";

const servers:Awaited<ReturnType<typeof createPlanetfallServer>>[]=[];
const directories:string[]=[];
afterEach(async()=>{
  for(const server of servers.splice(0))await server.close();
  for(const directory of directories.splice(0)){
    rmSync(join(directory,"profiles.json"),{force:true});
    rmSync(join(directory,"profiles.json.tmp"),{force:true});
    rmdirSync(directory);
  }
});

it.each(["memory","file"] as const)("reports %s profile storage without exposing storage configuration",async mode=>{
  let profileFile:string|undefined;
  if(mode==="file"){
    const directory=mkdtempSync(join(tmpdir(),"planetfall-health-"));
    directories.push(directory);profileFile=join(directory,"profiles.json");
  }
  const server=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"test",profileFile});
  servers.push(server);const {url}=await server.listen();
  const response=await fetch(`${url}/health`);
  expect(response.status).toBe(200);
  const health=await response.json();
  expect(health).toEqual({ok:true,rooms:0,uptime:expect.any(Number),profileStorage:mode});
  if(profileFile)expect(JSON.stringify(health)).not.toContain(profileFile);
});
