import * as THREE from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {pgResolveHero,pgResolveOperator} from "@planetfall/shared";
import type {AstronautVisual} from "../../astronaut";
import {createAstronautVisual} from "../../astronaut";

export type PgInfectedKind="drifter"|"skitter"|"bulwark";
/** Silhouette parts remain outside lodDetails. The canonical body/visor and team shoulders remain intact. */
export function createPgCharacterArt(rig:AstronautVisual,characterId:string) {
 const definition=pgResolveHero(characterId)??pgResolveOperator(characterId);
 const infected=["drifter","skitter","bulwark"].includes(characterId);
 const colors=definition?.silhouette.colors??{armor:infected?"#68646d":"#8291ad",secondary:"#282e43",emitter:"#ff9c55"};
 const materials=[new THREE.MeshStandardMaterial({color:colors.armor,roughness:.76,flatShading:true}),new THREE.MeshStandardMaterial({color:colors.secondary,roughness:.7}),new THREE.MeshStandardMaterial({color:colors.emitter,emissive:colors.emitter,emissiveIntensity:.5,roughness:.4})];
 const restoredMaterials=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>();
 const shell=rig.helmet.children.find((o):o is THREE.Mesh=>o instanceof THREE.Mesh&&o!==rig.visor&&!(o instanceof THREE.InstancedMesh)&&o.geometry.type==="SphereGeometry");
 const originalShellGeometry=shell?.geometry;let ownedShellGeometry:THREE.BufferGeometry|undefined;
 if(definition){
  // The canonical white material is shared by helmet, torso, gloves and boots.
  // Reassign the actual armor surfaces, not a tiny overlay hidden by that shell.
  // Suit-color shoulders/cuffs, the visor shader and both eye instances stay intact.
  const white=rig.torso.material;
  rig.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===white){restoredMaterials.set(o,o.material);o.material=materials[0];}});
  rig.torso.material=materials[1];
  for(const limb of [rig.leftArm,rig.rightArm,rig.leftLeg,rig.rightLeg])for(const o of limb.children){if(o instanceof THREE.Mesh&&o.geometry.type==="CapsuleGeometry"){restoredMaterials.set(o,o.material);o.material=materials[0];}}
  for(const o of rig.backpack.children){if(o instanceof THREE.Mesh&&o.geometry.type==="BoxGeometry"){restoredMaterials.set(o,o.material);o.material=materials[0];}}
  if(shell){
   const shape=definition.silhouette.helmet;
   // Eyes are placed against exact canonical 12x9 sphere facets. Retain their
   // front topology, positions AND normals; rebuild neither the face nor visor.
   ownedShellGeometry=shell.geometry.clone();
   const positions=ownedShellGeometry.getAttribute("position"),originalPositions=shell.geometry.getAttribute("position"),originalNormals=shell.geometry.getAttribute("normal");
   for(let i=0;i<positions.count;i++){
    let x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    if(z>.25&&Math.abs(y)<=.31)continue;
    if(["square","rectangular","flat","geometric"].includes(shape)){if(y>.31)y=shape==="flat"?.43:.5;if(Math.abs(x)>.4)x=Math.sign(x)*.52;if(z<-.42)z=-.48;}
    if(shape==="swept"&&y>.15){z-=.12*(y-.15)/.41;y*=.93;}
    if(shape==="narrow-sensor"||shape==="slit")x*=.88;
    if(shape==="dome"||shape==="antenna-hood"){x*=1.04;if(y>0)y*=.9;}
    positions.setXYZ(i,x,y,z);
   }
   ownedShellGeometry.computeVertexNormals();const normals=ownedShellGeometry.getAttribute("normal");
   for(let i=0;i<positions.count;i++)if(originalPositions.getZ(i)>.25&&Math.abs(originalPositions.getY(i))<=.31)normals.setXYZ(i,originalNormals.getX(i),originalNormals.getY(i),originalNormals.getZ(i));
   shell.geometry=ownedShellGeometry;
   // Keep the face in the lighter armor tone so the canonical black eyes
   // remain readable; dark equipment surrounds it instead of masking it.
  }
 }
 const batches=new Map<THREE.Object3D,THREE.BufferGeometry[][]>();
 const transform=new THREE.Object3D();
 function part(anchor:THREE.Object3D,shape:"box"|"ring"|"orb",p:number[],s:number[],material=0,rz=0) {
  const primitive=shape==="box"?new THREE.BoxGeometry(1,1,1):shape==="ring"?new THREE.TorusGeometry(.5,.11,4,12):new THREE.IcosahedronGeometry(.5,1);
  const geometry=primitive.index?primitive.toNonIndexed():primitive;if(geometry!==primitive)primitive.dispose();
  transform.position.set(p[0],p[1],p[2]);transform.scale.set(s[0],s[1],s[2]);transform.rotation.set(0,0,rz);transform.updateMatrix();geometry.applyMatrix4(transform.matrix);
  if(!batches.has(anchor))batches.set(anchor,[[],[],[]]);batches.get(anchor)![material].push(geometry);
 }
 const h=rig.helmet,b=rig.backpack;
 const box=(a:THREE.Object3D,p:number[],s:number[],m=0,r=0)=>part(a,"box",p,s,m,r);
 const ring=(a:THREE.Object3D,p:number[],s:number[],m=0)=>part(a,"ring",p,s,m);
 // Identity-critical shapes are deliberately broad, low polygon and close to the normal rig envelope.
 switch(characterId){
 case "cairn": box(h,[0,.38,0],[1.06,.26,.99]);box(b,[0,-.15,-.2],[.8,.47,.34]);for(const a of [rig.leftArm,rig.rightArm])box(a,[0,-.17,-.09],[.42,.2,.42]);break;
 case "kepler": ring(b,[0,.07,-.3],[1.05,1.05,.7]);for(const x of [-.35,.35])part(h,"orb",[x,.12,0],[.52,.64,.65]);break;
 case "cinder": box(h,[0,.32,-.12],[.36,.5,.85],0,-.4);for(const x of [-.26,.26])box(b,[x,0,-.26],[.22,.7,.34],1,-x);box(rig.rightArm,[0,-.38,.1],[.32,.38,.36]);break;
 case "parallax": box(h,[0,.24,.47],[.85,.09,.15],1);box(b,[.32,.5,-.1],[.1,1.15,.13]);box(rig.leftArm,[-.1,-.12,-.1],[.28,.2,.5]);break;
 case "solace": ring(rig.upperBody,[0,1.13,0],[1.18,.36,1],0);part(b,"orb",[0,0,-.2],[.9,.95,.48]);box(rig.leftArm,[0,-.43,.15],[.26,.2,.2],2);break;
 case "spindle": box(h,[0,.32,0],[.7,.43,.73],0,Math.PI/4);for(const x of [-.4,.4]){box(b,[x,.22,-.12],[.12,.72,.14],0,x);box(b,[x,.42,-.17],[.35,.12,.12]);}break;
 case "rivet": box(h,[-.44,.08,.27],[.22,.53,.35],1);box(rig.rightArm,[.04,-.3,.1],[.4,.53,.39]);for(const x of [-.24,0,.24])box(b,[x,0,-.24],[.16,.55,.17],2);break;
 case "lumen": for(const x of [-.22,.22])box(h,[x,.46,-.07],[.13,.48,.48],0,x);box(b,[0,.1,-.2],[.35,.9,.2]);break;
 case "null": ring(h,[0,.08,-.12],[1.12,1.12,.8],1);box(b,[0,0,-.25],[.8,.65,.4]);for(const a of [rig.leftArm,rig.rightArm])ring(a,[0,-.35,0],[.42,.44,.5],1);break;
 case "strut": box(h,[0,.4,0],[.93,.16,.79]);for(const x of [-.25,0,.25])box(b,[x,.06,-.26],[.22,.94,.18],0,x*.4);break;
 case "thread": box(h,[0,.23,.46],[.8,.08,.15],1);ring(b,[0,.08,-.3],[.83,.83,.9]);for(const a of [rig.leftArm,rig.rightArm])box(a,[0,-.4,.17],[.17,.3,.27]);break;
 case "patch": box(h,[0,-.2,.38],[.82,.16,.32]);for(const x of [-.3,.3])part(b,"orb",[x,0,-.25],[.3,.8,.35]);box(rig.upperBody,[0,.9,.46],[.4,.4,.12],0);break;
 case "brace":box(h,[0,.37,.02],[1.08,.22,1]);for(const x of [-.47,.47])box(h,[x,.05,.3],[.13,.51,.37],1);for(const x of [-.57,.57])box(rig.upperBody,[x,1.2,-.23],[.36,.25,.3]);box(b,[0,.08,-.26],[.65,.85,.18]);break;
 case "hush":for(const x of [-.51,.51])part(h,"orb",[x,.02,-.03],[.29,.66,.62]);ring(b,[0,0,-.3],[.95,.88,.9],1);box(b,[0,.4,-.2],[.65,.14,.3]);break;
 case "glint":box(h,[0,.34,.43],[.92,.2,.22],0);for(const x of [-.28,0,.28]){ring(h,[x,.34,.57],[.23,.23,.6],1);part(h,"orb",[x,.34,.61],[.12,.12,.1],2);}box(b,[.2,-.1,-.2],[.51,.5,.3]);break;
 case "coil":for(const x of [-.34,.34]){box(h,[x,.47,-.04],[.16,.38,.24],0,x*.55);ring(b,[x,0,-.3],[.57,.71,.7]);}break;
 case "mend":for(const x of [-.32,0,.32])box(h,[x,.33,0],[.27,.32,.74]);box(rig.upperBody,[0,.83,.48],[.65,.46,.18]);ring(b,[0,.05,-.27],[.7,.8,.6],2);break;
 case "shroud":for(const x of [-.25,.25]){part(h,"orb",[x,-.22,.41],[.28,.29,.27],1);box(b,[x,.04,-.3],[.27,.8,.28]);}box(h,[0,.3,-.12],[.87,.18,.7]);break;
 case "bulwark":box(h,[0,.26,0],[.96,.46,.89]);for(const a of [rig.leftArm,rig.rightArm])box(a,[0,.07,0],[.43,.37,.46]);box(rig.upperBody,[0,.8,.48],[.73,.57,.18]);break;
 case "skitter":box(b,[0,.35,-.26],[.5,.53,.4],1);box(h,[.23,.25,-.16],[.4,.33,.57],1,.4);box(rig.leftArm,[0,-.35,.1],[.17,.45,.2]);break;
 case "drifter":box(h,[-.24,.2,0],[.36,.35,.73],1,-.3);box(b,[-.14,.04,-.26],[.5,.66,.28],1,.22);break;
 }
 if(infected){ // Cracks, opaque face mask and a broken chest seal identify enemies even without color.
  box(h,[0,.01,.49],[.72,.46,.13],1);
  box(h,[-.07,.02,.565],[.035,.41,.016],2,.5);box(h,[.06,.08,.566],[.3,.025,.017],2,-.35);
  box(rig.upperBody,[.12,.84,.49],[.34,.09,.06],2,.35);
 }else if(definition){
  // Compact edge plates sit behind team shoulder badges and remain readable
  // while aiming. Their profile follows each catalog's equipment family.
  const rounded=/round|padded|curved/.test(definition.silhouette.shoulders),heavy=/broad|thick|heavy|reinforcement/.test(definition.silhouette.shoulders);
  for(const [a,side]of [[rig.leftArm,-1],[rig.rightArm,1]]as const)part(a,rounded?"orb":"box",[side*.12,-.13,-.1],[heavy?.34:.24,rounded?.3:.2,.33],1,rounded?0:side*.2);
  // Bracers are attached to animated wrists; existing shoulder and visor team markings are unobstructed.
  for(const a of [rig.leftArm,rig.rightArm])box(a,[0,-.43,-.03],[.25,.22,.28],1);
  box(rig.rightArm,[0,-.43,.13],[.18,.07,.04],2);
 }
 const meshes:THREE.Mesh[]=[];
 for(const [anchor,groups] of batches)groups.forEach((parts,index)=>{if(!parts.length)return;const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());const mesh=new THREE.Mesh(geometry,materials[index]);mesh.name=`pg-identity-${characterId}`;mesh.layers.mask=anchor.layers.mask;anchor.add(mesh);meshes.push(mesh);});
 let disposed=false;
 return {dispose(){if(disposed)return;disposed=true;for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}for(const [mesh,material]of restoredMaterials)mesh.material=material;if(shell&&originalShellGeometry)shell.geometry=originalShellGeometry;ownedShellGeometry?.dispose();materials.forEach(m=>m.dispose());}};
}

const portraits=new Map<string,string>();
/** Orthographic vector projection of the very same rig and identity geometry used in-world.
 * Cached once per catalog entry, with no canvas/WebGL context or retained GPU resources. */
export function pgCharacterPortraitSvg(characterId:string):string {
 const cached=portraits.get(characterId);if(cached)return cached;
 if(!pgResolveHero(characterId)&&!pgResolveOperator(characterId))return "";
 const rig=createAstronautVisual({identityColor:"#65d8f2",suitAccent:"#3e5278",isBot:false});
 const art=createPgCharacterArt(rig,characterId);rig.group.rotation.y=-.32;rig.group.updateMatrixWorld(true);
 const faces:{z:number;path:string;color:string}[]=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 rig.group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;geometries.add(o.geometry);const mat=Array.isArray(o.material)?o.material[0]:o.material;materials.add(mat);if(o instanceof THREE.InstancedMesh)return;
  const p=o.geometry.getAttribute("position"),index=o.geometry.index;
  for(let i=0;i<(index?.count??p.count);i+=3){a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(o.matrixWorld);
   const xy=(v:THREE.Vector3)=>`${(70+v.x*45).toFixed(1)},${(124-v.y*45).toFixed(1)}`;
   faces.push({z:(a.z+b.z+c.z)/3,path:`M${xy(a)}L${xy(b)}L${xy(c)}Z`,color:`#${mat.color?.getHexString()??"7b8da7"}`});
  }
 });
 faces.sort((a,b)=>a.z-b.z);
 const svg=`<svg viewBox="0 0 140 145" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="70" cy="137" rx="41" ry="5" fill="#060b1c"/>${faces.map(f=>`<path d="${f.path}" fill="${f.color}"/>`).join("")}</svg>`;
 art.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());portraits.set(characterId,svg);return svg;
}

/** Identifier hardware inherits the animated glove anchors, safely below the existing optics. */
export function createPgFirstPersonCharacterArt(root:THREE.Object3D,characterId:string){
 const definition=pgResolveHero(characterId)??pgResolveOperator(characterId);
 const meshes:THREE.Mesh[]=[],geometry=new THREE.BoxGeometry(1,1,1);
 const armor=new THREE.MeshStandardMaterial({color:definition?.silhouette.colors.armor??"#7c8ba4",roughness:.65}),emitter=new THREE.MeshStandardMaterial({color:definition?.silhouette.colors.emitter??"#8edafa",emissive:definition?.silhouette.colors.emitter??"#8edafa",emissiveIntensity:.35});
 if(definition)for(const [name,side]of [["support-glove",-1],["trigger-glove",1]]as const){const anchor=root.getObjectByName(name);if(!anchor)continue;
  const plate=new THREE.Mesh(geometry,armor);plate.name=`pg-firstperson-${characterId}`;plate.position.set(side*.042,.014,-.006);plate.scale.set(.014,.042,.055);plate.layers.mask=anchor.layers.mask;anchor.add(plate);meshes.push(plate);
  const segmented=["round-segmented","rescue-segmented","forked","triple-lens"].includes(definition.silhouette.helmet),count=segmented?3:1;
  for(let i=0;i<count;i++){const light=new THREE.Mesh(geometry,emitter);light.position.set(side*.051,.016+(i-(count-1)/2)*.011,-.007);light.scale.set(.004,.004,segmented?.032:.044);light.layers.mask=anchor.layers.mask;light.name=`pg-firstperson-emitter-${characterId}`;anchor.add(light);meshes.push(light);}
 }
 let disposed=false;return {dispose(){if(disposed)return;disposed=true;meshes.forEach(m=>m.removeFromParent());geometry.dispose();armor.dispose();emitter.dispose();}};
}
