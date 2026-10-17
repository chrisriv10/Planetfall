import { describe, expect, it } from "vitest";
import { brNextWaypoint,BR_STRUCTURES,brRoadIntersectsFootprint } from "./map.js";

describe("road-relative waypoint progress",()=>{
  it("enters a reachable street before routing around Zero Gallery's north wall",()=>{
    const start={x:-39.726,y:.035,z:45.31},target={x:-61,y:.035,z:-20};
    const next=brNextWaypoint(start,target),gallery=BR_STRUCTURES.find(s=>s.id==="zero-gallery")!;
    expect(next.z).toBeGreaterThan(start.z);
    expect(brRoadIntersectsFootprint({id:"approach",from:start,to:next,width:.9,color:"#fff"},gallery.position,gallery.size,.15)).toBe(false);
  });
  const target={x:-61.2927,y:.035,z:34.9233};
  it("does not reverse onto Nova's parallel street while replanning its northeast bend",()=>{
    for(const fraction of [.05,.2,.4,.55,.7,.9]){
      const start={x:-92-28*fraction,y:5.035,z:-60+10*fraction};
      expect(brNextWaypoint(start,target)).toEqual({x:-120,y:5.3,z:-50});
    }
  });
  it("makes continuous stateless progress across the bend before choosing the outgoing grade",()=>{
    let point={x:-92,y:5.035,z:-60};
    const positions=[{...point}];
    for(let frame=0;frame<30;frame++){
      const next=brNextWaypoint(point,target),dx=next.x-point.x,dz=next.z-point.z,distance=Math.hypot(dx,dz);
      const step=Math.min(1.2,distance);point={x:point.x+dx/distance*step,y:5.035,z:point.z+dz/distance*step};positions.push({...point});
    }
    expect(Math.min(...positions.map(p=>p.x))).toBeLessThan(-119);
    expect(point.z).toBeGreaterThan(-50);
    for(let i=1;i<positions.length;i++)expect(positions[i].x).toBeLessThanOrEqual(positions[i-1].x+.001);
  });
});
