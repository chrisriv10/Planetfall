import * as THREE from "three";
import {createPrArtKit,type PrArtContext,type PrRoundArt} from "./pr-art-shared";

/** Botanical park: flush paths on support, all volumetric planting outside it. */
export function createPrMeteorArtCourse(ctx:PrArtContext):PrRoundArt {
 const kit=createPrArtKit(ctx),saved=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>();
 // Sage paving keeps warm meteor telegraphs distinct under the bright orbital key.
 kit.materials.neutral.color.setHex(0x9bb6a4);
 for(const p of ctx.round.platforms){
  const parent=ctx.platforms.get(p.id);if(!parent)continue;
  const surface=ctx.surfaces.get(p.id);if(surface){saved.set(surface,surface.material);surface.material=kit.materials.neutral;}
  kit.add("botanical-cross-path","box","white",[0,p.half.y+.006,0,2.4,.008,p.half.z*2-.3],parent);
  kit.add("botanical-cross-path","box","white",[0,p.half.y+.006,0,p.half.x*2-.3,.008,2.4],parent);
  // The broad pale walkways continue across the nine actual support boxes.
  for(const side of [-1,1]){
   kit.add("garden-path-frame","box","primary",[side*(p.half.x-.22),p.half.y+.008,0,.22,.012,p.half.z*2-.25],parent);
   kit.add("garden-path-frame","box","primary",[0,p.half.y+.008,side*(p.half.z-.22),p.half.x*2-.25,.012,.22],parent);
  }
  // Flat leaf inlays are deliberately filtered against actual meteor footprints.
  for(let x=-4.5;x<=4.5;x+=1.5)for(let z=-4.5;z<=4.5;z+=1.5){
   const wx=p.center.x+x,wz=p.center.z+z;
   if(ctx.round.obstacles.some(o=>o.kind==="meteor"&&Math.abs(wx-o.center.x)<o.half.x+.7&&Math.abs(wz-o.center.z)<o.half.z+.7))continue;
   kit.add("safe-lane-leaf-inlay","sphere","secondary",[x,p.half.y+.008,z,.35,.006,.65],parent,[0,.6,0]);
  }
 }
 const edge=Math.max(...ctx.round.platforms.map(p=>Math.max(Math.abs(p.center.x)+p.half.x,Math.abs(p.center.z)+p.half.z)));
 // Scalloped garden retaining shell never creates an unsupported top extension.
 for(let i=0;i<40;i++){
  const a=i/40*Math.PI*2,x=Math.cos(a)*(edge+2.8),z=Math.sin(a)*(edge+2.8);
  if(Math.abs(x)<edge+1&&Math.abs(z)<edge+1)continue;
  kit.add("curved-garden-retaining-bed","sphere","dark",[x,-1.6,z,3.5,1.35,3.5]);
  kit.add("sculpted-soil-bed","sphere","soft",[x,-.6,z,2.9,.35,2.9]);
  kit.add("garden-rock","sphere","neutral",[x+.6,-.15,z+.2,.8,.45,.6]);
  for(let n=0;n<3;n++)kit.add("perimeter-succulent","sphere",n%2?"primary":"secondary",[x+(n-1)*.8,.25+n*.23,z,1.1,.9,1.3]);
 }
 const canopy=kit.group("garden-swaying-canopies");
 for(const [x,z,h] of [[-22,-13,7],[22,12,8],[-22,12,6],[22,-13,9]] as const){
  kit.add("arboretum-tree-trunk","cone","soft",[x,h/2-1,z,.6,h+2,.6]);
  for(let n=0;n<4;n++){
   kit.add("oversized-alien-canopy","sphere",n%2?"secondary":"primary",[x+(n%2-.5)*2.1,h+n*.85,z+(Math.floor(n/2)-.5)*2,3.3,1.5,2.9],canopy);
   kit.add("canopy-seed-light","sphere","glow",[x+(n%2-.5)*2.2,h-1,z+(Math.floor(n/2)-.5)*2,.18,.4,.18],canopy,[0,0,0],1);
  }
 }
 // A single monumental open ribbed dome, with an oversized living tree inside.
 const dome=kit.group("orbital-arboretum-landmark");dome.position.set(0,-3,-49);
 kit.add("arboretum-foundation","cylinder","dark",[0,0,0,21,3,21],dome);
 kit.add("arboretum-garden-bowl","sphere","soft",[0,1,0,20,2,20],dome);
 for(let i=0;i<6;i++)kit.add("arboretum-dome-rib","torus","white",[0,2,0,21,21,21],dome,[0,i*Math.PI/6,0]);
 kit.add("arboretum-equator","torus","primary",[0,2,0,21,21,21],dome,[Math.PI/2,0,0]);
 kit.add("arboretum-crown-ring","torus","glow",[0,16,0,14,14,14],dome,[Math.PI/2,0,0]);
 kit.add("arboretum-ancient-trunk","cone","soft",[0,9,0,2.8,20,2.8],dome);
 for(let i=0;i<9;i++){const a=i*2.399;kit.add("arboretum-ancient-leaves","sphere",i%2?"secondary":"primary",[Math.cos(a)*7,12+(i%3)*2,Math.sin(a)*7,7,3.2,5],dome);}
 kit.label("ORBITAL ARBORETUM",[0,4,21,17,2.8,1],dome);
 const drone=kit.group("garden-pollinator-flight",ctx.root,1);
 for(let i=0;i<3;i++){const a=i*2.094;kit.add("pollinator-shell","sphere","white",[Math.cos(a)*25,9,Math.sin(a)*25,.7,.35,.7],drone);kit.add("pollinator-orbit","torus","glow",[Math.cos(a)*25,9,Math.sin(a)*25,1,1,1],drone,[Math.PI/2,0,0]);}
 const crown=kit.group("arboretum-pollen-crown",dome,2);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;kit.add("pollen-lantern","sphere","glow",[Math.cos(a)*10,18+(i%3),Math.sin(a)*10,.22,.5,.22],crown);}
 kit.finish();let quality="high",disposed=false;
 return {update(ms){if(disposed)return;const t=ms/1000;canopy.rotation.z=quality==="low"?0:Math.sin(t*.45)*.008;drone.rotation.y=t*.065;crown.rotation.y=-t*.045;crown.position.y=Math.sin(t*.7)*.4;},setQuality(q){quality=q;kit.setQuality(q);},dispose(){if(disposed)return;disposed=true;for(const [mesh,material]of saved)mesh.material=material;saved.clear();kit.dispose();}};
}
