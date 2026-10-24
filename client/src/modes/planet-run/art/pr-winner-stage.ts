import * as THREE from 'three';
import {SHOP_CATALOG,type PrSnapshotPlayer} from '@planetfall/shared';
import {createAstronautVisual,type AstronautVisual} from '../../../astronaut';
import {applyCosmeticEmotePose,applyCosmeticVictoryPose} from '../../../cosmetic-pose';

/** Existing renderer/lighting only. Frame the group at target (0,.8,0), camera
 * (0,1.4,7), ~32deg vertical FOV. Parent can offset camera framing for the UI. */
export function createPrWinnerStage(){
 const root=new THREE.Group();root.name='pr-winner-podium';root.visible=false;
 const podium=new THREE.Group(),pilot=new THREE.Group();root.add(podium,pilot);
 const dark=new THREE.MeshStandardMaterial({color:0x233451,roughness:.5,metalness:.3}),white=new THREE.MeshStandardMaterial({color:0xecf2fa,roughness:.45}),gold=new THREE.MeshStandardMaterial({color:0xffd682,emissive:0xffb84d,emissiveIntensity:.3}),accent=new THREE.MeshStandardMaterial({color:0x9fffe0,emissive:0x9fffe0,emissiveIntensity:.55});
 const base=new THREE.Mesh(new THREE.CylinderGeometry(1.65,1.9,.35,24),dark);base.position.y=-.42;podium.add(base);
 const plate=new THREE.Mesh(new THREE.CylinderGeometry(1.57,1.57,.06,24),white);plate.position.y=-.22;podium.add(plate);
 const trim=new THREE.Mesh(new THREE.TorusGeometry(1.63,.045,6,36),accent);trim.rotation.x=Math.PI/2;trim.position.y=-.24;podium.add(trim);
 const halo=new THREE.Mesh(new THREE.TorusGeometry(1.5,.028,5,48),gold);halo.position.set(0,1,-.8);podium.add(halo);
 const leaves=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.34,.055),gold,12),dummy=new THREE.Object3D();
 for(let i=0;i<12;i++){const side=i<6?-1:1,a=(i%6)*.19+.15;dummy.position.set(side*Math.cos(a)*1.7,1+Math.sin(a)*1.7,-.8);dummy.rotation.z=side*(-.45-a);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);}podium.add(leaves);
 let astronaut:AstronautVisual|undefined,player:PrSnapshotPlayer|null=null,key='',disposed=false;
 const release=(group:THREE.Group)=>{const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();group.traverse(n=>{if(n instanceof THREE.Mesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);if(n instanceof THREE.InstancedMesh)n.dispose();}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();};
 const update=(elapsedMs:number,reducedMotion=false)=>{if(disposed||!root.visible||!astronaut||!player)return;const t=reducedMotion?900:elapsedMs;
  for(const limb of [astronaut.leftArm,astronaut.rightArm,astronaut.leftLeg,astronaut.rightLeg])limb.rotation.set(0,0,0);
  astronaut.torso.position.y=.72;astronaut.torso.rotation.set(0,0,0);astronaut.group.rotation.set(0,-.18,0);
  applyCosmeticEmotePose(astronaut,'celebrate',t);astronaut.group.rotation.y+=applyCosmeticVictoryPose(astronaut,player.equippedCosmetics.victory,t/1000);
 };
 return {root,setWinner(next:PrSnapshotPlayer|null){if(disposed)return;const nextKey=next?JSON.stringify([next.id,next.color,next.isBot,next.equippedCosmetics]):'';player=next;root.visible=!!next;if(nextKey===key)return;key=nextKey;release(pilot);astronaut=undefined;
   if(next){const suit=SHOP_CATALOG.find(i=>i.category==='suit'&&i.id===next.equippedCosmetics.suit)?.color??next.color;astronaut=createAstronautVisual({identityColor:next.color,suitAccent:suit,isBot:next.isBot});pilot.add(astronaut.group);accent.color.set(next.color);accent.emissive.set(next.color);update(0);}
  },update,dispose(){if(disposed)return;disposed=true;release(pilot);release(podium);root.clear();root.removeFromParent();astronaut=undefined;player=null;}};
}
