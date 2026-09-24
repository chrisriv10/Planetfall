import {
  BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, BR_TRAVERSAL,
  type BrMapBlock, type BrRoadSegment, type BrSecondaryLocation, type BrStructure, type Vec3
} from "@planetfall/shared";

export type BrParkFinish="canopy"|"soil"|"concrete"|"brushedMetal"|"structuralDark"|"windowLit"|"flowers";
/** Box dimensions are unit lengths; cylinders/crowns/octahedra have unit radii. */
export interface BrParkPart {
  geometry:"box"|"cylinder"|"crown"|"octahedron";
  finish:BrParkFinish;
  position:Vec3;
  scale:Vec3;
  rotationY:number;
  rotationZ?:number;
}
export interface BrParkCluster {
  center:Vec3;
  radius:number;
  archetype:"spreading"|"spire"|"forked";
  parts:BrParkPart[];
}
export interface BrParkPath {
  position:Vec3;
  scale:Vec3;
  rotationY:number;
  finish:"sidewalk"|"accent";
}
export interface BrParkClearance {
  roads:readonly Pick<BrRoadSegment,"from"|"to"|"width">[];
  structures:readonly Pick<BrStructure,"position"|"size">[];
  blocks:readonly Pick<BrMapBlock,"position"|"size"|"kind">[];
  traversal:readonly {position:Vec3}[];
  outline:readonly (readonly [number,number])[];
}
const defaults:BrParkClearance={roads:BR_ROADS,structures:BR_STRUCTURES,blocks:BR_MAP_BLOCKS,traversal:BR_TRAVERSAL,outline:BR_ISLAND_OUTLINE};
const RADIUS=3.6;
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
const segmentDistance=(p:Vec3,a:Vec3,b:Vec3)=>{
  const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
  const t=length>0?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/length)):0;
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
};

function clear(center:Vec3,input:BrParkClearance):boolean {
  let inside=false;
  for(let i=0,j=input.outline.length-1;i<input.outline.length;j=i++) {
    const [x,z]=input.outline[i],[px,pz]=input.outline[j];
    if((z>center.z)!==(pz>center.z)&&center.x<(px-x)*(center.z-z)/(pz-z)+x)inside=!inside;
    if(segmentDistance(center,{x,y:0,z},{x:px,y:0,z:pz})<RADIUS+1)return false;
  }
  if(!inside)return false;
  for(const road of input.roads)if(segmentDistance(center,road.from,road.to)<road.width/2+RADIUS+2)return false;
  for(const structure of input.structures) {
    const dx=Math.max(0,Math.abs(center.x-structure.position.x)-structure.size.x/2);
    const dz=Math.max(0,Math.abs(center.z-structure.position.z)-structure.size.z/2);
    if(Math.hypot(dx,dz)<RADIUS+4)return false;
  }
  for(const block of input.blocks) {
    if(!["cover","ramp","bridge"].includes(block.kind))continue;
    if(distance(center,block.position)<Math.hypot(block.size.x,block.size.y,block.size.z)/2+RADIUS+2)return false;
  }
  return input.traversal.every(t=>distance(center,t.position)>=RADIUS+8);
}

/** World-space, decorative transforms only. Attach to the parent's existing LOD
 * group and mark every instance cameraCollision=false. No lights or colliders. */
export function buildBrParkDressing(location:BrSecondaryLocation,destination:Vec3,overrides:Partial<BrParkClearance>={}):BrParkCluster[] {
  if(!["academy","city","farm"].includes(location.style))return [];
  if(![location.position.x,location.position.z,destination.x,destination.z].every(Number.isFinite))return [];
  const input={...defaults,...overrides},clusters:BrParkCluster[]=[];
  const approach=Math.atan2(destination.z-location.position.z,destination.x-location.position.x);
  let hash=0;for(const char of location.id)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
  for(let i=0;i<32&&clusters.length<5;i++) {
    // Interleave quadrants so a five-cluster budget dresses the whole park,
    // even when the early candidates all happen to be unobstructed.
    const angle=approach+((i*13%32)/32+.013*(hash%7))*Math.PI*2;
    const radius=i%2?33.5:29;
    const center={x:location.position.x+Math.cos(angle)*radius,y:0,z:location.position.z+Math.sin(angle)*radius};
    // A 12m-wide unobstructed approach crosses the entire park. Checking a
    // containing circle protects the canopy/bench ends, not just tree trunks.
    if(Math.abs(Math.sin(angle-approach)*radius)<6+RADIUS)continue;
    if(distance(center,location.position)<14+RADIUS||!clear(center,input))continue;
    if(clusters.some(cluster=>distance(center,cluster.center)<RADIUS*2+3))continue;
    const archetype=(["spreading","spire","forked"] as const)[clusters.length%3];
    clusters.push({center,radius:RADIUS,archetype,parts:clusterParts(center,angle,archetype,clusters.length,location.style)});
  }
  return clusters;
}

/** Flush visual paths that establish an entrance-to-district axis and a
 * perpendicular park promenade. They intentionally carry no collision. */
export function buildBrParkPaths(location:BrSecondaryLocation,destination:Vec3):BrParkPath[] {
  if(!["academy","city","farm"].includes(location.style))return [];
  if(![location.position.x,location.position.z,destination.x,destination.z].every(Number.isFinite))return [];
  const angle=Math.atan2(destination.z-location.position.z,destination.x-location.position.x);
  const paths:BrParkPath[]=[];
  for(const offset of [0,Math.PI/2]) {
    const rotationY=angle+offset;
    paths.push({position:{x:location.position.x,y:.044,z:location.position.z},scale:{x:74,y:.035,z:5.4},rotationY,finish:"sidewalk"});
    paths.push({position:{x:location.position.x,y:.047,z:location.position.z},scale:{x:68,y:.018,z:.24},rotationY,finish:"accent"});
  }
  return paths;
}

function clusterParts(center:Vec3,angle:number,archetype:BrParkCluster["archetype"],index:number,style:BrSecondaryLocation["style"]):BrParkPart[] {
  const parts:BrParkPart[]=[];
  const add=(geometry:BrParkPart["geometry"],finish:BrParkFinish,x:number,y:number,z:number,sx:number,sy:number,sz:number,tilt=0)=>{
    parts.push({geometry,finish,position:{x:center.x+Math.cos(angle)*x-Math.sin(angle)*z,y,z:center.z+Math.sin(angle)*x+Math.cos(angle)*z},scale:{x:sx,y:sy,z:sz},rotationY:-angle,rotationZ:tilt});
  };
  // The tree sits toward the rim; seats face the open park on the inner side.
  add("cylinder","soil",.8,1.25,0,.14,2.5,.14);
  if(archetype==="spreading") {
    add("crown","canopy",.7,3.35,0,1.75,1.15,1.45);
    add("crown","canopy",1.3,3.95,.3,1.1,.85,1);
  }else if(archetype==="spire") {
    add("octahedron","canopy",.8,3.15,0,1.22,1.7,1.22);
    add("octahedron","canopy",.8,4.35,0,.8,1.3,.8);
  }else {
    add("cylinder","soil",.45,2.3,0,.1,1.1,.1,.4);
    add("cylinder","soil",1.12,2.3,0,.1,1.1,.1,-.4);
    add("crown","canopy",.05,3.25,-.2,1.15,1.15,1.1);
    add("crown","canopy",1.55,3.65,.25,1.1,1.35,1.05);
  }
  // Shallow beds and short edging avoid the impression of usable hard cover.
  add("box","soil",.6,.075,-1.7,3.4,.08,1.1);
  for(const side of [-1,1])add("box","concrete",.6,.16,-1.7+side*.62,3.65,.22,.12);
  for(const x of [-.6,.6,1.65]) {
    add("crown","canopy",x,.46,-1.7,.48,.38,.42);
    add("octahedron","flowers",x+.1,.78,-1.72,.16,.16,.16);
  }
  if(index%2===0) {
    // Three visible seat slats, a narrow back, and separate feet read as a
    // bench rather than the former solid block. Maximum back height 1.2m.
    for(const x of [-1.65,-1.4,-1.15])add("box","brushedMetal",x,.62,.6,.19,.12,2.3);
    add("box","brushedMetal",-.99,1,.6,.12,.36,2.3);
    for(const z of [-.2,1.4])add("box","structuralDark",-1.4,.3,z,.62,.5,.14);
    add("cylinder","structuralDark",-1.4,1.55,2.12,.07,3.1,.07);
    add("box","windowLit",-1.4,3.14,2.12,.28,.12,.28);
  }else {
    // A quiet contrasting border ties tree-only clusters into the park paths.
    add("box","concrete",-1.6,.11,.35,.15,.12,2.6);
    if(style==="farm")add("box","brushedMetal",-1.6,.17,.35,.05,.05,2.5);
  }
  return parts;
}
