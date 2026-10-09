import {chromium} from "@playwright/test";
import {mkdir,writeFile} from "node:fs/promises";
import {dirname} from "node:path";

// Requires the local Vite development server. A blank page imports the actual
// renderer; no gameplay session, server state or source is modified.
const origin=process.env.PLANETFALL_AUDIT_URL??"http://127.0.0.1:5173";
const output=process.argv[2]??"artifacts/br-landmark-audit/report.json";
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/__landmark_audit__",route=>route.fulfill({contentType:"text/html",body:"<html><body></body></html>"}));
  await page.goto(new URL("/__landmark_audit__",origin).href);
  const report=await page.evaluate(async()=>{
    const source=await(await fetch("/src/modes/battle-royale/br-world.ts")).text();
    const threePath=source.match(/import \* as THREE from "([^"]+)"/)?.[1];
    const sharedPath=source.match(/from "([^"]*shared[^"]*)"/)?.[1];
    if(!threePath||!sharedPath)throw new Error("Vite renderer imports could not be resolved");
    const THREE=await import(threePath),{BR_POIS,BR_STRUCTURES}=await import(sharedPath);
    const {BrWorldRenderer}=await import("/src/modes/battle-royale/br-world.ts");
    const world=new BrWorldRenderer("high");
    try{
      const landmarks=BR_POIS.map(p=>({poi:p,group:world.root.children.find(g=>g.position.x===p.position.x&&Math.abs(g.position.y-p.position.y-.45)<.001&&g.position.z===p.position.z&&g.userData.cameraCollision===false)}));
      if(landmarks.some(l=>!l.group))throw new Error("Expected landmark assembly is missing");
      const targets=BR_STRUCTURES.map(s=>({s,box:new THREE.Box3(
        new THREE.Vector3(s.position.x-s.size.x/2+.4,s.position.y+.4,s.position.z-s.size.z/2+.4),
        new THREE.Vector3(s.position.x+s.size.x/2-.4,s.position.y+s.size.y-.3,s.position.z+s.size.z/2-.4))}));
      const camera=new THREE.PerspectiveCamera();camera.position.set(0,60,-90);
      const triangle=new THREE.Triangle(),bounds=new THREE.Box3(),local=new THREE.Matrix4(),matrix=new THREE.Matrix4();
      const hits=new Map(),poses=[];let meshes=0,triangleChecks=0,broadPhaseCandidates=0;
      for(let pose=0;pose<=24;pose++){
        const time=pose*3750;poses.push(time);world.update(camera,time);world.root.updateMatrixWorld(true);
        for(const {poi,group} of landmarks){let meshIndex=0;
          group.traverse(mesh=>{
            if(!mesh.isMesh)return;const n=meshIndex++;if(pose===0)meshes++;
            const geometry=mesh.geometry,attr=geometry.attributes.position,index=geometry.index;geometry.computeBoundingBox();
            for(let instance=0;instance<(mesh.isInstancedMesh?mesh.count:1);instance++){
              if(mesh.isInstancedMesh){mesh.getMatrixAt(instance,local);matrix.multiplyMatrices(mesh.matrixWorld,local);}else matrix.copy(mesh.matrixWorld);
              bounds.copy(geometry.boundingBox).applyMatrix4(matrix);
              for(const {s,box} of targets){
                if(!bounds.intersectsBox(box))continue;broadPhaseCandidates++;
                let cut=0;
                for(let i=0;i<(index?index.count:attr.count);i+=3){
                  triangle.a.fromBufferAttribute(attr,index?index.getX(i):i).applyMatrix4(matrix);
                  triangle.b.fromBufferAttribute(attr,index?index.getX(i+1):i+1).applyMatrix4(matrix);
                  triangle.c.fromBufferAttribute(attr,index?index.getX(i+2):i+2).applyMatrix4(matrix);
                  triangleChecks++;if(box.intersectsTriangle(triangle))cut++;
                }
                if(cut){
                  const key=`${poi.id}/${n}/${instance}/${s.id}`;
                  const hit=hits.get(key)??{poi:poi.id,mesh:n,instance,name:mesh.name,type:geometry.type,structure:s.id,poses:[],maxCutTriangles:0};
                  hit.poses.push(time);hit.maxCutTriangles=Math.max(hit.maxCutTriangles,cut);hits.set(key,hit);
                }
              }
            }
          });
        }
      }
      return {scope:"Production landmark triangle surfaces against every authored building envelope; 0.4m wall/floor and 0.3m roof-contact margins.",
        limits:"Sampled 90s timeline, not a continuous animation or enclosed-volume proof. Does not cover players, prop groups, landmark-to-landmark contacts or every map mesh.",
        checked:{landmarks:landmarks.length,meshObjects:meshes,structures:targets.length,enterableStructures:targets.filter(t=>t.s.enterable).length,poses,broadPhaseCandidates,triangleChecks},hits:[...hits.values()]};
    }finally{world.dispose();}
  });
  const result={generatedAt:new Date().toISOString(),...report,errors,passed:report.hits.length===0&&errors.length===0};
  await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify({checked:result.checked,hits:result.hits.length,errors,passed:result.passed,output}));
  if(!result.passed)process.exitCode=1;
}finally{await browser.close();}
