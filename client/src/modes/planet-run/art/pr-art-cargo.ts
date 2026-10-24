import {createPrArtKit,type PrArtContext,type PrRoundArt,type PrArtMaterial,type PrArtPrimitive,type PrArtPlacement} from './pr-art-shared';

/** Freight terminal dressing. Moving support groups are owned and updated by the world. */
export function createPrCargoArt(ctx:PrArtContext):PrRoundArt {
 const kit=createPrArtKit(ctx),originals=[...ctx.surfaces,...ctx.hazardVolumes].map(([id,m])=>({id,m,material:m.material}));
 for(const surface of ctx.surfaces.values())surface.material=kit.materials.neutral;
 for(const volume of ctx.hazardVolumes.values())volume.material=kit.materials.primary;
 ctx.round.platforms.forEach((p,index)=>{
  const moving=!!p.motion,parent=moving?ctx.platforms.get(p.id):ctx.root;if(!parent)return;
  const add=(name:string,primitive:PrArtPrimitive,material:PrArtMaterial,a:PrArtPlacement,rotation:readonly[number,number,number]=[0,0,0],tier=0)=>kit.add(name,primitive,material,[a[0]+(moving?0:p.center.x),a[1]+(moving?0:p.center.y),a[2]+(moving?0:p.center.z),a[3],a[4],a[5]],parent,rotation,tier);
  const hx=p.half.x,hz=p.half.z,top=p.half.y;
  // Conveyor lanes cross X, matching the shared conveyor vector. Dispatch/start
  // decks instead have lengthwise loading lanes. These are all flush markings.
  if(p.conveyor){
   for(const z of [-hz*.49,hz*.49])add('freight-belt','box','dark',[0,top+.004,z,hx*2-.6,.006,hz-.7]);
   for(let x=-hx+.8;x<hx-.4;x+=1.6)for(const z of [-hz*.49,hz*.49])add('belt-slats','box','soft',[x,top+.009,z,.065,.006,hz-1.2]);
  }else for(const x of [-4.3,4.3])add('freight-belt','box','dark',[x,top+.004,0,6.9,.006,hz*2-.5]);
  for(let z=-hz+.8;z<hz-.4;z+=1.6) {
   if(!p.conveyor)for(const x of [-4.3,4.3])add('belt-slats','box','soft',[x,top+.009,z,6.4,.006,.065]);
   for(const side of [-1,1])add('load-bumper','box',index%2?'primary':'secondary',[side*(hx-.38),-.18,z,.65,.68,1.1]);
  }
  add('freight-spine','box','white',[0,top+.006,0,p.conveyor?hx*2-.6:1.05,.008,p.conveyor?.85:hz*2-.6]);
  for(let code=0;code<7;code++)add('freight-manifest-code','box','white',[6.8-code*.18,top+.015,hz-1.4,code%3===0?.1:.045,.006,.65],undefined,2);
  add('loading-chassis','box','dark',[0,-1.05,0,hx*1.92,.75,hz*1.94]);
  for(const end of [-1,1]) {
   // Cylinders lie along X, recessed beneath the collision volume.
   if(p.conveyor)add('conveyor-return-roller','cylinder','soft',[end*(hx-.65),-.85,0,.52,hz*1.85,.52],[Math.PI/2,0,0]);
   else add('conveyor-return-roller','cylinder','soft',[0,-.85,end*(hz-.65),.52,hx*1.85,.52],[0,0,Math.PI/2]);
   add('transfer-endcap','box','primary',[0,-.26,end*(hz-.15),hx*1.9,.55,.25]);
  }
  if(p.conveyor)for(const z of [-hz*.49,hz*.49])for(const x of [-5,0,5])for(const s of [-1,1]) {
   const direction=Math.sign(p.conveyor.x);
   add('belt-direction','box','secondary',[x,top+.014,z+s*.32,.95,.008,.18],[0,direction*s*Math.PI/4,0]);
  }
 });
 // Hazard shells stay exactly within the shared collision box (including overlays).
 for(const o of ctx.round.obstacles){const parent=ctx.obstacles.get(o.id);if(!parent)continue;
  for(const face of [-1,1]){
   kit.add('sorter-rotor-inset','box','dark',[0,0,face*(o.half.z+.002),o.half.x*2-.6,o.half.y*1.15,.004],parent);
   for(let x=-o.half.x+1;x<o.half.x;x+=2)kit.add('sorter-warning','box','glow',[x,0,face*(o.half.z+.005),.5,.13,.004],parent);
  }
 }
 for(const [z,title] of [[16,'ORBITAL FREIGHT / 07'],[-60,'TRANSFER / CYCLONE'],[-124,'DISPATCH']] as const){
  for(const side of [-1,1]){
   kit.add('scanner-tower','box','primary',[side*11.5,3.3,z,2,8,2.2]);
   kit.add('scanner-reader','box','glow',[side*10.45,3,z,.08,4,.7]);
   kit.add('portal-foot','box','dark',[side*11.5,-1.3,z,3.2,1.3,3.6]);
  }
  kit.add('scanner-bridge','box','white',[0,7.5,z,25,1.6,2]);
  kit.add('scanner-header','box','primary',[0,7.55,z+1.03,16,1.2,.08]);
  kit.label(title,[0,7.55,z+1.09,14,1,1]);
 }
 // Cyclone Sorter: a vertical wheel over the unreachable starboard loading dock.
 const rotor=kit.group('cargo-cyclone-sorter');rotor.position.set(37,14,-72);
 kit.add('sorter-fixed-rim','torus','white',[37,14,-72,17,17,17]);
 kit.add('sorter-routing-rim','torus','glow',[37,14,-71.8,15.5,15.5,15.5]);
 kit.add('sorter-drive','cylinder','dark',[37,14,-74,4,7,4],undefined,[Math.PI/2,0,0]);
 for(const side of [-1,1])kit.add('sorter-support','box','primary',[37+side*13,0,-74,3,22,4]);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,x=Math.cos(a),y=Math.sin(a);
  kit.add('routing-spoke','box','secondary',[x*8,y*8,0,15,.75,.8],rotor,[0,0,a]);
  kit.add('freight-capsule','box',i%2?'primary':'white',[x*13,y*13,0,4.7,3,3.8],rotor,[0,0,a]);
  kit.add('capsule-scan-window','box','dark',[x*13,y*13,1.94,3,1.3,.08],rotor,[0,0,a]);
 }
 kit.label('CYCLONE SORTER',[37,34,-71,20,2.4,1]);
 const traffic=kit.group('cargo-parallel-traffic',ctx.root,1);
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const x=side*25,z=18-i*36;
  kit.add('parallel-freight-guide','box','dark',[x,-4,-55,.5,.6,170]);
  kit.add('traffic-pod','box',i%2?'primary':'secondary',[x,-1.3,z,3.2,2.7,5.4],traffic);
  kit.add('traffic-rib','box','white',[x,-1.3,z+1.6,3.25,2.75,.16],traffic);
 }
 const loader=kit.group('cargo-suspended-loader',ctx.root,1);loader.position.set(-34,8,-42);
 kit.add('loader-cargo','box','secondary',[0,-2,0,6,3,6],loader);
 for(const x of [-2.5,2.5])kit.add('loader-suspension','box','dark',[x,1,0,.2,6,.2],loader);
 kit.add('loader-clamp','box','white',[0,0,0,7,.45,6.5],loader);
 kit.finish();let quality='high',disposed=false;
 return {update(ms){if(disposed)return;const t=ms*.001;rotor.rotation.z=t*.075;if(quality!=='low'){traffic.position.z=Math.sin(t*.12)*10;loader.position.y=8+Math.sin(t*.35)*2;}},setQuality(q){quality=q;kit.setQuality(q);},dispose(){if(disposed)return;disposed=true;for(const r of originals)r.m.material=r.material;kit.dispose();}};
}
