import * as THREE from "three";
import {createAstronautVisual} from "../../../astronaut";
import {createAstronautMotion} from "../../../astronaut-motion";
import {createPrShowcasePose,samplePrShowcasePose} from "./pr-showcase-timeline";

export const PR_SHOWCASE_MOTIFS=["cargo","solar","meteor","flux","capacitor","shatterdeck"] as const;
/** A standalone animated maquette. No renderer, simulation, world or lights. */
export function createPrShowcaseArt(){
 const root=new THREE.Group();root.name="planet-run-home-preview";
 const course=new THREE.Group();root.add(course);
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),instances=new Set<THREE.InstancedMesh>();
 const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};
 const box=geo(new THREE.BoxGeometry(1,1,1)),cylinder=geo(new THREE.CylinderGeometry(1,1,1,20)),sphere=geo(new THREE.IcosahedronGeometry(1,1)),torus=geo(new THREE.TorusGeometry(1,.07,6,32)),hex=geo(new THREE.CylinderGeometry(1,1,1,6));
 const material=(color:number,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.16,emissive:color,emissiveIntensity:glow});materials.add(m);return m;};
 const dark=material(0x25314c),white=material(0xe9eee5),coral=material(0xf68b69),gold=material(0xeebf48),green=material(0x80bc68),purple=material(0xad88df),blue=material(0x559dd2),mint=material(0xa5ffe4,.5);
 const groups=PR_SHOWCASE_MOTIFS.map(name=>{const g=new THREE.Group();g.name=`showcase-${name}`;course.add(g);return g;});
 const pending=new Map<string,{parent:THREE.Object3D;geo:THREE.BufferGeometry;mat:THREE.Material;transforms:THREE.Matrix4[]}>(),dummy=new THREE.Object3D();
 const add=(parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0)=>{
  const key=`${parent.uuid}:${g.uuid}:${m.uuid}`;let b=pending.get(key);if(!b){b={parent,geo:g,mat:m,transforms:[]};pending.set(key,b);}dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();b.transforms.push(dummy.matrix.clone());
 };
 const subgroup=(parent:THREE.Group,name:string)=>{const g=new THREE.Group();g.name=name;parent.add(g);return g;};
 // Freight: roller bed, oversized sorting gantry, striped suspended cargo.
 const cargo=groups[0],pod=subgroup(cargo,"miniature-loader-pod");
 add(cargo,box,dark,0,-.6,0,8.4,1,6);add(cargo,box,coral,0,-.1,0,8,.15,5.8);
 for(let i=0;i<11;i++)add(cargo,cylinder,white,(i-5)*.68,.03,0,.22,5.2,.22,Math.PI/2,0,0);
 for(const x of [-3.8,3.8])add(cargo,box,coral,x,1.8,-2.2,.5,3.8,.6);
 add(cargo,box,gold,0,3.7,-2.2,8.1,.5,.7);add(pod,box,blue,0,2.1,-2.2,1.7,1.4,1.5);add(pod,box,white,0,2.1,-1.43,1.1,.25,.05);add(pod,box,dark,0,3.05,-2.2,.12,.7,.12);
 // Solar: radial collector panels and a rotating, gold collection arm.
 const solar=groups[1],sweeper=subgroup(solar,"miniature-solar-arm");
 add(solar,cylinder,dark,0,-.5,0,4.6,.8,4.6);add(solar,cylinder,white,0,-.06,0,4.4,.06,4.4);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;add(solar,box,gold,Math.sin(a)*2.5,0,Math.cos(a)*2.5,1.3,.05,2.7,0,a,0);}
 add(solar,cylinder,purple,0,.35,0,.65,.7,.65);add(sweeper,box,gold,0,.55,0,8,.25,.65);add(sweeper,box,mint,0,.7,0,7.7,.06,.24);
 add(solar,torus,gold,0,-.1,0,4.6,4.6,4.6,Math.PI/2);
 // Meteor: botanical margins, converging target and descending miniature rock.
 const meteor=groups[2],comet=subgroup(meteor,"miniature-incoming-meteor"),target=subgroup(meteor,"miniature-meteor-target");
 add(meteor,cylinder,green,0,-.45,0,4.5,.7,4.5);add(meteor,cylinder,white,0,-.05,0,3.8,.08,3.8);
 for(let i=0;i<9;i++){const a=i*Math.PI*2/9,x=Math.sin(a)*4,z=Math.cos(a)*4;add(meteor,sphere,green,x,.25,z,.7,.9,.7);add(meteor,sphere,mint,x,.7,z,.13,.25,.13);}
 add(target,torus,coral,1.4,.03,-.8,1.1,1.1,1.1,Math.PI/2);add(comet,sphere,coral,1.4,0,-.8,.33,.4,.33);add(comet,sphere,gold,1.4,.7,-.8,.16,.65,.16);
 // Flux: actual miniature height changes and hovering garden seeds.
 const flux=groups[3],levitation=subgroup(flux,"miniature-floating-seeds");
 for(let i=0;i<3;i++){const x=(i-1)*2.65,y=i===1?.6:0;add(flux,cylinder,dark,x,y-.45,0,1.8,.7,2.6);add(flux,cylinder,i===1?purple:white,x,y-.04,0,1.75,.08,2.55);}
 add(flux,torus,mint,0,1.4,-.8,2.7,2.7,1);add(flux,torus,purple,0,1.4,-.82,2.9,2.9,1);
 for(let i=0;i<6;i++){const a=i*Math.PI/3;add(levitation,sphere,purple,Math.sin(a)*3.4,1.3+i%2,Math.cos(a)*2.3,.25,.5,.25);}
 // Capacitor: paired coils power a split shutter; charged channels lead through.
 const capacitor=groups[4],left=subgroup(capacitor,"miniature-shutter-left"),right=subgroup(capacitor,"miniature-shutter-right");
 add(capacitor,box,dark,0,-.5,0,8.5,.8,5.5);add(capacitor,box,white,0,-.05,0,8.2,.08,5.3);
 for(const x of [-3.5,3.5]){add(capacitor,cylinder,blue,x,1.15,-1.6,.55,2.5,.55);for(let j=0;j<5;j++)add(capacitor,torus,mint,x,.3+j*.43,-1.6,.75,.75,.75,Math.PI/2);}
 for(const side of [-1,1]){const g=side<0?left:right;add(g,box,blue,side*1.25,1.1,-1.6,2.45,2.2,.5);add(g,box,mint,side*.14,1.1,-1.31,.15,1.9,.05);add(capacitor,box,mint,side*1.5,.015,.4,.2,.03,3.7);}
 // Shatterdeck: shared hex geometry and material, two unmistakable floating layers.
 const shatter=groups[5],tiles=new THREE.InstancedMesh(hex,mint,38);tiles.name="miniature-collapsing-hexes";tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);tiles.frustumCulled=false;instances.add(tiles);shatter.add(tiles);
 const tilePositions:{x:number;y:number;z:number}[]=[];
 for(let deck=0;deck<2;deck++)for(let q=-2;q<=2;q++)for(let r=-2;r<=2;r++)if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=2)tilePositions.push({x:Math.sqrt(3)*.85*(q+r/2),y:-deck*1.9,z:1.5*.85*r});
 for(const y of [-.35,-2.25])add(shatter,torus,purple,0,y,0,4.6,4.6,4.6,Math.PI/2);
 for(const b of pending.values()){const mesh=new THREE.InstancedMesh(b.geo,b.mat,b.transforms.length);for(let i=0;i<b.transforms.length;i++)mesh.setMatrixAt(i,b.transforms[i]);mesh.computeBoundingSphere();b.parent.add(mesh);instances.add(mesh);}pending.clear();
 const astronaut=createAstronautVisual({identityColor:"#a5ffe4",suitAccent:"#8edbc7",isBot:false}),motion=createAstronautMotion(astronaut);astronaut.group.name="showcase-astronaut";astronaut.group.scale.setScalar(.7);course.add(astronaut.group);
 astronaut.group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)instances.add(o);}});
 const reduced=typeof matchMedia!=="undefined"?matchMedia("(prefers-reduced-motion: reduce)"):null;
 const pose=createPrShowcasePose();
 const fadeMaterials=[...materials].map(material=>({material,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite}));
 const floorHeights=[.25,.025,-.01,0,0,.1];
 let lastTime:number|null=null,disposed=false,index=0,wasReduced=false;
 const update=(timeSeconds:number)=>{
  if(disposed)return;
  const time=Number.isFinite(timeSeconds)?Math.max(0,timeSeconds):0,isReduced=reduced?.matches??false;
  samplePrShowcasePose(time,isReduced,pose);
  if(pose.motif!==index||isReduced!==wasReduced){index=pose.motif;motion.reset();}
  wasReduced=isReduced;
  for(let i=0;i<6;i++)groups[i].visible=i===index;
  const dt=lastTime===null?1/60:THREE.MathUtils.clamp(time-lastTime,0,.05);lastTime=time;
  course.rotation.y=.2;
  for(const entry of fadeMaterials){entry.material.opacity=entry.opacity*pose.opacity;entry.material.transparent=entry.transparent||pose.opacity<1;entry.material.depthWrite=entry.depthWrite&&pose.opacity>=1;}
  pod.position.x=pose.cargoX;sweeper.rotation.y=pose.sweeperYaw;
  comet.visible=pose.meteorVisible;comet.position.y=pose.meteorY;target.visible=pose.warningVisible;target.scale.setScalar(pose.warningScale);
  levitation.position.y=isReduced?0:Math.sin(pose.local*.8)*.1;levitation.rotation.y=0;
  left.position.x=-pose.gateOpen*1.15;right.position.x=pose.gateOpen*1.15;
  // Only the tile already crossed gives way; the pilot stays on the upper deck.
  if(index===5){for(let i=0;i<tilePositions.length;i++){const p=tilePositions[i],collapse=p.y===0&&p.z===0&&p.x<-.1&&p.x>-2?pose.collapse:0;dummy.position.set(p.x,p.y-collapse*.8,p.z);dummy.scale.set(.82*(1-collapse),.2*(1-collapse),.82*(1-collapse));dummy.rotation.set(0,0,0);dummy.updateMatrix();tiles.setMatrixAt(i,dummy.matrix);}tiles.instanceMatrix.needsUpdate=true;}
  // Canonical astronaut soles sit .29 below its root; scaled to .7 here.
  astronaut.group.position.set(pose.x,.203+floorHeights[index]+pose.y,pose.z);astronaut.group.rotation.y=pose.yaw;
  const input=motion.input;input.dt=isReduced?0:dt;input.timeSeconds=isReduced?2:time;input.forwardSpeed=pose.speed;input.grounded=pose.y<.01;input.verticalSpeed=pose.verticalSpeed;input.turnRate=0;motion.update();
 };
 update(0);
 return {root,update,get currentMotif(){return PR_SHOWCASE_MOTIFS[index];},dispose(){if(disposed)return;disposed=true;root.removeFromParent();root.clear();for(const instance of instances)instance.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();instances.clear();geometries.clear();materials.clear();}};
}
