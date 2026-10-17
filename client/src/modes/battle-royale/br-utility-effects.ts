import * as THREE from "three";
import type { GraphicsQuality } from "../../settings";

export interface BrUtilityField {
  readonly id:string;
  readonly kind:"nano-mist"|"pulse-scanner"|"vortex";
  /** World-space support/contact position, supplied by the authoritative effect. */
  readonly position:Readonly<{x:number;y:number;z:number}>;
  readonly radius:number;
  readonly createdAt:number;
  readonly expiresAt:number;
}
type FieldSlot={rim:THREE.Mesh<THREE.CylinderGeometry,THREE.MeshBasicMaterial>;wave:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>};
export const BR_UTILITY_FIELD_CAP=12;

/** Visuals only. Time values must share the server effect's millisecond clock.
 * Each slot has a low vertical rim and one horizontal annulus, never a filled
 * disc. Vortex warnings get priority when the bounded pool is saturated. */
export class BrUtilityEffects {
  readonly root=new THREE.Group();
  private readonly rimGeometry=new THREE.CylinderGeometry(1,1,1,48,1,true);
  private readonly waveGeometry=new THREE.RingGeometry(.94,1,48);
  private readonly slots:FieldSlot[]=[];
  private disposed=false;

  constructor(capacity=BR_UTILITY_FIELD_CAP){
    this.root.name="br-utility-effects";
    const count=Number.isFinite(capacity)?Math.max(0,Math.min(BR_UTILITY_FIELD_CAP,Math.floor(capacity))):BR_UTILITY_FIELD_CAP;
    for(let i=0;i<count;i++){
      const material=()=>new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false});
      const rim=new THREE.Mesh(this.rimGeometry,material());
      const wave=new THREE.Mesh(this.waveGeometry,material());
      rim.name="utility-boundary";wave.name="utility-pulse";wave.rotation.x=-Math.PI/2;
      rim.visible=wave.visible=false;
      this.root.add(rim,wave);this.slots.push({rim,wave});
    }
  }

  update(effects:readonly BrUtilityField[],now:number,quality:GraphicsQuality):void{
    if(this.disposed)return;
    this.clear();
    if(!Number.isFinite(now))return;
    const limit=Math.min(this.slots.length,quality==="low"?6:quality==="medium"?9:12);
    let used=0;
    for(let priority=0;priority<2;priority++)for(let i=0;i<effects.length&&used<limit;i++){
      const effect=effects[i];
      if((effect.kind==="vortex")!==(priority===0))continue;
      const p=effect.position;
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)||!Number.isFinite(effect.radius)||effect.radius<=0||
        !Number.isFinite(effect.createdAt)||!Number.isFinite(effect.expiresAt)||now<effect.createdAt||now>=effect.expiresAt)continue;
      if(effect.kind!=="nano-mist"&&effect.kind!=="pulse-scanner"&&effect.kind!=="vortex")continue;
      const slot=this.slots[used++];
      const age=now-effect.createdAt;
      const endFade=Math.min(1,(effect.expiresAt-now)/250);
      const phase=(age%1200)/1200;
      const vortex=effect.kind==="vortex",scanner=effect.kind==="pulse-scanner";
      const color=vortex?0xd4b3ff:scanner?0xffbf72:0x82e6ae;
      const rimHeight=vortex?.22:.14;
      // The outer edge always denotes the supplied radius; pulse stays inside it.
      slot.rim.position.set(p.x,p.y+.035+rimHeight/2,p.z);
      slot.rim.scale.set(effect.radius,rimHeight,effect.radius);
      slot.rim.material.color.setHex(color);
      slot.rim.material.opacity=(vortex?.38:scanner?.12:.2)*endFade;
      slot.rim.visible=true;
      const waveRadius=effect.radius*(scanner?.08+.92*phase:vortex?.95-.75*phase:.68+.3*phase);
      slot.wave.position.set(p.x,p.y+.04,p.z);
      slot.wave.scale.set(waveRadius,waveRadius,1);
      slot.wave.material.color.setHex(vortex?0xffd391:color);
      slot.wave.material.opacity=(vortex?.48:.32)*(1-phase*.65)*endFade;
      slot.wave.visible=true;
    }
  }

  clear():void{for(const slot of this.slots)slot.rim.visible=slot.wave.visible=false;}
  dispose():void{
    if(this.disposed)return;
    this.clear();this.root.removeFromParent();
    this.rimGeometry.dispose();this.waveGeometry.dispose();
    for(const slot of this.slots){slot.rim.material.dispose();slot.wave.material.dispose();}
    this.root.clear();this.disposed=true;
  }
}
