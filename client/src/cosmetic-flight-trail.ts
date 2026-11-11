import * as THREE from "three";

export function cosmeticTrailStyle(id:string):{width:number;dashed:boolean;particles:number} {
  if(id==="warp-spark"||id==="sparks")return {width:.085,dashed:true,particles:id==="sparks"?.24:.18};
  if(id==="plasma-helix")return {width:.10,dashed:false,particles:0};
  if(id==="solar-petals")return {width:.036,dashed:false,particles:.35};
  if(id==="void-wake")return {width:.14,dashed:true,particles:0};
  if(id==="bubbles")return {width:.025,dashed:false,particles:.46};
  if(id==="stardust")return {width:.035,dashed:false,particles:.26};
  return {width:id==="ion-blue"?.11:.065,dashed:false,particles:0};
}

/** Shared production/Shop/Pass trail. Two crossed, tapered ribbons make the
 * energy readable from different camera angles without per-particle meshes. */
export function createCosmeticFlightTrail(color: THREE.ColorRepresentation,id="default"): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .72 }));
  line.name = "cosmetic-flight-trail";
  const ribbon=new THREE.BufferGeometry();
  ribbon.setAttribute("position",new THREE.BufferAttribute(new Float32Array(11*12*3),3).setUsage(THREE.DynamicDrawUsage));ribbon.setDrawRange(0,0);
  const shades=new THREE.BufferAttribute(new Float32Array(11*12*3),3);
  ribbon.setAttribute("color",shades);
  const glow=new THREE.Mesh(ribbon,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.56,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));glow.name="trail-energy-ribbon";line.add(glow);
  const dots=new THREE.BufferGeometry();dots.setAttribute("position",new THREE.BufferAttribute(new Float32Array(12*3),3).setUsage(THREE.DynamicDrawUsage));dots.setDrawRange(0,0);
  const particles=new THREE.Points(dots,new THREE.PointsMaterial({color,size:.1,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));particles.name="trail-particles";line.add(particles);
  configureCosmeticFlightTrail(line,color,id);
  return line;
}

export function configureCosmeticFlightTrail(line:THREE.Line,color:THREE.ColorRepresentation,id:string):void {
  (line.material as THREE.LineBasicMaterial).color.set(color);line.userData.cosmeticId=id;
  for(const child of line.children){const material=(child as THREE.Mesh).material as THREE.MeshBasicMaterial|THREE.PointsMaterial;material.color.set(color);}
  const glow=line.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  const strands=id==="plasma-helix"||id==="void-wake";
  const core=line.material as THREE.LineBasicMaterial;
  core.opacity=id==="void-wake"?0:id==="plasma-helix" ? .18 : .72;
  core.depthWrite=id!=="void-wake";
  glow.material.opacity=id==="void-wake" ? .76 : .56;
  const blend=id==="void-wake"?THREE.NormalBlending:THREE.AdditiveBlending;
  if(glow.material.vertexColors!==strands || glow.material.blending!==blend){
    glow.material.vertexColors=strands;glow.material.blending=blend;glow.material.needsUpdate=true;
  }
  if(strands) {
    const ink=id==="void-wake"?new THREE.Color(0x392748):new THREE.Color(color);
    const edge=new THREE.Color(color).lerp(new THREE.Color(id==="void-wake"?0xc5a9ff:0xeeceff),.55);
    const shades=glow.geometry.getAttribute("color") as THREE.BufferAttribute;
    for(let i=0;i<shades.count;i++){
      // Both crossed wake sheets need a visible violet rim. A separate coplanar
      // edge disappears together with the body when viewed along that sheet.
      const bright=id==="void-wake"?side[i%6]>0:i%12>=6;
      const tint=bright?edge:ink;shades.setXYZ(i,tint.r,tint.g,tint.b);
    }
    shades.needsUpdate=true;glow.material.color.setHex(0xffffff);
  }
  const particles=line.children[1] as THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>;
  particles.material.size=cosmeticTrailStyle(id).particles;particles.visible=particles.material.size>0;
  const shape=id==="solar-petals"?"petals":id==="bubbles"?"ring":id==="sparks"||id==="stardust"?"star":"glow";
  if(particles.material.userData.trailShape!==shape){
    particles.material.userData.trailShape=shape;
    particles.material.onBeforeCompile=shader=>{
      const mask=shape==="ring"
        ?"(1.0-smoothstep(.38,.49,r))*smoothstep(.25,.34,r)"
        :shape==="petals"
        ?"1.0-smoothstep(.34,.47,r/(.44+.56*abs(cos(3.0*atan(p.y,p.x)))))"
        :shape==="star"
        ?"(1.0-smoothstep(.02,.09,min(abs(p.x),abs(p.y))))*(1.0-smoothstep(.15,.49,r))"
        :"1.0-smoothstep(.05,.49,r)";
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>\nvec2 p=gl_PointCoord-vec2(.5);float r=length(p);diffuseColor.a*=${mask};`);
    };
    particles.material.customProgramCacheKey=()=>`cosmetic-trail-${shape}`;
    particles.material.needsUpdate=true;
  }
}

const tangent=new THREE.Vector3(),normal=new THREE.Vector3(),cross=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
const endpoint=[0,1,1,0,1,0],side=[-1,-1,1,-1,1,1];
const samples=Array.from({length:12},()=>new THREE.Vector3());

export function updateCosmeticFlightTrail(line: THREE.Line, points: readonly THREE.Vector3[],maximumLength=Infinity): void {
  const attribute = line.geometry.getAttribute("position") as THREE.BufferAttribute;
  let count=0,length=0;
  for(let i=0;i<Math.min(points.length,attribute.count);i++){
    const segment=i?points[i-1].distanceTo(points[i]):0;
    samples[count].copy(points[i]);
    if(length+segment>maximumLength){
      samples[count].copy(points[i-1]).lerp(points[i],Math.max(0,maximumLength-length)/segment);
      count++;break;
    }
    count++;length+=segment;
  }
  for (let i = 0; i < count; i++) attribute.setXYZ(i, samples[i].x, samples[i].y, samples[i].z);
  attribute.needsUpdate = true;
  line.geometry.setDrawRange(0, count);
  line.geometry.computeBoundingSphere();
  const id=String(line.userData.cosmeticId),style=cosmeticTrailStyle(id);
  const ribbon=(line.children[0] as THREE.Mesh).geometry,positions=ribbon.getAttribute("position") as THREE.BufferAttribute;
  let vertex=0;
  for(let i=0;i<count-1;i++){
    if(style.dashed&&i%3===1)continue;
    const a=samples[i],b=samples[i+1];tangent.copy(b).sub(a).normalize();
    normal.crossVectors(tangent,up);if(normal.lengthSq()<.001)normal.set(1,0,0);else normal.normalize();cross.crossVectors(tangent,normal).normalize();
    for(let plane=0;plane<2;plane++)for(let corner=0;corner<6;corner++){
      const axis=plane===0?normal:cross,p=endpoint[corner]===0?a:b;
      const width=style.width*(1-(i+endpoint[corner])/12)*side[corner];
      if(id==="plasma-helix"){
        const phase=(i+endpoint[corner])*.74+plane*Math.PI;
        const radius=style.width*(1-(i+endpoint[corner])/12)*(1+side[corner]*.28);
        const nx=Math.cos(phase)*radius,ny=Math.sin(phase)*radius;
        positions.setXYZ(vertex++,p.x+normal.x*nx+cross.x*ny,p.y+normal.y*nx+cross.y*ny,p.z+normal.z*nx+cross.z*ny);
      }else positions.setXYZ(vertex++,p.x+axis.x*width,p.y+axis.y*width,p.z+axis.z*width);
    }
  }
  positions.needsUpdate=true;ribbon.setDrawRange(0,vertex);ribbon.computeBoundingSphere();
  const dots=(line.children[1] as THREE.Points).geometry,dotPositions=dots.getAttribute("position") as THREE.BufferAttribute;
  for(let i=0;i<count;i++){
    const p=samples[i],spread=style.particles*.65;
    if(id==="solar-petals"){
      tangent.copy(samples[Math.min(i+1,count-1)]).sub(samples[Math.max(0,i-1)]).normalize();
      normal.crossVectors(tangent,up);if(normal.lengthSq()<.001)normal.set(1,0,0);else normal.normalize();
      cross.crossVectors(tangent,normal).normalize();
      const angle=i*2.39996,radius=spread*(.55+.45*i/12);
      const n=radius*Math.cos(angle),c=radius*Math.sin(angle);
      dotPositions.setXYZ(i,p.x+normal.x*n+cross.x*c,p.y+normal.y*n+cross.y*c,p.z+normal.z*n+cross.z*c);
    }else dotPositions.setXYZ(i,p.x,p.y+Math.sin(i*2.4)*spread,p.z+Math.cos(i*1.7)*spread);
  }
  dotPositions.needsUpdate=true;dots.setDrawRange(0,count);dots.computeBoundingSphere();
}
