import * as THREE from "three";
import type {PrRoundDefinition,PrRoundId} from "@planetfall/shared";
import type {PrArtQuality} from "./pr-art-shared";

interface SkyScript {
 horizon:number;zenith:number;under:number;nebula:number;planet:number;cloud:number;station:number;accent:number;
 location:readonly[number,number,number];radius:number;traffic:"freight"|"collector"|"habitat"|"seed"|"relay"|"observer";
}
const SCRIPTS:Record<PrRoundId,SkyScript>={
 "cargo-cyclone":{horizon:0x738296,zenith:0x18243e,under:0x182b41,nebula:0xc38c72,planet:0x697e9e,cloud:0xd2bbad,station:0x243548,accent:0xffaa72,location:[-155,-25,-445],radius:100,traffic:"freight"},
 "solar-sweep":{horizon:0xc5a485,zenith:0x383455,under:0x403658,nebula:0xf3c885,planet:0x9d7d99,cloud:0xe9cdb5,station:0x55415d,accent:0xffdf9b,location:[-160,-40,-450],radius:100,traffic:"collector"},
 "meteor-garden":{horizon:0x799a9d,zenith:0x1b3d52,under:0x173c46,nebula:0x98c7ac,planet:0x49818b,cloud:0xd0e4c3,station:0x315958,accent:0xb9eab9,location:[-145,-40,-440],radius:125,traffic:"habitat"},
 "flux-gardens":{horizon:0x8e7fa8,zenith:0x322353,under:0x292644,nebula:0xbd8fe3,planet:0x8073ac,cloud:0xc7bce9,station:0x49415f,accent:0xb3f3e0,location:[150,-55,-455],radius:110,traffic:"seed"},
 "capacitor-causeway":{horizon:0x6a8fa6,zenith:0x142c52,under:0x17314e,nebula:0x83b8d6,planet:0x4d749a,cloud:0xb2d3dd,station:0x243f5c,accent:0xace9ff,location:[-160,-35,-450],radius:110,traffic:"relay"},
 shatterdeck:{horizon:0x474363,zenith:0x10172d,under:0x15162f,nebula:0x776095,planet:0x5e618d,cloud:0xbaa8c3,station:0x2e3049,accent:0xd9a9e9,location:[-70,-90,-460],radius:160,traffic:"observer"},
};

// Cache CPU pixels only: six small pairs at most. GPU texture ownership stays local.
const bakedPixels=new Map<PrRoundId,{sky:Uint8Array;planet:Uint8Array}>();
function bake(id:PrRoundId,script:SkyScript){
 const cached=bakedPixels.get(id);if(cached)return cached;
 const sky=new Uint8Array(256*128*4),planet=new Uint8Array(512*256*4);
 const horizon=new THREE.Color(script.horizon),zenith=new THREE.Color(script.zenith),under=new THREE.Color(script.under),nebula=new THREE.Color(script.nebula),base=new THREE.Color(script.planet),cloud=new THREE.Color(script.cloud),color=new THREE.Color();
 for(let y=0;y<128;y++)for(let x=0;x<256;x++){
  const latitude=Math.cos(y/127*Math.PI),longitude=x/256*Math.PI*2;
  color.copy(horizon).lerp(latitude>0?zenith:under,Math.min(1,Math.abs(latitude)*1.6));
  // A broad oblique nebula crosses the useful horizon, with quieter wisps above
  // and below. Baked detail adds depth without transparent fullscreen layers.
  const band=latitude+.04-Math.sin(longitude*2)*.18;
  const wisps=.64+.22*Math.sin(longitude*9+latitude*21)+.14*Math.sin(longitude*17-latitude*37);
  const glow=Math.exp(-band*band*48)*(.22+.15*Math.sin(longitude+1)**2)*wisps+Math.exp(-((band+.24)**2)*75)*.055;
  color.lerp(nebula,glow).convertLinearToSRGB();const offset=((127-y)*256+x)*4;
  sky[offset]=Math.round(color.r*255);sky[offset+1]=Math.round(color.g*255);sky[offset+2]=Math.round(color.b*255);sky[offset+3]=255;
 }
 // Continuous softly shaded bands/clouds are baked at texture resolution, not
 // thresholded per vertex: close silhouettes never expose colored triangles.
 for(let y=0;y<256;y++)for(let x=0;x<512;x++){
  const latitude=y/255*Math.PI,longitude=x/512*Math.PI*2,ny=Math.cos(latitude),nx=-Math.cos(longitude)*Math.sin(latitude),nz=Math.sin(longitude)*Math.sin(latitude);
  const bands=.5+.5*Math.sin(ny*23+Math.sin(longitude*3)*.6+Math.sin(longitude*7+ny*12)*.22);
  const clouds=(.5+.5*Math.sin(longitude*5+Math.sin(ny*13)*2))*(.5+.5*Math.sin(ny*35+longitude*2));
  color.copy(base).lerp(cloud,.12+bands*.3+clouds*.2).multiplyScalar(.26+.74*Math.max(0,nx*-.45+ny*.55+nz*.7)).convertLinearToSRGB();
  const offset=((255-y)*512+x)*4;planet[offset]=Math.round(color.r*255);planet[offset+1]=Math.round(color.g*255);planet[offset+2]=Math.round(color.b*255);planet[offset+3]=255;
 }
 const result={sky,planet};bakedPixels.set(id,result);return result;
}

/** One inexpensive sky rig, authored through a per-round color/composition script. */
export function createPrSkyArt(round:PrRoundDefinition):{root:THREE.Group;update(elapsedMs:number):void;setQuality(q:PrArtQuality):void;dispose():void}{
 const script=SCRIPTS[round.id],pixels=bake(round.id,script),root=new THREE.Group();root.name=`pr-sky:${round.id}`;root.userData.cameraCollision=false;
 const resources=new Set<THREE.BufferGeometry|THREE.Material|THREE.Texture>(),batches:THREE.InstancedMesh[]=[];
 const resource=<T extends THREE.BufferGeometry|THREE.Material|THREE.Texture>(r:T):T=>{resources.add(r);return r;};
 const texture=(data:Uint8Array,w:number,h:number)=>{const t=resource(new THREE.DataTexture(data,w,h));t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
 const basic=(color:number)=>resource(new THREE.MeshBasicMaterial({color,fog:false}));
 const sphere=resource(new THREE.SphereGeometry(1,48,32)),box=resource(new THREE.BoxGeometry(1,1,1)),torus=resource(new THREE.TorusGeometry(1,.025,5,48));
 const skyMaterial=resource(new THREE.MeshBasicMaterial({map:texture(pixels.sky,256,128),side:THREE.BackSide,depthWrite:false,fog:false}));
 const sky=new THREE.Mesh(sphere,skyMaterial);sky.name="orbital-sky";sky.scale.setScalar(650);sky.position.z=-55;sky.renderOrder=-10;sky.frustumCulled=false;root.add(sky);
 const planetMaterial=resource(new THREE.MeshBasicMaterial({map:texture(pixels.planet,512,256),fog:false}));
 const planet=new THREE.Mesh(sphere,planetMaterial);planet.name="distant-band-planet";planet.position.set(...script.location);planet.scale.setScalar(script.radius);root.add(planet);
 // Thin diffuse orbital dust is a disc rather than a solid torus. Depth testing
 // lets the planet naturally occlude its far half; a small moon completes scale.
 const beltGeometry=resource(new THREE.RingGeometry(script.radius*1.23,script.radius*1.72,96));
 const beltMaterial=resource(new THREE.MeshBasicMaterial({color:script.cloud,side:THREE.DoubleSide,transparent:true,opacity:.19,depthWrite:false,fog:false}));
 const belt=new THREE.Mesh(beltGeometry,beltMaterial);belt.name="distant-planet-dust-belt";belt.position.copy(planet.position);belt.rotation.set(1.13,.18,round.id==="shatterdeck"?-.4:.3);root.add(belt);
 const moon=new THREE.Mesh(sphere,basic(script.station));moon.name="distant-habitat-moon";moon.position.set(-script.location[0]*1.4,75,-435);moon.scale.setScalar(round.id==="shatterdeck"?34:25);root.add(moon);
 const starPositions=new Float32Array(300*3);
 for(let i=0;i<300;i++){const a=i*2.399963,up=i%3===0?-.04+Math.sin(a*2)*.18+Math.sin(i*7.7)*.11:-.8+((i*73)%299)/299*1.75,r=Math.sqrt(1-up*up);starPositions[i*3]=Math.cos(a)*r*560;starPositions[i*3+1]=up*560;starPositions[i*3+2]=Math.sin(a)*r*560-55;}
 const starGeometry=resource(new THREE.BufferGeometry());starGeometry.setAttribute("position",new THREE.BufferAttribute(starPositions,3));
 const stars=new THREE.Points(starGeometry,resource(new THREE.PointsMaterial({color:script.cloud,size:1.15,sizeAttenuation:true,depthWrite:false,fog:false})));stars.name="orbital-starfield";root.add(stars);
 const silhouette=basic(script.station),accent=basic(script.accent),dummy=new THREE.Object3D();
 const batch=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,count:number)=>{const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=name;batches.push(mesh);root.add(mesh);return mesh;};
 const set=(mesh:THREE.InstancedMesh,i:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,rz=0)=>{dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,0,rz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);};
 const station=batch(`distant-${script.traffic}-station`,box,silhouette,24),rings=batch("distant-station-halos",torus,accent,3);
 for(let i=0;i<6;i++){
  const side=i%2?1:-1,x=side*(205+(i%3)*43),z=-250-(i%3)*70,y=32+(i%3)*29;
  const freight=script.traffic==="freight",collector=script.traffic==="collector",relay=script.traffic==="relay";
  set(station,i*4,x,y,z,freight?46:12,freight?6:26,12);
  set(station,i*4+1,x-22,y+3,z,collector?35:24,relay?21:3,collector?20:10,-.18);
  set(station,i*4+2,x+22,y+3,z,collector?35:24,relay?21:3,collector?20:10,.18);
  set(station,i*4+3,x,y+18,z,4,14,4);
  if(i<3)set(rings,i,x,y,z,script.traffic==="habitat"?28:20,script.traffic==="seed"?32:20,1,.3*i);
 }
 station.computeBoundingSphere();rings.computeBoundingSphere();
 const craft=batch(`distant-${script.traffic}-traffic`,box,accent,15);craft.instanceMatrix.setUsage(THREE.DynamicDrawUsage);craft.frustumCulled=false;
 if(round.id==="solar-sweep"){
  const sun=new THREE.Mesh(sphere,basic(0xffedbe));sun.name="solar-distant-sun";sun.position.set(-240,230,-390);sun.scale.setScalar(38);root.add(sun);
 }
 let disposed=false,craftCount=3;
 const update=(ms:number)=>{if(disposed)return;const t=ms/1000;planet.rotation.y=t*.003;
  for(let i=0;i<craftCount;i++){
   const x=Math.sin(t*.025+i*2.1)*220,y=70+i*31+Math.sin(t*.11+i)*3,z=-320-i*48;
   const freight=script.traffic==="freight",seed=script.traffic==="seed";
   set(craft,i*5,x,y,z,freight?10:5,seed?6:2.5,5);
   set(craft,i*5+1,x-5,y,z+1,4,1,9);set(craft,i*5+2,x+5,y,z+1,4,1,9);
   set(craft,i*5+3,x,y,z+5,2,1,3);set(craft,i*5+4,x,y+2,z-2,freight?7:1,freight?3:2,3);
  }craft.instanceMatrix.needsUpdate=true;
 };
 const setQuality=(q:PrArtQuality)=>{if(disposed)return;const level=q==="low"?0:q==="medium"?1:2;starGeometry.setDrawRange(0,[70,170,300][level]);station.count=[8,16,24][level];rings.count=[1,2,3][level];craftCount=level+1;craft.count=craftCount*5;};
 update(0);
 return {root,update,setQuality,dispose(){if(disposed)return;disposed=true;root.removeFromParent();root.clear();for(const b of batches)b.dispose();for(const r of resources)r.dispose();resources.clear();batches.length=0;}};
}
