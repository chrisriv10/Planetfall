import { describe, expect, it } from "vitest";
import { BR_STRUCTURES } from "@planetfall/shared";
import { buildBrFacadeLeds } from "./br-facade-leds";
import { buildFacadeParts } from "./br-facades";

describe("recessed facade LEDs",()=>{
  it("mounts LEDs above glazing with door, sign and corner gaps across the island",()=>{
    let count=0;
    for(const structure of BR_STRUCTURES){
      const glazing=buildFacadeParts(structure).filter(p=>p.finish==="glass"||p.finish==="lit");
      for(const led of buildBrFacadeLeds(structure)){
        count++;
        expect(led.position.y-led.scale.y/2,structure.id).toBeGreaterThan(Math.max(.7,...glazing.filter(p=>p.face===led.face).map(p=>p.position.y+p.scale.y/2)));
        expect(led.position.y+led.scale.y/2,structure.id).toBeLessThan(structure.size.y-.12);
        const along=led.face==="north"||led.face==="south"?"x":"z";
        const normal=along==="x"?"z":"x";
        const near=Math.abs(led.position[along]-structure.position[along])-led.scale[along]/2;
        expect(near+1e-10,structure.id).toBeGreaterThanOrEqual(structure.enterable&&structure.entrance===led.face?5:1);
        expect(Math.abs(led.position[along]-structure.position[along])+led.scale[along]/2,structure.id).toBeLessThanOrEqual(structure.size[along]/2-2.7+.0001);
        expect(Math.abs(led.position[normal]-structure.position[normal])-led.scale[normal]/2,structure.id).toBeGreaterThan(structure.size[normal]/2+.65);
      }
    }
    expect(count).toBeGreaterThan(500);
  });
});
