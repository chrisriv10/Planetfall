import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as current from '../shared/dist/index.js';

const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
let source=execFileSync('git',['show','HEAD:shared/src/battle-royale/map.ts'],{encoding:'utf8'});
source=source.replace(/from (["'])(\.[^"']+\.js)\1/g,(_,quote,relative)=>`from ${quote}${pathToFileURL(resolve('shared/src/battle-royale',relative.replace(/\.js$/,'.ts'))).href}${quote}`);
const baselinePath=resolve(`.local-runtime/br-baseline-map-${head.slice(0,7)}-${Date.now()}.ts`);
await writeFile(baselinePath,source,{flag:'wx'});
const baseline=await import(pathToFileURL(baselinePath).href);
const removedStructures=[],structureChanges=[],roofAccessChanges=[],removedLoot=[],movedLoot=[];
for(const old of baseline.BR_STRUCTURES){
 const next=current.BR_STRUCTURES.find(s=>s.id===old.id);
 if(!next){removedStructures.push(old.id);continue;}
 for(const key of Object.keys(old))if(JSON.stringify(old[key])!==JSON.stringify(next[key])){
  (key==='roofAccessSide'?roofAccessChanges:structureChanges).push({id:old.id,key,before:old[key],after:next[key]});
 }
}
for(const old of baseline.BR_LOOT_SOCKETS){
 const next=current.BR_LOOT_SOCKETS.find(s=>s.id===old.id);
 if(!next)removedLoot.push(old.id);
 else if(JSON.stringify(old.position)!==JSON.stringify(next.position))movedLoot.push({id:old.id,before:old.position,after:next.position});
}
const unchanged=(path)=>execFileSync('git',['diff','HEAD','--',path],{encoding:'utf8'}).length===0;
const report={generatedAt:new Date().toISOString(),head,
 scope:'Read-only Git HEAD reconstruction in a separate ignored local module; existing checkout and index are never changed. Authored dependency files are current, so this is not a full historical-world reconstruction.',
 baseline:{structures:baseline.BR_STRUCTURES.length,loot:baseline.BR_LOOT_SOCKETS.length},current:{structures:current.BR_STRUCTURES.length,loot:current.BR_LOOT_SOCKETS.length},
 islandOutlinePreserved:JSON.stringify(baseline.BR_ISLAND_OUTLINE)===JSON.stringify(current.BR_ISLAND_OUTLINE),
 primaryPoisPreserved:JSON.stringify(baseline.BR_POIS)===JSON.stringify(current.BR_POIS),
 canonicalAstronautPreserved:unchanged('client/src/astronaut.ts'),
 removedStructures,structureChanges,roofAccessChanges,removedLoot,movedLoot,
 addedStructures:current.BR_STRUCTURES.filter(s=>!baseline.BR_STRUCTURES.some(b=>b.id===s.id)).map(s=>s.id)};
report.passed=report.islandOutlinePreserved&&report.primaryPoisPreserved&&report.canonicalAstronautPreserved&&removedStructures.length===0&&structureChanges.length===0&&removedLoot.length===0;
await writeFile(process.argv[2]??'artifacts/br-pass-completion-oct09/preservation-final.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
if(!report.passed)process.exitCode=1;
