import * as THREE from "three";
import {PR_BALANCE,prTileState,type PrRoundDefinition} from "@planetfall/shared";
import type {PrArtQuality} from "./pr-art-shared";

const LAYERS=[0x83ece5,0x859fff,0xd595ed,0xff986b] as const;
const CHASSIS=[0x254858,0x303a63,0x4d365e,0x61334f] as const;
const SHARDS=72,LIFETIME=360;

/** One planar annulus, matching CylinderGeometry's pointy hex orientation. */
function perimeterGeometry(radius:number):THREE.BufferGeometry {
 const positions:number[]=[];
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3,b=(i+1)*Math.PI/3;
  const ax=Math.sin(a)*radius,az=Math.cos(a)*radius,bx=Math.sin(b)*radius,bz=Math.cos(b)*radius;
  positions.push(ax,0,az,bx*.91,0,bz*.91,bx,0,bz,ax,0,az,ax*.91,0,az*.91,bx*.91,0,bz*.91);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}

/** Six small paired circuit branches share one geometry and one tile instance. */
function circuitGeometry(radius:number):THREE.BufferGeometry {
 const positions:number[]=[];
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3,s=Math.sin(a),c=Math.cos(a);
  for(const [from,to,width]of [[.3,.64,.022],[.69,.76,.06]]){
   const x0=s*radius*from,z0=c*radius*from,x1=s*radius*to,z1=c*radius*to,dx=c*width,dz=-s*width;
   positions.push(x0-dx,0,z0-dz,x1+dx,0,z1+dz,x1-dx,0,z1-dz,x0-dx,0,z0-dz,x0+dx,0,z0+dz,x1+dx,0,z1+dz);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}

export function createPrCellArt(round:PrRoundDefinition){
 const root=new THREE.Group();root.name="shatterdeck-cell-art";
 const radius=PR_BALANCE.tileRadius;
 const geometries=[new THREE.CylinderGeometry(radius,radius,.38,6),perimeterGeometry(radius*.985),new THREE.CylinderGeometry(radius*.84,radius*.84,.012,6),circuitGeometry(radius),new THREE.ConeGeometry(.045,.38,3)];
 const materials=[
  new THREE.MeshStandardMaterial({color:0xffffff,roughness:.57,metalness:.3}),
  new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}),
  new THREE.MeshStandardMaterial({color:0xffffff,roughness:.4,metalness:.2,emissive:0xffffff,emissiveIntensity:.18}),
  new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}),
  new THREE.MeshBasicMaterial({color:0xc1eaff,transparent:true,opacity:.55,depthWrite:false}),
 ];
 const batches=geometries.map((geo,i)=>{
  const mesh=new THREE.InstancedMesh(geo,materials[i],i===4?SHARDS:round.tiles.length);
  mesh.name=["shatterdeck-cells","shatterdeck-cell-rims","shatterdeck-cell-fields","shatterdeck-cell-circuits","shatterdeck-cell-shards"][i];
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.userData.cameraCollision=false;root.add(mesh);return mesh;
 });
 const [cells,rims,fields,circuits,shards]=batches;
 const tileBatches=[cells,rims,fields,circuits];
 cells.receiveShadow=true;
 const dummy=new THREE.Object3D(),color=new THREE.Color(),white=new THREE.Color(0xeaffff),warn=new THREE.Color(0xffd47d),breaking=new THREE.Color(0xff728c);
 const states:(ReturnType<typeof prTileState>|undefined)[]=new Array(round.tiles.length);
 const starts=new Float64Array(SHARDS).fill(-Infinity),xs=new Float32Array(SHARDS),ys=new Float32Array(SHARDS),zs=new Float32Array(SHARDS),angles=new Float32Array(SHARDS);
 let cursor=0,disposed=false,quality:PrArtQuality="high",lastMs=-Infinity;
 function matrix(mesh:THREE.InstancedMesh,i:number,x:number,y:number,z:number,scale:number){
  dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
 }
 function update(ms:number,triggered:ReadonlyMap<number,number>):void {
  if(disposed)return;
  if(ms<lastMs)starts.fill(-Infinity);lastMs=ms;
  let changed=false;
  for(let i=0;i<round.tiles.length;i++){
   const tile=round.tiles[i],at=triggered.get(tile.id),state=prTileState(at,ms),previous=states[i];
   if(state===previous&&(state==="solid"||state==="gone"))continue;
   changed=true;states[i]=state;
   const deck=tile.deck%4,gone=state==="gone",active=state==="triggered"||state==="breaking",fracturing=state==="breaking";
   const progress=fracturing?Math.max(0,Math.min(1,(ms-at!-PR_BALANCE.tileBreakMs+PR_BALANCE.tileBreakingMs)/PR_BALANCE.tileBreakingMs)):0;
   matrix(cells,i,tile.center.x,tile.center.y-.19,tile.center.z,gone?0:1);
   matrix(rims,i,tile.center.x,tile.center.y+.002,tile.center.z,gone?0:1);
   matrix(fields,i,tile.center.x,tile.center.y+.008,tile.center.z,gone?0:fracturing?1-progress*.6:1);
   matrix(circuits,i,tile.center.x,tile.center.y+.015,tile.center.z,gone?0:1);
   color.setHex(CHASSIS[deck]);cells.setColorAt(i,color);
   color.setHex(LAYERS[deck]);if(active)color.lerp(fracturing?breaking:white,fracturing?.85:.45+.4*Math.sin(ms*.024)**2);rims.setColorAt(i,color);
   color.setHex(LAYERS[deck]).multiplyScalar(.7);if(active)color.lerp(fracturing?breaking:warn,fracturing?.35+.5*Math.sin(ms*.065)**2:.48);fields.setColorAt(i,color);
   color.copy(fracturing?breaking:white);if(fracturing)color.multiplyScalar(.45+.55*Math.sin(ms*.08)**2);circuits.setColorAt(i,color);
   // Late snapshots never replay historical collapses; only newly observed fresh gone transitions emit.
   if(gone&&previous!==undefined&&previous!=="gone"&&at!==undefined&&ms-at-PR_BALANCE.tileBreakMs<160){
    const count=quality==="low"?0:quality==="medium"?3:6;
    for(let edge=0;edge<count;edge++){
     const slot=cursor++%SHARDS,a=edge*Math.PI*2/count;
     starts[slot]=ms;xs[slot]=tile.center.x+Math.sin(a)*radius*.75;ys[slot]=tile.center.y-.45;zs[slot]=tile.center.z+Math.cos(a)*radius*.75;angles[slot]=a;
    }
   }
  }
  if(changed)for(const mesh of tileBatches){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  for(let i=0;i<SHARDS;i++){
   const age=ms-starts[i],life=age/LIFETIME,visible=quality!=="low"&&age>=0&&age<LIFETIME;
   if(!visible){matrix(shards,i,0,0,0,0);continue;}
   dummy.position.set(xs[i]+Math.sin(angles[i])*life*.25,ys[i]-life*1.6,zs[i]+Math.cos(angles[i])*life*.25);
   dummy.rotation.set(.35,angles[i],life*.7);dummy.scale.setScalar((1-life)*.9);dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix);
  }
  shards.instanceMatrix.needsUpdate=true;
 }
 update(0,new Map());
 return {root,cells,update,
  setQuality(q:PrArtQuality){quality=q;circuits.visible=q!=="low";shards.visible=q!=="low";if(q==="low")starts.fill(-Infinity);},
  dispose(){if(disposed)return;disposed=true;for(const mesh of batches)mesh.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.clear();root.removeFromParent();},
 };
}
