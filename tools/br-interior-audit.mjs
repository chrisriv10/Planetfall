import{mkdir,writeFile}from'node:fs/promises';
import{dirname}from'node:path';
import{BR_STRUCTURES,BR_MAP_BLOCKS,BR_LOOT_SOCKETS,brBlockTopSurfaceAt,BR_BALANCE}from'../shared/dist/index.js';
import{BrPhysicsWorld}from'../server/src/modes/battle-royale/br-physics.ts';
import{BrPredictionPhysics}from'../client/src/modes/battle-royale/br-physics.ts';
const output=process.argv[2]??'artifacts/br-pass-completion-oct09/interior-draft.json',physics=new BrPhysicsWorld(),prediction=new BrPredictionPhysics(),reports=[];
const spacing=.5;
try{
 for(const s of BR_STRUCTURES.filter(s=>s.enterable&&(!process.env.INTERIOR_ONLY||process.env.INTERIOR_ONLY.split(',').includes(s.id)))){
  const floors=BR_MAP_BLOCKS.filter(b=>b.id.startsWith(`${s.id}-`)&&b.kind==='platform'&&!b.id.endsWith('-roof'));
  const columns=new Map(),nodes=[],edges=new Map();
  const nx=Math.floor((s.size.x-1.2)/spacing),nz=Math.floor((s.size.z-1.2)/spacing),x0=s.position.x-nx*spacing/2,z0=s.position.z-nz*spacing/2;
  for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
   const x=x0+ix*spacing,z=z0+iz*spacing,heights=[...new Set(floors.map(b=>brBlockTopSurfaceAt(b,{x,z})).filter(y=>y!==null))];
   for(const y of heights){
    const feet={x,y:y+.035,z};let clear=true;
    for(let angle=0;angle<1;angle++){
     // Begin above the highest neighboring part of a walkable incline. A ray
     // at ankle height on its uphill edge starts inside the floor itself.
     const r=0,a=angle*Math.PI/4,p={x:x+Math.cos(a)*r,y:feet.y+.35,z:z+Math.sin(a)*r};
     if(physics.rayDistance(p,{x:0,y:1,z:0},BR_BALANCE.playerHeight-.35)<BR_BALANCE.playerHeight-.35-.01){clear=false;break;}
    }
    if(!clear)continue;
    if(Math.abs(physics.rayDistance({...feet,y:feet.y+.2},{x:0,y:-1,z:0},.5)-.235)>.04)continue;
    const node={id:nodes.length,ix,iz,...feet};nodes.push(node);const key=`${ix}:${iz}`;if(!columns.has(key))columns.set(key,[]);columns.get(key).push(node);
   }
  }
  const ns=s.entrance==='north'||s.entrance==='south',sign=s.entrance==='north'||s.entrance==='east'?1:-1,axis=ns?'z':'x';
  const entry={...s.position,y:s.position.y+.395};entry[axis]+=sign*(s.size[axis]/2-2);
  const closest=p=>nodes.filter(n=>Math.abs(n.y-p.y)<.06).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  const stairLinks=new Map();
  const portal=p=>{
   const node={...p,id:nodes.length,ix:Math.round((p.x-x0)/spacing),iz:Math.round((p.z-z0)/spacing)};
   nodes.push(node);const key=`${node.ix}:${node.iz}`;if(!columns.has(key))columns.set(key,[]);columns.get(key).push(node);return node;
  };
  for(let level=1;level<s.floors;level++){
   const ramp=BR_MAP_BLOCKS.find(b=>b.id===`${s.id}-stairs-${level}`),run=ramp.size.z*Math.cos(ramp.rotation.x),low=s.position.y+(level-1)*s.size.y/s.floors;
   const bottom=portal({x:ramp.position.x,y:low+(level===1?.395:.21),z:ramp.position.z+run/2+.35});
   const top=portal({x:ramp.position.x,y:low+s.size.y/s.floors+.21,z:ramp.position.z-run/2-.35});
   if(bottom&&top){stairLinks.set(bottom.id,[top]);stairLinks.set(top.id,[bottom]);}
  }
  const source=closest(entry),sockets=BR_LOOT_SOCKETS.filter(l=>l.structureId===s.id&&l.kind!=='roof'),report={id:s.id,archetype:s.archetype,nodes:nodes.length,routes:[]};reports.push(report);
  const traverse=(from,to,predictionFrom=from)=>{
   let feet={x:from.x,y:from.y,z:from.z},predicted={...predictionFrom},gap=0,parity=0,stalled=0;
   // A steep climb projects the requested horizontal step onto its plane.
   // Allow that measured progress; the independent stall guard still rejects
   // blocked edges. A flat-ground speed estimate cut off valid tall stairs.
   for(let frame=0;frame<Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.03)+120;frame++){
    const dx=to.x-feet.x,dz=to.z-feet.z,d=Math.hypot(dx,dz),step=Math.min(.18,d),desired={x:d>.001?dx/d*step:0,y:-.12,z:d>.001?dz/d*step:0};
    const a=physics.move('interior',feet,desired,false),b=prediction.move(predicted,desired,false);
    stalled=Math.hypot(a.movement.x,a.movement.z)<.001?stalled+1:0;
    feet={x:feet.x+a.movement.x,y:feet.y+a.movement.y,z:feet.z+a.movement.z};predicted={x:predicted.x+b.movement.x,y:predicted.y+b.movement.y,z:predicted.z+b.movement.z};
    gap=Math.max(gap,physics.rayDistance({...feet,y:feet.y+1},{x:0,y:-1,z:0},3)-1);parity=Math.max(parity,Math.hypot(feet.x-predicted.x,feet.y-predicted.y,feet.z-predicted.z));
    if(d<.005&&a.grounded)return{passed:Math.abs(feet.y-to.y)<.15&&gap<.45&&parity<.001,gap,parity,end:feet,predicted};
    if(stalled>20)break;
   }
   return{passed:false,gap,parity,end:feet,predicted};
  };
  for(const socket of sockets){
   // Use the production 3D pickup contract, with a small arrival margin.
   // Requiring the nearest cell alone incorrectly rejects items beside stairs.
   const distance=n=>Math.hypot(n.x-socket.position.x,n.y-socket.position.y,n.z-socket.position.z);
   const targets=new Set(nodes.filter(n=>distance(n)<BR_BALANCE.pickupRange-.1).map(n=>n.id));
   const route={socketId:socket.id,passed:false,waypoints:[]};report.routes.push(route);
   if(!source||!targets.size){route.failure='no standing pickup approach';continue;}
   const queue=[source],parents=new Map([[source.id,null]]),costs=new Map([[source.id,0]]);
   let target;const closed=new Set();
   while(queue.length){
    queue.sort((a,b)=>(costs.get(a.id)+Math.max(0,distance(a)-BR_BALANCE.pickupRange+.1))-(costs.get(b.id)+Math.max(0,distance(b)-BR_BALANCE.pickupRange+.1)));
    const current=queue.shift();if(closed.has(current.id))continue;closed.add(current.id);
    if(targets.has(current.id)){target=current;break;}
    const neighbors=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].flatMap(([dx,dz])=>columns.get(`${current.ix+dx}:${current.iz+dz}`)??[]).filter(n=>n.id!==current.id&&Math.abs(current.y-n.y)<=.65);
    neighbors.push(...stairLinks.get(current.id)??[]);
    for(const neighbor of neighbors){
     if(closed.has(neighbor.id))continue;
     const cost=costs.get(current.id)+Math.hypot(current.x-neighbor.x,current.z-neighbor.z,current.y-neighbor.y);
     if(cost>=(costs.get(neighbor.id)??Infinity))continue;
     const key=`${current.id}:${neighbor.id}`,back=`${neighbor.id}:${current.id}`;
     if(!edges.has(key))edges.set(key,traverse(current,neighbor));if(!edges.get(key).passed)continue;
     if(!edges.has(back))edges.set(back,traverse(neighbor,current));if(!edges.get(back).passed)continue;
     costs.set(neighbor.id,cost);parents.set(neighbor.id,current.id);queue.push(neighbor);
    }
   }
   if(!target){route.failure='no collision-backed standing route';route.search={visited:closed.size,portals:[...stairLinks.keys()].map(id=>({point:nodes[id],reachable:closed.has(id),flight:edges.get(`${id}:${stairLinks.get(id)[0].id}`)}))};continue;}
   let id=target.id;while(id!==null){const n=nodes[id];route.waypoints.unshift({x:n.x,y:n.y,z:n.z});id=parents.get(id);}
   route.traversals=[];
   for(const reverse of [false,true]){
    const path=reverse?[...route.waypoints].reverse():route.waypoints;
    let feet={...path[0]},predicted={...feet},passed=true,gap=0,parity=0;
    for(const point of path.slice(1)){
     const result=traverse(feet,point,predicted);gap=Math.max(gap,result.gap);parity=Math.max(parity,result.parity);
     if(!result.passed){passed=false;break;}feet=result.end;predicted=result.predicted;
    }
    route.traversals.push({reverse,passed,gap,parity,end:feet});
   }
   route.passed=route.traversals.every(t=>t.passed);if(!route.passed)route.failure='continuous route failed';
   route.distance=costs.get(target.id);route.pickupApproachDistance=distance(target);
  }
 }
}finally{prediction.dispose();physics.dispose();}
const failures=reports.flatMap(s=>s.routes.filter(r=>!r.passed).map(r=>({structure:s.id,...r}))),report={scope:'Every selected enterable structure and every ground/upper loot socket. 0.5m candidate grid with center headroom/support rays, real standing capsule authority/prediction movement on each edge, then continuous traversal of the complete route in both directions. Pickup uses production 2.7m 3D range with 0.1m arrival margin; parity<.001m, floor gap<.45m. This is a reachable route search, not human control acceptance or decorative mesh collision proof. Roof routes are separately validated.',passed:!failures.length,structures:reports,routes:reports.reduce((n,s)=>n+s.routes.length,0),failures};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,structures:reports.length,routes:report.routes,failures}));if(!report.passed)process.exitCode=1;
