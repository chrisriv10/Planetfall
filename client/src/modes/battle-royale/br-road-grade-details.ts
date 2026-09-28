import type { BrRoadSegment, Vec3 } from "@planetfall/shared";

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
export function buildBrRoadGradeDetails(road: BrRoadSegment): BrRoadGradeDetailPart[] {
  const dx=road.to.x-road.from.x,dy=road.to.y-road.from.y,dz=road.to.z-road.from.z;
  const horizontal=Math.hypot(dx,dz);
  if(![dx,dy,dz,road.width,...Object.values(road.from),...Object.values(road.to)].every(Number.isFinite)
    ||horizontal<8||Math.abs(dy)<.5||road.width<3)return[];
  const length=Math.hypot(horizontal,dy),rotationY=-Math.atan2(dz,dx),rotationZ=Math.atan2(dy,horizontal);
  const nx=-dz/horizontal,nz=dx/horizontal;
  const surface=(t:number)=>({x:road.from.x+dx*t,y:road.from.y+dy*t,z:road.from.z+dz*t});
  const parts:BrRoadGradeDetailPart[]=[];
  // Low edge girders make the grade read as engineered structure without
  // falsely suggesting a waist-high collision rail.
  for(const side of [-1,1]){
    const midpoint=surface(.5),offset=side*(road.width/2+.12);
    parts.push({role:"edge",finish:"brushedMetal",position:{x:midpoint.x+nx*offset,y:midpoint.y-.18,z:midpoint.z+nz*offset},
      scale:{x:length,y:.2,z:.18},rotationY,rotationZ});
    for(const t of [.18,.5,.82]){
      const point=surface(t),lightOffset=side*(road.width/2+.225);
      parts.push({role:"light",finish:"energyCyan",position:{x:point.x+nx*lightOffset,y:point.y+.035,z:point.z+nz*lightOffset},
        scale:{x:.65,y:.035,z:.08},rotationY,rotationZ});
    }
  }
  // Exposed braces only appear where there is enough height to see them.
  for(const t of [.28,.52,.76]){
    const point=surface(t),height=point.y-.12;
    if(height<.8)continue;
    for(const side of [-1,1]){
      const offset=side*Math.max(.9,road.width*.34);
      parts.push({role:"support",finish:"structuralDark",position:{x:point.x+nx*offset,y:height/2,z:point.z+nz*offset},
        scale:{x:.18,y:height,z:.18}});
    }
    parts.push({role:"support",finish:"structuralDark",position:{x:point.x,y:Math.max(.16,point.y-.28),z:point.z},
      scale:{x:Math.max(2.2,road.width*.8),y:.16,z:.24},rotationY});
  }
  return parts;
}
