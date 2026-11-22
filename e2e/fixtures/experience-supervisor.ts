import http from "node:http";
import {fork,type ChildProcess} from "node:child_process";
import {fileURLToPath} from "node:url";
if(process.env.NODE_ENV!=="test")throw new Error("Local experience supervisor requires test mode");
let child:ChildProcess;
async function start():Promise<void>{
  const started=Date.now();
  child=fork(fileURLToPath(new URL("./experience-server.ts",import.meta.url)),{execArgv:["--import","tsx"],env:process.env,stdio:["ignore","inherit","inherit","ipc"],windowsHide:true});
  // A measured cold tsx module load takes 31 seconds on the release workstation.
  // Bound fixture initialization within Playwright's existing 60-second server budget.
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Isolated child startup timed out")),55000);child.once("message",()=>{clearTimeout(timer);resolve();});child.once("exit",code=>{clearTimeout(timer);reject(Error(`Isolated child exited ${code}`));});});
  console.log(`Isolated compiled server ready after ${Date.now()-started}ms`);
}
async function stop():Promise<void>{if(child.exitCode!==null)return;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Isolated child shutdown timed out")),10000);child.once("exit",()=>{clearTimeout(timer);resolve();});child.send("stop");});}
await start();let restarting=false;
const control=http.createServer((req,res)=>{
  if(req.method!=="POST"||req.url!=="/restart"){res.writeHead(404).end();return;}
  if(restarting){res.writeHead(409).end();return;}restarting=true;
  void stop().then(start).then(()=>{res.writeHead(200,{"Content-Type":"application/json"}).end('{"restarted":true}');},error=>{console.error(error instanceof Error?error.message:"Isolated restart failed");res.writeHead(503).end();}).finally(()=>{restarting=false;});
});
control.listen(25482,"127.0.0.1");
for(const signal of ["SIGINT","SIGTERM"]as const)process.on(signal,()=>void stop().finally(()=>control.close(()=>process.exit(0))));
