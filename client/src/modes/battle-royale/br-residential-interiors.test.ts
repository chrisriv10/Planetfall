import { describe,expect,it } from "vitest";
import { BR_STRUCTURES, BR_LOOT_SOCKETS, BR_MAP_BLOCKS } from "@planetfall/shared";
import { buildResidentialInterior, buildResidentialCeiling, buildResidentialLandingMarkers } from "./br-residential-interiors";

describe("residential lounge dressing",()=>{
  it("mounts numbered landing markers on real back walls, clear of stairs and ceilings",()=>{
    let markers=0;
    for(const s of BR_STRUCTURES) {
      const result=buildResidentialLandingMarkers(s);
      const landings=BR_MAP_BLOCKS.filter(b=>b.id.startsWith(`${s.id}-deck-`)&&b.id.endsWith("-landing"));
      if(!s.enterable||!["apartment","hotel"].includes(s.archetype))expect(result).toEqual({parts:[],signs:[]});
      expect(result.parts.length).toBe(result.signs.length*7);
      expect(result.signs.length).toBeLessThanOrEqual(landings.length);
      for(const sign of result.signs) {
        markers++;
        const landing=landings.find(b=>b.position.x===sign.position.x&&Math.abs(sign.position.y-(b.position.y+b.size.y/2+2.2))<.001)!;
        expect(landing).toBeDefined();
        expect(sign.text).toBe(`LEVEL ${String(Math.round(landing.position.y/(s.size.y/s.floors))+1).padStart(2,"0")}`);
      }
      for(const part of result.parts) {
        expect(Object.values(part.scale).every(v=>Number.isFinite(v)&&v>0)).toBe(true);
        expect(part.position.z-part.scale.z/2).toBeGreaterThan(s.position.z-s.size.z/2+.61);
        expect(part.position.z+part.scale.z/2).toBeLessThan(s.position.z-s.size.z/2+.75);
        expect(Math.abs(part.position.x-s.position.x)+part.scale.x/2).toBeLessThan(s.size.x/2-.5);
        expect(part.position.y+part.scale.y/2).toBeLessThan(s.size.y-.3);
        if(s.entrance==="south")expect(Math.abs(part.position.x-s.position.x)-part.scale.x/2).toBeGreaterThan(2.8);
      }
    }
    expect(markers).toBeGreaterThan(0);
    expect(buildResidentialLandingMarkers(BR_STRUCTURES.find(s=>s.id==="comet-hotel-1")!).signs.map(s=>s.text)).toEqual(["LEVEL 02"]);
  });
  it("mounts ceiling detail underneath real slabs without bridging stair openings",()=>{
    let count=0;
    for(const s of BR_STRUCTURES)for(const p of buildResidentialCeiling(s)) {
      count++;
      expect(Object.values(p.scale).every(v=>v>0&&Number.isFinite(v))).toBe(true);
      expect(BR_MAP_BLOCKS.some(b=>b.id.startsWith(`${s.id}-`)&&b.kind==="platform"&&!b.id.endsWith("-floor")&&
        Math.abs(p.position.x-b.position.x)+p.scale.x/2<b.size.x/2-.5&&
        Math.abs(p.position.z-b.position.z)+p.scale.z/2<b.size.z/2-.5&&
        p.position.y+p.scale.y/2<b.position.y-b.size.y/2&&
        p.position.y-p.scale.y/2>b.position.y-b.size.y/2-.13)).toBe(true);
    }
    expect(count).toBeGreaterThan(50);
    for(const s of BR_STRUCTURES.filter(s=>!s.enterable||!["apartment","hotel"].includes(s.archetype)))expect(buildResidentialCeiling(s)).toEqual([]);
  });
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
      else {expect(result.parts.length).toBeLessThanOrEqual(96*s.floors);expect(result.signs.length).toBeGreaterThanOrEqual(s.floors);expect(result.signs.length).toBeLessThanOrEqual(s.floors+1);}
    }
  });
  it("distinguishes check-in and parcel bays without blocking a west entrance",()=>{
    const hotel=BR_STRUCTURES.find(s=>s.id==="comet-hotel-1")!;
    const homes=BR_STRUCTURES.find(s=>s.id==="central-heights-1")!;
    expect(buildResidentialInterior(hotel).signs.some(s=>s.text==="CHECK IN")).toBe(true);
    expect(buildResidentialInterior({...homes,entrance:"north"}).signs.some(s=>s.text==="PARCELS")).toBe(true);
    const west=BR_STRUCTURES.find(s=>s.id==="horizon-homes-1")!;
    expect(buildResidentialInterior(west).signs.some(s=>s.text==="PARCELS")).toBe(false);
  });
  it("keeps wayfinding clear of corner columns and below ceilings",()=>{
    for(const s of BR_STRUCTURES)for(const sign of buildResidentialInterior(s).signs) {
      expect(Math.abs(sign.position.z-s.position.z)+sign.width/2).toBeLessThan(s.size.z/2-2);
      expect(sign.position.y+.225).toBeLessThan(s.size.y-.3);
    }
  });
});
