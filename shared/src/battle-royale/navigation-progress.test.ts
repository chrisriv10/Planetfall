import { describe, expect, it } from "vitest";
import { brNextWaypoint } from "./map.js";

describe("road-relative waypoint progress",()=>{
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
