import { BR_ROADS, BR_STRUCTURES, type BrRoadSegment, type BrStructure } from "@planetfall/shared";
import { buildBrRoadBends } from "./br-road-bends";

/** Grade subdivision is geometry, not a new street or an intersection. */
export const brRoadRouteId=(road:Pick<BrRoadSegment,"id">):string=>road.id.replace(/-grade-part-\d+$/,"");
/** Cache horizontal paths once. Merge only adjoining, equally wide collinear
 * pieces so grade subdivision adds no clearance work, while bends stay intact. */
export function buildBrRoadDetailClear(pieces:readonly BrRoadSegment[]=BR_ROADS,structures:readonly BrStructure[]=BR_STRUCTURES){
const elbows=buildBrRoadBends(pieces,undefined,structures).filter(b=>b.arms.length===2);
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
// A detail footprint samples many points along a route. Keep the exact narrow
// checks below, but avoid scanning every building and road for every sample.
type Bounds={minX:number;maxX:number;minZ:number;maxZ:number};
const index=<T extends Bounds>(items:readonly T[])=>{
  const cells=new Map<string,T[]>(),size=32;
  for(const item of items)for(let ix=Math.floor(item.minX/size);ix<=Math.floor(item.maxX/size);ix++)
    for(let iz=Math.floor(item.minZ/size);iz<=Math.floor(item.maxZ/size);iz++){
      const key=`${ix}:${iz}`,cell=cells.get(key)??[];cell.push(item);cells.set(key,cell);
    }
  return (x:number,z:number)=>cells.get(`${Math.floor(x/size)}:${Math.floor(z/size)}`)??[];
};
type Mask=Bounds&{x:number;z:number;halfX:number;halfZ:number};
const masks:Mask[]=[];
for(const structure of structures){
  const {x,z}=structure.position,halfX=structure.size.x/2+2,halfZ=structure.size.z/2+2;
  masks.push({x,z,halfX,halfZ,minX:x-halfX,maxX:x+halfX,minZ:z-halfZ,maxZ:z+halfZ});
  if(structure.enterable){
    const ns=structure.entrance==="north"||structure.entrance==="south",sign=structure.entrance==="north"||structure.entrance==="east"?1:-1;
    const doorX=x+(ns?0:sign*(structure.size.x/2+3)),doorZ=z+(ns?sign*(structure.size.z/2+3):0);
    masks.push({x:doorX,z:doorZ,halfX:ns?2.5:3,halfZ:ns?3:2.5,minX:doorX-(ns?2.5:3),maxX:doorX+(ns?2.5:3),minZ:doorZ-(ns?3:2.5),maxZ:doorZ+(ns?3:2.5)});
  }
}
const nearbyMasks=index(masks),nearbyRoads=index(routeFootprints);
const joins=new Map<string,Array<{x:number;z:number;radius:number}>>();
for(const bend of elbows){
  const ids=bend.arms.map(arm=>brRoadRouteId({id:arm.roadId}));
  const join={x:bend.center.x,z:bend.center.z,radius:Math.max(...bend.arms.map(arm=>arm.tangent))+bend.radius+1.5};
  for(const a of ids)for(const b of ids){const key=`${a}\0${b}`,list=joins.get(key)??[];list.push(join);joins.set(key,list);}
}

/** Leave intersections and building entrances free of crossing curbs/paint.
 * Roads remain continuous; only their non-colliding surface detail is masked. */
return function roadDetailClear(road:BrRoadSegment,x:number,z:number):boolean {
  for(const mask of nearbyMasks(x,z))if(Math.abs(x-mask.x)<mask.halfX&&Math.abs(z-mask.z)<mask.halfZ)return false;
  // Sibling grades and bends belong to this road, never a crossing street.
  const routeId=brRoadRouteId(road);
  for(const footprint of nearbyRoads(x,z)) {
    const {road:other,dx,dz,lengthSq}=footprint;
    if(other.id===routeId||x<footprint.minX||x>footprint.maxX||z<footprint.minZ||z>footprint.maxZ)continue;
    // Only the local supported two-arm join is a continuation. The same two
    // routes may cross elsewhere; those crossings keep their full mask.
    if(joins.get(`${routeId}\0${other.id}`)?.some(join=>Math.hypot(x-join.x,z-join.z)<=join.radius))continue;
    const t=lengthSq?Math.max(0,Math.min(1,((x-other.from.x)*dx+(z-other.from.z)*dz)/lengthSq)):0;
    const gapX=x-other.from.x-dx*t,gapZ=z-other.from.z-dz*t;
    if(gapX*gapX+gapZ*gapZ<footprint.padSquared)return false;
  }
  return true;
};
}

export const brRoadDetailClear=buildBrRoadDetailClear();
