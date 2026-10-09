import { BR_ROADS, BR_ROAD_ROUTES, BR_BRIDGE_PIERS, brAuthoredDeckHeight, type BrMapBlock, type BrRoadSegment, type Vec3 } from "@planetfall/shared";

export type BrRoadGradeFinish = "structuralDark" | "brushedMetal" | "energyCyan";
export interface BrRoadGradeDetailPart {
  role: "edge" | "support" | "light";
  finish: BrRoadGradeFinish;
  position: Vec3;
  scale: Vec3;
  rotationY?: number;
  rotationZ?: number;
}

/**
 * Visual-only construction for an authored sloped service road. The roadway
 * and its collider remain owned by shared map data; these narrow pieces sit
 * outside the driving lane or beneath it and cannot read as usable cover.
 */
export function buildBrRoadGradeDetails(road: BrRoadSegment, pieces: readonly BrRoadSegment[] = [road], piers: readonly BrMapBlock[] = BR_BRIDGE_PIERS): BrRoadGradeDetailPart[] {
  const dx=road.to.x-road.from.x,dy=road.to.y-road.from.y,dz=road.to.z-road.from.z;
  const horizontal=Math.hypot(dx,dz);
  if(![dx,dy,dz,road.width,...Object.values(road.from),...Object.values(road.to)].every(Number.isFinite)
    ||horizontal<8||road.width<3||!pieces.length
    ||pieces.some(piece=>![...Object.values(piece.from),...Object.values(piece.to)].every(Number.isFinite))
    ||Math.max(...pieces.flatMap(piece=>[piece.from.y,piece.to.y]))-Math.min(...pieces.flatMap(piece=>[piece.from.y,piece.to.y]))<.5)return[];
  // Stations follow real arc length; endpoint chords cut bent roads through
  // courtyards and orient their girders across the actual driving lane.
  const lengths=pieces.map(piece=>Math.hypot(piece.to.x-piece.from.x,piece.to.z-piece.from.z));
  const pathLength=lengths.reduce((sum,length)=>sum+length,0);
  const surface=(t:number)=>{
    let distance=pathLength*t,index=0;
    while(index<pieces.length-1&&distance>lengths[index])distance-=lengths[index++];
    const piece=pieces[index],h=lengths[index],u=h?distance/h:0;
    const px=piece.to.x-piece.from.x,pz=piece.to.z-piece.from.z;
    return {x:piece.from.x+px*u,y:piece.from.y+(piece.to.y-piece.from.y)*u,z:piece.from.z+pz*u,
      nx:-pz/h,nz:px/h,rotationY:-Math.atan2(pz,px),rotationZ:Math.atan2(piece.to.y-piece.from.y,h)};
  };
  const parts:BrRoadGradeDetailPart[]=[];
  // Low edge girders make the grade read as engineered structure without
  // falsely suggesting a waist-high collision rail.
  for(const side of [-1,1]){
    const offset=side*(road.width/2+.2);
    for(const piece of pieces){
      const px=piece.to.x-piece.from.x,py=piece.to.y-piece.from.y,pz=piece.to.z-piece.from.z;
      const h=Math.hypot(px,pz);if(h<1e-6)continue;
      // Only expose girders above real ground/decks. One-metre conservative
      // samples partition each authored plane into continuous supported spans.
      const count=Math.ceil(h),slope=Math.atan2(py,h),halfDepth=.275/Math.cos(slope);
      const exposed=(t:number)=>[-.175,.175].every(cross=>{
        const p={x:piece.from.x+px*t-pz/h*(offset+cross),z:piece.from.z+pz*t+px/h*(offset+cross)};
        return piece.from.y+py*t-.4-halfDepth>brAuthoredDeckHeight(p)+.02;
      });
      let start:number|undefined;
      for(let step=0;step<=count;step++){
        const t=step/count,clear=step<count&&exposed(t)&&exposed((step+1)/count);
        if(clear&&start===undefined)start=t;
        if(!clear&&start!==undefined){
          const mid=(start+t)/2;
          parts.push({role:"edge",finish:"brushedMetal",position:{x:piece.from.x+px*mid-pz/h*offset,y:piece.from.y+py*mid-.4,z:piece.from.z+pz*mid+px/h*offset},
            scale:{x:Math.hypot(h,py)*(t-start),y:.55,z:.35},rotationY:-Math.atan2(pz,px),rotationZ:slope});
          start=undefined;
        }
      }
    }
    for(const t of [.18,.5,.82]){
      const point=surface(t),lightOffset=side*(road.width/2+.225);
      parts.push({role:"light",finish:"energyCyan",position:{x:point.x+point.nx*lightOffset,y:point.y+.035,z:point.z+point.nz*lightOffset},
        scale:{x:.65,y:.035,z:.08},rotationY:point.rotationY,rotationZ:point.rotationZ});
    }
  }
  // Crossheads belong to real paired piers, never synthetic visual columns.
  // Their bottoms touch pier tops, inside the existing slab envelope, so they
  // do not lower the clear opening beneath an otherwise traversable span.
  for(const left of piers.filter(p=>p.id.startsWith(`bridge-pier-${road.id}-`)&&p.id.endsWith("-left"))){
    const right=piers.find(p=>p.id===left.id.replace(/-left$/,"-right"));if(!right)continue;
    const x=(left.position.x+right.position.x)/2,z=(left.position.z+right.position.z)/2;
    const top=left.position.y+left.size.y/2;
    const angle=-Math.atan2(right.position.z-left.position.z,right.position.x-left.position.x);
    parts.push({role:"support",finish:"structuralDark",position:{x,y:top+.1,z},
      scale:{x:road.width+.7,y:.2,z:1.25},rotationY:angle});
  }
  return parts;
}

/** One bounded light/support kit per route, with edges following the exact
 * authored planes. Never multiply support stations by subdivision count. */
export function buildBrRoadRouteGradeDetails(routes:readonly BrRoadSegment[]=BR_ROAD_ROUTES,roads:readonly BrRoadSegment[]=BR_ROADS):BrRoadGradeDetailPart[]{
  const piecesById=new Map<string,BrRoadSegment[]>();
  for(const road of roads){
    const id=road.id.replace(/-grade-part-\d+$/,"");
    const pieces=piecesById.get(id)??[];pieces.push(road);piecesById.set(id,pieces);
  }
  return routes.flatMap(route=>route.id==="south-transfer-bridge"?[]:buildBrRoadGradeDetails(route,piecesById.get(route.id)??[route]));
}
