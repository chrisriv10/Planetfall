import {createPrArtKit,type PrArtContext,type PrRoundArt} from './pr-art-shared';

/** A single radial collector drawn onto the exact nine support boxes. */
export function createPrSolarArt(ctx:PrArtContext):PrRoundArt {
 const kit=createPrArtKit(ctx),originals=[...ctx.surfaces.values(),...ctx.hazardVolumes.values()].map(m=>({m,material:m.material}));
 // Subdued violet cells leave the amber hazard silhouette as the strongest mark.
 kit.materials.soft.color.setHex(0x514b6c);
 for(const surface of ctx.surfaces.values())surface.material=kit.materials.dark;
 // Radial color bands deliberately cross tile boundaries. Each mark is still clipped
 // to a single support: the visible 20cm gaps remain honest, never bridged by paint.
 for(const p of ctx.round.platforms){
  for(let ix=0;ix<8;ix++)for(let iz=0;iz<8;iz++){
   const x=p.center.x+(ix-3.5)*1.43,z=p.center.z+(iz-3.5)*1.43,r=Math.hypot(x,z);
   const band=Math.floor(r/4.5);
   kit.add('collector-cell','box',band%2?'dark':'soft',[x,p.center.y+p.half.y+.005,z,1.39,.008,1.39]);
   if((ix+iz)%2===0)kit.add('cell-contact','box','soft',[x,p.center.y+p.half.y+.011,z,1.2,.004,.025],undefined,[0,0,0],1);
   if(ix%3===0&&iz%3===0)kit.add('cell-terminal','box','primary',[x+.52,p.center.y+p.half.y+.013,z,.045,.004,.2],undefined,[0,0,0],2);
  }
  // Converging radial traces are sampled, and only kept when the entire mark fits.
  for(let i=0;i<12;i++)for(let r=2;r<25;r+=.7){const a=i*Math.PI/6,x=Math.cos(a)*r,z=Math.sin(a)*r;
   if(Math.abs(x-p.center.x)<p.half.x-.4&&Math.abs(z-p.center.z)<p.half.z-.4)
    kit.add('radial-bus','box','primary',[x,p.center.y+p.half.y+.017,z,.11,.006,.66],undefined,[0,Math.PI/2-a,0]);
  }
 }
 // Rounded rib cage sits well beneath the support plane. No extra opaque floor.
 for(const r of [9,17,24.7])kit.add('collector-under-ring','torus',r===24.7?'primary':'dark',[0,-2.3,0,r,r,r],undefined,[Math.PI/2,0,0]);
 for(let i=0;i<24;i++){
  const a=i*Math.PI/12,x=Math.cos(a),z=Math.sin(a);
  kit.add('collector-radial-rib','box','dark',[x*13,-2.3,z*13,23,.65,.6],undefined,[0,-a,0]);
  kit.add('collector-edge-petal','box','primary',[x*22,-3.1,z*22,4.3,.5,2.2],undefined,[0,-a,0]);
  kit.add('collector-edge-emitter','box','glow',[x*24,-2.9,z*24,.25,.2,1.4],undefined,[0,-a,0],1);
 }
 kit.add('collector-under-core','cylinder','dark',[0,-3.5,0,5,3,5]);
 kit.add('collector-under-core-cap','cylinder','primary',[0,-5.1,0,4.3,.3,4.3]);
 // All arm detailing fits within the authority envelope + a sub-centimetre decal.
 for(const o of ctx.round.obstacles){const parent=ctx.obstacles.get(o.id);if(!parent)continue;const high=o.id==='solar-high',hx=o.half.x,hy=o.half.y,hz=o.half.z;
  const volume=ctx.hazardVolumes.get(o.id);if(volume)volume.material=high?kit.materials.secondary:kit.materials.hazard;
  kit.add('energy-arm-top','box',high?'dark':'hazard',[0,hy+.002,0,hx*2-.5,.004,hz*1.5],parent);
  for(const face of [-1,1]){
   kit.add('energy-arm-collector','box',high?'white':'dark',[0,0,face*(hz+.002),hx*2-.5,hy*1.5,.004],parent);
   kit.add('energy-arm-strip','box',high?'primary':'glow',[0,-hy*.45,face*(hz+.005),hx*2-.8,hy*.22,.004],parent);
   for(let x=-hx+1;x<hx;x+=1.8)kit.add('energy-arm-vanes','box',high?'dark':'white',[x,hy*.12,face*(hz+.006),high?.14:.42,hy*.85,.004],parent);
  }
  kit.add('energy-arm-hub','cylinder','white',[0,hy+.004,0,hz*.78,.004,hz*.78],parent);
 }
 // Suspended turbine is entirely above reach; there is no false solid center post.
 const turbine=kit.group('solar-overhead-turbine');turbine.position.y=16;
 kit.add('suspended-reactor','sphere','primary',[0,0,0,3,2,3],turbine);
 kit.add('reactor-crown','torus','white',[0,0,0,8,8,8],turbine,[Math.PI/2,0,0]);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;
  kit.add('turbine-petal','box','primary',[Math.cos(a)*6,0,Math.sin(a)*6,6,.35,1.7],turbine,[0,-a+.32,0]);
  kit.add('turbine-cell','box','dark',[Math.cos(a)*6,.2,Math.sin(a)*6,4.8,.04,1.1],turbine,[0,-a+.32,0]);
 }
 kit.add('overhead-containment','torus','secondary',[0,16,0,10.3,10.3,10.3],undefined,[Math.PI/2,0,0]);
 const pulse=kit.group('solar-energy-pulse',ctx.root,1);pulse.position.y=16;
 kit.add('reactor-energy-ring','torus','glow',[0,0,0,4,4,4],pulse,[Math.PI/2,0,0]);
 // Far collector sail tilts as a unit, adding slow heliostat tracking.
 const sail=kit.group('solar-tracking-sail',ctx.root,1);sail.position.set(-30,13,-32);
 for(let i=0;i<5;i++){
  kit.add('heliostat-petal','box','primary',[(i-2)*4,0,0,3.8,.5,14],sail);
  kit.add('heliostat-cell','box','dark',[(i-2)*4,.28,0,3.4,.06,13],sail);
 }
 kit.add('heliostat-pedestal','cylinder','white',[-30,1,-32,1.5,17,1.5]);
 kit.label('HELIOS / COLLECTION ARRAY',[0,19.5,-7,13,1.4,1]);
 kit.finish();let quality='high',disposed=false;
 return {update(ms){if(disposed)return;const t=ms*.001;turbine.rotation.y=t*.12;if(quality!=='low'){sail.rotation.z=Math.sin(t*.09)*.18;sail.rotation.x=.35+Math.sin(t*.11)*.1;pulse.scale.setScalar(1+Math.sin(t*1.5)*.07);}},setQuality(q){quality=q;kit.setQuality(q);},dispose(){if(disposed)return;disposed=true;for(const r of originals)r.m.material=r.material;kit.dispose();}};
}
