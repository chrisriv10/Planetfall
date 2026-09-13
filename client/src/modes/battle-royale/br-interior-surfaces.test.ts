import { describe,it,expect } from "vitest";
import { BR_MAP_BLOCKS,BR_STRUCTURES } from "@planetfall/shared";
import { buildInteriorSurfaces } from "./br-interior-surfaces";

describe("interior surface inlays",()=>{
  it("follows floor slabs without bridging stair openings",()=>{
    let count=0;
    for(const structure of BR_STRUCTURES)for(const part of buildInteriorSurfaces(structure).filter(p=>p.rotationX===undefined)){
      count++;
      expect(BR_MAP_BLOCKS.some(b=>b.id.startsWith(`${structure.id}-`)&&b.kind==="platform"&&!b.id.endsWith("-roof")&&
        Math.abs(part.position.y-(b.position.y+b.size.y/2+.012))<.001&&
        Math.abs(part.position.x-b.position.x)+part.scale.x/2<b.size.x/2&&
        Math.abs(part.position.z-b.position.z)+part.scale.z/2<b.size.z/2)).toBe(true);
    }
    expect(count).toBeGreaterThan(100);
  });
  it("mounts ramp paint parallel to the actual inclined top face",()=>{
    let count=0;
    for(const structure of BR_STRUCTURES)for(const part of buildInteriorSurfaces(structure).filter(p=>p.rotationX!==undefined)){
      count++;
      const angle=part.rotationX!;
      expect(BR_MAP_BLOCKS.some(b=>{
        if(!b.id.startsWith(`${structure.id}-stairs-`)||b.rotation?.x!==angle)return false;
        const dy=part.position.y-b.position.y,dz=part.position.z-b.position.z;
        const localY=dy*Math.cos(angle)+dz*Math.sin(angle),localZ=-dy*Math.sin(angle)+dz*Math.cos(angle);
        return Math.abs(localY-(b.size.y/2+.016))<.001&&Math.abs(localZ)+part.scale.z/2<b.size.z/2;
      })).toBe(true);
    }
    expect(count).toBeGreaterThan(10);
  });
});
