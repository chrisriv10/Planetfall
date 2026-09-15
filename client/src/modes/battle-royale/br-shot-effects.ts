import * as THREE from "three";
import type { BrWeaponId, Vec3 } from "@planetfall/shared";
import { brWeaponAccent } from "./br-weapons";

const SHOT_STYLE: Record<Exclude<BrWeaponId,"energy-saber">,{width:number;length:number;life:number;trace:number}> = {
  "pulse-rifle":{width:.1,length:.46,life:85,trace:55},
  "nova-smg":{width:.075,length:.3,life:65,trace:45},
  "photon-shotgun":{width:.3,length:.55,life:105,trace:65},
  "rail-laser":{width:.065,length:1.65,life:130,trace:125},
  "plasma-launcher":{width:.32,length:.5,life:130,trace:0},
  "arc-blaster":{width:.18,length:.55,life:95,trace:70}
};
type Slot = {
  flash:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  tracer:THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>;
  started:number; life:number; trace:number; width:number; length:number;
};

/** Bounded presentation only. No lights, timers, per-shot geometry or damage. */
export class BrShotEffects {
  readonly root=new THREE.Group();
  private readonly geometry=new THREE.IcosahedronGeometry(1,0);
  private readonly slots:Slot[]=[];
  private readonly direction=new THREE.Vector3();
  private readonly forward=new THREE.Vector3(0,0,1);
  private cursor=0;
  private disposed=false;

  constructor(capacity=32) {
    this.root.name="br-shot-effects";
    for(let i=0;i<capacity;i++) {
      const flash=new THREE.Mesh(this.geometry,new THREE.MeshBasicMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(6),3).setUsage(THREE.DynamicDrawUsage));
      const tracer=new THREE.Line(geometry,new THREE.LineBasicMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
      flash.visible=tracer.visible=false;
      this.root.add(flash,tracer);
      this.slots.push({flash,tracer,started:0,life:0,trace:0,width:0,length:0});
    }
  }

  fire(id:BrWeaponId,origin:Vec3,direction:Vec3,traceLength:number|null,now:number):void {
    if(this.disposed||id==="energy-saber"||this.slots.length===0)return;
    if(![origin.x,origin.y,origin.z,direction.x,direction.y,direction.z,now].every(Number.isFinite))return;
    this.direction.set(direction.x,direction.y,direction.z);
    if(this.direction.lengthSq()<1e-10)return;
    this.direction.normalize();
    const slot=this.slots[this.cursor];this.cursor=(this.cursor+1)%this.slots.length;
    const style=SHOT_STYLE[id];
    slot.started=now;slot.life=style.life;slot.trace=style.trace;slot.width=style.width;slot.length=style.length;
    const color=brWeaponAccent(id);
    slot.flash.material.color.setHex(color);slot.flash.material.opacity=.9;
    slot.flash.position.set(origin.x,origin.y,origin.z).addScaledVector(this.direction,style.length*.35);
    slot.flash.quaternion.setFromUnitVectors(this.forward,this.direction);
    slot.flash.scale.set(style.width,style.width,style.length*.5);slot.flash.visible=true;
    slot.tracer.visible=traceLength!==null&&Number.isFinite(traceLength)&&traceLength>0&&style.trace>0;
    if(slot.tracer.visible) {
      const attribute=slot.tracer.geometry.getAttribute("position") as THREE.BufferAttribute;
      attribute.setXYZ(0,origin.x,origin.y,origin.z);
      attribute.setXYZ(1,origin.x+this.direction.x*traceLength!,origin.y+this.direction.y*traceLength!,origin.z+this.direction.z*traceLength!);
      attribute.needsUpdate=true;slot.tracer.geometry.computeBoundingSphere();
      slot.tracer.material.color.setHex(color);slot.tracer.material.opacity=id==="rail-laser"?.9:.6;
    }
  }

  update(now:number):void {
    for(const slot of this.slots) {
      const age=Math.max(0,now-slot.started);
      if(slot.flash.visible){
        const progress=Math.min(1,age/slot.life);
        slot.flash.visible=age<slot.life;
        slot.flash.material.opacity=.9*(1-progress);
        const spread=1+progress*.5;
        slot.flash.scale.set(slot.width*spread,slot.width*spread,slot.length*.5*(1-progress*.4));
      }
      if(slot.tracer.visible)slot.tracer.visible=age<slot.trace;
    }
  }

  clear():void { for(const slot of this.slots)slot.flash.visible=slot.tracer.visible=false;this.cursor=0; }
  dispose():void {
    if(this.disposed)return;this.clear();this.root.removeFromParent();
    this.geometry.dispose();
    for(const slot of this.slots){slot.flash.material.dispose();slot.tracer.geometry.dispose();slot.tracer.material.dispose();}
    this.root.clear();this.disposed=true;
  }
}
