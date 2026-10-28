import * as THREE from "three";
import type {PgModuleId,PgWeaponId} from "@planetfall/shared";
import {PG_RELOAD_PROFILES} from "./pg-reload-art";
import type {PgWeaponArtResources} from "./pg-weapon-presentation";

/** Cosmetic sockets only. Cells remain children of the animated reload hardware. */
export function createPgModuleArt(model:THREE.Group,weapon:PgWeaponId,r:PgWeaponArtResources){
 const root=new THREE.Group();root.name="pg-module-sockets";model.add(root);
 const groups=new Map<PgModuleId,THREE.Group>(),owned:THREE.BufferGeometry[]=[];
 const lens=r.ownMaterial(new THREE.MeshStandardMaterial({color:0x72e8ff,emissive:0x319cce,emissiveIntensity:.35,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}));
 const ceramic=r.ownMaterial(new THREE.MeshStandardMaterial({color:0xd2dce5,metalness:.35,roughness:.36}));
 const hot=r.ownMaterial(new THREE.MeshStandardMaterial({color:0xffc66b,emissive:0xff9a39,emissiveIntensity:.4,roughness:.4}));
 const box=(g:THREE.Group,name:string,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const o=new THREE.Mesh(r.bevel??r.box,m);o.name=name;o.position.set(x,y,z);o.scale.set(w,h,d);g.add(o);return o;};
 const make=(id:PgModuleId,parent:THREE.Object3D=root)=>{const g=new THREE.Group();g.name=`pg-module-${id}`;g.visible=false;parent.add(g);groups.set(id,g);return g;};
 const sight=({pulse:.35,nova:.30,photon:.215,quasar:.30,rail:.37,comet:.265,helix:.23,arc:.35,prism:.35,orbit:.22})[weapon];
 const reflex=make("reflex-array");
 for(const side of[-1,1])box(reflex,"reflex-open-post",ceramic,side*.10,sight,-.36,.025,.16,.065);
 box(reflex,"reflex-open-bridge",ceramic,0,sight+.09,-.36,.22,.025,.065);
 box(reflex,"reflex-emitter",hot,0,sight-.075,-.36,.04,.015,.035);
 const precision=make("precision-lens");
 const tube=new THREE.CylinderGeometry(.108,.108,.38,20,1,true);owned.push(tube);
 const shell=r.ownMaterial(r.composite.clone());shell.side=THREE.DoubleSide;
 const optic=new THREE.Mesh(tube,shell);optic.name="precision-open-tube";optic.rotation.x=Math.PI/2;optic.position.set(0,sight,-.42);precision.add(optic);
 const ring=new THREE.RingGeometry(.095,.113,20);owned.push(ring);
 for(const z of[-.61,-.23]){const rim=new THREE.Mesh(ring,ceramic);rim.position.set(0,sight,z);precision.add(rim);}
 const glassGeo=new THREE.CircleGeometry(.094,20);owned.push(glassGeo);
 const glass=new THREE.Mesh(glassGeo,lens);glass.position.set(0,sight,-.60);precision.add(glass);
 for(const side of[-1,1])box(precision,"precision-mount",r.metal,side*.075,sight-.12,-.42,.025,.10,.09);
 const gyro=make("gyro-stabilizer");
 for(const side of[-1,1]){box(gyro,"gyro-outrigger",r.metal,side*.25,-.10,-.66,.09,.09,.32);box(gyro,"gyro-inertial-weight",ceramic,side*.25,-.10,-.73,.13,.14,.12);box(gyro,"gyro-status",hot,side*.318,-.10,-.73,.008,.05,.05);}
 const cell=model.getObjectByName(`pg-${weapon}-power-cell`),expanded=make("expanded-cell",cell??root),rapid=make("rapid-charge-cell",cell??root);
 const profile=PG_RELOAD_PROFILES[weapon],w=profile.width,d=profile.depth,bottom=-profile.height*.5;
 if(!cell){expanded.position.set(profile.cellX,profile.cellY,profile.cellZ);rapid.position.copy(expanded.position);}
 box(expanded,"expanded-cell-extension",r.composite,0,bottom-.075,0,w*1.18,.18,d*1.06);
 box(expanded,"expanded-cell-bumper",ceramic,0,bottom-.18,0,w*1.25,.045,d*1.10);
 for(const side of[-1,1])box(expanded,"expanded-cell-bus",hot,side*w*.60,bottom-.075,0,.012,.12,d*.65);
 box(rapid,"rapid-charge-collar",ceramic,0,bottom+.025,0,w*1.20,.10,d*1.10);
 for(let i=0;i<3;i++)box(rapid,"rapid-charge-fin",hot,0,bottom-.01+i*.035,d*.57,w*1.13,.014,.04);
 const light=make("lightweight-frame");
 const sideX=({pulse:.18,nova:.23,photon:.27,quasar:.16,rail:.15,comet:.20,helix:.17,arc:.20,prism:.22,orbit:.15})[weapon];
 for(const side of[-1,1]){for(const y of[-.08,.06])box(light,"lightweight-open-brace",ceramic,side*sideX,y,-.48,.025,.025,.48);for(const z of[-.68,-.28])box(light,"lightweight-frame-joint",hot,side*sideX,-.01,z,.035,.15,.035);}
 // Inherit the host's render layer even when installed after viewmodel setup.
 for(const g of groups.values())g.traverse(o=>{o.layers.mask=model.layers.mask;o.userData.cameraCollision=false;});
 root.layers.mask=model.layers.mask;
 const originalOptics:THREE.Object3D[]=[];
 model.traverse(o=>{if(o!==root&&!isWithin(o,root)&&(/^(pulse-optic|rail-scope|quasar-optic|quasar-lens|helix-reflex|local-energy-reflex|pg-optic|optic-mount)/.test(o.name)))originalOptics.push(o);});
 const visibility=originalOptics.map(o=>o.visible);
 let disposed=false;
 return{setModules(modules:readonly PgModuleId[]=[]){if(disposed)return;for(const[id,g]of groups)g.visible=modules.includes(id);const optic=modules.includes("reflex-array")||modules.includes("precision-lens");originalOptics.forEach((o,i)=>o.visible=optic?false:visibility[i]);},dispose(){if(disposed)return;disposed=true;originalOptics.forEach((o,i)=>o.visible=visibility[i]);for(const g of groups.values())g.removeFromParent();root.removeFromParent();owned.forEach(g=>g.dispose());}};
}
function isWithin(o:THREE.Object3D,parent:THREE.Object3D):boolean{for(let p=o.parent;p;p=p.parent)if(p===parent)return true;return false;}
