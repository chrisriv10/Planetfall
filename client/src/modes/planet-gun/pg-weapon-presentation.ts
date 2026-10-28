import * as THREE from "three";
import {PG_RELOAD_PROFILES,type PgPresentationWeapon,type PgReloadSample} from "./pg-reload-art";

/** Local weapon scale only; integration must use the resulting scale for sights and wrists. */
export const PG_WEAPON_PRESENCE:Record<PgPresentationWeapon,number>={pulse:1.15,nova:1.18,photon:1.12,quasar:1.15,rail:1.12,comet:1.14,helix:1.15,arc:1.14,prism:1.14,orbit:1.18};

export interface PgWeaponArtResources {
 box:THREE.BufferGeometry;metal:THREE.Material;composite:THREE.Material;grip:THREE.Material;
 bevel?:THREE.BufferGeometry;
 sculpted?:THREE.BufferGeometry;
 ownMaterial<T extends THREE.Material>(material:T):T;
}
/** Shared unit housing: clipped corners and tapered end shoulders, 60 triangles. */
export function createPgBeveledHousingGeometry():THREE.BufferGeometry{
 const outline=[[-.36,-.5],[.36,-.5],[.5,-.36],[.5,.36],[.36,.5],[-.36,.5],[-.5,.36],[-.5,-.36]],vertices:number[]=[],indices:number[]=[];
 for(const [z,scale]of[[-.5,.82],[-.38,1],[.38,1],[.5,.82]])for(const[x,y]of outline)vertices.push(x*scale,y*scale,z);
 for(let ring=0;ring<3;ring++)for(let i=0;i<8;i++){const a=ring*8+i,b=ring*8+(i+1)%8,c=b+8,d=a+8;indices.push(a,b,d,b,c,d);}
 for(let i=1;i<7;i++){indices.push(0,i+1,i);indices.push(24,24+i,25+i);}
 const indexed=new THREE.BufferGeometry();indexed.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));indexed.setIndex(indices);
 const geometry=indexed.toNonIndexed();indexed.dispose();geometry.computeVertexNormals();return geometry;
}
/** A full front shoulder flows into a narrow, dropped rear face, rather than
 * putting a large perpendicular plate nearest the eye. Shared by local stocks.
 */
export function createPgSculptedHousingGeometry():THREE.BufferGeometry{
 const outline=[[-.36,-.5],[.36,-.5],[.5,-.36],[.5,.36],[.36,.5],[-.36,.5],[-.5,.36],[-.5,-.36]],vertices:number[]=[],indices:number[]=[];
 for(const [z,w,h,drop]of[[-.5,.82,.82,0],[-.36,1,1,0],[.16,1,.9,-.025],[.5,.48,.64,-.10]])for(const[x,y]of outline)vertices.push(x*w,y*h+drop,z);
 for(let ring=0;ring<3;ring++)for(let i=0;i<8;i++){const a=ring*8+i,b=ring*8+(i+1)%8;indices.push(a,b,a+8,b,b+8,a+8);}
 for(let i=1;i<7;i++)indices.push(0,i+1,i,24,24+i,25+i);
 const indexed=new THREE.BufferGeometry();indexed.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));indexed.setIndex(indices);
 const geometry=indexed.toNonIndexed();indexed.dispose();geometry.computeVertexNormals();return geometry;
}
function part(parent:THREE.Object3D,r:PgWeaponArtResources,name:string,material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number){
 const mesh=new THREE.Mesh(r.box,material);mesh.name=name;mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;
}
/** Original compact sidearm; no copied heavy Comet cylinder or broad slide. */
export function createPgOrbitModel(r:PgWeaponArtResources):THREE.Group{
 const model=new THREE.Group();model.name="br-weapon-orbit-sidearm";model.userData.muzzle=new THREE.Vector3(0,.02,-.73);
 part(model,r,"orbit-composite-frame",r.composite,0,-.015,-.26,.22,.18,.49);
 const slide=part(model,r,"orbit-light-slide",r.metal,0,.065,-.32,.19,.10,.50);slide.geometry=r.bevel??r.box;
 const grip=part(model,r,"orbit-angled-grip",r.grip,0,-.235,-.10,.15,.33,.18);grip.rotation.x=-.15;
 part(model,r,"orbit-barrel",r.composite,0,.02,-.62,.12,.12,.20);
 part(model,r,"orbit-front-sight",r.metal,0,.16,-.54,.035,.065,.04);
 for(const side of[-1,1]){
  part(model,r,"orbit-rear-sight",r.metal,side*.055,.16,-.10,.025,.065,.045);
  for(let i=0;i<3;i++)part(model,r,"orbit-slide-serration",r.composite,side*.097,.06,-.14-i*.045,.008,.065,.012);
 }
 return model;
}
function refineLocalRearHousing(model:THREE.Group,weapon:PgPresentationWeapon,r:PgWeaponArtResources){
 if(!r.bevel)return;
 const sculpted=r.sculpted??r.bevel;
 const finish=r.ownMaterial(new THREE.MeshStandardMaterial({color:0x415668,roughness:.67,metalness:.24}));
 // Assign new owned geometry to this instance only. The borrowed canonical
 // buffers and model transforms stay intact, including moving pump/slide nodes.
 for(const o of model.children){
  if(!(o instanceof THREE.Mesh)||!(o.geometry instanceof THREE.BoxGeometry))continue;
  const p=o.geometry.parameters;
  if(o.position.x===0&&o.position.z<0&&o.position.y>=-.14&&o.position.y<.15&&p.width>=.2&&p.depth>.3){
   o.geometry=o.name==="comet-slide"?sculpted:r.bevel;o.scale.multiply(new THREE.Vector3(p.width,p.height,p.depth));
   if(o.name==="comet-slide"||o.name==="shotgun-pump"||o.name==="prism-receiver")o.material=finish;
  }
 }
 if(weapon==="orbit"){
  const frame=model.getObjectByName("orbit-composite-frame")as THREE.Mesh;frame.geometry=r.bevel;
  const slide=model.getObjectByName("orbit-light-slide")as THREE.Mesh;slide.geometry=sculpted;slide.material=finish;
  part(model,r,"orbit-rear-striker-inset",r.composite,0,.065,-.064,.105,.042,.014);
  part(model,r,"orbit-slide-top-inlay",r.composite,0,.119,-.30,.09,.008,.26);
  return;
 }
 if(weapon==="comet"){
  // Inset striker, below the unchanged front sight. It travels with the slide.
  const slide=model.getObjectByName("comet-slide")as THREE.Mesh;
  if(slide){const inset=part(model,r,"comet-striker-inset",r.grip,0,.018,-.001,.105,.065,.015);inset.geometry=r.bevel;
   slide.attach(inset);}
  return;
 }
 if(weapon==="nova"||weapon==="quasar"){
  // Preserve their open stock/strut identities; shape the pad instead of
  // filling the negative space with a solid rifle stock.
  const pad=weapon==="nova"?model.getObjectByName("smg-stock-pad"):model.children.find(o=>o instanceof THREE.Mesh&&o.position.z===.57&&o.position.x===0);
  if(pad instanceof THREE.Mesh&&pad.geometry instanceof THREE.BoxGeometry){const p=pad.geometry.parameters;pad.geometry=sculpted;pad.scale.multiply(new THREE.Vector3(p.width*.72,p.height*.78,p.depth));pad.material=r.grip;pad.name=`pg-${weapon}-shaped-pad`;}
  return;
 }
 if(weapon==="rail"){
  // The viewmodel already shortens this local stock. Keep that exact extent.
  for(const o of model.children)if(o instanceof THREE.Mesh&&o.position.z>0&&o.position.x===0&&o.geometry instanceof THREE.BoxGeometry){const p=o.geometry.parameters;o.geometry=sculpted;o.scale.multiply(new THREE.Vector3(p.width,p.height,p.depth));o.material=o.name==="rail-cheek-rest"?r.grip:finish;}
  return;
 }
 const rearY=weapon==="arc"?.03:weapon==="prism"?.01:.02,rearZ=weapon==="pulse"?.15:weapon==="photon"?.18:weapon==="helix"?.2:weapon==="arc"?.16:.18;
 for(const o of model.children)if(o instanceof THREE.Mesh&&Math.abs(o.position.y-rearY)<1e-6&&Math.abs(o.position.z-rearZ)<1e-6&&o.position.x===0)o.visible=false;
 const width=weapon==="photon"?.24:weapon==="pulse"?.20:weapon==="prism"?.21:.17;
 const length=weapon==="photon"?.49:weapon==="pulse"?.36:weapon==="helix"?.28:weapon==="arc"?.25:.22;
 const center=weapon==="photon"?.16:weapon==="pulse"?.14:.12,back=center+length*.5;
 const core=part(model,r,`pg-${weapon}-stock-core`,finish,0,-.025,center,width,.135,length);core.geometry=sculpted;
 const mount=part(model,r,"stock-receiver-collar",r.composite,0,-.025,center-length*.5,width*1.08,.15,.055);mount.geometry=r.bevel;
 const pad=part(model,r,"stock-recoil-pad",r.grip,0,-.043,back+.018,width*.60,.115,.035);pad.geometry=sculpted;
 const heel=part(model,r,"stock-pad-inset",finish,0,-.05,back+.035,width*.20,.05,.008);heel.geometry=r.bevel;
 const cheek=part(model,r,"stock-cheek-inlay",r.composite,0,.044,center-length*.15,width*.66,.021,length*.46);cheek.geometry=sculpted;cheek.rotation.x=.05;
 // A low receiver spine separates the action from its stock without adding a new sight.
 const spine=part(model,r,"receiver-action-spine",finish,0,weapon==="prism"?.157:.127,-.32,width*.6,.018,.26);spine.geometry=r.bevel;
}
/** Adds FP service hardware without modifying any shared library geometry/material. */
export function addPgWeaponPresentation(model:THREE.Group,weapon:PgPresentationWeapon,r:PgWeaponArtResources){
 const p=PG_RELOAD_PROFILES[weapon];
 refineLocalRearHousing(model,weapon,r);
 const energy=r.ownMaterial(new THREE.MeshStandardMaterial({color:p.accent,emissive:p.accent,emissiveIntensity:.16,roughness:.30,metalness:.25}));
 // Replace the old local power-cell silhouette, including its floating rarity ring.
 const old=weapon==="pulse"?[.16,-.04,-.48]:weapon==="nova"?[.2,.02,-.3]:weapon==="rail"?[0,-.04,-.72]:null;
 if(old)for(const o of model.children)if(o instanceof THREE.Mesh&&o.position.distanceToSquared(new THREE.Vector3(...old))<1e-8)o.visible=false;
 for(const o of model.children)if(o instanceof THREE.Mesh&&o.geometry instanceof THREE.TorusGeometry&&Math.abs(o.position.z+.14)<1e-6&&o.position.x===0&&o.position.y===0)o.visible=false;
 if(weapon==="quasar")for(const o of model.children)if(o instanceof THREE.Mesh&&Math.abs(o.position.y+.22)<1e-6&&Math.abs(o.position.z+.6)<1e-6)o.visible=false;
 const cell=new THREE.Group();cell.name=`pg-${weapon}-power-cell`;cell.position.set(p.cellX,p.cellY,p.cellZ);model.add(cell);
 part(cell,r,"cell-composite-shell",r.composite,0,0,0,p.width,p.height,p.depth);
 part(cell,r,"cell-metal-base",r.metal,0,-p.height*.43,0,p.width*1.08,.045,p.depth*1.05);
 part(cell,r,"cell-energy-window",energy,-p.width*.51,0,0,.008,p.height*.46,p.depth*.55);
 for(const z of[-1,1])part(cell,r,"cell-contact-band",r.metal,0,p.height*.3,z*p.depth*.37,p.width*1.02,.035,.025);
 const chamber=new THREE.Group();chamber.name=`pg-${weapon}-chamber`;chamber.position.set(p.cellX,p.cellY+p.height*.5,p.cellZ);model.add(chamber);
 part(chamber,r,"service-hatch",r.metal,-.025,.025,0,p.width+.035,.035,p.depth+.04);
 const latch=part(model,r,`pg-${weapon}-latch`,r.metal,p.cellX-p.width*.5-.01,p.cellY+.055,p.cellZ,.09,.045,.07);
 // Two purposeful layered receiver panels with inset fasteners, below all sightlines.
 const receiverSide=({pulse:.148,nova:.198,photon:.238,quasar:.128,rail:.118,comet:.168,helix:.133,arc:.158,prism:.183,orbit:.118}as const)[weapon];
 if(weapon!=="rail")for(const side of[-1,1]){
  part(model,r,"receiver-composite-panel",r.composite,side*receiverSide,-.025,-.45,.016,.095,.25);
  part(model,r,"receiver-metal-edge",r.metal,side*(receiverSide+.011),-.07,-.45,.012,.018,.26);
 }
 const carriage=part(model,r,`pg-${weapon}-recoil-carriage`,r.metal,receiverSide+.01,-.025,-.30,.035,.075,.18);
 // Manufacturing detail stays below the sightline and uses the existing shared buffers.
 const trim=r.ownMaterial(new THREE.MeshStandardMaterial({color:0x718a9c,metalness:.48,roughness:.41}));
 for(const side of[-1,1]){
  for(let i=0;i<3;i++){
   part(model,r,`${weapon}-receiver-vent`,r.grip,side*(receiverSide+.021),.014,-.38-i*.056,.009,.035,.026);
  }
  for(const z of[-.55,-.33])part(model,r,`${weapon}-captive-fastener`,trim,side*(receiverSide+.026),-.055,z,.014,.022,.022);
  part(model,r,`${weapon}-service-serial`,trim,side*(receiverSide+.023),-.025,-.52,.008,.018,.065);
 }
 const muzzle=model.userData.muzzle as THREE.Vector3|undefined;
 if(muzzle){
  const count=weapon==="prism"?3:weapon==="photon"?4:weapon==="arc"?2:weapon==="helix"?3:2;
  for(let i=0;i<count;i++){
   const angle=(i/count)*Math.PI*2,spread=weapon==="photon"?.14:weapon==="prism"?.17:.075;
   const vane=part(model,r,`${weapon}-emitter-service-vane`,trim,Math.cos(angle)*spread,muzzle.y+Math.sin(angle)*spread,muzzle.z+.16,.035,.035,.18);vane.geometry=r.bevel??r.box;
  }
 }
 // Details on the slide/pump travel with their actual mechanism, not a floating overlay.
 const moving=model.getObjectByName(weapon==="orbit"?"orbit-light-slide":weapon==="comet"?"comet-slide":"shotgun-pump");
 if(moving){for(const side of[-1,1]){const inlay=part(model,r,`${weapon}-action-inlay`,trim,side*(receiverSide+.027),.005,-.40,.012,.025,.12);moving.attach(inlay);}}
 const slide=model.getObjectByName(weapon==="orbit"?"orbit-light-slide":weapon==="comet"?"comet-slide":"shotgun-pump");
 const slideZ=slide?.position.z??0,latchZ=latch.position.z;
 return{cell,chamber,latch,update(sample:PgReloadSample,recoil:number){
  cell.position.set(sample.cellX,sample.cellY,sample.cellZ);cell.rotation.z=sample.cellRoll;
  chamber.rotation.z=-sample.open*p.open;
  latch.position.z=latchZ+sample.latch*.10;
  carriage.position.z=-.30+Math.max(0,Math.min(1,recoil))*.065;
  if(slide)slide.position.z=slideZ+Math.max(0,Math.min(1,recoil))*(weapon==="photon"?.045:.075);
 }};
}
