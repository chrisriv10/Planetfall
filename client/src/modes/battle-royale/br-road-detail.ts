import { BR_ROADS, BR_STRUCTURES, type BrRoadSegment, type BrStructure } from "@planetfall/shared";

/** Grade subdivision is geometry, not a new street or an intersection. */
export const brRoadRouteId=(road:Pick<BrRoadSegment,"id">):string=>road.id.replace(/-grade-part-\d+$/,"");
/** Cache horizontal paths once. Merge only adjoining, equally wide collinear
 * pieces so grade subdivision adds no clearance work, while bends stay intact. */
export function buildBrRoadDetailClear(pieces:readonly BrRoadSegment[]=BR_ROADS,structures:readonly BrStructure[]=BR_STRUCTURES){
const paths:BrRoadSegment[]=[];
const tails=new Map<string,BrRoadSegment>();
for(const piece of pieces){
  const id=brRoadRouteId(piece),tail=tails.get(id);
  const dx=piece.to.x-piece.from.x,dz=piece.to.z-piece.from.z;
  const tx=tail?tail.to.x-tail.from.x:0,tz=tail?tail.to.z-tail.from.z:0;
  if(tail&&tail.width===piece.width&&Math.hypot(tail.to.x-piece.from.x,tail.to.z-piece.from.z)<1e-8
    &&tx*dx+tz*dz>0&&Math.abs(tx*dz-tz*dx)<=1e-8*Math.hypot(tx,tz)*Math.hypot(dx,dz)){
    tail.to=piece.to;
  }else{
    const path={...piece,id};paths.push(path);tails.set(id,path);
  }
}
const routeFootprints=paths.map(road=>{
  const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,pad=road.width*.54+1.5;
  return {road,dx,dz,lengthSq:dx*dx+dz*dz,padSquared:pad*pad,
    minX:Math.min(road.from.x,road.to.x)-pad,maxX:Math.max(road.from.x,road.to.x)+pad,
    minZ:Math.min(road.from.z,road.to.z)-pad,maxZ:Math.max(road.from.z,road.to.z)+pad};
});

/** Leave intersections and building entrances free of crossing curbs/paint.
 * Roads remain continuous; only their non-colliding surface detail is masked. */
return function roadDetailClear(road:BrRoadSegment,x:number,z:number):boolean {
  for(const structure of structures) {
    if(Math.abs(x-structure.position.x)<structure.size.x/2+2 && Math.abs(z-structure.position.z)<structure.size.z/2+2)return false;
    if(structure.enterable){
      const ns=structure.entrance==="north"||structure.entrance==="south",sign=structure.entrance==="north"||structure.entrance==="east"?1:-1;
      const doorX=structure.position.x+(ns?0:sign*(structure.size.x/2+3));
      const doorZ=structure.position.z+(ns?sign*(structure.size.z/2+3):0);
      if(Math.abs(x-doorX)<(ns?2.5:3)&&Math.abs(z-doorZ)<(ns?3:2.5))return false;
    }
  }
  // Sibling grades and bends belong to this road, never a crossing street.
  const routeId=brRoadRouteId(road);
  for(const footprint of routeFootprints) {
    const {road:other,dx,dz,lengthSq}=footprint;
    if(other.id===routeId||x<footprint.minX||x>footprint.maxX||z<footprint.minZ||z>footprint.maxZ)continue;
    const t=lengthSq?Math.max(0,Math.min(1,((x-other.from.x)*dx+(z-other.from.z)*dz)/lengthSq)):0;
    const gapX=x-other.from.x-dx*t,gapZ=z-other.from.z-dz*t;
    if(gapX*gapX+gapZ*gapZ<footprint.padSquared)return false;
  }
  return true;
};
}

export const brRoadDetailClear=buildBrRoadDetailClear();
