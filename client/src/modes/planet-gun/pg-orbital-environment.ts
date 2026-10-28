import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Distant, non-traversable scenery. All geometry stays outside the arena.
 * Four materials / six draws at High; one baked texture, no lights or frame allocations. */
export function createPgOrbitalEnvironment() {
  const root = new THREE.Group(); root.name = "orbital-neighborhood";
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  const own = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(v:T):T => { resources.add(v); return v; };
  const planetMaterial=own(new THREE.ShaderMaterial({
    uniforms:{terrainMap:{value:null}},
    vertexShader: `varying vec2 terrainUv; varying vec3 worldNormal; varying vec3 eye; void main(){terrainUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);worldNormal=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform sampler2D terrainMap; varying vec2 terrainUv; varying vec3 worldNormal; varying vec3 eye;
      void main(){
        float edge=1.-max(0.,dot(normalize(worldNormal),normalize(eye)));
        float rim=edge*edge*edge;
        vec3 color=mix(texture2D(terrainMap,terrainUv).rgb,vec3(.16,.552,.688),rim*.64);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,fog:false}));
  // Bake canonical geography and illumination once. The planet covers many
  // pixels in ADS; evaluating terrain trigonometry per fragment is expensive
  // on integrated/software renderers. A small filtered map keeps cloud edges
  // smooth without exposing sphere triangles. Colors are stored in linear space.
  const planetGeometry=own(new THREE.SphereGeometry(105,64,40));
  const textureWidth=512,textureHeight=256;
  const terrainColors=new Uint8Array(textureWidth*textureHeight*4);
  const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
  const sunLength=Math.sqrt(.8*.8+.7*.7+.3*.3);
  for(let i=0;i<textureWidth*textureHeight;i++){
    const u=(i%textureWidth+.5)/textureWidth,v=(Math.floor(i/textureWidth)+.5)/textureHeight;
    const phi=u*Math.PI*2,theta=(1-v)*Math.PI;
    const x=-Math.cos(phi)*Math.sin(theta),y=Math.cos(theta),z=Math.sin(phi)*Math.sin(theta);
    // Warped geography has continental scale and fine coastal breakup. Cloud
    // bands follow latitude instead of reading as isolated white polka dots.
    const warp=Math.sin(z*5+x*3)*.8+Math.cos(y*7-z*4)*.4;
    const land=Math.sin(y*7+warp)+Math.sin(x*8+z*4)*.6+Math.cos(z*19-y*8)*.18+Math.sin(x*43+y*31+z*27)*.07;
    const coast=smooth(.20,.30,land),elevation=smooth(.4,1.8,land),shallows=smooth(-.12,.20,land);
    const ice=smooth(.78,.94,Math.abs(y+.13*Math.sin(x*4)));
    const cloudBand=Math.sin(y*39+Math.sin(x*6+z*4)*2.5+z*3);
    const clouds=smooth(.55,1.03,cloudBand)*smooth(-.3,.8,Math.sin(x*13-z*9)+Math.cos(y*18+x*5))*.48;
    const light=(.24+.80*smooth(-.28,.72,(-x*.8+y*.7+z*.3)/sunLength))*.8;
    terrainColors[i*4]=Math.round(255*mix(mix(mix(mix(.025,.07,shallows),mix(.30,.67,elevation),coast),.73,ice),.87,clouds)*light);
    terrainColors[i*4+1]=Math.round(255*mix(mix(mix(mix(.13,.39,shallows),mix(.42,.52,elevation),coast),.86,ice),.90,clouds)*light);
    terrainColors[i*4+2]=Math.round(255*mix(mix(mix(mix(.22,.43,shallows),mix(.25,.30,elevation),coast),.84,ice),.85,clouds)*light);
    terrainColors[i*4+3]=255;
  }
  const terrainMap=own(new THREE.DataTexture(terrainColors,textureWidth,textureHeight,THREE.RGBAFormat));
  terrainMap.name="orbital-geography-bake";
  terrainMap.wrapS=THREE.RepeatWrapping;terrainMap.wrapT=THREE.ClampToEdgeWrapping;
  terrainMap.magFilter=THREE.LinearFilter;terrainMap.minFilter=THREE.LinearMipmapLinearFilter;
  terrainMap.generateMipmaps=true;terrainMap.colorSpace=THREE.LinearSRGBColorSpace;terrainMap.needsUpdate=true;
  planetMaterial.uniforms.terrainMap.value=terrainMap;
  const planet=new THREE.Mesh(planetGeometry,planetMaterial);
  planet.name="neighborhood-planet"; planet.position.set(220,15,65); planet.rotation.z=.23; root.add(planet);
  const atmosphereMaterial=own(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec3 n;varying vec3 eye;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec3 n;varying vec3 eye;void main(){float edge=pow(1.-abs(dot(normalize(n),normalize(eye))),5.);gl_FragColor=vec4(.18,.54,.82,edge*.24);}`,fog:false}));
  const atmosphere=new THREE.Mesh(own(new THREE.SphereGeometry(107.5,48,32)),atmosphereMaterial);
  atmosphere.name="planet-atmospheric-limb";atmosphere.position.copy(planet.position);root.add(atmosphere);
  const hullMaterial=own(new THREE.MeshBasicMaterial({vertexColors:true,fog:false}));
  const base:THREE.BufferGeometry[]=[], detail:THREE.BufferGeometry[]=[], fine:THREE.BufferGeometry[]=[];
  const color=new THREE.Color();
  const add=(list:THREE.BufferGeometry[],geometry:THREE.BufferGeometry,tint:number,x:number,y:number,z:number,rz=0,ry=0)=>{
    geometry.rotateZ(rz);geometry.rotateY(ry);geometry.translate(x,y,z);
    color.setHex(tint);const colors=new Float32Array(geometry.getAttribute("position").count*3);
    const normals=geometry.getAttribute("normal");
    // Baked key/fill makes the structural faces readable in a single unlit
    // batch. No extra lights, runtime shader work or dynamic shadow casters.
    for(let i=0;i<normals.count;i++){
      const light=.48+.52*Math.max(0,-normals.getX(i)*.48+normals.getY(i)*.8+normals.getZ(i)*.36);
      colors[i*3]=color.r*light;colors[i*3+1]=color.g*light;colors[i*3+2]=color.b*light;
    }
    geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));list.push(geometry);
  };
  const box=(list:THREE.BufferGeometry[],tint:number,x:number,y:number,z:number,w:number,h:number,d:number,rz=0)=>add(list,new THREE.BoxGeometry(w,h,d),tint,x,y,z,rz);
  // A near service gantry frames the planet without covering its central disk.
  for(const z of[-68,112]){
    box(base,0x263c50,70,-13,z,11,35,14);
    box(base,0x8fabb8,70,5,z,23,3,18);
    box(base,0x3b566c,88,3,z,35,2.5,5);
    box(base,0x70dfff,101,4.4,z,5,.45,5.5);
    for(let y=-22;y<3;y+=6)box(detail,0x506b80,63.9,y,z,.6,1,15);
    for(let x=76;x<102;x+=6)box(detail,0x65808b,x,1,z,1.2,6,4,.5);
  }
  // Habitation wheel: thick segmented rim, axial spindle, spokes and solar sails.
  add(base,new THREE.TorusGeometry(31,2.6,8,56),0x5b758d,54,35,-119,.20,.36);
  add(base,new THREE.CylinderGeometry(6,7,22,12),0x9aabb7,54,35,-119,Math.PI/2);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+.2;
    box(base,0x344a61,54+Math.cos(a)*17,35+Math.sin(a)*17,-119,29,1.4,2,a);
    box(detail,0x8bb9c5,54+Math.cos(a)*31,35+Math.sin(a)*31,-119,7,4,6,a);
  }
  for(const sign of[-1,1]){
    box(base,0x4b657b,54+sign*48,35,-119,34,1.6,2);
    box(base,0x163b59,54+sign*55,35,-119,19,25,1);
    for(let j=-2;j<=2;j++)box(detail,0x4c8797,54+sign*55,35+j*5,-118.4,19,.16,.1);
    for(let j=-1;j<=1;j++)box(detail,0x4c8797,54+sign*55+j*6,35,-118.4,.16,25,.1);
  }
  // Two distant freighters: split engine banks, projecting bridge and cargo spine.
  for(const [x,y,z,s]of [[-108,48,64,1],[123,72,128,.75]]){
    box(base,0x53687e,x,y,z,33*s,4*s,8*s);
    box(base,0xa4afb7,x-7*s,y+4*s,z,9*s,5*s,7*s);
    for(const sign of[-1,1]){
      box(base,0x23384c,x-15*s,y,z+sign*7*s,11*s,5*s,4*s);
      box(base,0x68c7e5,x-20.6*s,y,z+sign*7*s,.3,2.2*s,2.4*s);
    }
    for(let j=0;j<4;j++)box(detail,j%2?0x917d62:0x768e9a,x+(j-1)*5*s,y+3*s,z,4*s,3*s,7*s);
    for(let j=0;j<6;j++)box(fine,0xc9d8b4,x-10*s+j*4*s,y+5.9*s,z,1,.3,1);
  }
  // The west/north sightlines previously ended in stars alone. A low distant
  // habitat spine and two docked modules establish another district beyond
  // the arena rails. They reuse the three baked batches, not new scene draws.
  for(const [x,y,z]of [[-112,-9,-96],[-146,4,-116]]as const){
    box(base,0x293c51,x,y,z,27,8,13);
    box(base,0x52697b,x,y+5,z,23,2,12);
    box(base,0x354d64,x+9,y+10,z-2,6,9,9);
    box(base,0x1b2d43,x-8,y+8,z+1,7,4,10);
    box(detail,0x6c8f9d,x,y+1.5,z+6.6,21,.5,.18);
    for(let i=0;i<5;i++)box(detail,0x8c9b92,x-8+i*4,y+1.5,z+6.75,1.3,.35,.12);
    box(fine,0xa5c7ba,x+9,y+14.7,z-2,.45,.25,.45);
  }
  box(base,0x273b51,-128,-9,-106,41,2,5,-.32);
  // A recessed docking collar gives the foreground gantry a destination and
  // depth cue. It remains wholly beyond the competitive arena and horizon.
  box(base,0x23394f,75,-1,112,14,8,5);
  box(detail,0x6b8a9a,75,1,114.6,10,.6,.18);
  box(detail,0x162b40,75,-1,114.65,8,3,.18);
  const batches:THREE.Mesh[]=[];
  for(const [name,list]of [["orbital-structural-silhouettes",base],["orbital-equipment",detail],["orbital-navigation-lights",fine]] as const){
    const geometry=mergeGeometries(list,false)!;for(const part of list)part.dispose();
    const mesh=new THREE.Mesh(own(geometry),hullMaterial);mesh.name=name;root.add(mesh);batches.push(mesh);
  }
  const positions:number[]=[],colors:number[]=[];
  // Deterministic, bounded celestial points; never use world-spanning lines.
  for(let i=0;i<360;i++){
    const a=i*2.3999632297,y=.08+.88*((i*73%359)/359),r=Math.sqrt(1-y*y);
    positions.push(Math.cos(a)*r*330,y*330,Math.sin(a)*r*330);
    const warm=i%7===0;colors.push(warm?.9:.55,warm?.71:.77,.92);
  }
  const starsGeometry=own(new THREE.BufferGeometry());starsGeometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));starsGeometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  const starsMaterial=own(new THREE.PointsMaterial({size:1.15,sizeAttenuation:false,vertexColors:true,fog:false,depthWrite:false}));
  const stars=new THREE.Points(starsGeometry,starsMaterial);stars.name="neighborhood-stars";root.add(stars);
  let disposed=false;
  return {root,
    setQuality(q:"low"|"medium"|"high") {batches[1].visible=q!=="low";batches[2].visible=q==="high";starsGeometry.setDrawRange(0,q==="low"?140:q==="medium"?240:360);},
    update(_time:number) { /* Fixed orbital neighborhood; no moving streaks or allocations. */ },
    dispose(){if(disposed)return;disposed=true;for(const resource of resources)resource.dispose();resources.clear();root.clear();},
  };
}
