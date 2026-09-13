import { describe, it, expect } from "vitest";
import { BR_STRUCTURES, BR_LOOT_SOCKETS } from "@planetfall/shared";
import { buildWreckRoof, buildWreckInterior } from "./br-wreck";

describe("wreck hull shell",()=>{
  const fuselage=BR_STRUCTURES.find(s=>s.id==="crash-fuselage")!;
  it("keeps interior fittings against walls or ceiling, clear of loot and the central lane",()=>{
    for(const part of buildWreckInterior(fuselage)) {
      expect(part.position.y-part.scale.y/2).toBeGreaterThan(.15);
      expect(part.position.y+part.scale.y/2).toBeLessThan(fuselage.size.y-.15);
      expect(Math.abs(part.position.z-fuselage.position.z)+part.scale.z/2).toBeLessThan(fuselage.size.z/2-.325);
      expect(Math.abs(part.position.x-fuselage.position.x)+part.scale.x/2).toBeLessThan(fuselage.size.x/2-.325);
      expect(part.position.y-part.scale.y/2>7 || Math.abs(part.position.z-fuselage.position.z)-part.scale.z/2>7).toBe(true);
      for(const socket of BR_LOOT_SOCKETS.filter(s=>s.structureId===fuselage.id&&s.kind==="interior"))
        expect(Math.abs(part.position.x-socket.position.x)<part.scale.x/2+.7&&Math.abs(part.position.z-socket.position.z)<part.scale.z/2+.7&&part.position.y-part.scale.y/2<2).toBe(false);
    }
  });
  it("keeps every rotated plate above the playable roof and inside its footprint",()=>{
    const parts=buildWreckRoof(fuselage);
    expect(parts.length).toBeGreaterThan(40);
    for(const p of parts){
      const halfY=(Math.abs(Math.cos(p.rotationX))*p.scale.y+Math.abs(Math.sin(p.rotationX))*p.scale.z)/2;
      const halfZ=(Math.abs(Math.sin(p.rotationX))*p.scale.y+Math.abs(Math.cos(p.rotationX))*p.scale.z)/2;
      expect(p.position.y-halfY).toBeGreaterThan(fuselage.size.y);
      expect(Math.abs(p.position.z-fuselage.position.z)+halfZ).toBeLessThan(fuselage.size.z/2);
      expect(Math.abs(p.position.x-fuselage.position.x)+p.scale.x/2).toBeLessThan(fuselage.size.x/2);
      expect(Object.values(p.scale).every(v=>Number.isFinite(v)&&v>0)).toBe(true);
    }
  });
  it("leaves roof sockets open and includes torn-away plates",()=>{
    // The current fuselage has interior loot only. Exercise future roof-socket
    // clearance explicitly rather than passing an empty-loop assertion.
    const socket={x:fuselage.position.x-10,y:fuselage.size.y+.65,z:fuselage.position.z+2};
    const parts=buildWreckRoof(fuselage,[socket]);
    expect(parts.length).toBeLessThan(buildWreckRoof(fuselage).length);
    for(const part of parts)expect(Math.abs(part.position.x-socket.x)-part.scale.x/2).toBeGreaterThan(1);
    expect(parts.filter(p=>p.finish==="frame").length).toBeGreaterThan(parts.filter(p=>p.finish!=="frame").length);
  });
});
