import { describe, expect, it } from "vitest";
import { BR_LOOT_SOCKETS, BR_STRUCTURES } from "@planetfall/shared";
import { buildBrRooftopDetails } from "./br-rooftop-details";

describe("BR low-profile rooftop detail",()=>{
  it("stays inside the roof, above its deck, and clear of roof loot",()=>{
    let count=0;
    for(const structure of BR_STRUCTURES){
      const loot=BR_LOOT_SOCKETS.find(socket=>socket.structureId===structure.id&&socket.kind==="roof");
      for(const part of buildBrRooftopDetails(structure,loot)){
        count++;
        expect(Math.abs(part.position.x-structure.position.x)+part.scale.x/2).toBeLessThanOrEqual(structure.size.x/2);
        expect(Math.abs(part.position.z-structure.position.z)+part.scale.z/2).toBeLessThanOrEqual(structure.size.z/2);
        expect(part.position.y-part.scale.y/2).toBeGreaterThanOrEqual(structure.size.y+.2);
        expect(part.position.y+part.scale.y/2).toBeLessThan(structure.size.y+1);
        if(loot)expect(Math.hypot(part.position.x-loot.position.x,part.position.z-loot.position.z))
          .toBeGreaterThanOrEqual(3.3+Math.max(part.scale.x,part.scale.z)*.5);
      }
    }
    expect(count).toBeGreaterThan(150);
  });
  it("leaves an accessible roof's ramp-arrival edge open",()=>{
    for(const structure of BR_STRUCTURES.filter(entry=>entry.roofAccess)){
      const parts=buildBrRooftopDetails(structure,BR_LOOT_SOCKETS.find(socket=>socket.structureId===structure.id&&socket.kind==="roof"));
      const edge=structure.entrance;
      for(const part of parts.filter(item=>item.finish==="edge")){
        if(edge==="north")expect(part.position.z).not.toBeGreaterThan(structure.position.z+structure.size.z*.4);
        if(edge==="south")expect(part.position.z).not.toBeLessThan(structure.position.z-structure.size.z*.4);
        if(edge==="east")expect(part.position.x).not.toBeGreaterThan(structure.position.x+structure.size.x*.4);
        if(edge==="west")expect(part.position.x).not.toBeLessThan(structure.position.x-structure.size.x*.4);
      }
    }
  });
  it("omits special authored roofs and non-enterable shells",()=>{
    for(const id of ["crash-fuselage","thruster-foundry","astra-observatory"]){
      const structure=BR_STRUCTURES.find(entry=>entry.id===id)!;
      expect(buildBrRooftopDetails(structure)).toEqual([]);
    }
    const structure=BR_STRUCTURES.find(entry=>entry.enterable)!;
    expect(buildBrRooftopDetails({...structure,enterable:false})).toEqual([]);
  });
});
