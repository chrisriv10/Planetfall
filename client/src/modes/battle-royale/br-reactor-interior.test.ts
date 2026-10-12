import { describe, expect, it } from "vitest";
import { BR_STRUCTURES, BR_MAP_BLOCKS } from "@planetfall/shared";
import { buildReactorInterior } from "./br-reactor-interior";

describe("Helios reactor interior dressing", () => {
  const core = BR_STRUCTURES.find(structure => structure.id === "helios-core")!;

  it("only dresses the enterable Helios Core", () => {
    expect(BR_STRUCTURES.filter(structure => buildReactorInterior(structure).length).map(structure => structure.id)).toEqual(["helios-core"]);
    expect(buildReactorInterior({ ...core, enterable: false })).toEqual([]);
    expect(buildReactorInterior({ ...core, districtId: "zero-point" })).toEqual([]);
  });

  it("keeps the central authoritative doorway clear", () => {
    for (const part of buildReactorInterior(core)) {
      const innerEdge = Math.abs(part.position.x - core.position.x) - part.scale.x / 2;
      expect(innerEdge).toBeGreaterThanOrEqual(2.5);
      const wall=BR_MAP_BLOCKS.find(b=>b.id===`${core.id}-back`)!;
      const wallFace = wall.position.z-wall.size.z/2;
      expect(part.position.z).toBeLessThan(wallFace);
      expect(part.position.z).toBeGreaterThanOrEqual(wallFace - .2);
      expect(part.position.z+part.scale.z/2).toBeLessThanOrEqual(wallFace-.002+1e-9);
    }
  });

  it("uses finite, shallow wall-mounted pieces with a bounded budget", () => {
    const parts = buildReactorInterior(core);
    expect(parts.length).toBeGreaterThan(20);
    expect(parts.length).toBeLessThanOrEqual(48);
    for (const part of parts) {
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value => Number.isFinite(value) && value > 0)).toBe(true);
      expect(part.scale.z).toBeLessThanOrEqual(.18);
      expect(part.position.y - part.scale.y / 2).toBeGreaterThan(1.2);
    }
  });
  it("rejects unsupported legacy divider and clears canonical rotated stairs",()=>{
    const firstStair=BR_MAP_BLOCKS.find(b=>b.id==="helios-core-stairs-1")!;
    // This point lay inside the old right panel and the actual rotated ramp:
    // old panel x267.375..275.025, local y1.59..4.51, z83.755..83.865.
    const oldPoint={x:271.18,y:core.position.y+4.4,z:83.8};
    const angle=firstStair.rotation!.x,dy=oldPoint.y-firstStair.position.y,dz=oldPoint.z-firstStair.position.z;
    expect(Math.abs(Math.cos(angle)*dy+Math.sin(angle)*dz)).toBeLessThan(firstStair.size.y/2);
    expect(Math.abs(-Math.sin(angle)*dy+Math.cos(angle)*dz)).toBeLessThan(firstStair.size.z/2);
    const parts=buildReactorInterior(core);
    expect(parts).toHaveLength(23);
    for(const p of parts){
      expect(p.position.z).toBeGreaterThan(94);
      for(const stair of BR_MAP_BLOCKS.filter(b=>b.id.startsWith("helios-core-stairs-"))){
        const a=stair.rotation?.x??0,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
        const half={x:stair.size.x/2,y:(c*stair.size.y+s*stair.size.z)/2,z:(s*stair.size.y+c*stair.size.z)/2};
        expect(Math.abs(p.position.x-stair.position.x)<p.scale.x/2+half.x+.08&&Math.abs(p.position.y+core.position.y-stair.position.y)<p.scale.y/2+half.y+.08&&Math.abs(p.position.z-stair.position.z)<p.scale.z/2+half.z+.08).toBe(false);
      }
    }
    expect(buildReactorInterior(core,[],BR_MAP_BLOCKS.filter(b=>b.id!=="helios-core-back"))).toEqual([]);
  });
  it("omits whole bays obstructed by supplied existing dressing",()=>{
    const p=buildReactorInterior(core)[0];
    expect(buildReactorInterior(core,[{min:{x:p.position.x-.1,y:p.position.y-.1,z:p.position.z-.1},max:{x:p.position.x+.1,y:p.position.y+.1,z:p.position.z+.1}}])).toEqual([]);
    expect(buildReactorInterior(core,[{min:{x:0,y:0,z:0},max:{x:1,y:1,z:1}}])).toHaveLength(23);
  });
});
