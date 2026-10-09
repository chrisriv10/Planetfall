import { expect, it } from "vitest";
import { BR_STRUCTURES } from "./map.js";
it("keeps every complete building envelope separate, including elevated buildings",()=>{
  for(let i=0;i<BR_STRUCTURES.length;i++)for(const b of BR_STRUCTURES.slice(i+1)){
    const a=BR_STRUCTURES[i];
    const overlapX=(a.size.x+b.size.x)/2-Math.abs(a.position.x-b.position.x);
    const overlapZ=(a.size.z+b.size.z)/2-Math.abs(a.position.z-b.position.z);
    const overlapY=Math.min(a.position.y+a.size.y,b.position.y+b.size.y)-Math.max(a.position.y,b.position.y);
    expect(Math.min(overlapX,overlapZ,overlapY),`${a.id} intersects ${b.id}`).toBeLessThanOrEqual(.01);
  }
});
