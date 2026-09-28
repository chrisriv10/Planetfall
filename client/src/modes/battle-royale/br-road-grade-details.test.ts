import { describe,expect,it } from "vitest";
import { BR_ROADS, type BrRoadSegment } from "@planetfall/shared";
import { buildBrRoadGradeDetails } from "./br-road-grade-details";

describe("BR authored road-grade presentation",()=>{
  const grades=BR_ROADS.filter(road=>Math.abs(road.to.y-road.from.y)>.5);

  it("dresses every authored grade deterministically without entering the driving lane",()=>{
    expect(grades).toHaveLength(4);
    for(const road of grades){
      const parts=buildBrRoadGradeDetails(road);
      expect(parts.length).toBeGreaterThanOrEqual(11);
      expect(buildBrRoadGradeDetails(road)).toEqual(parts);
      expect(parts.filter(part=>part.role==="edge")).toHaveLength(2);
      expect(parts.filter(part=>part.role==="light")).toHaveLength(6);
      for(const part of parts){
        expect([...Object.values(part.position),...Object.values(part.scale),part.rotationY??0,part.rotationZ??0].every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(value=>value>0)).toBe(true);
      }
      const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,horizontal=Math.hypot(dx,dz);
      const nx=-dz/horizontal,nz=dx/horizontal;
      for(const part of parts.filter(part=>part.role==="edge"||part.role==="light")){
        const signed=(part.position.x-road.from.x)*nx+(part.position.z-road.from.z)*nz;
        expect(Math.abs(signed)).toBeGreaterThan(road.width/2);
      }
    }
  });

  it("rejects level, malformed, short, and implausibly narrow roads",()=>{
    const base=grades[0];
    for(const road of [
      {...base,to:{...base.to,y:base.from.y}},
      {...base,to:{...base.to,x:base.from.x+2,z:base.from.z+2}},
      {...base,width:2},
      {...base,from:{...base.from,x:Number.NaN}}
    ] as BrRoadSegment[])expect(buildBrRoadGradeDetails(road)).toEqual([]);
  });
});
