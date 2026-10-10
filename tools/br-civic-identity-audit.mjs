import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
const output=process.argv[2]??'artifacts/br-civic-identity-oct09/assembly.json';
const origin=process.env.PLANETFALL_AUDIT_URL??'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__identity_audit__',r=>r.fulfill({contentType:'text/html',body:'<html></html>'}));
 await page.goto(new URL('/__identity_audit__',origin).href);
 const result=await page.evaluate(async()=>{
  const source=await(await fetch('/src/modes/battle-royale/br-world.ts')).text();
  const threePath=source.match(/import \* as THREE from "([^"]+)"/)?.[1],sharedPath=source.match(/from "([^"]*shared[^"]*)"/)?.[1];
  if(!threePath||!sharedPath)throw Error('Renderer imports unresolved');
  const THREE=await import(threePath),{BR_STRUCTURES}=await import(sharedPath);
  const {BrWorldRenderer}=await import('/src/modes/battle-royale/br-world.ts');
  const {buildBrNorthCivicIdentity}=await import('/src/modes/battle-royale/br-north-civic-identity.ts');
  const {buildFunctionalInterior}=await import('/src/modes/battle-royale/br-functional-interiors.ts');
  const {buildRetailInterior}=await import('/src/modes/battle-royale/br-retail-interiors.ts');
  const world=new BrWorldRenderer('high'),issues=[],buildings=[];
  try{
   world.root.updateMatrixWorld(true);
   const group=world.root.getObjectByName('detail-void-mall'),boxes=[];
   const local=new THREE.Matrix4(),matrix=new THREE.Matrix4();
   group.traverse(mesh=>{
    if(!mesh.isInstancedMesh)return;
    mesh.geometry.computeBoundingBox();
    for(let i=0;i<mesh.count;i++){
     mesh.getMatrixAt(i,local);matrix.multiplyMatrices(mesh.matrixWorld,local);
     const bounds=mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
     boxes.push({bounds,material:mesh.material,geometry:mesh.geometry});
    }
   });
   const same=(a,b)=>['x','y','z'].every(axis=>Math.abs(a.min[axis]-b.min[axis])<.002&&Math.abs(a.max[axis]-b.max[axis])<.002);
   const boundsFor=(s,p)=>new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(p.position.x,p.position.y+s.position.y,p.position.z),new THREE.Vector3(p.scale.x,p.scale.y,p.scale.z));
   for(const id of ['north-civic-archive','north-civic-exchange']){
    const s=BR_STRUCTURES.find(s=>s.id===id),identity=buildBrNorthCivicIdentity(s);
    if(!identity.supported)issues.push(id+': supported replacement declined');
    let matched=0,removed=0;
    for(const p of identity.parts){
     const count=boxes.filter(b=>b.geometry===world.materials.unitBox&&b.material===world.materials.get(p.finish)&&same(b.bounds,boundsFor(s,p))).length;
     if(count!==1)issues.push(`${p.name}: expected one borrowed box with correct material/world transform, found ${count}`);else matched++;
    }
    const oldParts=id==='north-civic-archive'?buildFunctionalInterior(s):buildRetailInterior(s).parts;
    const finishes=id==='north-civic-archive'?{dark:'structuralDark',panel:'interiorWall',light:'windowLit'}:{frame:'structuralDark',panel:'interiorWall',glass:'windowDark',light:'windowLit'};
    for(const p of oldParts){
     const finish=finishes[p.finish];if(!finish)continue;
     if(boxes.some(b=>b.material===world.materials.get(finish)&&same(b.bounds,boundsFor(s,p))))issues.push(id+': old generic dressing remains at '+JSON.stringify(p.position));else removed++;
    }
    buildings.push({id,expected:identity.parts.length,matched,priorHelperPartsRemoved:removed,attachments:[...new Set(identity.parts.map(p=>p.attachment))]});
   }
   return{scope:'Actual production instance transforms, borrowed unit-box geometry/materials, exactly one instance per identity part; absence of previous functional/retail helper parts on these two buildings.',limitations:'Not every generic kit part, facade/prop-to-prop clearance, FPS, GPU memory, human art or gameplay acceptance. Focused support and traversal checks provide separate evidence.',buildings,issues,passed:issues.length===0};
  }finally{world.dispose();}
 });
 const report={...result,pageErrors:errors,passed:result.passed&&errors.length===0};await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
