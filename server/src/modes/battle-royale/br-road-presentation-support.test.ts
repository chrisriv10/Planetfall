import {expect,it} from "vitest";
import {BR_ROADS} from "@planetfall/shared";
import {buildBrRoadBends} from "../../../../client/src/modes/battle-royale/br-road-bends.js";
import {BrPhysicsWorld} from "./br-physics.js";

it("keeps added rounded pavement and curb footprints on the actual authoritative floor",()=>{
 const physics=new BrPhysicsWorld();let samples=0;
 const check=(p:{x:number;y:number;z:number})=>{
  samples++;expect(physics.rayDistance({...p,y:p.y+.3},{x:0,y:-1,z:0},1),JSON.stringify(p)).toBeCloseTo(.335,4);
 };
 try{
  for(const bend of buildBrRoadBends(BR_ROADS)){
   for(const p of bend.vertices)check(p);
   for(const [a,b,c] of bend.insideFans){
    const steps=Math.ceil(Math.max(Math.hypot(a.x-b.x,a.z-b.z),Math.hypot(a.x-c.x,a.z-c.z))/.5);
    for(let i=0;i<=steps;i++)for(let j=0;j<=steps-i;j++)check({x:a.x+(b.x-a.x)*i/steps+(c.x-a.x)*j/steps,y:a.y,z:a.z+(b.z-a.z)*i/steps+(c.z-a.z)*j/steps});
   }
   for(const edge of [bend.edge,bend.outerEdge])for(let i=1;i<edge.length;i++){
    const a=edge[i-1],b=edge[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    for(const t of [0,.5,1])for(const side of [-.12,.12])check({x:a.x+dx*t-dz/length*side,y:a.y,z:a.z+dz*t+dx/length*side});
   }
  }
  expect(samples).toBeGreaterThan(1000);
 }finally{physics.dispose();}
});
