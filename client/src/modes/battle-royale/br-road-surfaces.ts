import { BR_STRUCTURES, type BrRoadSegment, type BrStructure, type Vec3 } from "@planetfall/shared";

export interface BrRoadSurface { sourceRoadId:string; vertices:Vec3[]; junction:boolean; }
const epsilon=1e-7;
const side=(a:Vec3,b:Vec3,p:Vec3)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);

/** Clip a convex polygon, retaining its interpolated grade at every new vertex. */
function halfPlane(polygon:Vec3[],a:Vec3,b:Vec3,inside:boolean):Vec3[]{
  const result:Vec3[]=[];
  for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length];
    const dp=side(a,b,p),dq=side(a,b,q);
    const keepP=inside?dp>=-epsilon:dp<=epsilon,keepQ=inside?dq>=-epsilon:dq<=epsilon;
    if(keepP)result.push(p);
    if(keepP!==keepQ){const t=dp/(dp-dq);result.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,z:p.z+(q.z-p.z)*t});}
  }
  return result.filter((p,i)=>{const previous=result[(i+result.length-1)%result.length];return Math.hypot(p.x-previous.x,p.z-previous.z)>epsilon;});
}
export function brRoadPolygonArea(polygon:readonly Vec3[]):number {
  return Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.x*q.z-q.x*p.z;},0))/2;
}
/** Exact polygon difference, not centerline clipping. Whole-width clipping
 * leaves triangular gaps at oblique junctions (the reported asphalt wedges). */
function subtract(polygon:Vec3[],cut:Vec3[]):Vec3[][]{
  const pieces:Vec3[][]=[];let remainder=polygon;
  for(let i=0;i<cut.length&&remainder.length>=3;i++){
    const a=cut[i],b=cut[(i+1)%cut.length];
    const outside=halfPlane(remainder,a,b,false);
    if(outside.length>=3&&brRoadPolygonArea(outside)>.0001)pieces.push(outside);
    remainder=halfPlane(remainder,a,b,true);
  }
  return pieces;
}
function hull(points:Vec3[]):Vec3[]{
  const sorted=points.slice().sort((a,b)=>a.x-b.x||a.z-b.z);
  const lower:Vec3[]=[],upper:Vec3[]=[];
  for(const p of sorted){while(lower.length>1&&side(lower.at(-2)!,lower.at(-1)!,p)<=epsilon)lower.pop();lower.push(p);}
  for(const p of sorted.slice().reverse()){while(upper.length>1&&side(upper.at(-2)!,upper.at(-1)!,p)<=epsilon)upper.pop();upper.push(p);}
  return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
function roadRibbon(road:BrRoadSegment):Vec3[]{
  const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz);
  if(length<.001)return[];
  const nx=-dz/length*road.width/2,nz=dx/length*road.width/2;
  return [
    {x:road.from.x-nx,y:road.from.y-.065,z:road.from.z-nz},
    {x:road.to.x-nx,y:road.to.y-.065,z:road.to.z-nz},
    {x:road.to.x+nx,y:road.to.y-.065,z:road.to.z+nz},
    {x:road.from.x+nx,y:road.from.y-.065,z:road.from.z+nz}
  ];
}
function surfaceHeight(surface:BrRoadSurface,p:Vec3):number{
  const [a,b,c]=surface.vertices;
  const normalY=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);
  if(Math.abs(normalY)<epsilon)return a.y;
  const normalX=(b.y-a.y)*(c.z-a.z)-(b.z-a.z)*(c.y-a.y);
  const normalZ=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  return a.y-(normalX*(p.x-a.x)+normalZ*(p.z-a.z))/normalY;
}

/** One non-overlapping pavement network. Junctions own a chamfered polygon;
 * approach ribbons are cut against the actual polygon edges. Surfaces at
 * different heights remain independent (bridges are not holes in the road). */
export function buildBrRoadSurfaces(roads:readonly BrRoadSegment[]):BrRoadSurface[]{
  const junctions:BrRoadSurface[]=[];
  const nodes=new Map<string,{point:Vec3;arms:Array<{road:BrRoadSegment;t:number}>}>();
  for(let i=0;i<roads.length;i++)for(let j=i+1;j<roads.length;j++){
    const a=roads[i],b=roads[j],ax=a.to.x-a.from.x,az=a.to.z-a.from.z,bx=b.to.x-b.from.x,bz=b.to.z-b.from.z;
    const den=ax*bz-az*bx;if(Math.abs(den)<epsilon)continue;
    const qx=b.from.x-a.from.x,qz=b.from.z-a.from.z,t=(qx*bz-qz*bx)/den,u=(qx*az-qz*ax)/den;
    if(t<-.0001||t>1.0001||u<-.0001||u>1.0001)continue;
    const ay=a.from.y+(a.to.y-a.from.y)*t,by=b.from.y+(b.to.y-b.from.y)*u;
    // Junctions belong to level streets; grade changes keep their exact plane.
    if(Math.abs(ay-by)>epsilon||Math.abs(a.to.y-a.from.y)>epsilon||Math.abs(b.to.y-b.from.y)>epsilon)continue;
    const point={x:a.from.x+ax*t,y:ay-.065,z:a.from.z+az*t},key=`${point.x.toFixed(3)}:${point.z.toFixed(3)}:${point.y.toFixed(2)}`;
    const node=nodes.get(key)??{point,arms:[]};
    for(const [road,amount] of [[a,t],[b,u]] as const)if(!node.arms.some(arm=>arm.road===road))node.arms.push({road,t:amount});
    nodes.set(key,node);
  }
  for(const node of nodes.values()){
    const points:Vec3[]=[],reach=Math.max(...node.arms.map(arm=>arm.road.width))*.65;
    for(const {road,t} of node.arms){
      const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz),nx=-dz/length*road.width/2,nz=dx/length*road.width/2;
      for(const sign of [-1,1]){
        const available=sign<0?t*length:(1-t)*length;if(available<.01)continue;
        const distance=Math.min(reach,available),cx=node.point.x+dx/length*distance*sign,cz=node.point.z+dz/length*distance*sign;
        points.push({x:cx+nx,y:node.point.y,z:cz+nz},{x:cx-nx,y:node.point.y,z:cz-nz});
      }
    }
    const vertices=hull(points);if(vertices.length>=3)junctions.push({sourceRoadId:`junction-${junctions.length}`,vertices,junction:true});
  }
  const surfaces:BrRoadSurface[]=[];
  for(const source of [...junctions,...roads.map(road=>({sourceRoadId:road.id,vertices:roadRibbon(road),junction:false}))]){
    if(source.vertices.length<3)continue;
    let fragments=[source.vertices];
    for(const prior of surfaces){
      // Sharing one endpoint height does not make two grades coplanar. Cutting
      // based on that one point could erase an entire rising road above a flat
      // road (or a descending entrance below it). Compare the complete planes.
      if(source.vertices.some(p=>Math.abs(surfaceHeight(prior,p)-p.y)>epsilon)
        ||prior.vertices.some(p=>Math.abs(surfaceHeight(source,p)-p.y)>epsilon))continue;
      const minX=Math.min(...prior.vertices.map(v=>v.x)),maxX=Math.max(...prior.vertices.map(v=>v.x)),minZ=Math.min(...prior.vertices.map(v=>v.z)),maxZ=Math.max(...prior.vertices.map(v=>v.z));
      fragments=fragments.flatMap(poly=>poly.every(p=>p.x<minX)||poly.every(p=>p.x>maxX)||poly.every(p=>p.z<minZ)||poly.every(p=>p.z>maxZ)?[poly]:subtract(poly,prior.vertices));
    }
    for(const vertices of fragments)surfaces.push({...source,vertices});
  }
  return surfaces;
}

export interface BrVisibleRoadSpan {
  sourceRoadId: string;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  startT: number;
  endT: number;
  width: number;
  color: string;
}

function clippedInterval(road: BrRoadSegment, structure: BrStructure, clearance: number): [number, number] | null {
  const dx = road.to.x - road.from.x;
  const dz = road.to.z - road.from.z;
  const halfX = structure.size.x / 2 + road.width / 2 + clearance;
  const halfZ = structure.size.z / 2 + road.width / 2 + clearance;
  const minX = structure.position.x - halfX;
  const maxX = structure.position.x + halfX;
  const minZ = structure.position.z - halfZ;
  const maxZ = structure.position.z + halfZ;
  let enter = 0;
  let exit = 1;
  for (const [origin, delta, min, max] of [[road.from.x, dx, minX, maxX], [road.from.z, dz, minZ, maxZ]] as const) {
    if (Math.abs(delta) < 1e-7) {
      if (origin < min || origin > max) return null;
      continue;
    }
    const first = (min - origin) / delta;
    const second = (max - origin) / delta;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (enter >= exit) return null;
  }
  return exit <= 0 || enter >= 1 ? null : [Math.max(0, enter), Math.min(1, exit)];
}

function roadIntersectionInterval(road:BrRoadSegment,other:BrRoadSegment,clearance:number):[number,number]|null {
  const rx=road.to.x-road.from.x,rz=road.to.z-road.from.z;
  const sx=other.to.x-other.from.x,sz=other.to.z-other.from.z;
  const roadLength=Math.hypot(rx,rz),otherLength=Math.hypot(sx,sz);
  if(roadLength<.001||otherLength<.001)return null;
  const qx=other.from.x-road.from.x,qz=other.from.z-road.from.z;
  const denominator=rx*sz-rz*sx;
  if(Math.abs(denominator)<1e-6){
    // Collinear authored segments are clipped by projected overlap so duplicate
    // pavement never occupies the same plane.
    if(Math.abs(qx*rz-qz*rx)/roadLength>Math.max(road.width,other.width)/2+.25)return null;
    const projection=(x:number,z:number)=>((x-road.from.x)*rx+(z-road.from.z)*rz)/(roadLength*roadLength);
    const start=Math.max(0,Math.min(projection(other.from.x,other.from.z),projection(other.to.x,other.to.z)));
    const end=Math.min(1,Math.max(projection(other.from.x,other.from.z),projection(other.to.x,other.to.z)));
    return end-start>1e-5?[start,end]:null;
  }
  const t=(qx*sz-qz*sx)/denominator,u=(qx*rz-qz*rx)/denominator;
  if(t<-.001||t>1.001||u<-.001||u>1.001)return null;
  const roadY=road.from.y+(road.to.y-road.from.y)*t;
  const otherY=other.from.y+(other.to.y-other.from.y)*u;
  if(Math.abs(roadY-otherY)>.3)return null; // genuine bridge/underpass crossing
  const sinAngle=Math.abs(denominator)/(roadLength*otherLength);
  const halfWorld=(other.width/2+clearance)/Math.max(.2,sinAngle);
  const halfT=halfWorld/roadLength;
  return[Math.max(0,t-halfT),Math.min(1,t+halfT)];
}

/** Visual road spans with building footprints cut out. Authoritative roads stay unchanged. */
export function buildBrVisibleRoadSpans(
  road: BrRoadSegment,
  structures: readonly BrStructure[] = BR_STRUCTURES,
  clearance = 1.25,
  occludingRoads:readonly BrRoadSegment[]=[]
): BrVisibleRoadSpan[] {
  const exclusions:Array<[number,number]> = structures
    .map((structure) => clippedInterval(road, structure, clearance))
    .filter((entry): entry is [number, number] => Boolean(entry));
  for(const other of occludingRoads){const interval=roadIntersectionInterval(road,other,.08);if(interval)exclusions.push(interval);}
  exclusions.sort((a,b)=>a[0]-b[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of exclusions) {
    const last = merged.at(-1);
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }
  const dx = road.to.x - road.from.x;
  const dy = road.to.y - road.from.y;
  const dz = road.to.z - road.from.z;
  const length = Math.hypot(dx, dz);
  const spans: BrVisibleRoadSpan[] = [];
  let cursor = 0;
  for (const [start, end] of [...merged, [1, 1] as [number, number]]) {
    if ((start - cursor) * length >= 1) {
      spans.push({
        sourceRoadId: road.id,
        startT: cursor,
        endT: start,
        from: { x: road.from.x + dx * cursor, y: road.from.y + dy * cursor, z: road.from.z + dz * cursor },
        to: { x: road.from.x + dx * start, y: road.from.y + dy * start, z: road.from.z + dz * start },
        width: road.width,
        color: road.color
      });
    }
    cursor = Math.max(cursor, end);
  }
  return spans;
}
