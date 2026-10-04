import { BR_STRUCTURES, type BrRoadSegment, type BrStructure } from "@planetfall/shared";

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
