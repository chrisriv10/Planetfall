import {spawn} from "node:child_process";
import {request} from "node:http";
import {fileURLToPath} from "node:url";
import {brotliCompressSync,deflateSync,gzipSync} from "node:zlib";
import {expect,it} from "vitest";
import {io} from "socket.io-client";

const worker=fileURLToPath(new URL("../test/http-body-process.ts",import.meta.url));
const origin="http://test.local";

async function deadline<T>(promise:Promise<T>,label:string,milliseconds=5000):Promise<T>{
  let timeout:ReturnType<typeof setTimeout>;
  try{
    return await Promise.race([promise,new Promise<never>((_,reject)=>{
      timeout=setTimeout(()=>reject(new Error(`${label} timed out`)),milliseconds);
    })]);
  }finally{clearTimeout(timeout!);}
}

async function withServer(run:(url:string)=>Promise<void>):Promise<void>{
  const env:NodeJS.ProcessEnv={...process.env,NODE_ENV:"test"};
  for(const key of Object.keys(env)){
    if(key==="DATABASE_URL"||key.startsWith("PLANETFALL_")||key.startsWith("NEON_AUTH_"))delete env[key];
  }
  const child=spawn(process.execPath,["--import","tsx",worker],{env,windowsHide:true,stdio:["ignore","ignore","pipe","ipc"]});
  let stderr="";
  child.stderr!.on("data",chunk=>{stderr=(stderr+String(chunk)).slice(-4000);});
  const exited=new Promise<{code:number|null;signal:NodeJS.Signals|null}>(resolve=>{
    child.once("exit",(code,signal)=>resolve({code,signal}));
  });
  try{
    const ready=new Promise<{url:string}>((resolve,reject)=>{
      const exit=(code:number|null)=>{cleanup();reject(new Error(`HTTP fixture exited (${code}): ${stderr}`));};
      const error=(error:Error)=>{cleanup();reject(error);};
      const message=(address:{url:string})=>{cleanup();resolve(address);};
      const cleanup=()=>{child.off("exit",exit);child.off("error",error);child.off("message",message);};
      child.once("exit",exit);child.once("error",error);child.once("message",message);
    });
    const {url}=await deadline(ready,"HTTP fixture startup",10000);
    expect(new URL(url).hostname).toBe("127.0.0.1");
    await run(url);
    await new Promise<void>((resolve,reject)=>child.send("close",error=>error?reject(error):resolve()));
    expect(await deadline(exited,"HTTP fixture shutdown"),stderr).toEqual({code:0,signal:null});
  }finally{
    if(child.exitCode===null&&child.signalCode===null)child.kill();
    await exited;
  }
}

function post(url:string,body:Buffer,encoding?:string):Promise<{status:number;body:string;cache:string|undefined}>{
  return new Promise((resolve,reject)=>{
    const incoming=request(new URL("/api/account/session",url),{
      method:"POST",agent:false,headers:{origin,"content-type":"application/json","content-length":body.length,
        ...(encoding?{"content-encoding":encoding}:{}),
      },
    },response=>{
      let text="";
      response.setEncoding("utf8");response.on("data",chunk=>{text+=chunk;});response.on("error",reject);
      response.on("end",()=>resolve({status:response.statusCode!,body:text,cache:response.headers["cache-control"]}));
    });
    incoming.on("error",reject);
    incoming.setTimeout(5000,()=>incoming.destroy(new Error("HTTP fixture request timed out")));
    incoming.end(body);
  });
}

async function healthy(url:string):Promise<void>{
  const response=await fetch(new URL("/health",url),{signal:AbortSignal.timeout(5000)});
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ok:true,profileStorage:"memory"});
}

it.each([
  ["gzip",gzipSync],["deflate",deflateSync],["br",brotliCompressSync],
] as const)("rejects %s JSON and trailing bytes without crashing the actual server",async(encoding,compress)=>{
  await withServer(async url=>{
    const plain=Buffer.from("{}");
    expect(await post(url,plain)).toMatchObject({status:200,body:'{"state":"disabled"}'});
    const compressed=compress(plain);
    // A complete frame followed by a zero byte and a large trailing chunk
    // reproduces the old decoder's uncaught error after it finished the JSON.
    for(const body of [compressed,Buffer.concat([compressed,Buffer.from([0]),Buffer.alloc(128*1024,0x59)])]){
      expect(await post(url,body,encoding)).toEqual({status:400,body:"",cache:"private, no-store"});
      await healthy(url);
    }
    expect(await post(url,plain)).toMatchObject({status:200,body:'{"state":"disabled"}'});
    // The same surviving process must still handle real multiplayer admission.
    const socket=io(url,{transports:["websocket"],extraHeaders:{origin},forceNew:true,reconnection:false});
    try{
      await deadline(new Promise<void>((resolve,reject)=>{
        socket.once("connect",resolve);socket.once("connect_error",reject);
      }),"Socket connection after rejected bodies");
      expect(await socket.timeout(3000).emitWithAck("room:create",{name:"Body safety pilot"})).toMatchObject({ok:true});
    }finally{socket.disconnect();}
  });
});

it("keeps plain JSON, invalid-JSON rejection and the 16 KiB limit intact",async()=>{
  await withServer(async url=>{
    expect(await post(url,Buffer.from("{}"))).toMatchObject({status:200,body:'{"state":"disabled"}'});
    for(const body of [Buffer.from("{"),Buffer.from(JSON.stringify({value:"x".repeat(16*1024)}))]){
      expect(await post(url,body)).toEqual({status:400,body:"",cache:"private, no-store"});
      await healthy(url);
    }
    expect(await post(url,Buffer.from("{}"))).toMatchObject({status:200,body:'{"state":"disabled"}'});
  });
});
