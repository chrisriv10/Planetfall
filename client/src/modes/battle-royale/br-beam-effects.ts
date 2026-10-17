import * as THREE from "three";
import type { GraphicsQuality } from "../../settings";

export interface BrBeamPresentation {
  readonly id:string;
  readonly origin:Readonly<{x:number;y:number;z:number}>;
  readonly end:Readonly<{x:number;y:number;z:number}>;
  readonly expiresAt:number;
}

/** Server-clipped endpoints only. No raycasts, hit inference, or extrapolation.
 * Time must use the same millisecond clock as expiresAt. */
export class BrBeamEffects {
  readonly root=new THREE.Group();
  private readonly geometry=new THREE.CylinderGeometry(1,1,1,6,1,true);
  private readonly coreMaterial=new THREE.MeshBasicMaterial({color:0xdfffff,transparent:true,opacity:.85,depthTest:true,depthWrite:false,toneMapped:false});
  private readonly glowMaterial=new THREE.MeshBasicMaterial({color:0x72fff0,transparent:true,opacity:.18,blending:THREE.AdditiveBlending,depthTest:true,depthWrite:false,toneMapped:false});
  private readonly slots:{core:THREE.Mesh;glow:THREE.Mesh}[]=[];
  private readonly direction=new THREE.Vector3();
  private readonly up=new THREE.Vector3(0,1,0);
  private disposed=false;

  constructor(capacity=40){
    this.root.name="br-beam-effects";
    const count=Number.isFinite(capacity)?Math.max(0,Math.min(40,Math.floor(capacity))):40;
    for(let i=0;i<count;i++){
      const core=new THREE.Mesh(this.geometry,this.coreMaterial);
      const glow=new THREE.Mesh(this.geometry,this.glowMaterial);
      core.name="prism-beam-core";glow.name="prism-beam-glow";
      core.visible=glow.visible=false;
      core.userData.cameraCollision=glow.userData.cameraCollision=false;
      this.root.add(core,glow);this.slots.push({core,glow});
    }
  }

  update(beams:readonly BrBeamPresentation[],now:number,quality:GraphicsQuality="high"):void {
    if(this.disposed)return;
    this.clear();
    if(!Number.isFinite(now))return;
    let used=0;
    // All qualities retain up to 40 actual beams; Low removes the outer glow.
    for(let i=0;i<beams.length&&used<this.slots.length;i++){
      const beam=beams[i],a=beam.origin,b=beam.end;
      if(!Number.isFinite(beam.expiresAt)||beam.expiresAt<=now||
        !Number.isFinite(a.x)||!Number.isFinite(a.y)||!Number.isFinite(a.z)||
        !Number.isFinite(b.x)||!Number.isFinite(b.y)||!Number.isFinite(b.z))continue;
      this.direction.set(b.x-a.x,b.y-a.y,b.z-a.z);
      const length=this.direction.length();
      if(!Number.isFinite(length)||length<.0001)continue;
      this.direction.multiplyScalar(1/length);
      const slot=this.slots[used++];
      slot.core.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
      slot.core.quaternion.setFromUnitVectors(this.up,this.direction);
      slot.core.scale.set(.018,length,.018);
      slot.core.visible=true;
      slot.glow.position.copy(slot.core.position);slot.glow.quaternion.copy(slot.core.quaternion);
      slot.glow.scale.set(.045,length,.045);slot.glow.visible=quality!=="low";
    }
  }

  clear():void {for(const slot of this.slots)slot.core.visible=slot.glow.visible=false;}
  dispose():void {
    if(this.disposed)return;
    this.disposed=true;this.clear();this.root.removeFromParent();
    this.geometry.dispose();this.coreMaterial.dispose();this.glowMaterial.dispose();this.root.clear();
  }
}
