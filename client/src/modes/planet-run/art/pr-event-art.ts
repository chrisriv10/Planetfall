import * as THREE from "three";
import type {Vec3} from "@planetfall/shared";
import type {PrArtQuality} from "./pr-art-shared";

export type PrEventKind="qualify"|"boost"|"eliminate"|"land";
const CAPACITY=96;
const DURATION:Record<PrEventKind,number>={qualify:620,boost:320,eliminate:540,land:260};
const COUNTS:Record<PrEventKind,number>={qualify:24,boost:12,eliminate:16,land:8};

/** One scene-wide pool; events contain no player, gameplay, or cosmetic state. */
export function createPrEventArt(){
 const root=new THREE.Group();root.name="planet-run-event-art";
 const geometry=new THREE.OctahedronGeometry(1,0);
 const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7,depthWrite:false,toneMapped:false});
 const sparks=new THREE.InstancedMesh(geometry,material,CAPACITY);sparks.name="planet-run-shared-event-pool";sparks.frustumCulled=false;sparks.userData.cameraCollision=false;sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(sparks);
 const starts=new Float64Array(CAPACITY).fill(-Infinity),durations=new Float32Array(CAPACITY);
 const origins=new Float32Array(CAPACITY*3),velocities=new Float32Array(CAPACITY*3),sizes=new Float32Array(CAPACITY*3),gravity=new Float32Array(CAPACITY),rotation=new Float32Array(CAPACITY);
 const dummy=new THREE.Object3D(),tint=new THREE.Color();let cursor=0,limit=CAPACITY,disposed=false,lastMs=-Infinity;
 dummy.scale.setScalar(0);dummy.updateMatrix();
 for(let i=0;i<CAPACITY;i++){sparks.setMatrixAt(i,dummy.matrix);sparks.setColorAt(i,tint);}
 function emit(kind:PrEventKind,position:Vec3,color:string|number,elapsedMs:number):void {
  if(disposed||!Number.isFinite(elapsedMs)||!Number.isFinite(position.x)||!Number.isFinite(position.y)||!Number.isFinite(position.z))return;
  // Every burst is deterministic and bounded. Local forward is course -Z;
  // integration may rotate the scene root if a different presentation axis is needed.
  const count=Math.max(3,Math.round(COUNTS[kind]*limit/CAPACITY));tint.set(color);
  for(let i=0;i<count;i++){
   const slot=cursor++%limit,k=slot*3,a=i*Math.PI*2/count,spread=.75+((i*7)%11)/22,s=Math.sin(a),c=Math.cos(a);
   starts[slot]=elapsedMs;durations[slot]=DURATION[kind];rotation[slot]=a;
   origins[k]=position.x;origins[k+1]=position.y;origins[k+2]=position.z;
   if(kind==="qualify"){
    origins[k]+=s*.45;origins[k+1]+=.8+(i%3)*.35;origins[k+2]+=c*.45;
    velocities[k]=s*2.3*spread;velocities[k+1]=2.4+(i%4)*.45;velocities[k+2]=c*2.3*spread;gravity[slot]=6;
    sizes[k]=.055;sizes[k+1]=.16;sizes[k+2]=.035;
   }else if(kind==="boost"){
    origins[k]+=s*.3;origins[k+1]+=.35+(i%3)*.12;
    velocities[k]=s*.65;velocities[k+1]=.25;velocities[k+2]=3.8+spread;gravity[slot]=0;
    sizes[k]=.035;sizes[k+1]=.035;sizes[k+2]=.3;
   }else if(kind==="eliminate"){
    origins[k]+=s*.5;origins[k+1]+=.7+(i%4)*.28;origins[k+2]+=c*.5;
    velocities[k]=s*.65;velocities[k+1]=1.2;velocities[k+2]=c*.65;gravity[slot]=2;
    sizes[k]=.045;sizes[k+1]=.24;sizes[k+2]=.045;
   }else{
    origins[k]+=.35*s;origins[k+1]+=.05;origins[k+2]+=.35*c;
    velocities[k]=s*1.6;velocities[k+1]=.35;velocities[k+2]=c*1.6;gravity[slot]=2;
    sizes[k]=.12;sizes[k+1]=.035;sizes[k+2]=.12;
   }
   sparks.setColorAt(slot,tint);
  }
  if(sparks.instanceColor)sparks.instanceColor.needsUpdate=true;
 }
 function update(elapsedMs:number):void {
  if(disposed||!Number.isFinite(elapsedMs))return;
  if(elapsedMs<lastMs)starts.fill(-Infinity);lastMs=elapsedMs;
  for(let i=0;i<limit;i++){
   const age=elapsedMs-starts[i],life=age/durations[i],k=i*3;
   if(age<0||age>=durations[i]||!Number.isFinite(life)){dummy.scale.setScalar(0);dummy.position.set(0,0,0);}
   else{
    const t=age*.001,fade=(1-life)*(1-life),bloom=Math.min(1,.45+life*8);
    dummy.position.set(origins[k]+velocities[k]*t,origins[k+1]+velocities[k+1]*t-gravity[i]*t*t*.5,origins[k+2]+velocities[k+2]*t);
    dummy.scale.set(sizes[k]*fade*bloom,sizes[k+1]*fade*bloom,sizes[k+2]*fade*bloom);
   }
   dummy.rotation.set(0,rotation[i],rotation[i]*.3);dummy.updateMatrix();sparks.setMatrixAt(i,dummy.matrix);
  }
  sparks.instanceMatrix.needsUpdate=true;
 }
 return {root,emit,update,
  setQuality(q:PrArtQuality){if(disposed)return;limit=q==="low"?24:q==="medium"?60:CAPACITY;sparks.count=limit;for(let i=limit;i<CAPACITY;i++)starts[i]=-Infinity;},
  dispose(){if(disposed)return;disposed=true;sparks.dispose();geometry.dispose();material.dispose();root.clear();root.removeFromParent();},
 };
}
