import {describe,it,expect} from "vitest";
import {BR_LOOT_SOCKETS,BR_STRUCTURES} from "@planetfall/shared";
import {buildFoundryEngines} from "./br-foundry";

describe("foundry engine-test assembly",()=>{
  const foundry=BR_STRUCTURES.find(s=>s.id==="thruster-foundry")!;
  it("keeps all heavy engine parts above the accessible roof",()=>{
    for(const p of buildFoundryEngines(foundry)) {
      expect(Object.values(p.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(p.scale).every(v=>Number.isFinite(v)&&v>0)).toBe(true);
      // Radial dimensions are radii for barrel/bell and ring primitives.
      const halfY=p.shape==="box"?(Math.abs(Math.sin(p.rotationZ??0))*p.scale.x+Math.abs(Math.cos(p.rotationZ??0))*p.scale.y)/2:p.shape==="ring"?p.scale.y*1.06:p.scale.z;
      expect(p.position.y-halfY).toBeGreaterThan(foundry.size.y+.15);
      if(p.shape!=="box")expect(p.position.y-halfY).toBeGreaterThan(foundry.size.y+2.7);
    }
  });
  it("keeps roof-level stands away from loot, the central aisle and stair perimeter",()=>{
    const parts=buildFoundryEngines(foundry);
    expect(parts.filter(p=>p.shape==="barrel"&&p.finish==="shell")).toHaveLength(2);
    for(const p of parts.filter(p=>p.position.y<foundry.size.y+4)) {
      expect(Math.abs(p.position.x-foundry.position.x)-p.scale.x/2).toBeGreaterThan(8);
      expect(Math.abs(p.position.x-foundry.position.x)+p.scale.x/2).toBeLessThan(foundry.size.x/2-2);
      expect(Math.abs(p.position.z-foundry.position.z)+p.scale.z/2).toBeLessThan(foundry.size.z/2-2);
      for(const socket of BR_LOOT_SOCKETS.filter(s=>s.structureId===foundry.id&&s.kind==="roof"&&p.position.y-p.scale.y/2<foundry.size.y+2.4))
        expect(Math.abs(p.position.x-socket.position.x)<p.scale.x/2+1&&Math.abs(p.position.z-socket.position.z)<p.scale.z/2+1).toBe(false);
    }
  });
});
