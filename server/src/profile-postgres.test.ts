import {fork,type ChildProcess} from "node:child_process";
import {once} from "node:events";
import {fileURLToPath} from "node:url";
import pg from "pg";
import {expect,it} from "vitest";
import {SHOP_CATALOG} from "@planetfall/shared";
import type {Command} from "../test/profile-process.js";
import type {PlayerProgress} from "./player-profiles.js";
import {reconcilePassRewards} from "./pass-reconciliation.js";
import {profileTestDatabase as configured,withProfilePostgres} from "../test/profile-postgres-fixture.js";

const workerPath=fileURLToPath(new URL("../test/profile-process.ts",import.meta.url));

async function postgres(run:(client:pg.Client,boot:()=>Promise<Worker>)=>Promise<void>):Promise<void>{
  await withProfilePostgres(async({owner,runtimeUrl,migrate,grantRuntime})=>{
    await migrate();
    await grantRuntime();
    const workers:Worker[]=[];
    try{
      await run(owner,async()=>{
        const worker=new Worker(runtimeUrl);
        workers.push(worker);
        await worker.ready;
        return worker;
      });
    }finally{await Promise.all(workers.map(worker=>worker.stop()));}
  });
}

class Worker{
  readonly child:ChildProcess;
  readonly ready:Promise<{pid:number;startupMs:number}>;
  private sequence=0;
  constructor(url:string){
    this.child=fork(workerPath,[],{execArgv:["--import","tsx"],env:{...process.env,PLANETFALL_TEST_PG_WORKER_URL:url},stdio:["ignore","ignore","inherit","ipc"]});
    this.ready=new Promise((resolve,reject)=>{
      this.child.once("message",resolve);
      this.child.once("exit",code=>reject(new Error(`Profile process exited with ${code}`)));
      this.child.once("error",reject);
    });
  }
  call<T=void>(command:Command):Promise<T>{
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{
      const failed=(code:unknown)=>{cleanup();reject(new Error(`Profile process exited during ${command.kind} (${code})`));};
      const message=(reply:{id:number;value:T;error?:string})=>{
        if(reply.id!==id)return;
        cleanup();
        if(reply.error)reject(new Error(reply.error));else resolve(reply.value);
      };
      const cleanup=()=>{this.child.off("exit",failed);this.child.off("message",message);};
      this.child.on("message",message);
      this.child.once("exit",failed);
      this.child.send({id,command},error=>{if(error){cleanup();reject(error);}});
    });
  }
  async stop(graceful=false):Promise<void>{
    if(this.child.exitCode!==null||this.child.signalCode!==null)return;
    const exited=once(this.child,"exit");
    if(graceful)await this.call({kind:"close"});else this.child.kill("SIGKILL");
    await exited;
  }
}
const create=(worker:Worker)=>worker.call<{key:string;token:string}>({kind:"create"});
const bind=(worker:Worker,key:string)=>worker.call<PlayerProgress>({kind:"bind",key});
const earn=(worker:Worker,key:string,xp:number,bucks:number,crowns=0)=>worker.call<{saveMs:number}>({kind:"earn",key,xp,bucks,crowns});
async function read(client:pg.Client,key:string):Promise<{progress:PlayerProgress;leaderboard_name:string|null}>{
  const {rows}=await client.query("SELECT progress,leaderboard_name FROM planetfall_guest_profiles WHERE id=$1",[key]);
  return rows[0];
}

it.skipIf(!configured)("preserves an independent writer's committed progression and reproduces the legacy mixed-version hazard",async()=>{
  await postgres(async(client,boot)=>{
    const initial=await boot();
    const a=(await create(initial)).key,b=(await create(initial)).key;
    await Promise.all([bind(initial,a),bind(initial,b)]);
    await earn(initial,a,100,0);
    const baseline=(await read(client,a)).progress;
    expect(baseline).toMatchObject({sessionTotalXp:100,fallbucks:50});
    const [retiring,replacement]=await Promise.all([boot(),boot()]);
    expect((await retiring.ready).pid).not.toBe((await replacement.ready).pid);
    await Promise.all([bind(retiring,b),bind(replacement,a)]);
    const pass=structuredClone(baseline);
    pass.sessionTotalXp=640;
    reconcilePassRewards(pass);
    await earn(replacement,a,540,247-pass.fallbucks);
    await earn(retiring,b,15,18);
    expect((await read(client,a)).progress).toMatchObject({sessionTotalXp:640,fallbucks:247});
    expect((await read(client,b)).progress).toMatchObject({sessionTotalXp:15,fallbucks:18});
    await retiring.call({kind:"legacySave",key:b,bucks:19});
    expect((await read(client,a)).progress).toMatchObject({sessionTotalXp:100,fallbucks:50});
  });
},20000);

it.skipIf(!configured)("serializes stale rewards, purchases, Pass grants, linking and opt-out across processes and restart",async()=>{
  await postgres(async(client,boot)=>{
    const a=await boot(),identity=await create(a),key=identity.key;
    const item=SHOP_CATALOG.find(item=>item.id==="solar-gold")!;
    await bind(a,key);
    await earn(a,key,0,item.price+5);
    const b=await boot();
    await bind(b,key);
    await a.call({kind:"visibility",key,name:"Native Pilot"});
    await b.call({kind:"visibility",key,name:null});
    const started=performance.now();
    const [first,second]=await Promise.all([
      a.call<{ok:boolean}>({kind:"shop",key,item:item.id,action:"buy"}),
      b.call<{ok:boolean}>({kind:"shop",key,item:item.id,action:"buy"}),
      earn(a,key,60,20,1),
      earn(b,key,60,30,2),
    ]);
    const concurrentMs=performance.now()-started;
    expect([first,second].filter(value=>value.ok)).toHaveLength(1);
    expect(await a.call({kind:"shop",key,item:item.id,action:"equip"})).toMatchObject({ok:true});
    const [claimed]=await Promise.all([b.call({kind:"claim",key}),earn(a,key,10,7)]);
    expect(claimed).toBe(true);
    await expect(a.call({kind:"visibility",key,name:"Stale Guest"})).rejects.toThrow("linked");
    await expect(a.call({kind:"shop",key,item:"pressure-white",action:"buy"})).rejects.toThrow("linked");
    const saved=await read(client,key);
    expect(saved.progress).toMatchObject({sessionTotalXp:130,fallbucks:112,crowns:3,ownedCosmetics:[item.id],equippedCosmetics:{suit:item.id}});
    expect(saved.progress.unlockedPassRewards.filter(id=>id==="bucks-50")).toHaveLength(1);
    expect(saved.leaderboard_name).toBeNull();
    expect((await client.query("SELECT profile_key FROM planetfall_account_links")).rows).toEqual([{profile_key:key}]);

    await a.call({kind:"holdUncommitted",key});
    await a.stop();
    expect(await read(client,key)).toEqual(saved);
    await earn(b,key,1,2);
    await b.stop(true);
    const restarted=await boot();
    expect(await bind(restarted,key)).toMatchObject({sessionTotalXp:131,fallbucks:114,crowns:3,equippedCosmetics:{suit:item.id}});
    const receipts=(await client.query("SELECT count(*)::int AS count FROM planetfall_profile_operations")).rows[0].count;
    console.info({nativeConcurrentFourOperationsMs:concurrentMs,workerStartupMs:(await restarted.ready).startupMs,receipts});
  });
},20000);

it.skipIf(!configured)("preserves repeated independent interleavings across more profiles",async()=>{
  await postgres(async(client,boot)=>{
    const a=await boot(),b=await boot();
    const sets=await Promise.all([a,b].map(async worker=>{
      const keys:string[]=[];
      for(let i=0;i<4;i++){
        const {key}=await create(worker);
        await bind(worker,key);
        keys.push(key);
      }
      return {worker,keys};
    }));
    const start=performance.now();
    const saveTimes:number[]=[];
    for(let round=0;round<6;round++){
      const saved=await Promise.all(sets.flatMap(({worker,keys})=>keys.map(key=>earn(worker,key,10,3))));
      saveTimes.push(...saved.map(result=>result.saveMs));
    }
    for(const {keys}of sets)for(const key of keys)expect((await read(client,key)).progress).toMatchObject({sessionTotalXp:60,fallbucks:18});
    const {rows}=await client.query("SELECT count(*)::int AS count FROM planetfall_profile_operations");
    expect(rows[0].count).toBe(48);
    saveTimes.sort((a,b)=>a-b);
    console.info({nativeIndependentProfiles:8,rewardTransactions:48,elapsedMs:performance.now()-start,
      saveAndQueueP50Ms:saveTimes[23],saveAndQueueP95Ms:saveTimes[45]});
    const buyer=(await create(a)).key;
    await bind(a,buyer);
    const items=["solar-gold","pressure-white"].map(id=>SHOP_CATALOG.find(item=>item.id===id)!);
    const wallet=Math.max(...items.map(item=>item.price));
    await earn(a,buyer,0,wallet);
    await bind(b,buyer);
    const purchases=await Promise.all([a,b].map((worker,index)=>worker.call<{ok:boolean;error?:string}>({
      kind:"shop",key:buyer,item:items[index].id,action:"buy",
    })));
    const winner=purchases.findIndex(result=>result.ok);
    expect(winner).toBeGreaterThanOrEqual(0);
    expect(purchases[1-winner]).toEqual({ok:false,error:"Not enough Fallbucks."});
    expect((await read(client,buyer)).progress).toMatchObject({fallbucks:wallet-items[winner].price,ownedCosmetics:[items[winner].id]});
  });
},20000);
