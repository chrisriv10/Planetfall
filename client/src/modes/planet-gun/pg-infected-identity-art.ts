import * as THREE from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {AstronautVisual} from "../../astronaut";

type InfectedKind="drifter"|"skitter"|"bulwark";
type Vec=readonly [number,number,number];
const shades={
  drifter:[0x888477,0x343640,0xe88852],
  skitter:[0x586d6b,0x28383d,0xaecf72],
  bulwark:[0x77747e,0x353441,0xe5aa65],
} as const;

/** Rigid art attached to the canonical pivots; the caller owns motion and instancing. */
export function createPgInfectedIdentityArt(rig:AstronautVisual,kind:InfectedKind){
  const mats=shades[kind].map((color,i)=>new THREE.MeshStandardMaterial({
    color,roughness:i===2 ? .56 : .84,metalness:i===2 ? .18 : .13,flatShading:true,
  }));
  // The friendly eyes, intact bubble visor, antenna and tanks belong to the original rig.
  // Detach as a set so even offline mesh bakers cannot include them through an opaque plate.
  const originals=[rig.helmet,rig.backpack].map(anchor=>{
    const children=[...anchor.children];
    for(const child of children)anchor.remove(child);
    return {anchor,children};
  });
  const borrowed=new Map<THREE.Mesh,THREE.Material>();
  const white=rig.torso.material;
  rig.group.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;
    const previous=o.material;
    borrowed.set(o,previous);
    o.material=previous===white?mats[0]:mats[1];
  });
  const batches=new Map<THREE.Object3D,THREE.BufferGeometry[][]>(),pose=new THREE.Object3D();
  function part(anchor:THREE.Object3D,geometry:THREE.BufferGeometry,p:Vec,s:Vec,index:number,roll=0,pitch=0){
    const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();
    g.deleteAttribute("uv");g.clearGroups();
    pose.position.set(...p);pose.scale.set(...s);pose.rotation.set(pitch,0,roll);pose.updateMatrix();g.applyMatrix4(pose.matrix);
    let batch=batches.get(anchor);if(!batch){batch=[[],[],[]];batches.set(anchor,batch);}batch[index].push(g);
  }
  function dome(a:THREE.Object3D,p:Vec,s:Vec,index:number,roll=0){
    part(a,new THREE.SphereGeometry(1,10,7),p,s,index,roll);
  }
  function cylinder(a:THREE.Object3D,p:Vec,s:Vec,index:number,roll=0){
    part(a,new THREE.CylinderGeometry(.86,1,1,8),p,s,index,roll);
  }
  // All outline coordinates are face-local; front and back faces share a clipped pressure rim.
  function plate(a:THREE.Object3D,outline:readonly (readonly [number,number])[],p:Vec,s:Vec,index:number,roll=0){
    const shape=new THREE.Shape();shape.moveTo(...outline[0]);for(const xy of outline.slice(1))shape.lineTo(...xy);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,curveSegments:1});
    part(a,geo,p,s,index,roll);
  }
  const visor=[[-1,.48],[-.67,.93],[.56,.95],[1,.36],[.83,-.45],[.32,-.92],[-.63,-.80],[-.94,-.34]] as const;
  const panel=[[-1,.50],[-.55,1],[.63,1],[1,.55],[.86,-.57],[.34,-1],[-.55,-.90],[-1,-.50]] as const;
  const fissure=[[-.85,.55],[-.35,.11],[-.50,-.01],[-.13,-.48],[-.30,-.10],[.14,.06],[.68,-.16],[.94,-.09],[.18,.19],[-.24,.15]] as const;
  const h=rig.helmet,b=rig.backpack;
  const width=kind==="skitter" ? .405 : kind==="bulwark" ? .535 : .495;
  const tilt=kind==="skitter"?-.26:kind==="drifter" ? .12 : 0;
  dome(h,[0,0,-.055],[width,kind==="skitter" ? .43 : .505,.46],0,tilt);
  plate(h,visor,[0,-.025,.265],[width*.94,.295,.19],1,tilt);
  plate(h,fissure,[0,.004,.459],[width*.85,.33,.012],2,tilt);
  if(kind==="drifter"){
    // One ruptured cheek pod and half of the original pressure collar survive.
    dome(h,[-.386,-.11,.095],[.16,.22,.215],1,.26);
    cylinder(h,[-.39,-.18,.15],[.13,.21,.14],0,.38);
    plate(rig.upperBody,panel,[-.09,.82,.444],[.285,.145,.074],0,-.21);
    plate(rig.upperBody,fissure,[-.09,.80,.525],[.24,.145,.010],2,-.21);
    cylinder(b,[-.15,.03,-.045],[.217,.80,.211],1,.21);
    cylinder(b,[-.17,.14,-.048],[.223,.097,.218],0,.21);
    dome(b,[.13,-.13,-.017],[.15,.27,.13],0,-.11);
  }else if(kind==="skitter"){
    // The raked brow and low swept respirator form a single directional silhouette.
    plate(h,visor,[-.048,.155,.267],[.367,.113,.15],0,tilt);
    plate(h,panel,[.075,-.231,.213],[.15,.178,.18],0,tilt);
    for(const sign of [-1,1]){
      const arm=sign<0?rig.leftArm:rig.rightArm;
      plate(arm,panel,[sign*.05,-.36,.06],[.125,.237,.118],0,-sign*.13);
    }
    dome(b,[0,.08,-.08],[.233,.395,.183],1,-.23);
    for(const sign of [-1,1])cylinder(b,[sign*.13,.04,-.16],[.075,.49,.075],0,-.23);
  }else{
    // The forehead blast shield overhangs a recessed face. Rounded pauldrons follow the animated arms.
    plate(h,panel,[0,.195,.209],[.49,.193,.248],0);
    for(const sign of [-1,1]){
      dome(h,[sign*.40,-.057,.085],[.15,.258,.245],1,-sign*.13);
      const arm=sign<0?rig.leftArm:rig.rightArm;
      dome(arm,[0,.018,.004],[.238,.252,.274],0,sign*.1);
      plate(arm,panel,[0,-.138,.156],[.177,.106,.105],1,sign*.08);
    }
    plate(rig.upperBody,panel,[0,.855,.405],[.424,.247,.115],0);
    plate(rig.upperBody,panel,[0,.825,.524],[.265,.093,.018],1);
    for(const x of [-.225,.225])cylinder(b,[x,.046,-.065],[.226,.83,.22],1);
    plate(b,panel,[0,.04,-.286],[.385,.294,.095],0);
  }
  const added:THREE.Mesh[]=[];
  for(const [anchor,batch]of batches)batch.forEach((parts,index)=>{
    if(!parts.length)return;
    const merged=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(merged,mats[index]);mesh.name=`infected-${kind}-${["shell","seal","rupture"][index]}`;
    anchor.add(mesh);added.push(mesh);
  });
  let disposed=false;
  return {dispose(){
    if(disposed)return;disposed=true;
    for(const mesh of added){mesh.removeFromParent();mesh.geometry.dispose();}
    for(const [mesh,before]of borrowed)if(mats.includes(mesh.material as THREE.MeshStandardMaterial))mesh.material=before;
    for(const {anchor,children}of originals)for(const child of children)if(!child.parent)anchor.add(child);
    mats.forEach(material=>material.dispose());
  }};
}
