import * as THREE from "three";

export type PlanetCosmeticStyle="ocean"|"cinder"|"garden";
const width=256,height=128;
type Surface={color:Uint8Array;relief:Uint8Array|null};
const surfaces=new Map<PlanetCosmeticStyle,Surface>();
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>x*x*(3-2*x);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function hash(x:number,y:number,z:number){
  let h=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,144269503);
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967295;
}
function noise(x:number,y:number,z:number){
  const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z);
  const u=smooth(x-a),v=smooth(y-b),w=smooth(z-c);
  const front=mix(mix(hash(a,b,c),hash(a+1,b,c),u),mix(hash(a,b+1,c),hash(a+1,b+1,c),u),v);
  const back=mix(mix(hash(a,b,c+1),hash(a+1,b,c+1),u),mix(hash(a,b+1,c+1),hash(a+1,b+1,c+1),u),v);
  return mix(front,back,w);
}
function colorMix(a:number,b:number,t:number){
  const r=Math.round(mix(a>>16,b>>16,t)),g=Math.round(mix((a>>8)&255,(b>>8)&255,t)),bl=Math.round(mix(a&255,b&255,t));
  return (r<<16)|(g<<8)|bl;
}
// Coordinates are sampled on the unit sphere, so coasts, cloud lanes and fractures cross the UV seam.
function surface(style:PlanetCosmeticStyle):Surface{
  const existing=surfaces.get(style);if(existing)return existing;
  const color=new Uint8Array(width*height*4),relief=style==="cinder"?new Uint8Array(width*height):null;
  const craters=Array.from({length:25},(_,i)=>{
    const y=1-2*(i+.5)/25,radial=Math.sqrt(1-y*y),angle=i*2.399963;
    return {x:Math.cos(angle)*radial,y,z:Math.sin(angle)*radial,radius:.065+.175*hash(i,23,6)};
  });
  for(let j=0;j<height;j++){
    const lat=((j+.5)/height-.5)*Math.PI,y=Math.sin(lat),radius=Math.cos(lat);
    for(let i=0;i<width;i++){
      const lon=(i+.5)/width*Math.PI*2,x=-radius*Math.cos(lon),z=radius*Math.sin(lon);
      const broad=noise(x*2.1+3,y*2.1+8,z*2.1-1),middle=noise(x*5.6-7,y*5.6,z*5.6+3);
      const grain=noise(x*16+2,y*16-11,z*16),land=.62*broad+.26*middle+.12*grain;
      let rgb:number;
      if(style==="ocean"){
        const shelf=clamp((land-.38)*6);
        rgb=colorMix(0x103268,0x259aa7,shelf);
        if(land>.573)rgb=colorMix(0xd5c495,0x64956e,clamp((land-.573)*35));
        if(land>.625)rgb=colorMix(0x63976d,0x365d56,clamp((land-.625)*11));
        const lane=Math.sin(lat*18+x*2.8+z*3.6+middle*2.7);
        const cloud=clamp((lane-.37)*2.0)*clamp((noise(x*5,y*10,z*5)-.43)*4);
        rgb=colorMix(rgb,0xeaf8f0,cloud*.73);
      }else if(style==="garden"){
        const coast=land+.055*Math.sin(4*x-3*z);
        rgb=colorMix(0x0f576b,0x348f85,clamp((coast-.26)*4));
        if(coast>.47)rgb=colorMix(0x92ad70,0x37926b,clamp((coast-.47)*30));
        if(coast>.52)rgb=colorMix(0x287456,0x94b967,clamp((middle-.25)*1.8));
        if(coast>.67)rgb=colorMix(rgb,0xbac99a,clamp((coast-.67)*6));
      }else{
        let rock=land*.76+.08,lip=0,bowl=0;
        for(const c of craters){
          const d2=2*(1-x*c.x-y*c.y-z*c.z);
          if(d2>c.radius*c.radius*1.52)continue;
          const d=Math.sqrt(Math.max(0,d2))/c.radius;
          lip=Math.max(lip,clamp(1-Math.abs(d-.91)*7));bowl=Math.max(bowl,clamp((.91-d)*2));
        }
        rock=clamp(rock+.25*lip-.30*bowl);
        const fracture=Math.min(Math.abs(Math.sin(x*6+y*3-z*4+middle*2)),Math.abs(Math.sin(x*4-y*5+z*2.7+broad*3)));
        const copper=clamp((.075-fracture)*17)*clamp((grain-.18)*2.5);
        rgb=colorMix(colorMix(0x272632,0x897c74,rock),0xf6a466,copper*.86);
        relief![j*width+i]=Math.round(clamp(.54+grain*.08+lip*.23-bowl*.29-copper*.10)*255);
      }
      const index=(j*width+i)*4;color[index]=rgb>>16;color[index+1]=(rgb>>8)&255;color[index+2]=rgb&255;color[index+3]=255;
    }
  }
  const result={color,relief};surfaces.set(style,result);return result;
}
function makeTexture(data:Uint8Array,format:THREE.PixelFormat,style:string){
  const texture=new THREE.DataTexture(data,width,height,format);
  texture.name=style;texture.wrapS=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

export function createPlanetCosmeticVariant(style:PlanetCosmeticStyle,radius:number){
  if(!Number.isFinite(radius)||radius<=0)throw new RangeError("Planet radius must be positive and finite");
  const group=new THREE.Group();group.name=`planet-cosmetic-${style}`;
  const paint=surface(style),map=makeTexture(paint.color,THREE.RGBAFormat,style+"-surface");
  map.colorSpace=THREE.SRGBColorSpace;
  const bump=paint.relief?makeTexture(paint.relief,THREE.RedFormat,"cinder-crater-relief"):null;
  const geometry=new THREE.SphereGeometry(radius,56,36);
  const material=new THREE.MeshStandardMaterial({map,bumpMap:bump,bumpScale:radius*.007,roughness:style==="ocean" ? .55 : .86,metalness:style==="cinder" ? .12 : .025});
  const shell=new THREE.Mesh(geometry,material);shell.name=style+"-shell";group.add(shell);
  let ring:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>|null=null;
  if(style==="garden"){
    // A narrow, interrupted orbital ribbon stays clear of the near-surface silhouette.
    const band=new THREE.RingGeometry(radius*1.20,radius*1.219,96,1,.18,Math.PI*1.85);
    ring=new THREE.Mesh(band,new THREE.MeshBasicMaterial({color:0xc1dba1,side:THREE.DoubleSide,transparent:true,opacity:.55,depthWrite:false}));
    ring.name="garden-orbital-ribbon";ring.rotation.set(1.18,.22,-.33);group.add(ring);
  }
  group.traverse(node=>{node.userData.cameraCollision=false;});
  let disposed=false;
  return {group,shell,
    update(timeSeconds:number,_camera?:THREE.Camera,reducedMotion=false){
      if(!disposed && ring)ring.rotation.z=-.33+(reducedMotion||!Number.isFinite(timeSeconds)?0:.045*Math.sin(timeSeconds*.12));
    },
    dispose(){
      if(disposed)return;disposed=true;group.removeFromParent();group.clear();
      geometry.dispose();material.dispose();map.dispose();bump?.dispose();ring?.geometry.dispose();ring?.material.dispose();
    }
  };
}
