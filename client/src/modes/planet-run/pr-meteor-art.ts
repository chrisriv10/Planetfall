import * as THREE from "three";
import type { Vec3 } from "@planetfall/shared";

/** Local visual footprint only; caller supplies the authoritative obstacle center and phase. */
export function createPrMeteorArt(half:Vec3):{
  root:THREE.Group;update(active:boolean,warning:boolean,elapsedMs:number):void;dispose():void;
} {
  const root=new THREE.Group();root.name="planet-run-meteor-impact";
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
  const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.push(g);return g;};
  const mat=(color:number,opacity:number)=>{
    const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});materials.push(m);return m;
  };
  const warningMaterial=mat(0xffcb79,.7),activeMaterial=mat(0xff796b,.85),flashMaterial=mat(0xfff5ce,.8);
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
  const ringGeometry=geo(new THREE.RingGeometry(radius*.55,radius*.6,32));ringGeometry.rotateX(-Math.PI/2);
  const ring=new THREE.Mesh(ringGeometry,warningMaterial);ring.position.y=floor+.01;root.add(ring);
  const flashGeometry=geo(new THREE.RingGeometry(radius*.18,radius*.34,24));flashGeometry.rotateX(-Math.PI/2);
  const flash=new THREE.Mesh(flashGeometry,flashMaterial);flash.position.y=floor+.04;root.add(flash);
  const rockMaterial=new THREE.MeshStandardMaterial({color:0x514e61,roughness:.95,emissive:0xd95d49,emissiveIntensity:.22});materials.push(rockMaterial);
  const rockGeometry=geo(new THREE.IcosahedronGeometry(1,0));
  const shards=new THREE.InstancedMesh(rockGeometry,rockMaterial,8);shards.name="meteor-fragments";shards.frustumCulled=false;shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(shards);
  const transform=new THREE.Object3D();
  let wasActive=false,impactAt=0,disposed=false;
  const update=(active:boolean,warning:boolean,elapsedMs:number)=>{
    if(disposed)return;
    root.visible=active||warning;
    if(active&&!wasActive)impactAt=elapsedMs;
    wasActive=active;
    const age=Math.max(0,elapsedMs-impactAt)/1000;
    footprint.visible=active||warning;activeMaterial.color.setHex(active?0xff796b:0xffcb79);
    activeMaterial.opacity=active?.85:.45+Math.sin(elapsedMs*.012)*.12;
    ring.visible=warning||active;warningMaterial.opacity=warning?.55+Math.sin(elapsedMs*.014)*.2:.25;
    fieldMaterial.opacity=active?.065:.025;
    flash.visible=active&&age<.32;flashMaterial.opacity=Math.max(0,.85-age*2.7);
    flash.scale.setScalar(1+Math.min(1,age/.32)*1.5);
    shards.visible=active;
    if(active)for(let i=0;i<8;i++){
      const a=i*2.399963,r=radius*(.18+(i%3)*.16),s=radius*(.085+(i%2)*.025);
      const lift=Math.max(0,1-age/.38)*Math.min(half.y*.6,.9);
      transform.position.set(Math.cos(a)*r,floor+s*.42+lift*(.55+(i%3)*.2),Math.sin(a)*r);
      transform.rotation.set(i*.7, a, i*.4+Math.min(age,.4));
      transform.scale.set(s,s*.65,s*.85);transform.updateMatrix();shards.setMatrixAt(i,transform.matrix);
    }
    if(active)shards.instanceMatrix.needsUpdate=true;
  };
  update(false,false,0);
  return {root,update,dispose(){if(disposed)return;disposed=true;root.removeFromParent();root.clear();shards.dispose();cornerMarkers.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
