import * as THREE from "three";
import type {PrRoundDefinition} from "@planetfall/shared";
import {createPrArtKit, type PrArtQuality, type PrArtContext, type PrArtPalette} from "./pr-art-shared";

/** Orbital habitat districts: decorative scenery entirely outside the game course. */
export function createPrGardenBackdrop(round:PrRoundDefinition){
 const flux=round.id==="flux-gardens",root=new THREE.Group();root.name=`pr-backdrop:${round.id}`;root.userData.cameraCollision=false;
 const ctx:PrArtContext={round,root,platforms:new Map(),obstacles:new Map(),surfaces:new Map(),hazardVolumes:new Map()};
 const palette:PrArtPalette=flux?{neutral:0x8b94af,dark:0x30364e,primary:0x73729d,secondary:0x508c91,hazard:0xa989c2,glow:0x8bbdb9,soft:0x52677f,white:0xaab7c5}:{neutral:0x8baba8,dark:0x29484e,primary:0x438377,secondary:0x6d965e,hazard:0xa09b75,glow:0x8cbea9,soft:0x527677,white:0xafc3b8};
 const kit=createPrArtKit(ctx,palette);for(const m of Object.values(kit.materials)){m.fog=false;m.emissiveIntensity=0;m.roughness=.85;}
 const add=kit.add;
 // Smooth low-segment crowns keep the larger distant conservatory roofs from
 // reading as unshaped faceted blocks; the kit retains GPU resource ownership.
 const crownGeometry=new THREE.SphereGeometry(1,12,8);kit.geometries.sphere.copy(crownGeometry);crownGeometry.dispose();
 // A continuous lower service district connects the garden islands into a place.
 // Its broad deck is well beneath the course, while all tall modules are lateral.
 for(const side of [-1,1]){
  add('habitat-service-spine','box','dark',[side*94,-25,-65,32,7,240]);
  add('habitat-transit-line','box','neutral',[side*78,-19,-65,2,2,240]);
  for(let i=0;i<4;i++){
   const x=side*(70+(i%2)*17),z=38-i*62,y=-11+(i%2)*4;
   add('garden-terrace','cylinder','dark',[x,y-3,z,23,5,20]);
   add('planted-terrace','cylinder','secondary',[x,y,z,21,1.5,18]);
   add('terrace-balcony','torus','neutral',[x,y+.6,z,22,19,1],root,[Math.PI/2,0,0]);
   add('habitat-drum','cylinder','primary',[x,y-13,z,13,17,12]);
   // Broad conservatory ribs, with open sky between them rather than solid shells.
   for(const rz of [0,Math.PI/2])add('conservatory-rib','torus','neutral',[x,y+3,z,20,27,20],root,[0,rz,0]);
   for(let j=0;j<5;j++){
    const a=j*2.4,px=x+Math.cos(a)*12,pz=z+Math.sin(a)*10;
    add('habitat-tree-trunk','cylinder','neutral',[px,y+5,pz,1.1,8,1.1]);
    add('habitat-tree-crown','sphere','secondary',[px,y+11+(j%2)*3,pz,5.5,7,5.5]);
   }
   add('habitat-light-band','torus','glow',[x,y-4,z,19,17,1],root,[Math.PI/2,0,0],1);
  }
 }
 // A lower cross-district viaduct supplies a readable horizon behind the finish.
 add('garden-transfer-bridge','box','neutral',[0,-24,-205,215,5,14]);
 for(let i=0;i<7;i++){
  const x=-180+i*60,z=-265+(i%2)*28,y=-8+(i%3)*9;
  const roofHeight=17+(i%2)*5;
  add('far-conservatory-hall','box','soft',[x,y-16,z,54,16,46]);
  add('far-conservatory-roof','sphere','soft',[x,y-8,z,26,roofHeight,22]);
  for(const angle of [0,Math.PI/2])add('far-conservatory-roof-rib','torus','neutral',[x,y-8,z,27,roofHeight+1,23],root,[0,angle,0]);
  add('far-conservatory-eave','box','primary',[x,y-8,z+23.5,54,2,1]);
  for(let bay=0;bay<5;bay++)add('far-conservatory-lit-window','box','glow',[x-21+bay*10.5,y-15,z+23.5,7,4,1],root,[0,0,0],1);
  add('far-conservatory-service-gallery','box','neutral',[x,y-22,z+28,56,2,8]);
 }
 // Mid-distance signature: long arboretum avenues versus gravity conservatories.
 for(const side of [-1,1]){
  const x=side*155,z=flux?-135:-100;
  add('district-annex','box','dark',[x,-10,z,54,16,94]);
  add('district-gallery','box','primary',[x,1,z,49,5,88]);
  if(flux){
   add('gravity-conservatory-ring','torus','neutral',[x,25,z,39,48,3],root,[0,side*.45,side*.22]);
   add('suspended-gravity-garden','sphere','secondary',[x,20,z,23,7,23]);
   add('suspended-crystal','cone','primary',[x,43,z,8,24,8]);
  }else{
   for(let j=0;j<3;j++){
    add('arboretum-dome','sphere','primary',[x,6,z-28+j*28,22,20,18]);
    add('arboretum-dome-rib','torus','neutral',[x,7,z-28+j*28,23,20,1],root,[0,0,0]);
   }
  }
  for(let j=0;j<8;j++)add('observation-gallery-window','box','glow',[x+side*27,-7,z-37+j*10,1,3,6],root,[0,0,0],1);
 }
 // Small shuttles stay in the lower service corridor; one group transform per frame.
 const transit=kit.group('habitat-service-shuttle',root,1);
 add('garden-shuttle-cabin','box','neutral',[0,0,0,9,3,4],transit);
 add('garden-shuttle-glass','box','dark',[0,.4,-2.1,6,1.5,.2],transit);
 transit.position.set(-78,-15,-45);
 kit.finish();let disposed=false;
 return {root,update(ms:number){if(!disposed)transit.position.z=-70+Math.sin(ms*.000035)*95;},setQuality(q:PrArtQuality){if(!disposed)kit.setQuality(q);},dispose(){if(disposed)return;disposed=true;kit.dispose();root.removeFromParent();root.clear();}};
}
