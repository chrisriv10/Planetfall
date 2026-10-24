import * as THREE from "three";
import type { Vec3 } from "@planetfall/shared";

/** Supplied by the authoritative timeline; no obstacle timing is recreated here. */
export interface PrMeteorVisualPhase {warningProgress:number;impactAgeMs:number|null;}

/** Local visual footprint only; caller supplies the authoritative obstacle center and phase. */
export function createPrMeteorArt(half:Vec3):{
  root:THREE.Group;update(active:boolean,warning:boolean,elapsedMs:number,phase?:PrMeteorVisualPhase):void;dispose():void;
} {
  const root=new THREE.Group();root.name="planet-run-meteor-impact";
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
  const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.push(g);return g;};
  const mat=(color:number,opacity:number)=>{
    const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});materials.push(m);return m;
  };
  const warningMaterial=mat(0xd96524,.7),activeMaterial=mat(0xff796b,.85),flashMaterial=mat(0xfff5ce,.8);
  // Additive orange on a pale deck saturates to white. Alpha-blended warning
  // paint preserves the danger hue; only the short impact flash stays additive.
  warningMaterial.blending=THREE.NormalBlending;activeMaterial.blending=THREE.NormalBlending;
  const box=geo(new THREE.BoxGeometry(1,1,1));
  const radius=Math.min(half.x,half.z),floor=Math.min(.12,half.y*.15);
  const footprint=new THREE.Group();root.add(footprint);
  const width=Math.min(.075,radius*.04),length=Math.min(.95,radius*.4);
  // Corner brackets and thin perimeter show the exact rectangular danger extent.
  for(const sx of [-1,1])for(const sz of [-1,1]) {
    for(const alongX of [true,false]) {
      const m=new THREE.Mesh(box,activeMaterial);
      m.position.set(sx*(half.x-(alongX?length/2:width/2)),floor,sz*(half.z-(alongX?width/2:length/2)));
      m.scale.set(alongX?length:width,.025,alongX?width:length);footprint.add(m);
    }
  }
  const cornerMarkers=new THREE.InstancedMesh(box,activeMaterial,footprint.children.length);
  for(let i=footprint.children.length-1;i>=0;i--){const part=footprint.children[i];part.updateMatrix();cornerMarkers.setMatrixAt(i,part.matrix);footprint.remove(part);}
  cornerMarkers.computeBoundingSphere();footprint.add(cornerMarkers);
  const plane=geo(new THREE.PlaneGeometry(half.x*2,half.z*2));plane.rotateX(-Math.PI/2);
  const fieldMaterial=mat(0xff655e,.055),field=new THREE.Mesh(plane,fieldMaterial);field.position.y=floor-.015;root.add(field);
  fieldMaterial.blending=THREE.NormalBlending;
  const ringGeometry=geo(new THREE.RingGeometry(radius*.55,radius*.6,32));ringGeometry.rotateX(-Math.PI/2);
  const ring=new THREE.Mesh(ringGeometry,warningMaterial);ring.position.y=floor+.01;root.add(ring);
  const flashGeometry=geo(new THREE.RingGeometry(radius*.18,radius*.34,24));flashGeometry.rotateX(-Math.PI/2);
  const flash=new THREE.Mesh(flashGeometry,flashMaterial);flash.position.y=floor+.04;root.add(flash);
  const rockMaterial=new THREE.MeshStandardMaterial({color:0x514e61,roughness:.95,emissive:0xd95d49,emissiveIntensity:.22});materials.push(rockMaterial);
  const rockGeometry=geo(new THREE.IcosahedronGeometry(1,0));
  const incoming=new THREE.InstancedMesh(rockGeometry,flashMaterial,4);incoming.name="incoming-meteor-trail";incoming.frustumCulled=false;incoming.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(incoming);
  const shards=new THREE.InstancedMesh(rockGeometry,rockMaterial,8);shards.name="meteor-fragments";shards.frustumCulled=false;shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(shards);
  const transform=new THREE.Object3D();
  let wasActive=false,impactAt=0,disposed=false;
  const update=(active:boolean,warning:boolean,elapsedMs:number,phase?:PrMeteorVisualPhase)=>{
    if(disposed)return;
    root.visible=active||warning;
    if(active&&!wasActive)impactAt=elapsedMs;
    wasActive=active;
    const age=Math.max(0,phase?.impactAgeMs??elapsedMs-impactAt)/1000;
    footprint.visible=active||warning;activeMaterial.color.setHex(active?0xff796b:0xd96524);
    activeMaterial.opacity=active?.95:.8+Math.sin(elapsedMs*.012)*.1;
    ring.visible=warning||active;warningMaterial.opacity=warning?.8+Math.sin(elapsedMs*.014)*.12:.4;
    fieldMaterial.opacity=active?.065:.025;
    flash.visible=active&&age<.45;flashMaterial.opacity=warning?.95:Math.max(0,.85-age*1.9);
    flash.scale.setScalar(1+Math.min(1,age/.45)*1.8);
    incoming.visible=warning;
    if(warning){
      const progress=Math.max(0,Math.min(1,phase?.warningProgress??0)),height=floor+.4+(1-progress)*19;
      for(let i=0;i<4;i++){
        const size=i===0?.38:.2-i*.035;
        transform.position.set((1-progress)*2+i*.14,height+i*1.5,0);
        transform.rotation.set(0,0,-.1);transform.scale.set(size,i===0?size:.9,size);transform.updateMatrix();incoming.setMatrixAt(i,transform.matrix);
      }
      incoming.instanceMatrix.needsUpdate=true;
    }
    shards.visible=active&&age<.7;
    if(shards.visible)for(let i=0;i<8;i++){
      const a=i*2.399963,r=radius*(.12+(i%3)*.13)*Math.min(1,age/.25),s=radius*(.085+(i%2)*.025)*Math.max(.01,1-age/.7);
      const lift=Math.sin(Math.min(1,age/.7)*Math.PI)*Math.min(half.y*1.5,3);
      transform.position.set(Math.cos(a)*r,floor+s*.42+lift*(.55+(i%3)*.2),Math.sin(a)*r);
      transform.rotation.set(i*.7, a, i*.4+Math.min(age,.4));
      transform.scale.set(s,s*.65,s*.85);transform.updateMatrix();shards.setMatrixAt(i,transform.matrix);
    }
    if(shards.visible)shards.instanceMatrix.needsUpdate=true;
  };
  update(false,false,0);
  return {root,update,dispose(){if(disposed)return;disposed=true;root.removeFromParent();root.clear();shards.dispose();incoming.dispose();cornerMarkers.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
