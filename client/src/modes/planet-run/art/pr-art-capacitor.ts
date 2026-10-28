import {prObstacleTransform,type PrObstacle} from "@planetfall/shared";
import {createPrArtKit,type PrArtContext,type PrArtQuality,type PrRoundArt} from "./pr-art-shared";

/** Presentation progress only; collision/active states always come from shared authority. */
function capacitorCycle(o:PrObstacle,ms:number,seed:number):number{
 return ((ms/1000/Math.max(.25,o.period)+o.phase+(seed%997)/997)%1+1)%1;
}

/** Circuit dressing never moves the support or the authoritative shutters. */
export function createPrCapacitorArt(ctx:PrArtContext):PrRoundArt {
 const kit=createPrArtKit(ctx),{add,group}=kit;
 kit.materials.neutral.color.setHex(0x8fa9bd);
 const replaced=[...ctx.surfaces.values(),...ctx.hazardVolumes.values()].map(mesh=>({mesh,material:mesh.material,visible:mesh.visible}));
 for(const mesh of ctx.surfaces.values())mesh.material=kit.materials.neutral;
 for(const o of ctx.round.obstacles){const mesh=ctx.hazardVolumes.get(o.id);if(!mesh)continue;
  if(o.kind==="arc"||o.kind==="shutter"||o.kind==="barrier")mesh.visible=false;
  else mesh.material=kit.materials.primary;
 }
 for(const p of ctx.round.platforms){
  const parent=ctx.platforms.get(p.id);if(!parent)continue;
  if(p.id==="capacitor-boost-landing"){
   for(const side of [-1,1])add("landing-apron-border","box","glow",[side*(p.half.x-.25),p.half.y+.012,0,.16,.008,p.half.z*2-.4],parent);
   for(const z of [-2,0,2])for(const side of [-1,1])add("landing-apron-chevron","box","dark",[side*.4,p.half.y+.01,z,.16,.008,1.1],parent,[0,-side*.7,0]);
   continue;
  }
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
 // Each shutter owns only its lane. Markers are independent of the hidden open body.
 const gates=ctx.round.obstacles.filter(o=>o.kind==="shutter").map(o=>{
  const parent=ctx.obstacles.get(o.id),shell=group(`capacitor-shell-${o.id}`,parent);
  add("shutter-panel","box","primary",[0,0,0,o.half.x*2-.08,o.half.y*2-.08,o.half.z*2-.08],shell);
  for(const face of [-1,1])for(let x=-o.half.x+.4;x<o.half.x-.2;x+=.7)
   add("shutter-live-rib","box","glow",[x,0,face*(o.half.z-.02),.09,o.half.y*1.65,.02],shell);
  const open=group(`capacitor-open-${o.id}`),next=group(`capacitor-next-${o.id}`);
  for(const [marker,material]of [[open,"glow"],[next,"hazard"]] as const){
   for(const z of [1.3,2.4,3.5])for(const side of [-1,1])
    add("lane-direction","box",material,[o.center.x+side*.38,.62,o.center.z+z,.18,.008,1.1],marker,[0,-side*.7,0]);
   // Clear the normal following-camera sweep as it crosses an open lane.
   // Open has a continuous underline; next has separated amber dashes.
   for(const x of [-1.2,0,1.2])add("lane-status","box",material,[o.center.x+x,6.2,o.center.z,material==="glow"?1.2:.7,.16,.14],marker);
  }
  return {o,shell,open,next};
 });
 const arcs=ctx.round.obstacles.filter(o=>o.kind==="arc").map(o=>{
  const discharge=group(`capacitor-discharge-${o.id}`,ctx.obstacles.get(o.id));
  // Three thin ribbons span the exact damage footprint only during discharge.
  for(const z of [-.6,0,.6])add("arc-discharge","box","glow",[0,0,z,o.half.x*2,.16,.08],discharge);
  const warning=group(`capacitor-warning-${o.id}`),charge=group(`capacitor-charge-${o.id}`);
  for(let x=-o.half.x+.35;x<o.half.x;x+=.75)
   add("arc-warning-dash","box","hazard",[o.center.x+x,.62,0,.35,.008,o.half.z*2],warning);
  for(const side of [-1,1]){
   const x=o.center.x+side*(o.half.x+.3);
   // Slim paired terminals do not masquerade as solid decorative cover.
   add("arc-emitter-foot","box","dark",[x,.62,o.center.z,.5,.03,1.7]);
   add("arc-emitter","cylinder","primary",[x,.87,o.center.z,.18,.5,.18]);
   for(const y of [.75,.95,1.15])add("emitter-winding","torus","glow",[x,y,o.center.z,.24,.24,.24],undefined,[Math.PI/2,0,0]);
   add("emitter-charge","box","hazard",[x,0,o.center.z,.14,.5,.14],charge);
  }
  warning.position.z=o.center.z;charge.position.y=.85;
  return {o,discharge,warning,charge};
 });
 for(const o of ctx.round.obstacles.filter(o=>o.kind==="barrier")){
  const parent=ctx.obstacles.get(o.id);
  add("moving-barrier-shell","box","primary",[0,0,0,o.half.x*2-.04,o.half.y*2-.04,o.half.z*2-.04],parent);
  for(const face of [-1,1]){
   for(const y of [-1.15,1.15])add("barrier-live-edge","box","glow",[0,y,face*(o.half.z-.01),o.half.x*2-.1,.1,.015],parent);
   for(const x of [-2,0,2])add("barrier-travel-chevron","box","glow",[x,0,face*(o.half.z-.01),.14,1.8,.015],parent,[0,0,.5]);
  }
 }
 // Two distant capacitor banks preserve the circuit skyline without blocking a lane.
 const banks=group("capacitor-bank-pulse-0");
 for(const z of [-20,-106])for(const side of [-1,1]){
  const x=side*48;
  add("bank-vessel","cylinder","dark",[x,5,z,5,22,5]);
  for(const y of [-3,1,5,9,13])add("bank-coil","torus","primary",[x,y,z,5.1,5.1,5.1],undefined,[Math.PI/2,0,0]);
  add("bank-crown","cylinder","dark",[x,16.5,z,4.5,1,4.5]);
  add("charge-transfer","box","glow",[side*30,12,z,32,.16,.16]);
  add("bank-charge-band","torus","glow",[x,0,z,5.18,5.18,5.18],banks,[Math.PI/2,0,0]);
 }
 for(const o of ctx.round.obstacles.filter(o=>o.kind==="boost")){
  const parent=ctx.obstacles.get(o.id);if(!parent)continue;
  // Winding scales to the actual launch field; arrows mark the launch direction.
  for(const ratio of [.4,.65,.85])add("inset-launch-coil","torus","dark",[0,.065,0,o.half.x*ratio,o.half.z*ratio,.004],parent,[Math.PI/2,0,0]);
  for(const z of [-.65,0,.65])for(const side of [-1,1])
   add("launch-arrow","box","dark",[side*.2,.075,z,.1,.008,.6],parent,[0,-side*.7,0]);
 }
 for(const [z,finish]of [[17,false],[ctx.round.finish?.center.z??-124,true]] as const){
  for(const side of [-1,1]){
   add("launch-gate-foot","box","dark",[side*11,2,z,2,7,2]);
   add("launch-gate-link","box","dark",[side*11,6.4,z,.35,3,.35]);
   add("launch-gate-coils","torus","glow",[side*11,5,z,1.65,1.65,1.65],undefined,[Math.PI/2,0,0]);
  }
  add("completion-header","box","dark",[0,7.8,z,23,1.8,1.2]);
  kit.label(finish?"CIRCUIT COMPLETE":"CAPACITOR / LAUNCH",[0,7.8,z+.62,15,1.05,1]);
 }
 const rotor=group("capacitor-bank-regulator",undefined,1);rotor.position.set(48,22,-60);
 add("regulator-rim","torus","glow",[0,0,0,10,10,10],rotor);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;add("regulator-vane","box","primary",[Math.sin(a)*7,Math.cos(a)*7,0,1.7,4,.65],rotor,[0,0,-a]);}
 kit.finish();let disposed=false,quality:PrArtQuality="high",lastMs=0,lastSeed=0;
 const update=(ms:number,seed:number)=>{if(disposed)return;lastMs=ms;lastSeed=seed;
   for(const g of gates){const state=prObstacleTransform(g.o,ms,seed);
    g.shell.visible=state.active;g.open.visible=!state.active;
    g.next.visible=state.warning&&g.o.lane===(Math.floor(capacitorCycle(g.o,ms,seed)*3)+1)%3;
   }
   for(const a of arcs){const state=prObstacleTransform(a.o,ms,seed),charge=state.warning?capacitorCycle(a.o,ms,seed)/.3:0;
    a.discharge.visible=state.active;a.warning.visible=state.warning;a.charge.visible=state.warning||state.active;
    a.charge.scale.y=state.active?1:.15+charge*.85;
    // A brighter late warning is made by widening flat dashes, never a false wall.
    a.warning.scale.z=.25+charge*.75;a.discharge.scale.y=quality==="low"?1:.85+Math.sin(ms*.08)*.15;
   }
   banks.position.y=quality==="low"?5:-3+((ms*.00014)%1)*16;
   if(quality!=="low")rotor.rotation.z=ms*.00014;kit.materials.glow.emissiveIntensity=.65;
  };
 return {update,
  setQuality(q){quality=q;kit.setQuality(q);update(lastMs,lastSeed);},
  dispose(){if(disposed)return;disposed=true;for(const {mesh,material,visible}of replaced){mesh.material=material;mesh.visible=visible;}kit.dispose();},
 };
}
