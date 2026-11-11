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
 const dark=material(0x172b45),white=material(0xe8eff5),pink=material(0xeb649b),gold=material(0xffc34d),purple=material(0x6255a0),blue=material(0x287cac),cyan=material(0x78dfff,.35);
 const eventLight=material(0xffdc86,.28);
 const arena=new THREE.Group();arena.name="showcase-solar";course.add(arena);
 const sweeper=new THREE.Group();sweeper.name="miniature-solar-arm";arena.add(sweeper);
 const pending=new Map<string,{parent:THREE.Object3D;geo:THREE.BufferGeometry;mat:THREE.Material;transforms:THREE.Matrix4[]}>(),dummy=new THREE.Object3D();
 const add=(parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0)=>{
  const key=`${parent.uuid}:${g.uuid}:${m.uuid}`;let b=pending.get(key);if(!b){b={parent,geo:g,mat:m,transforms:[]};pending.set(key,b);}dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();b.transforms.push(dummy.matrix.clone());
 };
 // Solar Circuit: segmented competition deck on a visibly engineered station.
 // All decorative contact surfaces remain within a centimetre of the deck.
 add(arena,cylinder,dark,0,-.4,0,3.65,.7,3.65);
 add(arena,cylinder,purple,0,-.82,0,2.75,.22,2.75);
 add(arena,cylinder,white,0,-.035,0,3.52,.07,3.52);
 add(arena,torus,cyan,0,-.32,0,3.66,3.66,3.66,Math.PI/2);
 add(arena,torus,dark,0,.008,0,2.95,2.95,2.95,Math.PI/2);
 const lane=geo(new THREE.RingGeometry(.76,2.92,24,1,.035,Math.PI/4-.07));
 for(let i=0;i<8;i++)add(arena,lane,i%2?white:blue,0,.004,0,1,1,1,-Math.PI/2,0,i*Math.PI/4);
 add(arena,cylinder,dark,0,-1.05,0,1.85,.35,1.85);
 add(arena,cylinder,gold,0,-1.25,0,.85,.12,.85);
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8;
  add(arena,box,i%4===0?pink:gold,Math.sin(a)*3.15,.008,Math.cos(a)*3.15,.38,.016,.46,0,a);
  add(arena,box,dark,Math.sin(a)*3.4,-.48,Math.cos(a)*3.4,.5,.22,.1,0,a);
  add(arena,box,i%2?purple:pink,Math.sin(a)*3.48,-.18,Math.cos(a)*3.48,.57,.23,.18,0,a);
  add(arena,box,white,Math.sin(a)*2.65,-.79,Math.cos(a)*2.65,.12,.45,.72,0,a,Math.PI/8);
 }
 add(arena,cylinder,purple,0,.3,0,.55,.6,.55);
 add(arena,cylinder,gold,0,.64,0,.43,.09,.43);
 add(arena,torus,cyan,0,.71,0,.28,.28,.28,Math.PI/2);
 add(sweeper,box,gold,1.8,.44,0,3.2,.22,.38);
 add(sweeper,box,white,1.8,.56,0,2.85,.035,.23);
 add(sweeper,cylinder,pink,3.36,.44,0,.27,.38,.27);
 for(let i=0;i<5;i++)add(sweeper,box,dark,.7+i*.49,.565,0,.07,.018,.25,0,.3);
 add(sweeper,box,eventLight,1.8,.44,.2,2.7,.065,.025);
 add(sweeper,cylinder,white,3.36,.65,0,.2,.035,.2);
 // A low crescent of station infrastructure frames the back of the action.
 // No enclosing box: the planet and space remain visible through the gate.
 const orbit=new THREE.Group();orbit.name="showcase-orbital-context";course.add(orbit);
 add(orbit,cylinder,dark,-2.7,-.5,-2.7,1.25,.65,1.1);
 add(orbit,cylinder,pink,-2.7,-.16,-2.7,1.16,.04,1.02);
 add(orbit,box,white,-2.25,-.15,-1.95,.9,.12,1.7,0,-.5);
 for(const x of[-3.55,-1.9]){
  add(orbit,cylinder,dark,x,.55,-3.1,.2,1.5,.2);
  add(orbit,cylinder,white,x,.65,-3.1,.14,1.55,.14);
  add(orbit,box,pink,x,.8,-3.1,.28,.85,.3);
  add(orbit,box,cyan,x,.85,-2.93,.075,.56,.025);
 }
 const gate=geo(new THREE.TorusGeometry(.825,.13,6,24,Math.PI));
 add(orbit,gate,gold,-2.725,1.4,-3.1,1,1,1);
 for(let i=0;i<3;i++)add(orbit,box,eventLight,-3.1+i*.37,1.6,-2.99,.16,.1,.035);
 // Rear services and paired solar wings read as a station, not loose blocks.
 add(orbit,box,dark,.6,-.45,-3.65,3.4,.28,.72);
 for(const x of[-.45,.6,1.65]){
  add(orbit,cylinder,white,x,-.12,-3.65,.3,.45,.3);
  add(orbit,cylinder,pink,x,.12,-3.65,.31,.05,.31);
 }
 for(const x of[2.5,3.65]){
  add(orbit,box,white,x,-.12,-3.7,.06,.7,.06);
  add(orbit,box,blue,x,.25,-3.7,1.0,.065,1.45,0,0,.13);
  for(let i=0;i<4;i++)add(orbit,box,cyan,x-.36+i*.24,.3,-3.7,.012,.008,1.36,0,0,.13);
 }
 // The planet is a real round silhouette with raised coastal landforms and
 // a pale polar cap. It is static, behind the station, inside the menu envelope.
 const planet=new THREE.Group();planet.name="showcase-planet";planet.position.set(-1.5,2.45,-4.2);orbit.add(planet);
 add(planet,sphere,blue,0,0,0,1.45,1.45,1.45);
 const land=material(0x73baa9);
 for(const [lat,lon,sx,sy] of [[.25,.7,.42,.65],[-.35,1.0,.29,.38],[.5,-.55,.5,.32],[-.4,-.6,.28,.55]]){
  const r=1.43,x=Math.cos(lat)*Math.sin(lon)*r,y=Math.sin(lat)*r,z=Math.cos(lat)*Math.cos(lon)*r;
  add(planet,sphere,land,x,y,z,sx,sy,.1,-lat,lon);
 }
 // Share the land batch for the pale cap instead of adding another draw.
 add(planet,sphere,land,0,1.36,0,.48,.12,.48);
 const atmosphere=new THREE.MeshBasicMaterial({color:0x79d8ff,side:THREE.BackSide});materials.add(atmosphere);
 add(planet,sphere,atmosphere,0,0,0,1.485,1.485,1.485);
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
  // Brief warm competition signal as the arm approaches; no flashing or lights.
  eventLight.emissiveIntensity=isReduced?.28:.28+.24*Math.exp(-Math.pow((pose.local-4)/.8,2));
  // Canonical soles are .29 below the root; no root bob or lateral foot slide.
  astronaut.group.position.set(pose.x,.232+pose.y,pose.z);astronaut.group.rotation.y=pose.yaw;
  const input=motion.input;input.dt=isReduced?0:dt;input.timeSeconds=isReduced?1:time;input.forwardSpeed=0;input.grounded=pose.y===0;input.verticalSpeed=pose.verticalSpeed;input.turnRate=0;motion.update();
 };
 update(0);
 return {root,update,get currentMotif(){return PR_SHOWCASE_MOTIFS[0];},dispose(){if(disposed)return;disposed=true;root.removeFromParent();root.clear();for(const instance of instances)instance.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();instances.clear();geometries.clear();materials.clear();}};
}
