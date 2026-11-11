import * as THREE from "three";
export type PgArtMaterial="ivory"|"frame"|"dark"|"glass"|"soil"|"leaf"|"cyan"|"amber"|"violet"|"paving";
export type PgArtPrimitive="box"|"cylinder"|"sphere"|"cone"|"torus"|"leafFan";
export type PgArtPlacement=readonly[number,number,number,number,number,number];
export interface PgArtContext {
 add(name:string,primitive:PgArtPrimitive,material:PgArtMaterial,placement:PgArtPlacement,rotation?:readonly[number,number,number],detail?:boolean,tint?:number):void;
}
/** Two whorls of folded lance-shaped leaves. Each blade is closed, so the
 * underside reads from street level with the same opaque one-sided material. */
function createLeafFan(){
 const positions:number[]=[];
 for(let i=0;i<13;i++){
  const inner=i>=8,angle=(inner?(i-8+.36)/5:i/8)*Math.PI*2;
  const direction=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
  const across=new THREE.Vector3(-direction.z,0,direction.x);
  const point=(r:number,y:number,w=0)=>direction.clone().multiplyScalar(r).addScaledVector(across,w).setY(y);
  const height=inner?.99:.40,reach=inner?.57:1;
  const base=point(.05,-.85),tip=point(reach,height),ridge=point(reach*.54,height*.68);
  const left=point(reach*.52,height*.20,.18),right=point(reach*.52,height*.20,-.18),under=point(reach*.52,height*.05);
  for(const [a,b,c] of [[base,left,ridge],[ridge,left,tip],[base,ridge,right],[ridge,tip,right],
    [base,under,left],[under,tip,left],[base,right,under],[under,right,tip]]){
   positions.push(...a.toArray(),...b.toArray(),...c.toArray());
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
 geometry.computeVertexNormals();return geometry;
}
/** Static authored instances share geometry/materials across all districts. */
export function createPgEnvironmentBuilder(materials:Record<PgArtMaterial,THREE.Material>){
 const root=new THREE.Group(),detail=new THREE.Group();root.name="nova-neighborhood-art";detail.name="neighborhood-secondary-detail";root.add(detail);
 const geometries:Record<PgArtPrimitive,THREE.BufferGeometry>={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,12),sphere:new THREE.SphereGeometry(1,10,7),cone:new THREE.ConeGeometry(1,1,10),torus:new THREE.TorusGeometry(1,.045,4,32),leafFan:createLeafFan()};
 const batches=new Map<string,{primitive:PgArtPrimitive;material:PgArtMaterial;detail:boolean;features:{name:string;placement:PgArtPlacement;rotation:readonly[number,number,number];tint:number}[]}>();
 const context:PgArtContext={add(name,primitive,material,placement,rotation=[0,0,0],secondary=false,tint=0xffffff){
  if(!placement.every(Number.isFinite)||placement.slice(3).some(v=>v<=0)||!rotation.every(Number.isFinite))throw Error(`Invalid neighborhood art: ${name}`);
  const key=`${primitive}:${material}:${secondary}`;let batch=batches.get(key);if(!batch){batch={primitive,material,detail:secondary,features:[]};batches.set(key,batch);}batch.features.push({name,placement,rotation,tint});
 }};
 let built=false,disposed=false;
 return {root,context,finish(){
  if(built)return;
  built=true;
  const dummy=new THREE.Object3D(),color=new THREE.Color();
  for(const [key,b]of batches){
   const mesh=new THREE.InstancedMesh(geometries[b.primitive],materials[b.material],b.features.length);
   mesh.name=`neighborhood:${key}`;
   mesh.userData.features=b.features;
   mesh.receiveShadow=true;
   mesh.userData.cameraCollision=false;
   b.features.forEach((f,i)=>{
    dummy.position.set(f.placement[0],f.placement[1],f.placement[2]);
    dummy.scale.set(f.placement[3],f.placement[4],f.placement[5]);
    dummy.rotation.set(...f.rotation);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
    // setColorAt initializes the rest of the static attribute to white.
    // All-white batches keep the material-only shader path.
    if(f.tint!==0xffffff)mesh.setColorAt(i,color.setHex(f.tint));
   });
   mesh.computeBoundingSphere();
   (b.detail?detail:root).add(mesh);
  }
  batches.clear();
 },setQuality(q:"low"|"medium"|"high"){detail.visible=q!=="low";},dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});for(const g of Object.values(geometries))g.dispose();root.clear();batches.clear();}};
}
