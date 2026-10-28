import {createPgMuzzleArt} from "./pg-muzzle-art";
import * as THREE from "three";
import {PG_MAP,type PgShot,type PgWeaponId} from "@planetfall/shared";

const COLORS:Record<PgWeaponId,number>={pulse:0x73ffe1,nova:0xffd276,photon:0xffa075,quasar:0xb8adff,rail:0x8ae8ff,comet:0xffbd91,helix:0xffdb94,arc:0x77bfff,prism:0xd4a1ff,orbit:0xa4f4df};
const CAPACITY=32;
/** Fixed-size presentation pool. Times are milliseconds on the caller's clock. */
export class PgEffects {
  readonly root=new THREE.Group();
  readonly muzzleRoot=new THREE.Group();
  private readonly slots:{line:THREE.Line;positions:THREE.BufferAttribute;impact:THREE.Mesh;flash:THREE.Mesh;start:number;impactSize:number;beam:boolean;active:boolean}[]=[];
  private readonly lines=new Map<PgWeaponId,THREE.LineBasicMaterial>();
  private readonly sparks=new Map<PgWeaponId,THREE.MeshBasicMaterial>();
  private readonly impactGeometry=new THREE.OctahedronGeometry(1,0);
  private cursor=0;private predictedMuzzleAt=-Infinity;private predictedMuzzleWeapon:PgWeaponId="pulse";
  private readonly localMuzzle=createPgMuzzleArt();

  private disposed=false;
  constructor(){
    this.root.name="planet-gun-shot-effects";
    for(const weapon of Object.keys(COLORS) as PgWeaponId[]){
      this.lines.set(weapon,new THREE.LineBasicMaterial({color:COLORS[weapon],transparent:true,opacity:.75,depthWrite:false}));
      this.sparks.set(weapon,new THREE.MeshBasicMaterial({color:COLORS[weapon],transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));
    }
    this.muzzleRoot.name="planet-gun-local-muzzle";this.muzzleRoot.add(this.localMuzzle.root);
    for(let i=0;i<CAPACITY;i++){
      const positions=new THREE.BufferAttribute(new Float32Array(6),3);positions.setUsage(THREE.DynamicDrawUsage);
      const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",positions);
      const line=new THREE.Line(geometry,this.lines.get("pulse")),impact=new THREE.Mesh(this.impactGeometry,this.sparks.get("pulse")),flash=new THREE.Mesh(this.impactGeometry,this.sparks.get("pulse"));
      line.frustumCulled=false;line.visible=impact.visible=flash.visible=false;
      for(const o of[line,impact,flash]){o.userData.cameraCollision=false;this.root.add(o);}
      this.slots.push({line,positions,impact,flash,start:0,impactSize:.1,beam:false,active:false});
    }
  }
  localFire(weapon:PgWeaponId,time:number):void{if(this.disposed)return;this.predictedMuzzleAt=time;this.predictedMuzzleWeapon=weapon;this.localMuzzle.fire(weapon,time);}
  shot(shot:PgShot,local:boolean,time:number):void{
    if(this.disposed||!Number.isFinite(time))return;
    const {origin:a,end:b}=shot;
    if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||!Number.isFinite(a.z)||!Number.isFinite(b.x)||!Number.isFinite(b.y)||!Number.isFinite(b.z)||Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)>200)return;
    const slot=this.slots[this.cursor];this.cursor=(this.cursor+1)%CAPACITY;
    if(local&&(this.predictedMuzzleWeapon!==shot.weapon||time-this.predictedMuzzleAt>350))this.localMuzzle.fire(shot.weapon,time);
    slot.start=time;slot.active=true;slot.beam=shot.weapon==="prism";
    // Truncate the near end so local eye-origin traces never cover the reticle.
    const distance=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),fraction=local?Math.min(1,.9/Math.max(.001,distance)):0;
    slot.positions.setXYZ(0,a.x+(b.x-a.x)*fraction,a.y+(b.y-a.y)*fraction,a.z+(b.z-a.z)*fraction);
    slot.positions.setXYZ(1,b.x,b.y,b.z);slot.positions.needsUpdate=true;slot.line.material=this.lines.get(shot.weapon)!;slot.line.visible=distance>.02;
    slot.impact.material=this.sparks.get(shot.weapon)!;slot.impact.position.set(b.x,b.y,b.z);slot.impactSize=shot.damage>0?.12:.07;slot.impact.scale.setScalar(slot.impactSize);
    slot.impact.visible=shot.damage>0||PG_MAP.solids.some(s=>Math.abs(b.x-s.center.x)<=s.half.x+.025&&Math.abs(b.y-s.center.y)<=s.half.y+.025&&Math.abs(b.z-s.center.z)<=s.half.z+.025);
    slot.flash.material=this.sparks.get(shot.weapon)!;slot.flash.position.set(a.x,a.y,a.z);slot.flash.scale.set(.045,.045,.11);slot.flash.visible=!local;
  }
  stats():{active:number;capacity:number}{let active=0;for(const slot of this.slots)if(slot.active)active++;return {active,capacity:CAPACITY};}
  update(time:number):void{
    if(this.disposed)return;
    this.localMuzzle.update(time);
    for(const slot of this.slots){
      if(!slot.active)continue;
      const age=Math.max(0,time-slot.start);
      if(age>=(slot.beam?100:65))slot.line.visible=false;
      if(age>=28)slot.flash.visible=false;
      if(age>=130){slot.impact.visible=false;slot.active=false;}
      else if(slot.impact.visible)slot.impact.scale.setScalar(slot.impactSize*(1-age/130));
    }
  }
  dispose():void{if(this.disposed)return;this.disposed=true;this.localMuzzle.dispose();for(const slot of this.slots)slot.line.geometry.dispose();this.impactGeometry.dispose();for(const m of this.lines.values())m.dispose();for(const m of this.sparks.values())m.dispose();this.slots.length=0;this.root.clear();this.root.removeFromParent();this.muzzleRoot.clear();this.muzzleRoot.removeFromParent();}
}
