import * as THREE from "three";
import type {PgWeaponId} from "@planetfall/shared";
/** Width, length, corona count, duration: ten deliberately different emitter signatures. */
export const PG_MUZZLE_SIGNATURES:Record<PgWeaponId,readonly[number,number,number,number,number]>={
 pulse:[.035,.13,4,62,0x80eaff],nova:[.025,.075,2,42,0xffda73],photon:[.075,.11,8,80,0xff9d57],quasar:[.03,.18,3,56,0xb8a1ff],rail:[.022,.30,2,95,0x8ae8ff],comet:[.06,.16,6,90,0xffb67b],helix:[.038,.13,3,65,0xffdf7d],arc:[.055,.15,5,88,0x68baff],prism:[.028,.23,3,72,0xe8a2ff],orbit:[.023,.085,4,48,0xa7e9ff]
};
/** Cosmetic local emitter pool. Parent places root at current camera-space muzzle.
 * No shot simulation, trails, damage, new lights, or allocations during fire/update. */
export function createPgMuzzleArt(){
 const root=new THREE.Group();root.name="pg-pooled-muzzle-art";root.visible=false;
 const geometry=new THREE.OctahedronGeometry(1,0),ringGeometry=new THREE.RingGeometry(.78,1,20);
 const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
 const slots=Array.from({length:4},()=>{const group=new THREE.Group(),glow=material.clone(),core=new THREE.Mesh(geometry,material),ring=new THREE.Mesh(ringGeometry,glow),rays=Array.from({length:8},()=>new THREE.Mesh(geometry,glow));group.add(core,ring,...rays);root.add(group);group.visible=false;return{group,glow,core,ring,rays,start:-1000,duration:0,width:0,length:0,count:0};});
 root.traverse(o=>o.userData.cameraCollision=false);let cursor=0,disposed=false;
 return{root,fire(weapon:PgWeaponId,time:number){if(disposed||!Number.isFinite(time))return;root.visible=true;const s=slots[cursor];cursor=(cursor+1)%slots.length;const p=PG_MUZZLE_SIGNATURES[weapon];s.width=p[0];s.length=p[1];s.count=p[2];s.duration=p[3];s.start=time;s.glow.color.setHex(p[4]);s.group.visible=true;s.group.scale.setScalar(1);s.core.visible=true;s.group.rotation.z=cursor*.73;s.core.scale.set(p[0]*.45,p[0]*.45,p[1]);s.core.position.z=-p[1]*.7;s.ring.position.z=-p[1]*.28;s.ring.scale.setScalar(p[0]*1.15);for(let i=0;i<8;i++){const ray=s.rays[i];ray.visible=i<s.count;const a=i*Math.PI*2/s.count;ray.position.set(Math.cos(a)*p[0],Math.sin(a)*p[0],-p[1]*.4);ray.scale.set(p[0]*.32,p[0]*.32,p[1]*.65);ray.rotation.set(Math.sin(a)*.4,Math.cos(a)*.4,a);}},update(time:number){if(disposed)return;let active=false;for(const s of slots){if(!s.group.visible)continue;const t=Math.max(0,(time-s.start)/s.duration);if(t>=1){s.group.visible=false;continue;}active=true;s.glow.opacity=(1-t)*.85;s.group.scale.setScalar(1+t*.5);s.core.visible=t<.45;s.ring.scale.setScalar(s.width*(1.15+t*1.8));}root.visible=active;},dispose(){if(disposed)return;disposed=true;geometry.dispose();ringGeometry.dispose();material.dispose();for(const s of slots)s.glow.dispose();root.clear();root.removeFromParent();}};
}
