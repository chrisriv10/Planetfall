import { describe, expect, it } from "vitest";
import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_STRUCTURES } from "@planetfall/shared";
import { buildRetailInterior } from "./br-retail-interiors";

describe("retail interior visual placement", () => {
  it("mounts every display on an authoritative divider without crossing its doorway", () => {
    let count=0;
    for (const structure of BR_STRUCTURES) for (const part of buildRetailInterior(structure).parts) {
      count++;
      const wall=BR_MAP_BLOCKS.find(b => b.id.startsWith(`${structure.id}-room-`) &&
        Math.abs(part.position.x-b.position.x)+part.scale.x/2 < b.size.x/2);
      expect(wall).toBeDefined();
      const face=wall!.position.z-wall!.size.z/2;
      expect(part.position.z+part.scale.z/2).toBeLessThan(face);
      expect(face-part.position.z+part.scale.z/2).toBeLessThan(.7);
      expect(part.position.y-part.scale.y/2).toBeGreaterThan(0);
      expect(part.position.y+part.scale.y/2).toBeLessThan(4);
      expect(Object.values(part.scale).every(v=>v>0&&Number.isFinite(v))).toBe(true);
    }
    expect(count).toBeGreaterThan(100);
  });
  it("leaves loot sockets unobstructed and uses compact mounted signs", () => {
    for(const structure of BR_STRUCTURES) {
      const {parts,signs}=buildRetailInterior(structure);
      for(const socket of BR_LOOT_SOCKETS.filter(s=>s.structureId===structure.id)) for(const part of parts) {
        const overlaps=Math.abs(socket.position.x-part.position.x)<part.scale.x/2+.5 &&
          Math.abs(socket.position.y-part.position.y)<part.scale.y/2+.5 &&
          Math.abs(socket.position.z-part.position.z)<part.scale.z/2+.5;
        expect(overlaps).toBe(false);
      }
      for(const sign of signs) { expect(sign.width).toBeLessThan(6); expect(sign.position.y).toBe(3.18); }
    }
  });
  it("does not decorate non-enterable or non-retail structures", () => {
    for(const structure of BR_STRUCTURES.filter(s=>!s.enterable||!["shop","mall"].includes(s.archetype)))
      expect(buildRetailInterior(structure)).toEqual({parts:[],signs:[]});
  });
});
