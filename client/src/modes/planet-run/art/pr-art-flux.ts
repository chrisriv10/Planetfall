import * as THREE from "three";
import {createPrArtKit,type PrArtContext,type PrRoundArt} from "./pr-art-shared";

/** Terraces track their real support, with field cues driven by gravityScale. */
export function createPrFluxArt(ctx:PrArtContext):PrRoundArt {
 const kit=createPrArtKit(ctx),saved=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>(),petals:THREE.Group[]=[];
 for(const p of ctx.round.platforms){
  const parent=ctx.platforms.get(p.id);if(!parent)continue;const low=(p.gravityScale??1)<1;
  const surface=ctx.surfaces.get(p.id);if(surface){saved.set(surface,surface.material);surface.material=low?kit.materials.primary:kit.materials.neutral;}
  // Large inlaid ellipses make the terrace read as a gravity conservatory floor,
  // while the pale longitudinal path gives the eye a continuous race direction.
  kit.add("conservatory-processional-inlay","box",low?"neutral":"primary",[0,p.half.y+.006,0,5.4,.008,p.half.z*2-.45],parent);
  for(const radius of [4.8,6.8])kit.add("terrace-gravity-floor-diagram","torus",low?"glow":"secondary",[0,p.half.y+.016,0,radius,radius*1.12,.16],parent,[Math.PI/2,0,0]);
  // Rounded inset skirt: all upper extents remain below the true surface.
  kit.add("terrace-curved-skirt","sphere","dark",[0,-1,0,p.half.x,.9,p.half.z],parent);
  for(const side of [-1,1]){
   kit.add("terrace-inset-field-channel","box",low?"glow":"secondary",[side*(p.half.x-1),p.half.y+.01,0,.38,.015,p.half.z*2-.5],parent);
   for(let j=0;j<5;j++)kit.add("terrace-scalloped-retainer","sphere","secondary",[side*(p.half.x-.9),-.45,(j-2)*p.half.z*.36,1,.8,1.9],parent);
  }
  if(low){
   // Ring sides are beyond the deck; its lowest point is below the deck.
   kit.add("low-gravity-threshold-ring","torus","white",[0,6.2,p.half.z-1,12,12,1],parent);
   kit.add("low-gravity-threshold-ring-inner","torus","glow",[0,6.2,p.half.z-1,11.6,11.6,1],parent);
   const drift=kit.group(`low-gravity-petals:${p.id}`,parent,1);petals.push(drift);
   for(let n=0;n<14;n++){
    const side=n%2?1:-1;
    kit.add("ascending-field-petal","sphere",n%3?"white":"glow",[side*(p.half.x-1.5),1.5+(n%4)*1.6,-p.half.z+1.8+(n/2|0)*2.3,.09,.18,.25],drift,[0,n,side*.7]);
   }
  }
 }
 // Flush segmented collector faces retain the full warm authoritative silhouette
 // while making the rotating obstacles legible as built machinery.
 for(const o of ctx.round.obstacles){
  if(o.kind!=="rotator")continue;const parent=ctx.obstacles.get(o.id);if(!parent)continue;
  for(let x=-o.half.x+.8;x<o.half.x-.5;x+=1.35){
   for(const face of [-1,1])kit.add("flux-collector-face","box","dark",[x,0,face*(o.half.z+.002),.9,o.half.y*1.15,.003],parent);
   kit.add("flux-collector-crown","box","dark",[x,o.half.y+.002,0,.9,.003,o.half.z*1.4],parent);
  }
 }
 // Thin lithic petals and gardening satellites float off either side of the race.
 const crystals=kit.group("flux-suspended-seed-modules",ctx.root,1);
 for(let i=0;i<10;i++){
  const x=(i%2?1:-1)*15,z=4-i*13;
  kit.add("floating-crystal-seed","cone","primary",[x,4.6+i%3,z,.9,2,.9],crystals,[0,i,.25]);
  kit.add("floating-crystal-seed-tip","cone","primary",[x+.35,3.2+i%3,z,.9,1.2,.9],crystals,[Math.PI,i,-.25]);
  kit.add("seed-gravity-halo","torus","glow",[x,3+i%3,z,1.7,1.7,1.7],crystals,[Math.PI/2,.2,0]);
 }
 const bloom=kit.group("flux-bloom-landmark");bloom.position.set(33,2,-66);
 kit.add("flux-bloom-suspended-base","sphere","dark",[0,-5,0,9,3,9],bloom);
 kit.add("flux-bloom-energy-stem","cone","secondary",[0,8,0,1.6,23,1.6],bloom);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,x=Math.cos(a),z=Math.sin(a);
  kit.add("flux-bloom-outer-petal","sphere","primary",[x*9,13,z*9,3.7,1.3,9],bloom,[z*.5,a,x*.5]);
  kit.add("flux-bloom-inner-petal","sphere","white",[x*5,18,z*5,2.3,1,6],bloom,[z*.7,a,x*.7]);
 }
 kit.add("flux-bloom-core","sphere","glow",[0,18,0,3,4,3],bloom);
 const halo=kit.group("flux-bloom-orbit",bloom);
 for(let i=0;i<3;i++)kit.add("bloom-orbital-lens","torus",i===1?"glow":"secondary",[0,11,0,13+i*2,13+i*2,13+i*2],halo,[Math.PI/2+i*.22,0,i*.3]);
 kit.label("FLUX BLOOM",[0,1,10,13,2.4,1],bloom);
 const drones=kit.group("flux-gardening-drones",ctx.root,2);
 for(let i=0;i<4;i++){kit.add("gardening-drone","sphere","white",[(i%2?1:-1)*13,8,2-i*30,1,.35,1],drones);kit.add("gardening-drone-probe","cone","glow",[(i%2?1:-1)*13,7.3,2-i*30,.25,.8,.25],drones);}
 for(const [z,title]of [[16,"CONSERVATORY ENTRY"],[ctx.round.finish?.center.z??-124,"FLUX TRANSFER COMPLETE"]] as const){
  kit.add("conservatory-portal","torus","primary",[0,6,z,12,12,1],ctx.root);
  kit.add("conservatory-portal-rim","torus","glow",[0,6,z,12.5,12.5,1],ctx.root);
  kit.label(title,[0,15,z,13,1.7,1]);
 }
 kit.finish();let disposed=false,quality="high";
 return {update(ms){if(disposed)return;const t=ms/1000;for(let i=0;i<petals.length;i++)petals[i].position.y=(t*.55+i*.3)%1.6;crystals.position.y=Math.sin(t*.5)*.45;crystals.rotation.z=Math.sin(t*.19)*.006;halo.rotation.y=quality==="low"?0:t*.08;drones.position.y=Math.sin(t*.8)*.65;drones.position.z=Math.sin(t*.22)*3;},setQuality(q){quality=q;kit.setQuality(q);},dispose(){if(disposed)return;disposed=true;for(const [mesh,material]of saved)mesh.material=material;saved.clear();kit.dispose();}};
}
