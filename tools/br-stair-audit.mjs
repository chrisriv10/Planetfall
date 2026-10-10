import{writeFile}from'node:fs/promises';
import{BR_STRUCTURES,BR_MAP_BLOCKS}from'../shared/dist/index.js';
import{BrPhysicsWorld}from'../server/src/modes/battle-royale/br-physics.ts';
const physics=new BrPhysicsWorld(),routes=[];
try{
for(const s of BR_STRUCTURES.filter(s=>s.enterable&&s.floors>1))for(let floor=1;floor<s.floors;floor++)for(const reverse of [false,true]){
 const ramp=BR_MAP_BLOCKS.find(b=>b.id===`${s.id}-stairs-${floor}`),run=ramp.size.z*Math.cos(ramp.rotation.x),low=s.position.y+(floor-1)*s.size.y/s.floors;
 const from={x:ramp.position.x,y:reverse?low+s.size.y/s.floors+.21:low+(floor===1?.395:.21),z:ramp.position.z+(reverse?-1:1)*(run/2+.35)};
 const target={...from,y:reverse?low+(floor===1?.395:.21):low+s.size.y/s.floors+.21,z:ramp.position.z+(reverse?1:-1)*(run/2+.35)};
 let feet={...from};const route={id:s.id,floor,reverse,from,target,passed:false};routes.push(route);
 for(let frame=0;frame<1200;frame++){
  const dz=target.z-feet.z,d=Math.abs(dz),desired={x:0,y:-.1,z:Math.sign(dz)*Math.min(.12,d)},r=physics.move('stair',feet,desired,false);
  feet={x:feet.x+r.movement.x,y:feet.y+r.movement.y,z:feet.z+r.movement.z};
  if(d<.05&&r.grounded){route.passed=Math.abs(feet.y-target.y)<.15;break;}
 }
 route.end=feet;
}
}finally{physics.dispose();}
const failures=routes.filter(r=>!r.passed);await writeFile(process.argv[2]??'artifacts/br-pass-completion-oct09/stairs-draft.json',JSON.stringify({passed:!failures.length,routes,failures},null,2));console.log(JSON.stringify({passed:!failures.length,routes:routes.length,failures}));
