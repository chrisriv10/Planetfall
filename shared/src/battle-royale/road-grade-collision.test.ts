import { describe,expect,it } from "vitest";
import { BR_MAP_BLOCKS,BR_ROADS } from "./index.js";

describe("Graded road collider surface alignment",()=>{
  it("places the real cuboid top-edge centers at both authored ribbon endpoints",()=>{
    for(const road of BR_ROADS){
      const block=BR_MAP_BLOCKS.find(b=>b.id===`${road.id}-surface`);
      if(!block)continue;
      const rotation=block.rotation!,cy=Math.cos(rotation.y),sy=Math.sin(rotation.y),cz=Math.cos(rotation.z),sz=Math.sin(rotation.z);
      for(const [sign,endpoint] of [[-1,road.from],[1,road.to]] as const){
        // Exact XYZ Euler transform of the upper face's local +/-X ends.
        const x=sign*block.size.x/2,y=block.size.y/2;
        const rotatedX=x*cz-y*sz,rotatedY=x*sz+y*cz;
        const top={x:block.position.x+rotatedX*cy,y:block.position.y+rotatedY,z:block.position.z-rotatedX*sy};
        expect(top.x,`${road.id}: x ${sign}`).toBeCloseTo(endpoint.x,7);
        expect(top.y,`${road.id}: y ${sign}`).toBeCloseTo(endpoint.y-.1,7);
        expect(top.z,`${road.id}: z ${sign}`).toBeCloseTo(endpoint.z,7);
      }
    }
  });
});
