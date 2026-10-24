import {prObstacleTransform} from "@planetfall/shared";
import {createPrArtKit,type PrArtContext,type PrArtQuality,type PrRoundArt} from "./pr-art-shared";

/** Circuit dressing never moves the support or the authoritative shutters. */
export function createPrCapacitorArt(ctx:PrArtContext):PrRoundArt {
 const kit=createPrArtKit(ctx),{add,group}=kit;
 kit.materials.neutral.color.setHex(0x8fa9bd);
 const replaced=[...ctx.surfaces.values(),...ctx.hazardVolumes.values()].map(mesh=>({mesh,material:mesh.material}));
 for(const mesh of ctx.surfaces.values())mesh.material=kit.materials.neutral;
 for(const mesh of ctx.hazardVolumes.values())mesh.material=kit.materials.primary;
 for(const p of ctx.round.platforms){
  const parent=ctx.platforms.get(p.id);if(!parent)continue;
  // All ink/energy is a sub-centimetre decal on actual support, never a bridge.
  for(const side of [-1,1]){
   for(let z=-p.half.z+2.2;z<p.half.z-1.5;z+=4.2){
    add("inset-circuit-panel","box","dark",[side*4.65,p.half.y+.004,z,3.8,.008,3.6],parent);
    add("panel-energy-branch","box","glow",[side*4.65,p.half.y+.009,z-1.35,3.15,.008,.07],parent);
    add("panel-energy-contact","box","glow",[side*5.9,p.half.y+.009,z-.7,.07,.008,1.35],parent);
   }
   add("conductive-bus","box","dark",[side*(p.half.x-1.1),p.half.y+.004,0,1.1,.008,p.half.z*2-.3],parent);
   add("live-circuit","box","glow",[side*(p.half.x-1.1),p.half.y+.009,0,.16,.008,p.half.z*2-.4],parent);
   for(let z=-p.half.z+1;z<p.half.z-.6;z+=2.4){
    add("pulse-index","box","glow",[side*(p.half.x-1.6),p.half.y+.009,z,.65,.008,.14],parent);
    add("circuit-junction","box","dark",[side*(p.half.x-2.3),p.half.y+.004,z,.6,.008,.6],parent);
   }
   add("research-deck-spine","box","dark",[side*(p.half.x-.3),-.8,0,.5,.35,p.half.z*2-.2],parent);
  }
 }
 const gates=ctx.round.obstacles.filter(o=>o.kind==="door").map((o,index)=>{
  const parent=ctx.obstacles.get(o.id);
  if(parent)for(const face of [-1,1]){
   add("shutter-recess","box","dark",[0,0,face*(o.half.z+.001),o.half.x*2-.28,o.half.y*1.7,.002],parent);
   for(let x=-o.half.x+.45;x<o.half.x-.2;x+=.7)
    add("capacitor-shutter-segment","box","glow",[x,0,face*(o.half.z+.004),.09,o.half.y*1.4,.002],parent);
  }
  const lamps=group(`capacitor-charge-${index}`),open=group(`capacitor-open-${index}`),bank=group(`capacitor-bank-pulse-${index}`);
  for(const side of [-1,1]){
   const x=side*12,z=o.center.z;
   add("paired-shutter-housing","cylinder","dark",[x,2.2,z,1.5,7.5,1.5]);
   add("shutter-cap","cylinder","neutral",[x,6,z,1.7,.65,1.7]);
   for(const y of [0,1.8,3.6])add("shutter-coil","torus","primary",[x,y,z,1.55,1.55,1.55],undefined,[Math.PI/2,0,0]);
   add("charge-column","box","hazard",[x,3,z+1.51,.65,3,.08],lamps);
   add("open-column","box","glow",[x,3,z+1.51,.65,3,.08],open);
   // Bank lives beyond the existing side towers, connected by a high cable gantry.
   const bx=side*48;
   add("bank-vessel","cylinder","dark",[bx,5,z,5,22,5]);
   for(const y of [-3,1,5,9,13])add("bank-coil","torus","primary",[bx,y,z,5.1,5.1,5.1],undefined,[Math.PI/2,0,0]);
   add("bank-crown","cylinder","neutral",[bx,16.5,z,4.5,1,4.5]);
   add("charge-transfer","box","glow",[side*30,12,z,32,.16,.16]);
   add("bank-charge-band","torus","glow",[bx,0,z,5.18,5.18,5.18],bank,[Math.PI/2,0,0]);
  }
  add("overhead-shutter-link","box","primary",[0,7.3,o.center.z,25,.55,.7]);
  return {o,lamps,open,bank};
 });
 for(const o of ctx.round.obstacles.filter(o=>o.kind==="boost")){
  const parent=ctx.obstacles.get(o.id);if(!parent)continue;
  // Flat, elliptical winding entirely inside the existing 4 x 3 boost field.
  for(const radius of [.65,1,1.3])add("inset-launch-coil","torus","dark",[0,.065,0,radius,radius*.78,.004],parent,[Math.PI/2,0,0]);
  for(const z of [-.65,0,.65])for(const side of [-1,1])
   add("launch-arrow","box","dark",[side*.2,.075,z,.1,.008,.6],parent,[0,-side*.7,0]);
 }
 for(const [z,finish]of [[17,false],[ctx.round.finish?.center.z??-124,true]] as const){
  for(const side of [-1,1]){
   add("launch-gate-foot","cone","dark",[side*11,2,z,2,7,2]);
   add("launch-gate-link","box","dark",[side*11,6.4,z,.35,3,.35]);
   add("launch-gate-coils","torus","glow",[side*11,5,z,1.65,1.65,1.65],undefined,[Math.PI/2,0,0]);
  }
  add("completion-header","box","primary",[0,7.8,z,23,1.8,1.2]);
  kit.label(finish?"CIRCUIT COMPLETE":"CAPACITOR / LAUNCH",[0,7.8,z+.62,15,1.05,1]);
 }
 const rotor=group("capacitor-bank-regulator",undefined,1);rotor.position.set(48,22,-60);
 add("regulator-rim","torus","glow",[0,0,0,10,10,10],rotor);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;add("regulator-vane","box","primary",[Math.sin(a)*7,Math.cos(a)*7,0,1.7,4,.65],rotor,[0,0,-a]);}
 kit.finish();let disposed=false,quality:PrArtQuality="high";
 return {
  update(ms,seed){if(disposed)return;for(const g of gates){const state=prObstacleTransform(g.o,ms,seed),phase=((state.yaw/(Math.PI*2))%1+1)%1;
   g.lamps.visible=state.active||phase>.86;g.open.visible=!state.active&&phase<=.86;
   g.lamps.scale.y=state.active?1:.4+(phase-.86)/.14*.6;
   g.bank.position.y=quality==="low"?5:-3+phase*16;
  }if(quality!=="low")rotor.rotation.z=ms*.00014;kit.materials.glow.emissiveIntensity=.58+Math.sin(ms*.002)*.12;},
  setQuality(q){quality=q;kit.setQuality(q);},
  dispose(){if(disposed)return;disposed=true;for(const {mesh,material}of replaced)mesh.material=material;kit.dispose();},
 };
}
