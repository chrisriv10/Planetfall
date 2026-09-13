import { describe, it, expect } from "vitest";
import { BR_STRUCTURES, BR_LOOT_SOCKETS } from "@planetfall/shared";
import { buildGrowhouseRoof } from "./br-growhouse";

describe("growhouse roof-light architecture", () => {
  it("stays above rooms and inside the roof perimeter", () => {
    let count = 0;
    for (const structure of BR_STRUCTURES) for (const part of buildGrowhouseRoof(structure)) {
      count++;
      const angle = part.rotationZ ?? 0;
      const halfY = (Math.abs(Math.sin(angle)) * part.scale.x + Math.abs(Math.cos(angle)) * part.scale.y) / 2;
      const halfX = (Math.abs(Math.cos(angle)) * part.scale.x + Math.abs(Math.sin(angle)) * part.scale.y) / 2;
      expect(part.position.y - halfY).toBeGreaterThan(structure.size.y);
      expect(Math.abs(part.position.x - structure.position.x) + halfX).toBeLessThan(structure.size.x / 2 - 2);
      expect(Math.abs(part.position.z - structure.position.z) + part.scale.z / 2).toBeLessThan(structure.size.z / 2 - 2);
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
    }
    expect(count).toBeGreaterThan(100);
  });
  it("does not decorate roof-access structures or other building families", () => {
    for (const structure of BR_STRUCTURES.filter(s => s.roofAccess || s.archetype !== "greenhouse")) {
      expect(buildGrowhouseRoof(structure)).toEqual([]);
    }
  });
  it("leaves aerial loot bays clear even on roofs without a ramp",()=>{
    for(const structure of BR_STRUCTURES)for(const socket of BR_LOOT_SOCKETS.filter(s=>s.structureId===structure.id&&s.kind==="roof"))
      for(const part of buildGrowhouseRoof(structure)){
        const angle=part.rotationZ??0;
        const halfX=(Math.abs(Math.cos(angle))*part.scale.x+Math.abs(Math.sin(angle))*part.scale.y)/2;
        expect(Math.abs(part.position.x-socket.position.x)<halfX+.65&&Math.abs(part.position.z-socket.position.z)<part.scale.z/2+.65).toBe(false);
      }
  });
});
