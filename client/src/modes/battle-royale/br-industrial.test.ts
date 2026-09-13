import {describe,it,expect} from "vitest";
import {BR_STRUCTURES,BR_LOOT_SOCKETS} from "@planetfall/shared";
import {buildCargoCrane,buildIndustrialRoof} from "./br-industrial";

describe("industrial visual kit",()=>{
  it("keeps crane ground pieces inside the old mast footprint",()=>{
    for(const direction of [-1,1] as const)for(const part of buildCargoCrane(direction)){
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(n=>n>0)).toBe(true);
      if(part.position.y-part.scale.y/2>=12)continue;
      const r=part.rotationZ??0;
      const halfX=(Math.abs(Math.cos(r))*part.scale.x+Math.abs(Math.sin(r))*part.scale.y)/2;
      expect(Math.abs(part.position.x)+halfX).toBeLessThanOrEqual(1.15);
      expect(Math.abs(part.position.z)+part.scale.z/2).toBeLessThanOrEqual(1.15);
    }
  });
  it("mirrors both complete crane assemblies without adding duplicates",()=>{
    const a=buildCargoCrane(1),b=buildCargoCrane(-1);
    expect(a.length).toBe(b.length);
    for(let i=0;i<a.length;i++){expect(a[i].position.x).toBe(-b[i].position.x);expect(a[i].scale).toEqual(b[i].scale);}
  });
  it("keeps machinery low, inside roofs and away from loot",()=>{
    let count=0;
    for(const structure of BR_STRUCTURES)for(const part of buildIndustrialRoof(structure)){
      count++;
      expect(part.position.y-part.scale.y/2).toBeGreaterThan(structure.size.y);
      expect(part.position.y+part.scale.y/2).toBeLessThan(structure.size.y+1);
      expect(Math.abs(part.position.x-structure.position.x)+part.scale.x/2).toBeLessThan(structure.size.x/2-1);
      expect(Math.abs(part.position.z-structure.position.z)+part.scale.z/2).toBeLessThan(structure.size.z/2-1);
      for(const socket of BR_LOOT_SOCKETS.filter(s=>s.structureId===structure.id&&s.kind==="roof"))
        expect(Math.abs(part.position.x-socket.position.x)<part.scale.x/2+.7&&Math.abs(part.position.z-socket.position.z)<part.scale.z/2+.7).toBe(false);
    }
    expect(count).toBeGreaterThan(100);
  });
});
