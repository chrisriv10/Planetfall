import * as THREE from "three";
import type { BR_UTILITIES } from "@planetfall/shared";

type UtilityId = keyof typeof BR_UTILITIES;

/** Clones borrow cached resources; remove clones without disposing their meshes.
 * Dispose this library once all ground/held users have been removed. */
export class BrUtilityModelLibrary {
  private readonly templates=new Map<UtilityId,THREE.Group>();
  private disposed=false;

  create(id:UtilityId):THREE.Group {
    if(this.disposed)throw new Error("BR utility model library has been disposed");
    let template=this.templates.get(id);
    if(!template){
      template=new THREE.Group();buildBrUtilityModel(template,id);
      template.name=`br-utility-${id}`;
      template.userData.borrowedUtilityResources=true;
      template.traverse(part=>{part.userData.cameraCollision=false;});
      this.templates.set(id,template);
    }
    return template.clone(true);
  }

  dispose():void {
    if(this.disposed)return;
    this.disposed=true;
    const geometries=new Set<THREE.BufferGeometry>();
    const materials=new Set<THREE.Material>();
    for(const template of this.templates.values())template.traverse(part=>{
      if(!(part instanceof THREE.Mesh))return;
      geometries.add(part.geometry);
      for(const material of Array.isArray(part.material)?part.material:[part.material])materials.add(material);
    });
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    this.templates.clear();
  }
}
/** Static local-space devices. Caller owns traversal disposal, as for weapon models.
 * Unit geometries and three materials are shared by all parts of this device. */
export function buildBrUtilityModel(group: THREE.Group, id: UtilityId): void {
  const accents: Record<UtilityId, number> = { "grav-coil":0x78e6ff,"void-filter":0xb39aff,"pulse-scanner":0xffbf72,"nano-mist":0x82e6ae };
  const shell=new THREE.MeshStandardMaterial({color:0xc5d1d6,metalness:.48,roughness:.32});
  const dark=new THREE.MeshStandardMaterial({color:0x19263b,metalness:.5,roughness:.35});
  const energy=new THREE.MeshStandardMaterial({color:accents[id],emissive:accents[id],emissiveIntensity:.3,roughness:.35});
  const box=new THREE.BoxGeometry(1,1,1);
  const add=(name:string,size:[number,number,number],at:[number,number,number],material:THREE.Material=shell)=>{
    const part=new THREE.Mesh(box,material);part.name=name;part.scale.set(...size);part.position.set(...at);part.castShadow=true;group.add(part);return part;
  };
  if(id==="grav-coil"){
    for(const y of [-.24,.24])add("coil-cap",[.44,.09,.3],[0,y,0]);
    for(const x of [-.17,.17])add("coil-spine",[.06,.4,.2],[x,0,0],dark);
    for(const y of [-.13,0,.13])add("coil-winding",[.3,.045,.25],[0,y,0],energy);
  }else if(id==="void-filter"){
    add("filter-bridge",[.48,.3,.17],[0,0,0],dark);
    for(const x of [-.17,.17]){
      add("filter-cartridge",[.18,.35,.27],[x,0,0]);
      for(const y of [-.1,0,.1])add("filter-vent",[.13,.025,.015],[x,y,-.143],dark);
    }
    add("filter-status",[.035,.16,.02],[0,0,-.1],energy);
  }else if(id==="pulse-scanner"){
    add("scanner-case",[.42,.48,.13],[0,0,0]);
    add("scanner-screen",[.33,.31,.018],[0,.04,-.075],dark);
    for(let i=0;i<3;i++)add("scanner-pulse",[.06+i*.075,.025,.012],[0,.12-i*.075,-.09],energy);
    add("scanner-antenna",[.035,.19,.04],[.15,.32,0],dark);
    add("scanner-button",[.065,.04,.015],[.1,-.19,-.08],energy);
  }else{
    add("mist-reservoir",[.27,.43,.25],[0,0,0]);
    add("mist-window",[.14,.29,.018],[0,0,-.136],energy);
    add("mist-nozzle",[.12,.09,.12],[0,.26,0],dark);
    add("mist-base",[.44,.07,.38],[0,-.26,0],dark);
    for(const x of [-.19,.19])add("mist-outrigger",[.06,.23,.06],[x,-.14,0]);
    add("mist-cross-horizontal",[.13,.035,.015],[0,0,-.151],shell);
    add("mist-cross-vertical",[.035,.13,.015],[0,0,-.153],shell);
  }
}
