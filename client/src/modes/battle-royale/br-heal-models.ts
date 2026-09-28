import * as THREE from "three";
import type { BrHealId } from "@planetfall/shared";

export type BrHealModelFinish="armor"|"dark"|"health"|"shield";
export interface BrHealModelPart {
  name:string;
  geometry:"box"|"cylinder";
  finish:BrHealModelFinish;
  position:readonly [number,number,number];
  scale:readonly [number,number,number];
}
type Part=readonly [string,BrHealModelPart["geometry"],BrHealModelFinish,number,number,number,number,number,number];
// Original Planetfall item designs shared by held and ground-loot presentation.
// Front is +Z, Y is up; pivot centered near grip. Matches br-item-art's pouch,
// handled case, narrow cell and broad battery silhouettes. No rarity recolor.
const PARTS:Record<BrHealId,readonly Part[]>={
  "med-patch":[
    ["patch-pouch","box","armor",0,0,0,.46,.32,.09],
    ["patch-inset","box","dark",0,0,.052,.36,.24,.012],
    ["patch-cross-h","box","health",0,0,.065,.2,.055,.012],
    ["patch-cross-v","box","health",0,0,.065,.055,.18,.012],
    ["patch-seal","box","dark",0,.147,0,.4,.025,.1],
    ["patch-pull","box","armor",-.247,.055,0,.035,.1,.07],
  ],
  "med-kit":[
    ["kit-case","box","armor",0,-.025,0,.6,.36,.22],
    ["kit-face","box","dark",0,-.025,.117,.5,.26,.014],
    ["kit-cross-h","box","health",0,-.025,.134,.24,.065,.014],
    ["kit-cross-v","box","health",0,-.025,.134,.065,.22,.014],
    ["kit-handle-left","box","dark",-.13,.192,0,.045,.085,.08],
    ["kit-handle-right","box","dark",.13,.192,0,.045,.085,.08],
    ["kit-handle-top","box","dark",0,.25,0,.305,.04,.08],
    ["kit-latch-left","box","armor",-.245,-.025,.132,.035,.08,.025],
    ["kit-latch-right","box","armor",.245,-.025,.132,.035,.08,.025],
  ],
  "shield-cell":[
    ["cell-body","cylinder","armor",0,-.015,0,.12,.4,.12],
    ["cell-neck","cylinder","dark",0,.2,0,.073,.045,.073],
    ["cell-cap","cylinder","armor",0,.238,0,.09,.035,.09],
    ["cell-display","box","dark",0,-.015,.123,.135,.245,.018],
    ["cell-shield-top","box","shield",0,.047,.139,.1,.075,.012],
    ["cell-shield-mid","box","shield",0,-.013,.139,.076,.045,.012],
    ["cell-shield-tip","box","shield",0,-.052,.139,.042,.032,.012],
  ],
  "shield-battery":[
    ["battery-case","box","armor",0,-.015,0,.48,.38,.21],
    ["battery-cap","box","dark",0,.2,0,.25,.05,.13],
    ["battery-bumper-left","box","dark",-.258,-.03,0,.045,.24,.24],
    ["battery-bumper-right","box","dark",.258,-.03,0,.045,.24,.24],
    ["battery-display","box","dark",0,-.015,.117,.35,.27,.018],
    ["battery-shield-top","box","shield",0,.055,.135,.19,.08,.014],
    ["battery-shield-mid","box","shield",0,-.015,.135,.135,.06,.014],
    ["battery-shield-tip","box","shield",0,-.065,.135,.07,.035,.014],
    ["battery-status","box","shield",.138,-.1,.135,.018,.04,.014],
  ],
};

/** Fresh descriptors, no input mutation, DOM, randomness or gameplay state. */
export function brHealModelParts(id:BrHealId):BrHealModelPart[]{
  return PARTS[id].map(([name,geometry,finish,x,y,z,sx,sy,sz])=>({name,geometry,finish,position:[x,y,z],scale:[sx,sy,sz]}));
}

/** One library per BrGame, shared across loot and astronaut-held models.
 * create() returns an independently transformable group; caller only removes
 * discarded groups, NOT their borrowed geometries/materials. dispose() once
 * when the game ends (after removing models). No per-frame allocation/update.
 * Don't apply the old generic large/small actionDevice scale: size is authored.
 * Animate/pose the containing group using the existing use-item animation.
 */
export class BrHealModelLibrary {
  private disposed=false;
  private readonly box=new THREE.BoxGeometry(1,1,1);
  private readonly cylinder=new THREE.CylinderGeometry(1,1,1,10);
  private readonly materials:Record<BrHealModelFinish,THREE.MeshStandardMaterial>={
    armor:new THREE.MeshStandardMaterial({color:0xd5e2e8,roughness:.48,metalness:.26}),
    dark:new THREE.MeshStandardMaterial({color:0x26374b,roughness:.65,metalness:.32}),
    health:new THREE.MeshStandardMaterial({color:0x82e6ae,emissive:0x82e6ae,emissiveIntensity:.2,roughness:.4,metalness:.12}),
    shield:new THREE.MeshStandardMaterial({color:0x63d8ff,emissive:0x63d8ff,emissiveIntensity:.2,roughness:.4,metalness:.12}),
  };
  create(id:BrHealId):THREE.Group {
    if(this.disposed)throw new Error("BR heal model library has been disposed");
    const group=new THREE.Group();group.name=`br-heal-${id}`;
    for(const part of brHealModelParts(id)){
      const mesh=new THREE.Mesh(part.geometry==="box"?this.box:this.cylinder,this.materials[part.finish]);
      mesh.name=part.name;mesh.position.set(...part.position);mesh.scale.set(...part.scale);
      mesh.castShadow=true;mesh.userData.cameraCollision=false;group.add(mesh);
    }
    group.userData.borrowedHealResources=true;
    return group;
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;
    this.box.dispose();this.cylinder.dispose();Object.values(this.materials).forEach(material=>material.dispose());
  }
}
