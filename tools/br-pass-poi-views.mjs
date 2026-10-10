import {mkdir,writeFile} from 'node:fs/promises';
import {BR_POIS,BR_SECONDARY_LOCATIONS,BR_STRUCTURES} from '../shared/dist/index.js';
import {BrPhysicsWorld} from '../server/src/modes/battle-royale/br-physics.ts';
const output=process.argv[2]??'artifacts/br-pass-completion-oct09';
await mkdir(output,{recursive:true});
const physics=new BrPhysicsWorld();
function view(d,s){
 const ns=s.entrance==='north'||s.entrance==='south',sign=s.entrance==='north'||s.entrance==='east'?1:-1;
 const axis=ns?'z':'x',edge={...s.position};edge[axis]+=sign*s.size[axis]/2;
 const target={...edge,y:s.position.y+2};let chosen;
 for(const distance of [16,12,9,6,4,2,1.2]){
  const p={...edge};p[axis]+=sign*distance;
  const floor=s.position.y+24-physics.rayDistance({...p,y:s.position.y+24},{x:0,y:-1,z:0},40);
  if(floor>s.position.y+.55||floor<s.position.y-.55)continue;
  p.y=floor+2.7;
  const dx=target.x-p.x,dy=target.y-p.y,dz=target.z-p.z,length=Math.hypot(dx,dy,dz);
  if(physics.rayDistance(p,{x:dx/length,y:dy/length,z:dz/length},length)<length-.4)continue;
  chosen=p;break;
 }
 if(!chosen)throw new Error(`No unobstructed entrance review camera for ${s.id}`);
 return {id:d.id,position:[chosen.x,chosen.y,chosen.z],focus:[s.position.x,s.position.y+Math.min(5,s.size.y*.4),s.position.z],structureId:s.id};
}
for(const [name,districts] of [['primary',BR_POIS],['secondary',BR_SECONDARY_LOCATIONS]]){
 const cameras=districts.map(d=>view(d,BR_STRUCTURES.find(s=>s.districtId===d.id&&s.enterable)??BR_STRUCTURES.find(s=>s.districtId===d.id)));
 await writeFile(`${output}/${name}-views.json`,JSON.stringify(cameras,null,2)+'\n');
}
const representatives=new Map();for(const s of BR_STRUCTURES.filter(s=>s.enterable))if(!representatives.has(s.archetype))representatives.set(s.archetype,s);
const interiors=[...representatives.values()].map(s=>{
 const ns=s.entrance==='north'||s.entrance==='south',sign=s.entrance==='north'||s.entrance==='east'?1:-1,axis=ns?'z':'x';
 const p={...s.position,y:s.position.y+2.2};p[axis]+=sign*(s.size[axis]/2-2);
 return {id:`interior-${s.archetype}`,position:[p.x,p.y,p.z],focus:[s.position.x,s.position.y+2.3,s.position.z],structureId:s.id};
});
await writeFile(`${output}/interior-views.json`,JSON.stringify(interiors,null,2)+'\n');
await writeFile(`${output}/entrance-views.json`,JSON.stringify(BR_STRUCTURES.filter(s=>s.enterable).map(s=>view({id:s.id},s)),null,2)+'\n');
await writeFile(`${output}/primary-aerial-views.json`,JSON.stringify(BR_POIS.map(d=>({id:`${d.id}-aerial`,position:[d.position.x+105,d.position.y+100,d.position.z-110],focus:[d.position.x,d.position.y+4,d.position.z]})),null,2)+'\n');
physics.dispose();
console.log(JSON.stringify({primary:BR_POIS.length,secondary:BR_SECONDARY_LOCATIONS.length,interiors:interiors.length}));
