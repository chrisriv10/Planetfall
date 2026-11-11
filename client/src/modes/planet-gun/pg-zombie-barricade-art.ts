import * as THREE from "three";
import {RoundedBoxGeometry} from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type {PgDynamicPanel,PgZombieBarricadeInstallation} from "@planetfall/shared";

const boardPaint=`
  vec2 p=barLocal.xy;
  float face=smoothstep(.43,.47,abs(barLocal.z));
  float sleeve=smoothstep(.36,.37,abs(p.x));
  float web=(1.-smoothstep(.32,.36,abs(p.x)))*(1.-smoothstep(.25,.31,abs(p.y)));
  vec3 steel=mix(vec3(.18,.25,.29),vec3(.079,.12,.14),web);
  steel=mix(steel,vec3(.31,.37,.38),sleeve*.85);
  float stud=1.-smoothstep(.045,.063,length(vec2((abs(p.x)-.422)*8.,abs(p.y)-.26)));
  float hatch=(1.-smoothstep(.16,.21,abs(fract(p.x*15.+p.y*.25)-.5)))*sleeve*step(.13,p.y);
  steel=mix(steel,vec3(.86,.44,.085),hatch);
  steel=mix(steel,vec3(.055,.078,.09),stud);
  // Two parallel seams and a centered wear band give the rail its rolled-steel profile.
  steel*=1.-.25*(1.-smoothstep(.014,.027,abs(abs(p.y)-.29)));
  float corrosion=(1.-barState.x)*smoothstep(.32,.73,fract(sin(dot(floor(p*vec2(200.,18.)),vec2(17.17,91.7)))*4837.27));
  steel=mix(steel,vec3(.24,.077,.035),corrosion*.78);
  float strip=step(abs(p.y+.11),.026)*step(abs(p.x),.27);
  float charged=step(p.x,.54*barState.x-.27);
  vec3 signal=mix(vec3(.98,.29,.06),vec3(.14,.89,.73),barState.x);
  diffuseColor.rgb=mix(vec3(.20,.26,.28),steel,face);
  diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.022,.05,.06),signal,charged),strip*face);
`;
const postPaint=`
  vec2 p=barLocal.xy;
  float face=smoothstep(.41,.47,abs(barLocal.z));
  float capBand=step(.37,abs(p.y));
  vec3 steel=mix(vec3(.066,.099,.12),vec3(.28,.34,.35),capBand);
  float rail=smoothstep(.29,.33,abs(p.x));
  steel=mix(steel,vec3(.32,.39,.42),rail*.85);
  float lamp=step(abs(p.x),.16)*(1.-smoothstep(.26,.34,abs(fract((p.y+.20)*6.)-.5)))*step(-.2,p.y)*step(p.y,.3);
  float live=step(p.y+.2,.5*barState.x);
  vec3 signal=mix(vec3(.92,.29,.06),vec3(.09,.87,.74),barState.x);
  steel=mix(steel,mix(vec3(.026,.056,.06),signal,live),lamp*face);
  float service=step(abs(p.y-.35),.024)*step(abs(p.x),.28);
  steel=mix(steel,mix(vec3(.32,.15,.035),vec3(1.,.67,.15),barState.y),service*face);
  diffuseColor.rgb=steel;
`;

// The beam, sleeve bolts, painted chevrons, and recessed indicators fit the
// same rounded unit billet. Nothing projects past its corresponding solid.
function createBatch(capacity:number,post:boolean){
 const geometry=new RoundedBoxGeometry(1,1,1,1,post?.055:.07);
 const state=new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1,capacity)*2),2);
 state.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute("integrityRepair",state);
 const material=new THREE.MeshStandardMaterial({roughness:.52,metalness:.57});
 material.onBeforeCompile=shader=>{
  shader.vertexShader="attribute vec2 integrityRepair;varying vec3 barLocal;varying vec2 barState;\n"+
   shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nbarLocal=position;barState=integrityRepair;");
  shader.fragmentShader="varying vec3 barLocal;varying vec2 barState;\n"+
   shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\n{\n"+(post?postPaint:boardPaint)+"\n}");
 };
 material.customProgramCacheKey=()=>post?"pg-entry-post":"pg-entry-board";
 const mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,capacity));
 mesh.name=post?"pg-entry-barricade-posts":"pg-entry-barricade-boards";
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;
 mesh.userData.panelIds=Array(capacity).fill("");mesh.userData.cameraCollision=false;
 return {mesh,state,geometry,material};
}
type Batch=ReturnType<typeof createBatch>;

export function createPgZombieBarricadeArt(definitions:readonly PgZombieBarricadeInstallation[]){
 const root=new THREE.Group();root.name="pg-zombie-barricades";root.visible=false;
 const sites=definitions.map(site=>({site,integrity:0}));
 const boards=createBatch(definitions.reduce((sum,site)=>sum+site.boards.length,0),false);
 const posts=createBatch(definitions.reduce((sum,site)=>sum+site.posts.length,0),true);
 root.add(boards.mesh,posts.mesh);
 const parts=new Map<string,{site:typeof sites[number];post:boolean;panel:PgDynamicPanel|null}>();
 for(const site of sites){
  for(const board of site.site.boards)parts.set(board.id,{site,post:false,panel:null});
  for(const post of site.site.posts)parts.set(post.id,{site,post:true,panel:null});
 }
 const pose=new THREE.Object3D(),previous=new THREE.Matrix4();let disposed=false;
 function place(batch:Batch,panel:PgDynamicPanel,yaw:number,integrity:number,repair:boolean){
  const i=batch.mesh.count++,half=panel.solid.half,alongZ=Math.abs(Math.sin(yaw))>.5;
  pose.position.copy(panel.solid.center);pose.rotation.y=yaw;
  pose.scale.set((alongZ?half.z:half.x)*2,half.y*2,(alongZ?half.x:half.z)*2);pose.updateMatrix();
  // Compare float32 transforms to the GPU-side storage, even for non-integral authored centers.
  for(let k=0;k<16;k++)pose.matrix.elements[k]=Math.fround(pose.matrix.elements[k]);
  batch.mesh.getMatrixAt(i,previous);
  if(!previous.equals(pose.matrix)){batch.mesh.setMatrixAt(i,pose.matrix);batch.mesh.instanceMatrix.needsUpdate=true;}
  integrity=Math.fround(integrity);
  if(batch.state.getX(i)!==integrity||batch.state.getY(i)!==+repair){
   batch.state.setXY(i,integrity,+repair);batch.state.needsUpdate=true;
  }
  batch.mesh.userData.panelIds[i]=panel.id;
 }
 return {root,ownsPanel:(id:string)=>parts.has(id),
  update(panels:readonly PgDynamicPanel[]|null,repairSiteId?:string|null){
   if(disposed)return;
   boards.mesh.count=0;posts.mesh.count=0;root.visible=false;
   if(!panels)return;
   for(const site of sites)site.integrity=0;
   for(const part of parts.values())part.panel=null;
   for(const panel of panels){
    const part=parts.get(panel.id);if(!part||!panel.active||panel.hp<=0)continue;
    part.panel=panel;
    if(!part.post)part.site.integrity+=THREE.MathUtils.clamp(panel.hp/Math.max(1,panel.maxHp),0,1);
   }
   for(const part of parts.values()){
    const panel=part.panel;if(!panel)continue;
    const site=part.site.site,repair=site.id===repairSiteId;
    const integrity=part.post?part.site.integrity/site.boards.length:THREE.MathUtils.clamp(panel.hp/Math.max(1,panel.maxHp),0,1);
    place(part.post?posts:boards,panel,site.yaw,integrity,repair);
   }
   root.visible=posts.mesh.count+boards.mesh.count>0;
  },
  dispose(){
   if(disposed)return;disposed=true;root.removeFromParent();root.clear();parts.clear();
   for(const batch of [boards,posts]){batch.mesh.dispose();batch.geometry.dispose();batch.material.dispose();}
  },
 };
}
