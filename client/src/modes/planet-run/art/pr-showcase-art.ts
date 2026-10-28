import * as THREE from "three";
import {createAstronautVisual} from "../../../astronaut";
import {createAstronautMotion} from "../../../astronaut-motion";
import {createPrShowcasePose,samplePrShowcasePose} from "./pr-showcase-timeline";

export const PR_SHOWCASE_MOTIFS=["solar"] as const;
/** A single composed hero diorama, using the menu's renderer and illumination. */
export function createPrShowcaseArt(){
 const root=new THREE.Group();root.name="planet-run-home-preview";
 const course=new THREE.Group();course.rotation.y=.2;root.add(course);
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),instances=new Set<THREE.InstancedMesh>();
 const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};
 const box=geo(new THREE.BoxGeometry(1,1,1)),cylinder=geo(new THREE.CylinderGeometry(1,1,1,48)),sphere=geo(new THREE.SphereGeometry(1,24,16)),torus=geo(new THREE.TorusGeometry(1,.035,6,64));
 const material=(color:number,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.22,emissive:color,emissiveIntensity:glow});materials.add(m);return m;};
 const dark=material(0x202843),white=material(0xe8e9f4),pink=material(0xe36aaf),gold=material(0xffc34d),purple=material(0x7862be),blue=material(0x4084bc),cyan=material(0x78dfff,.45);
 const arena=new THREE.Group();arena.name="showcase-solar";course.add(arena);
 const sweeper=new THREE.Group();sweeper.name="miniature-solar-arm";arena.add(sweeper);
 const pending=new Map<string,{parent:THREE.Object3D;geo:THREE.BufferGeometry;mat:THREE.Material;transforms:THREE.Matrix4[]}>(),dummy=new THREE.Object3D();
 const add=(parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0)=>{
  const key=`${parent.uuid}:${g.uuid}:${m.uuid}`;let b=pending.get(key);if(!b){b={parent,geo:g,mat:m,transforms:[]};pending.set(key,b);}dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();b.transforms.push(dummy.matrix.clone());
 };
 // Thick floating arena with a luminous inset, tapered underside and legible
 // radial racing surface. One asymmetric arm leaves a generous waiting area.
 add(arena,cylinder,dark,0,-.4,0,3.65,.7,3.65);
 add(arena,cylinder,purple,0,-.82,0,2.75,.22,2.75);
 add(arena,cylinder,white,0,-.035,0,3.52,.07,3.52);
 add(arena,torus,cyan,0,-.32,0,3.66,3.66,3.66,Math.PI/2);
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8;
  add(arena,box,i%4===0?pink:gold,Math.sin(a)*3.15,.008,Math.cos(a)*3.15,.38,.016,.46,0,a);
  add(arena,box,dark,Math.sin(a)*3.4,-.48,Math.cos(a)*3.4,.5,.22,.1,0,a);
 }
 add(arena,cylinder,purple,0,.3,0,.55,.6,.55);
 add(arena,cylinder,gold,0,.64,0,.43,.09,.43);
 add(arena,torus,cyan,0,.71,0,.28,.28,.28,Math.PI/2);
 add(sweeper,box,gold,1.8,.44,0,3.2,.22,.38);
 add(sweeper,box,white,1.8,.56,0,2.85,.035,.23);
 add(sweeper,cylinder,pink,3.36,.44,0,.27,.38,.27);
 // Backstage launch dock and a distant station segment provide depth without
 // sprawling beyond the six-unit framing envelope used by the menu.
 const orbit=new THREE.Group();orbit.name="showcase-orbital-context";course.add(orbit);
 add(orbit,cylinder,dark,-2.5,-.95,-3.1,1.2,.3,1.1);
 add(orbit,cylinder,pink,-2.5,-.78,-3.1,1.12,.04,1.02);
 add(orbit,box,dark,-2.7,-.9,-1.9,.8,.25,1.5,0,-.2);
 for(const x of[-3.25,-1.75])add(orbit,box,white,x,.05,-3.4,.12,1.65,.16);
 add(orbit,box,gold,-2.5,.92,-3.4,1.7,.18,.2);
 add(orbit,sphere,blue,-1.3,1.6,-4.25,1.1,1.1,1.1);
 add(orbit,torus,purple,-1.3,1.6,-4.25,1.7,.55,1,0,0,-.3);
 // Satellite panel pairs are deliberately quiet behind the warm hero obstacle.
 add(orbit,box,white,2.25,1.25,-4.1,.48,.46,.7);
 for(const x of[1.35,3.15]){
  add(orbit,box,blue,x,1.25,-4.1,1.1,.06,.8,0,0,.12);
  for(let i=0;i<3;i++)add(orbit,box,cyan,x-.35+i*.35,1.29,-4.1,.018,.008,.7,0,0,.12);
 }
 for(const b of pending.values()){const mesh=new THREE.InstancedMesh(b.geo,b.mat,b.transforms.length);for(let i=0;i<b.transforms.length;i++)mesh.setMatrixAt(i,b.transforms[i]);mesh.computeBoundingSphere();b.parent.add(mesh);instances.add(mesh);}pending.clear();
 const astronaut=createAstronautVisual({identityColor:"#ffe5a1",suitAccent:"#e983b5",isBot:false}),motion=createAstronautMotion(astronaut);
 astronaut.group.name="showcase-astronaut";astronaut.group.scale.setScalar(.8);course.add(astronaut.group);
 astronaut.group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)instances.add(o);}});
 const reduced=typeof matchMedia!=="undefined"?matchMedia("(prefers-reduced-motion: reduce)"):null;
 const pose=createPrShowcasePose();let lastTime:number|null=null,disposed=false,wasReduced=false;
 const update=(timeSeconds:number)=>{
  if(disposed)return;
  const time=Number.isFinite(timeSeconds)?Math.max(0,timeSeconds):0,isReduced=reduced?.matches??false;
  samplePrShowcasePose(time,isReduced,pose);
  if(isReduced!==wasReduced)motion.reset();wasReduced=isReduced;
  const dt=lastTime===null?1/60:THREE.MathUtils.clamp(time-lastTime,0,.05);lastTime=time;
  sweeper.rotation.y=pose.sweeperYaw;
  // Canonical soles are .29 below the root; no root bob or lateral foot slide.
  astronaut.group.position.set(pose.x,.232+pose.y,pose.z);astronaut.group.rotation.y=pose.yaw;
  const input=motion.input;input.dt=isReduced?0:dt;input.timeSeconds=isReduced?1:time;input.forwardSpeed=0;input.grounded=pose.y===0;input.verticalSpeed=pose.verticalSpeed;input.turnRate=0;motion.update();
 };
 update(0);
 return {root,update,get currentMotif(){return PR_SHOWCASE_MOTIFS[0];},dispose(){if(disposed)return;disposed=true;root.removeFromParent();root.clear();for(const instance of instances)instance.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();instances.clear();geometries.clear();materials.clear();}};
}
