import { BR_ROADS, BR_ROAD_ROUTES, type BrRoadSegment, type Vec3 } from "@planetfall/shared";

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
export function buildBrRoadGradeDetails(road: BrRoadSegment, pieces: readonly BrRoadSegment[] = [road]): BrRoadGradeDetailPart[] {
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
    const offset=side*(road.width/2+.12);
    for(const piece of pieces){
      const px=piece.to.x-piece.from.x,py=piece.to.y-piece.from.y,pz=piece.to.z-piece.from.z;
      const h=Math.hypot(px,pz);if(h<1e-6)continue;
      parts.push({role:"edge",finish:"brushedMetal",position:{x:(piece.from.x+piece.to.x)/2-pz/h*offset,y:(piece.from.y+piece.to.y)/2-.18,z:(piece.from.z+piece.to.z)/2+px/h*offset},
        scale:{x:Math.hypot(h,py),y:.2,z:.18},rotationY:-Math.atan2(pz,px),rotationZ:Math.atan2(py,h)});
    }
    for(const t of [.18,.5,.82]){
      const point=surface(t),lightOffset=side*(road.width/2+.225);
      parts.push({role:"light",finish:"energyCyan",position:{x:point.x+point.nx*lightOffset,y:point.y+.035,z:point.z+point.nz*lightOffset},
        scale:{x:.65,y:.035,z:.08},rotationY:point.rotationY,rotationZ:point.rotationZ});
    }
  }
  // Exposed braces only appear where there is enough height to see them.
  for(const t of [.28,.52,.76]){
    const point=surface(t),height=point.y-.12;
    if(height<.8)continue;
    for(const side of [-1,1]){
      const offset=side*Math.max(.9,road.width*.34);
      parts.push({role:"support",finish:"structuralDark",position:{x:point.x+point.nx*offset,y:height/2,z:point.z+point.nz*offset},
        scale:{x:.18,y:height,z:.18}});
    }
    parts.push({role:"support",finish:"structuralDark",position:{x:point.x,y:Math.max(.16,point.y-.28),z:point.z},
      // This crosshead joins the two side columns across the road, not along
      // its heading. Longitudinal beams left both supports visibly disconnected.
      scale:{x:Math.max(2.2,road.width*.8),y:.16,z:.24},rotationY:point.rotationY+Math.PI/2});
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
