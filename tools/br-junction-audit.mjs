import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {BR_ROADS} from '../shared/dist/index.js';
import {BrPhysicsWorld} from '../server/src/modes/battle-royale/br-physics.ts';
import {BrPredictionPhysics} from '../client/src/modes/battle-royale/br-physics.ts';

const output=process.argv[2]??'artifacts/br-pass-completion-oct09/junction-draft.json';
const point=(r,t)=>({x:r.from.x+(r.to.x-r.from.x)*t,y:r.from.y+(r.to.y-r.from.y)*t,z:r.from.z+(r.to.z-r.from.z)*t});
const cross=(ax,az,bx,bz)=>ax*bz-az*bx;
const joins=[],separations=[],mismatches=[],routes=[];
for(let i=0;i<BR_ROADS.length;i++)for(let j=i+1;j<BR_ROADS.length;j++){
 const a=BR_ROADS[i],b=BR_ROADS[j],ax=a.to.x-a.from.x,az=a.to.z-a.from.z,bx=b.to.x-b.from.x,bz=b.to.z-b.from.z;
 const dx=b.from.x-a.from.x,dz=b.from.z-a.from.z,den=cross(ax,az,bx,bz),candidates=[];
 if(Math.abs(den)>.00001){
  const ta=cross(dx,dz,bx,bz)/den,tb=cross(dx,dz,ax,az)/den;
  if(ta>=-1e-7&&ta<=1+1e-7&&tb>=-1e-7&&tb<=1+1e-7)candidates.push([Math.max(0,Math.min(1,ta)),Math.max(0,Math.min(1,tb))]);
 }else if(Math.abs(cross(dx,dz,ax,az))<.001){
  for(const ta of [0,1]){const p=point(a,ta),tb=((p.x-b.from.x)*bx+(p.z-b.from.z)*bz)/(bx*bx+bz*bz);if(tb>=0&&tb<=1)candidates.push([ta,tb]);}
  for(const tb of [0,1]){const p=point(b,tb),ta=((p.x-a.from.x)*ax+(p.z-a.from.z)*az)/(ax*ax+az*az);if(ta>=0&&ta<=1)candidates.push([ta,tb]);}
 }
 const seen=new Set();for(const [ta,tb]of candidates){
  const pa=point(a,ta),pb=point(b,tb),key=`${pa.x.toFixed(4)}:${pa.z.toFixed(4)}`;if(seen.has(key))continue;seen.add(key);
  const join={a:a.id,b:b.id,ta,tb,position:pa,heightDifference:Math.abs(pa.y-pb.y)};
  if(join.heightDifference>.15){(join.heightDifference>=2.2?separations:mismatches).push(join);continue;}
  joins.push(join);
  for(const sa of [-1,1])for(const sb of [-1,1]){
   const startT=ta+sa*Math.min(6/Math.hypot(ax,az),sa<0?ta:1-ta),endT=tb+sb*Math.min(6/Math.hypot(bx,bz),sb<0?tb:1-tb);
   const start=point(a,startT),end=point(b,endT);
   if(Math.hypot(start.x-pa.x,start.z-pa.z)<.25||Math.hypot(end.x-pa.x,end.z-pa.z)<.25)continue;
   routes.push({a:a.id,b:b.id,waypoints:[start,pa,end]});
  }
 }
}
const physics=new BrPhysicsWorld(),prediction=new BrPredictionPhysics();
try{
 for(const route of routes){
  let feet={...route.waypoints[0],y:route.waypoints[0].y-.065},predicted={...feet};
  route.passed=true;route.maximumParityError=0;route.maximumSupportGap=0;
  for(const target of route.waypoints.slice(1)){
   let best=Infinity,stalled=0,arrived=false;
   for(let frame=0;frame<240;frame++){
    const dx=target.x-feet.x,dz=target.z-feet.z,d=Math.hypot(dx,dz),step=Math.min(.18,d);
    const desired={x:d>.001?dx/d*step:0,y:-.18,z:d>.001?dz/d*step:0};
    const a=physics.move('junction',feet,desired,false),b=prediction.move(predicted,desired,false);
    feet={x:feet.x+a.movement.x,y:feet.y+a.movement.y,z:feet.z+a.movement.z};predicted={x:predicted.x+b.movement.x,y:predicted.y+b.movement.y,z:predicted.z+b.movement.z};
    route.maximumParityError=Math.max(route.maximumParityError,Math.hypot(feet.x-predicted.x,feet.y-predicted.y,feet.z-predicted.z));
    route.maximumSupportGap=Math.max(route.maximumSupportGap,physics.rayDistance({...feet,y:feet.y+1},{x:0,y:-1,z:0},3)-1);
    if(d<best-.01){best=d;stalled=0;}else stalled++;
    if(d<.05&&a.grounded){arrived=Math.abs(feet.y-(target.y-.065))<.15;break;}
    if(stalled>30)break;
   }
   if(!arrived){route.passed=false;route.failure='blocked or mismatched landing';route.failedTarget=target;break;}
  }
  route.end=feet;route.passed&&=route.maximumParityError<.001&&route.maximumSupportGap<.45;
  if(!route.passed&&!route.failure)route.failure='support or parity';
 }
 for(const separation of separations){
  const a=BR_ROADS.find(r=>r.id===separation.a),b=BR_ROADS.find(r=>r.id===separation.b),pa=point(a,separation.ta),pb=point(b,separation.tb),lower=pa.y<pb.y?pa:pb;
  separation.clearance=physics.rayDistance({...lower,y:lower.y-.065+.1},{x:0,y:1,z:0},2.2);
  separation.passed=separation.clearance>=1.85;
 }
}finally{prediction.dispose();physics.dispose();}
const failures=routes.filter(r=>!r.passed),report={scope:'Every centerline intersection or collinear endpoint overlap. Continuous 6m approach/turn/departure where space allows; both road directions, authoritative/prediction parity <.001m, endpoint height <.15m and real-ray floor gap <.45m. Authored height mismatches .15–2.2m fail; >=2.2m crossings separately require standing headroom. Road shoulders and human acceptance remain separate.',passed:!failures.length&&!mismatches.length&&separations.every(s=>s.passed),joins,separations,mismatches,routes,failures};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,joins:joins.length,routes:routes.length,mismatches,failedSeparations:separations.filter(s=>!s.passed),failures:failures.map(r=>({a:r.a,b:r.b,failure:r.failure,end:r.end,failedTarget:r.failedTarget,gap:r.maximumSupportGap}))}));if(!report.passed)process.exitCode=1;
