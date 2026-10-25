import * as THREE from "three";
import type {PrRoundDefinition} from "@planetfall/shared";
import {createPrArtKit,type PrArtQuality,type PrArtPalette} from "./pr-art-shared";

/** Outboard orbital districts. These meshes are scenery, never landing surfaces. */
export function createPrCapacitorShatterBackdrop(round:PrRoundDefinition){
 const final=round.id==="shatterdeck",root=new THREE.Group();root.name=`pr-backdrop:${round.id}`;root.userData.cameraCollision=false;
 const palette:PrArtPalette=final
  ?{dark:0x242b43,neutral:0x65728b,primary:0x425a71,secondary:0x76688f,soft:0x3e455f,white:0x8da4b8,glow:0x83bdbd,hazard:0x9e769c}
  :{dark:0x21364c,neutral:0x708c9f,primary:0x3e6984,secondary:0x536d94,soft:0x38566e,white:0x9ab8c3,glow:0x8fc7d0,hazard:0x9b846b};
 const kit=createPrArtKit({round,root,platforms:new Map(),obstacles:new Map(),surfaces:new Map(),hazardVolumes:new Map()},palette),{add}=kit;
 for(const material of Object.values(kit.materials)){material.fog=false;material.emissiveIntensity=0;material.roughness=.85;material.metalness=.1;}
 kit.materials.glow.emissiveIntensity=.12;
 if(!final){
  // Two continuous laboratory quays give the race a surrounding campus rather
  // than another collection of disconnected batteries beside the course.
  for(const side of [-1,1]){
   const x=side*83;
   add("research-quay-hull","box","dark",[x,-16,-57,36,10,184]);
   add("research-quay-deck","box","soft",[x,-10.6,-57,39,1.3,187]);
   add("quay-transit-conduit","box","primary",[x-side*14,-7,-57,2,2,178]);
   for(let i=0;i<5;i++){
    const z=20-i*36,height=12+(i%3)*7;
    add("laboratory-block","box","primary",[x+side*3,-10+height/2,z,24,height,24]);
    add("laboratory-roof","box","neutral",[x+side*3,-9.4+height,z,26,1.2,26]);
    add("laboratory-window-band","box","glow",[x-side*9.1,-3+height*.45,z,0.3,1.2,20]);
    add("quay-support-keel","box","dark",[x,-31,z,9,22,12]);
    for(let j=0;j<3;j++){
     add("research-capacitor","cylinder","dark",[x+side*18,-2+j%2*3,z-8+j*8,3.3,16,3.3]);
     add("research-capacitor-cap","cylinder","neutral",[x+side*18,6+j%2*3,z-8+j*8,3.6,1.2,3.6]);
    }
   }
   // Heavy transfer lines and reactor frames extend into the middle distance.
   for(let i=0;i<3;i++){
    const mx=side*(141+i*21),z=-22-i*71;
    add("reactor-service-island","box","dark",[mx,-24,z,44,8,46]);
    add("reactor-containment-core","cylinder","primary",[mx,0,z,11,43,11]);
    add("reactor-crown","cylinder","neutral",[mx,22,z,12,2,12]);
    for(const dx of [-17,17])add("reactor-frame-upright","box","soft",[mx+dx,7,z,3,64,4]);
    add("reactor-frame-header","box","neutral",[mx,39,z,38,3,5]);
    add("reactor-power-feed","box","primary",[(x+mx)/2,-18,z,Math.abs(mx-x),4,6]);
    add("reactor-charge-indicator","box","glow",[mx,8,z+11.2,1.2,25,.3]);
   }
  }
  // Far-side research concourse closes the distant horizon without blocking
  // the playable finish: its nearest edge remains more than 60 m beyond it.
  add("far-research-concourse","box","soft",[0,-17,-248,330,13,48]);
  add("far-research-concourse-roof","box","primary",[0,-9,-248,336,3,51]);
  for(let i=0;i<9;i++){
   const x=-144+i*36,height=29+(i%4)*13;
   add("far-laboratory-silhouette","box","soft",[x,-8+height/2,-257,25,height,27]);
   add("far-laboratory-terrace","box","neutral",[x,-7+height,-257,28,2,30]);
   add("far-signal-window","box","glow",[x,4+height*.5,-243,15,1.4,.4]);
   for(const level of [.22,.72])add("far-laboratory-window-ribbon","box","neutral",[x,-6+height*level,-243.3,20,.7,.35]);
   add("roof-relay","box","primary",[x,-3+height,-257,2,8,2],root,[0,0,0],1);
  }
  // The underslung transit deck is deliberately well below the kill plane.
  add("lower-campus-transit","box","dark",[0,-66,-86,165,7,24]);
  add("lower-campus-transit-edge","box","primary",[0,-61.9,-74,165,1.2,1]);
 }else{
  // Stadium infrastructure is segmented and outboard. No enclosing bright
  // collar competes with the collapsing tile edge or its open void.
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4+.18,r=94,x=Math.cos(a)*r,z=Math.sin(a)*r,rot:[number,number,number]=[0,-a,0];
   add("event-district-deck","box","dark",[x,-29,z,22,9,57],root,rot);
   add("event-district-roof","box","soft",[x,-23.8,z,24,1.5,60],root,rot);
   for(let row=0;row<3;row++){
    const rr=r+row*5,xx=Math.cos(a)*rr,zz=Math.sin(a)*rr;
    add("spectator-terrace","box","primary",[xx,-20+row*3,zz,5,3,50],root,rot);
    add("spectator-aisle-light","box","glow",[xx,-18.3+row*3,zz,1,.4,46],root,rot);
   }
   add("station-undercarriage","box","dark",[x,-49,z,11,33,18],root,rot);
   // A handful of clearly framed media displays, angled inward to the arena.
   if(i%2===0){
    const rr=112,xx=Math.cos(a)*rr,zz=Math.sin(a)*rr;
    add("event-display-frame","box","neutral",[xx,8,zz,2,14,36],root,rot);
    add("event-display-field","box","dark",[xx-Math.cos(a)*1.2,8,zz-Math.sin(a)*1.2,.5,11,32],root,rot);
    add("event-display-progress","box","glow",[xx-Math.cos(a)*1.6,4,zz-Math.sin(a)*1.6,.3,.65,23],root,rot);
    // A simple pixel planet and broadcast bars read at long range while
    // remaining part of the existing static instanced material batches.
    for(let row=0;row<5;row++){
     const width=[2.2,4.1,5,4.1,2.2][row];
     add("event-display-planet","box","neutral",[xx-Math.cos(a)*1.6+Math.sin(a)*8,7.2+row*.8,zz-Math.sin(a)*1.6-Math.cos(a)*8,.3,.82,width],root,rot);
    }
    add("event-display-orbit","box","glow",[xx-Math.cos(a)*1.8+Math.sin(a)*8,8.8,zz-Math.sin(a)*1.8-Math.cos(a)*8,.3,.5,8.5],root,rot);
    for(let row=0;row<3;row++)add("event-display-broadcast-bars","box","neutral",[xx-Math.cos(a)*1.6-Math.sin(a)*5,7.2+row*1.5,zz-Math.sin(a)*1.6+Math.cos(a)*5,.3,.65,[9,6,10][row]],root,rot);
    add("display-mount","box","primary",[xx,-9,zz,3,24,4],root,rot);
   }
  }
  // Tall distant pylons and suspended hospitality wings establish a stadium
  // scale around the small, high contrast playable core.
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3+.32,r=170,x=Math.cos(a)*r,z=Math.sin(a)*r,rot:[number,number,number]=[0,-a,0];
   add("event-megapylon","box","soft",[x,-10,z,17,134,20],root,rot);
   add("event-megapylon-crown","box","neutral",[x,59,z,27,6,29],root,rot);
   add("pylon-beacon","box","glow",[x-Math.cos(a)*9,36,z-Math.sin(a)*9,1.2,28,1.2]);
   add("hospitality-wing","box","primary",[x,14,z,37,13,80],root,rot);
   add("hospitality-roof","box","soft",[x,21,z,40,2,83],root,rot);
   add("hospitality-window","box","glow",[x-Math.cos(a)*19,14,z-Math.sin(a)*19,.5,1.5,69],root,rot);
   add("lower-event-transfer-arm","box","dark",[x*.6,-70,z*.6,120,7,10],root,rot);
   // Far skyline is a lower-contrast third depth layer, not an enclosing wall.
   const fx=Math.cos(a)*285,fz=Math.sin(a)*285;
   add("orbital-event-terminal","box","soft",[fx,-17,fz,45,42,98],root,rot);
   add("terminal-observation-wing","box","primary",[fx,7,fz,64,5,110],root,rot);
   for(let j=0;j<3;j++)add("terminal-relay","box","neutral",[fx,22+j*7,fz+(j-1)*22,5,28,5],root,[0,0,0],1);
  }
 }
 // A few grouped transport silhouettes traverse the outboard lanes. Their
 // bounded sway creates parallax cues without allocations or dynamic lights.
 const traffic=kit.group("orbital-backdrop-shuttles",root,1);
 for(let i=0;i<4;i++){
  const x=(i%2?1:-1)*(final?132:121),z=final?-48-i*38:-15-i*52,y=final?36:29;
  add("shuttle-fuselage","box","dark",[x,y,z,5,3,13],traffic);
  add("shuttle-wings","box","dark",[x,y-.5,z,13,.6,5],traffic);
  add("shuttle-engine","box","glow",[x,y,z+7,3,1,.5],traffic);
 }
 kit.finish();let disposed=false,quality:PrArtQuality="high";
 return {root,
  update(ms:number){if(disposed)return;const t=Number.isFinite(ms)?ms*.001:0;traffic.position.z=quality==="low"?0:Math.sin(t*.085)*15;traffic.position.y=quality==="low"?0:Math.sin(t*.27)*1.2;},
  setQuality(q:PrArtQuality){if(disposed)return;quality=q;kit.setQuality(q);},
  dispose(){if(disposed)return;disposed=true;kit.dispose();root.removeFromParent();root.clear();},
 };
}
