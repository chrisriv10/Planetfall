import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {BR_STRUCTURES,BR_MAP_BLOCKS,stepBrMovement} from '../shared/dist/index.js';
import {BrPhysicsWorld} from '../server/src/modes/battle-royale/br-physics.ts';

// Reconstruct only the previous single controller query in a separate local
// module. Never alter the working tree or replace its authoritative geometry.
const copy=resolve(`.local-runtime/br-physics-single-query-review-${Date.now()}.ts`);
let source=await readFile('server/src/modes/battle-royale/br-physics.ts','utf8');
source=source.replace(/    const steps=brInteriorStairSubsteps[\s\S]*?    const sector=this\.sector\(feet\);/, '    const sector=this.sector(feet);');
await writeFile(copy,source,{flag:'wx'});
const PriorPhysics=(await import(pathToFileURL(copy).href)).BrPhysicsWorld;
const s=BR_STRUCTURES.find(s=>s.id==='north-civic-archive');
const ramp=BR_MAP_BLOCKS.find(b=>b.id===`${s.id}-stairs-1`),run=ramp.size.z*Math.cos(ramp.rotation.x),reports=[];
for(const [name,Physics] of [['priorSingleQuery',PriorPhysics],['currentRefinedQueries',BrPhysicsWorld]]){
 const physics=new Physics(),samples=[];
 try{
  let state={position:{x:ramp.position.x,y:s.position.y+s.size.y/s.floors+.21,z:s.position.z-s.size.z/2+1},
   velocity:{x:0,y:0,z:0},yaw:Math.PI,grounded:true,crouched:false,deployment:'grounded',downed:false,
   lastJumpSignal:false,lastCrouchSignal:false,slideEndsAt:0,traversalCooldownUntil:0};
  const target=ramp.position.z+run/2+.35;
  for(let frame=0;frame<300;frame++){
   state=stepBrMovement(state,{moveX:0,moveY:Math.sign(target-state.position.z)*Math.min(1,Math.abs(target-state.position.z)/.4),yaw:Math.PI,jump:false,sprint:false,crouch:false},.1,10000+frame*100,(p,d,o)=>physics.move('stair-proof',p,d,o.jumping,o.crouched));
   const gap=physics.rayDistance({...state.position,y:state.position.y+1},{x:0,y:-1,z:0},3)-1;
   samples.push({frame,position:state.position,grounded:state.grounded,gap});
   if(Math.abs(target-state.position.z)<.05&&state.grounded)break;
  }
  reports.push({name,maximumGap:Math.max(...samples.map(s=>s.gap)),unsupportedFrames:samples.filter(s=>!s.grounded).length,arrived:Math.abs(target-state.position.z)<.05&&state.grounded,samples});
 }finally{physics.dispose();}
}
await writeFile(process.argv[2]??'artifacts/br-pass-completion-oct09/stair-query-regression-proof.json',JSON.stringify({scope:'Same current geometry and original movement intent; isolates prior single versus current refined controller queries without modifying source.',reports},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(reports.map(({samples,...r})=>r)));
if(!reports[1].arrived||reports[1].maximumGap>=.18||reports[0].unsupportedFrames===0)process.exitCode=1;
