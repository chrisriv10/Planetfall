import { BR_ROADS, BR_STRUCTURES, type BrRoadSegment } from "@planetfall/shared";

/** Leave intersections and building entrances free of crossing curbs/paint.
 * Roads remain continuous; only their non-colliding surface detail is masked. */
export function brRoadDetailClear(road:BrRoadSegment,x:number,z:number):boolean {
  for(const structure of BR_STRUCTURES) {
    if(Math.abs(x-structure.position.x)<structure.size.x/2+2 && Math.abs(z-structure.position.z)<structure.size.z/2+2)return false;
  }
  for(const other of BR_ROADS) {
    if(other===road)continue;
    const dx=other.to.x-other.from.x,dz=other.to.z-other.from.z;
    const t=Math.max(0,Math.min(1,((x-other.from.x)*dx+(z-other.from.z)*dz)/(dx*dx+dz*dz)));
    if(Math.hypot(x-other.from.x-dx*t,z-other.from.z-dz*t)<other.width*.54+1.5)return false;
  }
  return true;
}
