import { describe,expect,it } from "vitest";
import { BR_STRUCTURES, BR_LOOT_SOCKETS, BR_MAP_BLOCKS } from "@planetfall/shared";
import { buildResidentialInterior } from "./br-residential-interiors";

describe("residential lounge dressing",()=>{
  it("keeps furniture shallow, finite and supported on each real floor",()=>{
    let total=0;
    for(const s of BR_STRUCTURES)for(const p of buildResidentialInterior(s).parts){
      total++;
      expect(Object.values(p.scale).every(v=>Number.isFinite(v)&&v>0)).toBe(true);
      expect(p.position.x-p.scale.x/2).toBeGreaterThan(s.position.x-s.size.x/2+.325);
      expect(p.position.x+p.scale.x/2).toBeLessThan(s.position.x-s.size.x/2+1.21);
      expect(Math.abs(p.position.z-s.position.z)+p.scale.z/2).toBeLessThan(s.size.z/2-.5);
      expect(p.position.y-p.scale.y/2).toBeGreaterThanOrEqual(.36);
      expect(p.position.y+p.scale.y/2).toBeLessThan(s.size.y-.3);
    }
    expect(total).toBeGreaterThan(100);
  });
  it("preserves doorways, dividers, stair lanes and loot clearance",()=>{
    for(const s of BR_STRUCTURES)for(const p of buildResidentialInterior(s).parts){
      if(s.entrance==="west")expect(Math.abs(p.position.z-s.position.z)-p.scale.z/2).toBeGreaterThan(2.8);
      for(const b of BR_MAP_BLOCKS.filter(b=>b.id.startsWith(`${s.id}-room-`))) {
        const overlap=Math.abs(p.position.x-b.position.x)<(p.scale.x+b.size.x)/2&&Math.abs(p.position.y-b.position.y)<(p.scale.y+b.size.y)/2&&Math.abs(p.position.z-b.position.z)<(p.scale.z+b.size.z)/2;
        expect(overlap).toBe(false);
      }
      for(const l of BR_LOOT_SOCKETS.filter(l=>l.structureId===s.id))expect(
        Math.abs(p.position.x-l.position.x)<p.scale.x/2+.6&&Math.abs(p.position.y-l.position.y)<p.scale.y/2+.6&&Math.abs(p.position.z-l.position.z)<p.scale.z/2+.6).toBe(false);
      expect(p.position.x+p.scale.x/2).toBeLessThan(s.position.x); // stairs are on east side
    }
  });
  it("has bounded per-floor detail and only decorates enterable residences",()=>{
    for(const s of BR_STRUCTURES){
      const result=buildResidentialInterior(s);
      if(!s.enterable||!["apartment","hotel"].includes(s.archetype))expect(result).toEqual({parts:[],signs:[]});
      else {expect(result.parts.length).toBeLessThanOrEqual(70*s.floors);expect(result.signs.length).toBe(s.floors);}
    }
  });
});
