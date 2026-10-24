import {expect,it} from "vitest";
import {PG_MAP,pgSpawnMotion,pgStepMovement,type PgPlayer} from "@planetfall/shared";
import {pgBotInput,pgBotMemory} from "./pg-bots.js";

it.each([[[-31,3.5,-12.6],[-25,3.5,-15]],[[32,3.5,15.6],[28,3.5,23]]])("keeps bot steering on its actual gallery landing %#",(start,end)=>{
 const node=(p:number[])=>PG_MAP.navigation.find(n=>Math.hypot(n.position.x-p[0],n.position.y-p[1],n.position.z-p[2])<.001)!;
 const from=node(start),to=node(end),queue=[from.id],previous=new Map<number,number>([[from.id,-1]]);
 for(let i=0;i<queue.length;i++){const id=queue[i];if(id===to.id)break;for(const link of PG_MAP.navigation[id].links)if(!previous.has(link.to)){previous.set(link.to,id);queue.push(link.to);}}
 const path=[to.id];while(path[0]!==from.id)path.unshift(previous.get(path[0])!);path.shift();
 for(const offset of[-.3,0,.3]){
 const p={...pgSpawnMotion({...from.position,z:from.position.z+offset}),id:"landing-bot",team:"solar",hp:100,grounded:true} as PgPlayer;
 const memory=pgBotMemory();memory.goal=to.id;memory.path=path;memory.nextDecision=Infinity;memory.stuckAt=10_000;
 for(let i=0;i<400;i++){if(!memory.path.length&&Math.hypot(p.position.x-to.position.x,p.position.z-to.position.z)<.15)break;const now=10_000+i*1000/60,{input}=pgBotInput(p,[p],now,"normal",memory);pgStepMovement(p,input,1/60,now);expect(p.position.y).toBeCloseTo(3.5);}
 expect(Math.hypot(p.position.x-to.position.x,p.position.z-to.position.z)).toBeLessThan(.15);
 }
});
