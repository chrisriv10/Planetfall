import {createPgZombieBarricadeArt} from "./pg-zombie-barricade-art";
import {createPgZombieWallBuyArt} from "./pg-zombie-wall-buy-art";
import {createPgZombieForgeArt} from "./pg-zombie-forge-art";
import {createPgZombieTonicArt} from "./pg-zombie-tonic-art";
import {createPgZombieArsenalArt} from "./pg-zombie-arsenal-art";
import type {GraphicsQuality} from "../../settings";
import {createPgSiegeCameraArt} from "./pg-siege-camera-art";
import * as THREE from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {PG_OBJECTIVES,PG_ZOMBIE_BARRICADE_SITES,PG_SIEGE_CAMERAS,PG_ZOMBIE_WALL_BUYS,PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_FORGE_SITE,PG_ZOMBIE_TONIC_SOCKETS,PG_ZOMBIE_PRICES,type PgModeSnapshot} from "@planetfall/shared";
import {createAstronautVisual} from "../../astronaut";
import type {PgInfectedKind} from "./pg-character-art";
import {createPgInfectedIdentityArt} from "./pg-infected-identity-art";
import {createPgModeDropArt} from "./pg-mode-drop-art";

export const PG_MODE_ART_LIMITS={panels:64,effects:96,zombies:32,drones:12} as const;
/** Presentation consumes current authoritative geometry. No collision or quality-dependent telegraphs. */
export function createPgModeArt(){
 const group=new THREE.Group();group.name="pg-mode-art";
 const drops=createPgModeDropArt();group.add(drops.group);
 const box=new THREE.BoxGeometry(1,1,1),ring=new THREE.RingGeometry(.94,1,48),sphere=new THREE.IcosahedronGeometry(1,2);
 ring.rotateX(-Math.PI/2);
 const panelMaterial=new THREE.MeshStandardMaterial({color:0x576888,metalness:.5,roughness:.7});
 const reinforcedMaterial=new THREE.MeshStandardMaterial({color:0xb59b65,metalness:.7,roughness:.5});
 const glow=new THREE.MeshBasicMaterial({color:0xffbf65}),droneMaterial=new THREE.MeshStandardMaterial({color:0x849bb3,metalness:.5,roughness:.4});
 const quarantineMaterial=new THREE.MeshStandardMaterial({color:0xf2ba62,emissive:0xe7993d,emissiveIntensity:.25,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,roughness:.4});
 const materials:THREE.Material[]=[quarantineMaterial,panelMaterial,reinforcedMaterial,glow,droneMaterial];
 const geometries:THREE.BufferGeometry[]=[box,ring,sphere];
 const textures:THREE.Texture[]=[];
 const securityCameras=createPgSiegeCameraArt(PG_SIEGE_CAMERAS);group.add(securityCameras.root);
 const barricades=createPgZombieBarricadeArt(PG_ZOMBIE_BARRICADE_SITES);group.add(barricades.root);
 const wallBuys=createPgZombieWallBuyArt(PG_ZOMBIE_WALL_BUYS);group.add(wallBuys.root);
 const arsenal=createPgZombieArsenalArt(PG_ZOMBIE_ARSENAL_SITE);group.add(arsenal.root);
 const forge=createPgZombieForgeArt(PG_ZOMBIE_FORGE_SITE),tonics=createPgZombieTonicArt(PG_ZOMBIE_TONIC_SOCKETS);group.add(forge.root,tonics.root);
 const panels=Array.from({length:PG_MODE_ART_LIMITS.panels},()=>{const mesh=new THREE.Mesh(box,panelMaterial),health=new THREE.Mesh(box,glow);health.name="panel-integrity";health.position.set(0,.46,0);mesh.add(health);mesh.visible=false;group.add(mesh);return mesh;});
 const effects=Array.from({length:PG_MODE_ART_LIMITS.effects},()=>{
  const material=new THREE.MeshBasicMaterial({color:0x64d7f2,transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide});materials.push(material);
  const root=new THREE.Group(),boundary=new THREE.Mesh(ring,material),volume=new THREE.Mesh(sphere,material),core=new THREE.Mesh(box,material);root.add(boundary,volume,core);root.visible=false;group.add(root);return {root,boundary,volume,core,material};
 });
 const markers=Array.from({length:8},(_,i)=>{const root=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:0x65d8f2,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide});materials.push(material);const ground=new THREE.Mesh(ring,material);root.add(ground);root.visible=false;root.name=`pg-objective-${i}`;group.add(root);return {root,ground,material};});
 const labels=markers.map(({root})=>{
  if(typeof document==="undefined")return null;
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=64;const ctx=canvas.getContext("2d");if(!ctx)return null;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
  const material=new THREE.SpriteMaterial({map:texture,depthTest:true,depthWrite:false});materials.push(material);const sprite=new THREE.Sprite(material);sprite.position.y=2.25;sprite.scale.set(2,.5,1);root.add(sprite);return {ctx,texture,text:""};
 });
 const charge=new THREE.Mesh(box,glow);charge.scale.set(.35,.25,.45);charge.name="pg-charge";charge.visible=false;group.add(charge);
 const drones=Array.from({length:PG_MODE_ART_LIMITS.drones},()=>{const mesh=new THREE.Mesh(box,droneMaterial);mesh.scale.set(.45,.2,.35);mesh.visible=false;group.add(mesh);return mesh;});
 // Five rigid parts per kind share one material. Limbs retain the canonical
 // pivot coordinates; geometry is built once, never rebuilt to animate a frame.
 type InfectedPart={mesh:THREE.InstancedMesh;position:THREE.Vector3;rotationZ:number};
 const infected=new Map<PgInfectedKind,InfectedPart[]>();
 for(const kind of ["drifter","skitter","bulwark"] as const){
  const rig=createAstronautVisual({identityColor:"#ff8d49",suitAccent:"#4a435a",isBot:false});
  // Record borrowed resources before the infected art temporarily detaches the
  // friendly visor/backpack. The decorator disposes only its own new resources.
  const oldGeometry=new Set<THREE.BufferGeometry>(),oldMaterial=new Set<THREE.Material>(),oldInstances=new Set<THREE.InstancedMesh>();
  rig.group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;oldGeometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])oldMaterial.add(m);if(o instanceof THREE.InstancedMesh)oldInstances.add(o);});
  const art=createPgInfectedIdentityArt(rig,kind);
  const anchors=[rig.group,rig.leftArm,rig.rightArm,rig.leftLeg,rig.rightLeg],partNames=["","-left-arm","-right-arm","-left-leg","-right-leg"];
  rig.group.updateMatrixWorld(true);const parts:THREE.BufferGeometry[][]=anchors.map(()=>[]),inverse=anchors.map(a=>a.matrixWorld.clone().invert()),local=new THREE.Matrix4();
  rig.group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;if(o instanceof THREE.InstancedMesh)return;
   let index=0;for(let ancestor:THREE.Object3D|null=o.parent;ancestor&&ancestor!==rig.group;ancestor=ancestor.parent){const found=anchors.indexOf(ancestor as THREE.Group);if(found>0){index=found;break;}}
   const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();local.multiplyMatrices(inverse[index],o.matrixWorld);g.applyMatrix4(local);g.deleteAttribute("uv");const material=Array.isArray(o.material)?o.material[0]:o.material,color=(material as THREE.MeshStandardMaterial).color??new THREE.Color(0x777777),values=new Float32Array(g.getAttribute("position").count*3);for(let i=0;i<values.length;i+=3){values[i]=color.r;values[i+1]=color.g;values[i+2]=color.b;}g.setAttribute("color",new THREE.BufferAttribute(values,3));parts[index].push(g);
  });
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,flatShading:true});materials.push(material);
  const batches=parts.map((pieces,index)=>{const geometry=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());geometries.push(geometry);const mesh=new THREE.InstancedMesh(geometry,material,32);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;mesh.name=`pg-infected-${kind}${partNames[index]}`;group.add(mesh);return {mesh,position:anchors[index].position.clone(),rotationZ:anchors[index].rotation.z};});
  infected.set(kind,batches);art.dispose();oldInstances.forEach(mesh=>mesh.dispose());oldGeometry.forEach(g=>g.dispose());oldMaterial.forEach(m=>m.dispose());
 }
 // Recycled records avoid per-frame objects and bound history even across long runs.
 const motion=Array.from({length:32},()=>({id:"",x:0,z:0,at:0,movedAt:0,speed:0,amount:0,phase:0}));
 const rootMatrix=new THREE.Matrix4(),bodyMatrix=new THREE.Matrix4(),partMatrix=new THREE.Matrix4(),pose=new THREE.Object3D();
 const windup=new THREE.InstancedMesh(ring,glow,32);windup.name="pg-infected-windup";windup.count=0;windup.frustumCulled=false;group.add(windup);
 const matrix=new THREE.Object3D(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);let disposed=false;
 const colorFor=(kind:string)=>kind==="heat"||kind==="breach"||kind==="electric"?0xff934b:kind==="gravity"||kind==="jammer"?0xb09aff:kind==="smoke"?0x8994ae:0x69d6f1;
 return {group,
  update(snapshot:PgModeSnapshot|null,_localId:string,serverTime:number,quality:GraphicsQuality="medium",reducedMotion=false,arsenalOwner:string|null=null,forgeOwner:string|null=null){
   if(disposed)return;group.visible=!!snapshot;
   arsenal.update(snapshot?.id==="planetzombies"?snapshot.arsenal:null,serverTime,arsenalOwner,quality,reducedMotion);
   const survivor=snapshot?.id==="planetzombies"?snapshot.pilots[_localId]:null,job=snapshot?.id==="planetzombies"?snapshot.forge:null;
   forge.update(snapshot?.id==="planetzombies"&&job?{phase:job.phase,weaponId:job.weaponId,ownerName:forgeOwner,tier:job.phase==="idle"?survivor?.upgrade??0:job.targetTier,startedAt:job.startedAt,completesAt:job.completesAt,price:job.phase==="idle"&&(survivor?.upgrade??3)<3?PG_ZOMBIE_PRICES.upgrade[survivor!.upgrade as 0|1|2]:null}:null,serverTime,quality,reducedMotion);
   barricades.update(snapshot?.id==="planetzombies"?snapshot.collision.panels:null);
   wallBuys.root.visible=snapshot?.id==="planetzombies";if(snapshot?.id==="planetzombies")wallBuys.update(snapshot.power,serverTime,quality,reducedMotion);
   tonics.root.visible=snapshot?.id==="planetzombies";if(snapshot?.id==="planetzombies")tonics.update(true,survivor?.perks??[],serverTime,quality,reducedMotion);
   securityCameras.update(snapshot?.id==="planetsiege"?snapshot.cameras:null);
   drops.update(snapshot?.id==="planetstrike"?snapshot.drops:null);
   for(const m of panels)m.visible=false;for(const e of effects)e.root.visible=false;for(const m of markers)m.root.visible=false;for(const m of drones)m.visible=false;charge.visible=false;for(const parts of infected.values())for(const p of parts)p.mesh.count=0;windup.count=0;
   if(snapshot?.id!=="planetzombies")for(const state of motion)state.id="";
   if(!snapshot)return;
   for(let i=0;i<Math.min(snapshot.collision.panels.length,panels.length);i++){const p=snapshot.collision.panels[i],mesh=panels[i];mesh.visible=p.active&&!p.id.startsWith("installation-")&&!barricades.ownsPanel(p.id);mesh.name=`pg-panel-${p.id}`;mesh.position.copy(p.solid.center);mesh.scale.set(p.solid.half.x*2,p.solid.half.y*2,p.solid.half.z*2);mesh.material=snapshot.id==="planetzombies"&&p.maxHp>=1000000?quarantineMaterial:p.reinforced?reinforcedMaterial:panelMaterial;mesh.children[0].visible=p.maxHp<1000000;mesh.userData.hp=p.hp;mesh.userData.maxHp=p.maxHp;const fraction=Math.max(0,Math.min(1,p.hp/Math.max(1,p.maxHp)));mesh.children[0].scale.set(p.solid.half.x>p.solid.half.z?fraction*.9:1.01,.025,p.solid.half.z>p.solid.half.x?fraction*.9:1.01);}
   let ei=0;for(const e of snapshot.effects){if(e.endsAt<=serverTime||ei>=effects.length)continue;const v=effects[ei++],warning=serverTime<e.startsAt;v.root.visible=true;v.root.name=`pg-effect-${e.kind}-${e.id}`;v.root.position.copy(e.position);v.material.color.setHex(warning?0xffc65a:colorFor(e.kind));v.material.opacity=e.kind==="smoke"?.985:warning?.35+.2*Math.sin(serverTime*.015):.52;
    v.boundary.visible=true;v.boundary.position.y=.045;v.boundary.scale.setScalar(Math.max(.2,e.radius));v.volume.visible=e.kind==="smoke";v.volume.scale.setScalar(e.radius);v.volume.position.y=e.kind==="smoke"?1:0;v.core.visible=e.maxHp>0;v.core.position.set(0,.25,0);v.core.quaternion.identity();v.core.scale.set(.35,.5,.35);v.root.userData.hp=e.hp;v.root.userData.maxHp=e.maxHp;
    if(e.kind==="trip"&&e.end){direction.set(e.end.x-e.position.x,e.end.y-e.position.y,e.end.z-e.position.z);const length=direction.length();v.boundary.visible=false;v.core.visible=true;v.core.position.copy(direction).multiplyScalar(.5);v.core.position.y+=.15;v.core.scale.set(.035,length,.035);if(length>0)v.core.quaternion.setFromUnitVectors(up,direction.normalize());}
    if(e.kind==="heal"&&e.end){direction.set(e.end.x-e.position.x,e.end.y-e.position.y,e.end.z-e.position.z);const length=direction.length();v.boundary.visible=false;v.volume.visible=false;v.core.visible=length>0;v.material.color.setHex(0x69d6f1);v.core.position.copy(direction).multiplyScalar(.5);v.core.position.y+=1;v.core.scale.set(.045,length,.045);if(length>0)v.core.quaternion.setFromUnitVectors(up,direction.normalize());}
   }
   const marker=(i:number,p:{x:number;y:number;z:number},radius:number,color:number,name:string)=>{const m=markers[i];m.root.visible=true;m.root.position.set(p.x,p.y+.04,p.z);m.ground.scale.setScalar(radius);m.material.color.setHex(color);m.root.name=`pg-objective-${name}`;const label=labels[i];if(label&&label.text!==name){label.text=name;label.ctx.clearRect(0,0,256,64);label.ctx.fillStyle="#111b36";label.ctx.fillRect(0,0,256,64);label.ctx.fillStyle="#d5edff";label.ctx.font="bold 25px sans-serif";label.ctx.textAlign="center";label.ctx.textBaseline="middle";label.ctx.fillText(name.replace("rack-","").toUpperCase(),128,32);label.texture.needsUpdate=true;}};
   if(snapshot.id==="planetstrike"){PG_OBJECTIVES.strike.forEach((p,i)=>marker(i,p.position,p.radius,0xffc265,p.id));if(snapshot.charge.position){charge.visible=true;charge.position.copy(snapshot.charge.position);charge.position.y+=.18;}}
   if(snapshot.id==="planetwatch"){const p=PG_OBJECTIVES.relay[snapshot.control.point%3];marker(0,p.position,p.radius,snapshot.control.contested?0xff6d55:snapshot.control.owner==="solar"?0xffb45c:0x5ae1f0,"relay");}
   if(snapshot.id==="planetsiege"){const p=PG_OBJECTIVES.uplink[snapshot.site%2];marker(0,p.position,p.radius,0x65d8f2,"uplink");snapshot.drones.slice(0,drones.length).forEach((d,i)=>{drones[i].visible=d.hp>0;drones[i].position.copy(d.position);drones[i].rotation.y=d.yaw;});}
   if(snapshot.id==="planetzombies"){
    marker(0,PG_OBJECTIVES.power,.65,snapshot.power?0x65d8f2:0xffbf65,"power");marker(1,PG_ZOMBIE_FORGE_SITE.interaction,.8,0x65d8f2,"overcharge forge");
    const count=Math.min(32,snapshot.zombies.length);
    for(const state of motion){if(!state.id)continue;let present=false;for(let i=0;i<count;i++)if(snapshot.zombies[i].id===state.id&&snapshot.zombies[i].hp>0){present=true;break;}if(!present)state.id="";}
    for(let i=0;i<count;i++){const z=snapshot.zombies[i],parts=infected.get(z.kind)!;if(z.hp<=0)continue;const warning=z.windupUntil>serverTime;
     let state:typeof motion[number]|undefined;for(const record of motion)if(record.id===z.id){state=record;break;}
     if(!state){for(const record of motion)if(!record.id){state=record;break;}if(!state)continue;state.id=z.id;state.x=z.position.x;state.z=z.position.z;state.at=state.movedAt=serverTime;state.speed=state.amount=0;state.phase=i*1.7;}
     const dt=Math.max(0,Math.min(.1,(serverTime-state.at)/1000)),distance=Math.hypot(z.position.x-state.x,z.position.z-state.z);
     if(distance>.001){state.speed=distance>3?0:Math.min(8,distance/Math.max(.016,(serverTime-state.movedAt)/1000));state.x=z.position.x;state.z=z.position.z;state.movedAt=serverTime;}
     if(serverTime-state.movedAt>180)state.speed=0;
     const target=warning?0:Math.min(1,state.speed/2);state.amount+=(target-state.amount)*Math.min(1,dt*12);state.phase+=dt*state.speed*(z.kind==="skitter"?3.4:z.kind==="bulwark"?2:2.7);state.at=serverTime;
     const stride=Math.sin(state.phase)*state.amount*(z.kind==="skitter"?.48:z.kind==="bulwark"?.26:.36),hunch=z.kind==="skitter"?.22:warning&&z.kind==="bulwark"?-.1:.035;
     matrix.position.set(z.position.x,z.position.y+.25,z.position.z);matrix.rotation.set(0,z.yaw+Math.PI,0);matrix.scale.setScalar(.85);matrix.updateMatrix();rootMatrix.copy(matrix.matrix);
     pose.position.set(0,.55-.55*Math.cos(hunch)+Math.abs(Math.sin(state.phase*2))*.015*state.amount,-.55*Math.sin(hunch));pose.rotation.set(hunch,0,0);pose.updateMatrix();bodyMatrix.multiplyMatrices(rootMatrix,pose.matrix);
     parts[0].mesh.setMatrixAt(parts[0].mesh.count++,bodyMatrix);
     for(let limb=1;limb<5;limb++){const part=parts[limb],arm=limb<3,side=limb===1||limb===3?-1:1;pose.position.copy(part.position);pose.rotation.set(arm?(warning?(z.kind==="bulwark"?-.95:-.65):(z.kind==="skitter"?-.3:0)-stride*side*.7):stride*side,0,part.rotationZ+(arm&&warning?side*.08:0));pose.updateMatrix();partMatrix.multiplyMatrices(arm?bodyMatrix:rootMatrix,pose.matrix);part.mesh.setMatrixAt(part.mesh.count++,partMatrix);}
     if(warning){matrix.position.set(z.position.x,z.position.y+.04,z.position.z);matrix.rotation.set(0,0,0);matrix.scale.setScalar(.65);matrix.updateMatrix();windup.setMatrixAt(windup.count++,matrix.matrix);}
    }
    for(const parts of infected.values())for(const p of parts)p.mesh.instanceMatrix.needsUpdate=true;windup.instanceMatrix.needsUpdate=true;
   }
  },
  dispose(){if(disposed)return;disposed=true;barricades.dispose();wallBuys.dispose();forge.dispose();tonics.dispose();arsenal.dispose();securityCameras.dispose();drops.dispose();group.removeFromParent();group.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());for(const parts of infected.values())for(const p of parts)p.mesh.dispose();windup.dispose();}
 };
}
