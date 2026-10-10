import {readFile,writeFile} from 'node:fs/promises';
import {BR_STRUCTURES,brAuthoredDeckHeight} from '../shared/dist/index.js';
import {BrPhysicsWorld} from '../server/src/modes/battle-royale/br-physics.ts';
const output='artifacts/br-pass-completion-oct09',physics=new BrPhysicsWorld();
try{
 const old=JSON.parse(await readFile('tools/br-pass-review-views.json','utf8'));
 const views=old.filter(v=>!v.id.includes('aerial')).map(v=>{
  const [x,,z]=v.position,top=100-physics.rayDistance({x,y:100,z},{x:0,y:-1,z:0},120);
  return {...v,id:`${v.id}-supported`,position:[x,top+2.7,z],focus:[v.focus[0],v.focus[1]+Math.max(0,brAuthoredDeckHeight({x:v.focus[0],z:v.focus[2]})),v.focus[2]],cameraSupportY:top};
 });
 views.push({id:'farms-west-grade',position:[250,5.4,330],focus:[205,7,330]});
 for(const id of ['crash-salvage','salvage-row-1','void-east','void-west','zero-control']){
  const s=BR_STRUCTURES.find(s=>s.id===id),ns=['north','south'].includes(s.entrance),sign=['north','east'].includes(s.entrance)?1:-1;
  views.push({id:`${id}-envelope`,position:[s.position.x+(ns?25:sign*35),s.position.y+s.size.y+22,s.position.z+(ns?sign*35:25)],focus:[s.position.x,s.position.y+s.size.y*.5,s.position.z],structureId:id});
 }
 await writeFile(`${output}/supported-views.json`,JSON.stringify(views,null,2)+'\n');
}finally{physics.dispose();}
