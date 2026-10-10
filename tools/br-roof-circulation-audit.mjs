import {writeFile} from 'node:fs/promises';
import {BR_STRUCTURES,BR_MAP_BLOCKS,BR_LOOT_SOCKETS} from '../shared/dist/index.js';
import {BrPhysicsWorld} from '../server/src/modes/battle-royale/br-physics.ts';
import {BrPredictionPhysics} from '../client/src/modes/battle-royale/br-physics.ts';
const physics=new BrPhysicsWorld(),prediction=new BrPredictionPhysics(),routes=[];
try{
 for(const s of BR_STRUCTURES.filter(s=>s.roofAccess)){
  const ramp=BR_MAP_BLOCKS.find(b=>b.id===`${s.id}-roof-ramp`),roof=BR_MAP_BLOCKS.find(b=>b.id===`${s.id}-roof`);
  const side=s.roofAccessSide??s.entrance,axis=['north','south'].includes(side)?'z':'x',sign=['north','east'].includes(side)?1:-1,run=Math.max(10,s.size.y*2.35);
  const bottom={...ramp.position,y:s.position.y+.035},top={...ramp.position,y:roof.position.y+roof.size.y/2+.035};
  bottom[axis]+=sign*(run/2+1);top[axis]-=sign*(run/2+.8);
  const socket=BR_LOOT_SOCKETS.find(l=>l.id===`${s.id}-roof-loot`),loot={...socket.position,y:top.y};
  for(const reverse of [false,true]){
   const points=reverse?[loot,top,bottom]:[bottom,top,loot];
   let feet={...points[0]},predicted={...feet};const report={id:s.id,reverse,passed:true,gap:0,parity:0,points};routes.push(report);
   for(const target of points.slice(1)){
    let arrived=false,stalled=0;
    for(let frame=0;frame<1800;frame++){
     const dx=target.x-feet.x,dz=target.z-feet.z,d=Math.hypot(dx,dz),step=Math.min(.12,d),desired={x:d?dx/d*step:0,y:-.1,z:d?dz/d*step:0};
     const a=physics.move('roof',feet,desired,false),b=prediction.move(predicted,desired,false);
     feet={x:feet.x+a.movement.x,y:feet.y+a.movement.y,z:feet.z+a.movement.z};predicted={x:predicted.x+b.movement.x,y:predicted.y+b.movement.y,z:predicted.z+b.movement.z};
     report.gap=Math.max(report.gap,physics.rayDistance({...feet,y:feet.y+1},{x:0,y:-1,z:0},3)-1);
     report.parity=Math.max(report.parity,Math.hypot(feet.x-predicted.x,feet.y-predicted.y,feet.z-predicted.z));
     if(d<.005&&a.grounded){arrived=Math.abs(feet.y-target.y)<.15;break;}
     stalled=Math.hypot(a.movement.x,a.movement.z)<.001?stalled+1:0;if(stalled>30)break;
    }
    if(!arrived){report.passed=false;report.failedTarget=target;break;}
   }
   report.end=feet;report.passed&&=report.gap<.45&&report.parity<.001;
  }
 }
}finally{prediction.dispose();physics.dispose();}
const failures=routes.filter(r=>!r.passed),report={scope:'Continuous bidirectional deck/ramp/roof-loot traversal, all ten authored roof access routes. Standing authoritative and predicted capsules; support gap<.45m, parity<.001m, arrival height error<.15m. Not human control or decorative rooftop collision acceptance.',passed:!failures.length,routes,failures};
await writeFile(process.argv[2]??'artifacts/br-pass-completion-oct09/roof-circulation-draft.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,routes:routes.length,failures}));if(!report.passed)process.exitCode=1;
