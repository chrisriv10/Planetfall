import * as THREE from "three";
import {SHOP_CATALOG} from "@planetfall/shared";
import {cosmeticTrailStyle} from "../../cosmetic-flight-trail";

const CAPACITY=8,LIFETIME=.36;
const trailColors=new Map(SHOP_CATALOG.filter(item=>item.category==="trail").map(item=>[item.id,item.color]));

// Each instance carries one path segment. Two strips follow its local transverse
// frame and one billboard carries the catalog particle silhouette in the same draw.
function segmentGeometry():THREE.BufferGeometry {
  const positions:number[]=[];
  for(let plane=0;plane<2;plane++)for(let step=0;step<3;step++){
    const a=step/3,b=(step+1)/3;
    positions.push(-1,a,plane,1,a,plane,1,b,plane,-1,a,plane,1,b,plane,-1,b,plane);
  }
  positions.push(-1,-1,2,1,-1,2,1,1,2,-1,-1,2,1,1,2,-1,1,2);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  return geometry;
}

const vertexShader=`
uniform float width, particleSize, kind;
varying vec2 uvMark;
varying float plane, life, segment;
void main(){
  plane=position.z;
  segment=float(gl_InstanceID);
  life=length(instanceMatrix[0].xyz);
  vec4 mv;
  if(plane>1.5){
    mv=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
    uvMark=position.xy;
    float angle=segment*2.39996;
    mv.xy+=(position.xy+vec2(cos(angle),sin(angle))*.8)*particleSize*life*.5;
  }else{
    float along=position.y;
    float taper=1.-(segment+along)/10.;
    vec2 offset;
    if(kind==1.){
      float phase=(segment+along)*.74+plane*3.14159;
      offset=vec2(cos(phase),sin(phase))*(1.+position.x*.28);
    }else if(kind==3.){
      offset=vec2(plane<.5?position.x:.84+position.x*.16,0.);
    }else{
      offset=plane<.5?vec2(position.x,0.):vec2(0.,position.x);
    }
    offset*=width*taper;
    mv=modelViewMatrix*instanceMatrix*vec4(offset.x,along,offset.y,1.);
    uvMark=vec2(position.x,along);
  }
  gl_Position=projectionMatrix*mv;
}`;

const fragmentShader=`
uniform vec3 tint,edge,ink;
uniform float kind,dashed,particleSize,shape;
varying vec2 uvMark;
varying float plane,life,segment;
void main(){
  vec3 color=tint;
  float alpha=life*.78;
  if(plane>1.5){
    if(particleSize<=0.)discard;
    float r=length(uvMark),mask;
    if(shape==1.) mask=1.-smoothstep(.72,.98,r/(.44+.56*abs(cos(3.*atan(uvMark.y,uvMark.x)))));
    else if(shape==2.) mask=smoothstep(.48,.68,r)*(1.-smoothstep(.76,.98,r));
    else if(shape==3.) mask=(1.-smoothstep(.04,.18,min(abs(uvMark.x),abs(uvMark.y))))*(1.-smoothstep(.3,.98,r));
    else mask=1.-smoothstep(.1,.98,r);
    alpha*=mask;
  }else{
    if(dashed>.5&&mod(segment,3.)==1.)discard;
    if(kind==1.&&plane>.5)color=edge;
    if(kind==3.)color=plane<.5?ink:edge;
    alpha*=1.-.28*abs(uvMark.x);
  }
  if(alpha<.012)discard;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createPrTrailArt(scene:THREE.Scene){
  const geometry=segmentGeometry();
  const uniforms={
    width:{value:.065},particleSize:{value:0},dashed:{value:0},kind:{value:0},shape:{value:0},
    tint:{value:new THREE.Color()},edge:{value:new THREE.Color()},ink:{value:new THREE.Color(0x392748)},
  };
  const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,
    side:THREE.DoubleSide,forceSinglePass:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const trail=new THREE.InstancedMesh(geometry,material,CAPACITY);
  trail.name="planet-run-cosmetic-trail";trail.visible=false;trail.frustumCulled=false;
  trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(trail);
  const points=Array.from({length:CAPACITY},()=>new THREE.Vector3());
  const times=new Float64Array(CAPACITY);
  const previous=new THREE.Vector3(),head=new THREE.Vector3(),end=new THREE.Vector3();
  const tangent=new THREE.Vector3(),normal=new THREE.Vector3(),cross=new THREE.Vector3(),matrix=new THREE.Matrix4();
  const up=new THREE.Vector3(0,1,0),light=new THREE.Color();
  let newest=0,count=0,time=0,serial=0,lastId="",lastColor="",disposed=false;

  function reset(){count=0;trail.visible=false;}
  function configure(id:string,pilotColor:string){
    const style=cosmeticTrailStyle(id);
    uniforms.width.value=style.width;uniforms.dashed.value=Number(style.dashed);uniforms.particleSize.value=style.particles;
    uniforms.kind.value=id==="plasma-helix"?1:id==="void-wake"?3:0;
    uniforms.shape.value=id==="solar-petals"?1:id==="bubbles"?2:id==="sparks"||id==="stardust"?3:0;
    uniforms.tint.value.set(trailColors.get(id)??pilotColor);
    light.setHex(id==="void-wake"?0xc5a9ff:0xeeceff);
    uniforms.edge.value.copy(uniforms.tint.value).lerp(light,.55);
    material.blending=id==="void-wake"?THREE.NormalBlending:THREE.AdditiveBlending;
    trail.userData.cosmeticId=id;lastId=id;lastColor=pilotColor;reset();
  }
  return {
    update(position:THREE.Vector3,id:string,pilotColor:string,dt:number,near:boolean,emit:boolean,cadenceSeconds:number,celebrating=false){
      if(disposed)return;
      if(!near){reset();return;}
      if(id!==lastId||pilotColor!==lastColor)configure(id,pilotColor);
      if(count&&previous.distanceToSquared(position)>100)reset();
      previous.copy(position);time+=Math.max(0,dt);
      while(count&&time-times[(newest+CAPACITY-count+1)%CAPACITY]>=LIFETIME)count--;
      if(!emit&&!count){trail.visible=false;return;}
      head.copy(position);head.y+=.8;
      if(celebrating){head.x+=Math.sin(serial*2.4)*.45;head.z+=Math.cos(serial*2.4)*.45;head.y+=(serial%3)*.3;}
      if(emit&&(!count||time-times[newest]>=cadenceSeconds)){
        newest=(newest+1)%CAPACITY;points[newest].copy(head);times[newest]=time;serial++;
        count=Math.min(count+1,CAPACITY);
      }
      // Connect sampled points newest to oldest. The first segment also covers
      // the live tip between samples, without stretching after emission stops.
      if(!emit)head.copy(points[newest]);
      for(let i=0;i<count;i++){
        const slot=(newest+CAPACITY-i)%CAPACITY;
        end.copy(points[slot]);
        tangent.subVectors(end,head);let length=tangent.length();
        if(length<.001){tangent.set(0,-1,0);length=.08;}
        else tangent.multiplyScalar(1/length);
        normal.crossVectors(tangent,up);
        if(normal.lengthSq()<.0001)normal.set(1,0,0);else normal.normalize();
        cross.crossVectors(normal,tangent);
        const life=1-(time-times[slot])/LIFETIME;
        matrix.makeBasis(normal.multiplyScalar(life),tangent.multiplyScalar(length),cross.multiplyScalar(life));
        matrix.setPosition(head);trail.setMatrixAt(i,matrix);head.copy(end);
      }
      trail.count=count;trail.visible=count>0;trail.instanceMatrix.needsUpdate=true;
    },
    dispose(){if(disposed)return;disposed=true;trail.removeFromParent();trail.dispose();geometry.dispose();material.dispose();},
  };
}
