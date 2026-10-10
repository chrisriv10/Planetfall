import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {BR_ROADS,BR_STRUCTURES,BR_MAP_BLOCKS} from '../shared/dist/index.js';
import {BrPhysicsWorld} from '../server/src/modes/battle-royale/br-physics.ts';
import {BrPredictionPhysics} from '../client/src/modes/battle-royale/br-physics.ts';

const output=process.argv[2]??'artifacts/br-pass-completion-oct09/circulation-before.json';
const authority=new BrPhysicsWorld(),prediction=new BrPredictionPhysics(),routes=[];
const paths=BR_ROADS.map(r=>({id:r.id,kind:'road',from:r.from,to:r.to}));
for(const s of BR_STRUCTURES.filter(s=>s.enterable)){
 const ns=s.entrance==='north'||s.entrance==='south',sign=s.entrance==='north'||s.entrance==='east'?1:-1;
 const axis=ns?'z':'x',edge=s.position[axis]+sign*s.size[axis]/2;
 const from={...s.position},to={...s.position};from[axis]=edge+sign*1.2;to[axis]=edge-sign*2;
 const floor=BR_MAP_BLOCKS.find(b=>b.id===`${s.id}-floor`);to.y=floor.position.y+floor.size.y/2+.1;from.y=s.position.y+.1;
 paths.push({id:s.id,kind:'entrance',from,to});
}
try{
 for(const path of paths)for(const reverse of [false,true]){
  const from=reverse?path.to:path.from,target=reverse?path.from:path.to;
  let feet={...from,y:from.y-.065},predicted={...feet},minimum=Infinity,stalled=0;
  const route={id:path.id,kind:path.kind,reverse,from,target,passed:false,samples:0,airborne:0,maximumParityError:0,maximumSupportGap:0};routes.push(route);
  for(let frame=0;frame<Math.ceil(Math.hypot(target.x-from.x,target.z-from.z)/.18)+160;frame++){
   const dx=target.x-feet.x,dz=target.z-feet.z,d=Math.hypot(dx,dz),step=Math.min(.18,d);
   const desired={x:d>.001?dx/d*step:0,y:-.18,z:d>.001?dz/d*step:0};
   const a=authority.move(path.id,feet,desired,false),p=prediction.move(predicted,desired,false);
   feet={x:feet.x+a.movement.x,y:feet.y+a.movement.y,z:feet.z+a.movement.z};
   predicted={x:predicted.x+p.movement.x,y:predicted.y+p.movement.y,z:predicted.z+p.movement.z};
   route.samples++;route.maximumParityError=Math.max(route.maximumParityError,Math.hypot(feet.x-predicted.x,feet.y-predicted.y,feet.z-predicted.z));
   if(!a.grounded)route.airborne++;
   const support=authority.rayDistance({...feet,y:feet.y+1},{x:0,y:-1,z:0},3)-1;
   if(support>route.maximumSupportGap){route.maximumSupportGap=support;route.maximumSupportGapAt={...feet};}
   if(d<minimum-.01){minimum=d;stalled=0;}else stalled++;
   if(stalled>30){route.failure='blocked';break;}
   if(d<.05&&a.grounded){route.passed=route.maximumParityError<.001&&Math.abs(feet.y-(target.y-.065))<.15; if(!route.passed)route.failure='height/parity';break;}
  }
  route.passed&&=route.maximumSupportGap<.45;
  route.end=feet;if(!route.passed&&!route.failure)route.failure=route.maximumSupportGap>=.45?'unsupported movement':'arrival';
 }
}finally{prediction.dispose();authority.dispose();}
const failures=routes.filter(r=>!r.passed),report={scope:'Bidirectional standing-capsule centerline movement for every authored road segment and 1.2m external/2m internal approach for every enterable doorway. Arrival within .05m, parity within .001m, final authored-height deviation below .15m and independent Rapier downward-ray floor gap below .45m (includes real .36m thresholds). Real authority/prediction worlds; not network/input or human acceptance. Road shoulders/interior circulation are separate scopes. Initial diagnostic used .02m arrivals and 2m external points; those points can enter adjacent walls in narrow legal alleys.',passed:!failures.length,roads:BR_ROADS.length,entrances:BR_STRUCTURES.filter(s=>s.enterable).length,routes,failures};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,routes:routes.length,failures:failures.map(r=>({id:r.id,reverse:r.reverse,reason:r.failure,end:r.end,target:r.target}))}));if(failures.length)process.exitCode=1;
