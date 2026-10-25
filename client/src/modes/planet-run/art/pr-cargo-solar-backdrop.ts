import * as THREE from "three";
import type {PrRoundDefinition} from "@planetfall/shared";
import {createPrArtKit, type PrArtPalette, type PrArtQuality} from "./pr-art-shared";

/** Non-playable orbital districts. All coordinates are outside the course envelope. */
export function createPrCargoSolarBackdrop(round:PrRoundDefinition){
 const cargo=round.id==="cargo-cyclone";
 if(!cargo&&round.id!=="solar-sweep")throw new Error("Unsupported freight/power backdrop");
 const root=new THREE.Group();root.name=`pr-backdrop:${round.id}`;root.userData.cameraCollision=false;
 const palette:PrArtPalette=cargo
  ?{neutral:0x647c8b,dark:0x203b50,primary:0xad796b,secondary:0xa0956b,hazard:0xad796b,glow:0x9bd8d7,soft:0x486174,white:0x91a0a6}
  :{neutral:0x9d9388,dark:0x41415b,primary:0xada16b,secondary:0x7d7196,hazard:0xada16b,glow:0xe8c995,soft:0x665f78,white:0xb7ae96};
 const kit=createPrArtKit({round,root,platforms:new Map(),obstacles:new Map(),surfaces:new Map(),hazardVolumes:new Map()},palette);
 for(const m of Object.values(kit.materials)){m.fog=false;m.roughness=.84;m.metalness=.08;}
 kit.materials.glow.emissiveIntensity=.14;
 const add=kit.add;
 const traffic=kit.group(cargo?"freight-transfer-tug":"solar-inspection-shuttle");
 const moving=kit.group(cargo?"freight-crane-transfer-head":"solar-tracking-mirror",root,1);
 if(cargo){
  // Two continuous terminal spines give the existing little docks a parent facility.
  for(const side of [-1,1]){
   const x=side*83;
   add("near-terminal-keel","box","dark",[x,-24,-53,35,16,224]);
   add("near-terminal-deck","box","soft",[x,-15,-53,38,2,224]);
   add("dock-edge-guide","box","glow",[x-side*18,-13.8,-53,1,.35,211]);
   for(let i=0;i<5;i++){
    const z=38-i*43;
    add("terminal-warehouse","box","dark",[x+side*5,-6,z,22,16,27]);
    add("warehouse-roof","box","neutral",[x+side*5,2.5,z,24,1.5,29]);
    add("warehouse-shutter","box","primary",[x-side*6.1,-5,z,.5,10,18]);
    for(let j=0;j<3;j++)add("stacked-freight","box",j%2?"primary":"secondary",[x-side*10,-9+j*3.4,z+14,8,3,7],root,[0,0,0],1);
    add("gantry-leg","box","primary",[x+side*14,10,z-8,3,48,3]);
    add("gantry-jib","box","primary",[x-side*2,33,z-8,35,3,4]);
    add("gantry-counterweight","box","dark",[x+side*17,28,z-8,8,9,9]);
    add("gantry-cable","box","soft",[x-side*13,17,z-8,.45,28,.45]);
    add("gantry-spreader","box","neutral",[x-side*13,3,z-8,9,1.5,8]);
   }
   // Lower bulk freight concourse: long rails and docked ships make depth visible below the course.
   const mx=side*156;
   add("mid-transfer-concourse","box","dark",[mx,-47,-80,61,9,312]);
   add("mid-transfer-tracks","box","neutral",[mx,-41.9,-80,3,.8,300]);
   for(let i=0;i<4;i++){
    const z=30-i*80;
    add("freighter-hull","box","soft",[mx+side*14,-33,z,24,17,54]);
    add("freighter-bow","box","neutral",[mx+side*14,-31,z-31,15,10,10]);
    add("freighter-bridge","box","dark",[mx+side*14,-20,z+15,14,11,13]);
    add("freighter-engine","box","glow",[mx+side*14,-32,z+28,15,5,1]);
    for(let j=0;j<3;j++)add("freighter-load","box","primary",[mx+side*14,-20,z-16+j*10,18,7,8],root,[0,0,0],1);
   }
  }
  // A distant terminal city anchors the end of the course without filling its jump corridor.
  add("far-freight-horizon","box","soft",[0,-55,-290,490,17,80]);
  for(let i=0;i<9;i++){
   const x=-220+i*55,h=30+(i%3)*19;
   add("far-terminal-tower","box","soft",[x,-47+h/2,-284,27,h,35]);
   add("far-terminal-crown","box","neutral",[x,-47+h,-284,34,3,40]);
   add("far-window-band","box","glow",[x,-38+h*.65,-265,23,1,1],root,[0,0,0],2);
  }
  add("far-transit-viaduct","box","neutral",[0,-9,-240,450,3,9]);
  add("tug-hull","box","neutral",[0,0,0,14,5,24],traffic);
  add("tug-cabin","box","dark",[0,4,-6,8,4,9],traffic);
  add("tug-thrusters","box","glow",[0,0,12.2,10,2,.6],traffic);
  add("transfer-head","box","secondary",[0,0,0,10,3,10],moving);
 }else{
  // A deep structural collar ties the little collector towers into a power station.
  add("lower-station-collar","torus","dark",[0,-39,0,116,116,116],root,[Math.PI/2,0,0]);
  add("lower-energy-manifold","torus","soft",[0,-35,0,111,111,80],root,[Math.PI/2,0,0]);
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4+.16,x=Math.cos(a)*108,z=Math.sin(a)*108;
   add("collector-foundation","cylinder","dark",[x,-34,z,15,18,15]);
   add("collector-cap","cylinder","neutral",[x,-24,z,16,2,16]);
   add("collector-mast","box","neutral",[x,-7,z,4,34,4]);
   // Broad dark photovoltaic surfaces framed in muted gold: readable from above and at eye level.
   const tilt=Math.PI*.12,ca=Math.cos(a),sa=Math.sin(a),ct=Math.cos(tilt),st=Math.sin(tilt);
   add("collector-array-frame","box","primary",[x,11,z,42,1.8,29],root,[0,-a,tilt]);
   add("collector-array-glass","box","dark",[x-ca*st*1.2,11+ct*1.2,z-sa*st*1.2,39,.5,26],root,[0,-a,tilt]);
   for(let j=-2;j<=2;j++)add("array-cell-seam","box","soft",[x+ca*(j*6.7*ct-st*1.6),11+j*6.7*st+ct*1.6,z+sa*(j*6.7*ct-st*1.6),.4,.2,26],root,[0,-a,tilt],1);
   add("collector-power-feed","box","glow",[x,-16,z+3,1,13,1],root,[0,0,0],1);
  }
  // Larger stepped fields establish a second scale beyond the collection ring.
  for(const side of [-1,1])for(let i=0;i<3;i++){
   const x=side*(174+i*30),z=-95+i*76;
   add("far-array-spine","box","soft",[x,-47,z,7,9,91]);
   add("far-array-port","box","secondary",[x-23,-40,z,38,2,78],root,[0,0,-.18]);
   add("far-array-starboard","box","secondary",[x+23,-40,z,38,2,78],root,[0,0,.18]);
   add("far-array-bus","box","primary",[x,-34,z,4,3,86]);
  }
  // The research head-end has an unmistakable stepped silhouette on the far horizon.
  add("power-station-base","box","dark",[0,-35,-179,190,18,49]);
  for(const side of [-1,1]){
   add("power-control-tower","box","soft",[side*65,4,-181,29,70,26]);
   add("power-control-crown","box","primary",[side*65,40,-181,38,3,34]);
   add("power-observation-gallery","box","glow",[side*65,24,-167,21,2,1]);
   add("power-reactor-drum","cylinder","dark",[side*36,-11,-176,16,30,16]);
   add("power-reactor-cap","cylinder","neutral",[side*36,5,-176,17,2,17]);
  }
  add("station-suspended-link","box","soft",[0,15,-181,112,5,10]);
  for(let i=0;i<5;i++){
   const x=-150+i*75;
   add("distant-mirror-pylon","box","soft",[x,-18,-313,8,84,8]);
   add("distant-mirror-plate","box","neutral",[x,26,-313,49,34,3],root,[0,.3,0]);
   add("distant-mirror-inset","box","secondary",[x,26,-310.9,44,29,1],root,[0,.3,0]);
  }
  add("shuttle-hull","box","neutral",[0,0,0,10,3,18],traffic);
  add("shuttle-wing","box","dark",[0,0,2,24,1,7],traffic);
  add("shuttle-drive","box","glow",[0,0,9.3,6,1,.5],traffic);
  add("tracking-reflector","box","primary",[0,0,0,22,16,1.5],moving);
 }
 kit.finish();let disposed=false;
 const update=(ms:number)=>{if(disposed)return;const t=ms*.001;
  if(cargo){traffic.position.set(-119,14+Math.sin(t*.13)*1.5,-60+Math.sin(t*.034)*109);moving.position.set(70,19+Math.sin(t*.11)*8,-56);}
  else{traffic.position.set(Math.cos(t*.029)*148,18+Math.sin(t*.1)*2,Math.sin(t*.029)*148);traffic.rotation.y=-t*.029;moving.position.set(141,16,-83);moving.rotation.y=.3+Math.sin(t*.035)*.18;}
 };
 update(0);
 return {root,update,setQuality(q:PrArtQuality){if(!disposed)kit.setQuality(q);},dispose(){if(disposed)return;disposed=true;kit.dispose();root.removeFromParent();root.clear();}};
}
