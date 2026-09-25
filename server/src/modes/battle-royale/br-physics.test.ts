import { describe,expect,it } from "vitest";
import { BR_BALANCE, BR_MAP_BLOCKS, BR_STRUCTURES } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";

describe("Battle Royale Rapier world",()=>{
  it.each(["comet-hotel-1","horizon-homes-1"])("climbs %s interior stairs onto the upper floor without jumping",(id)=>{
    const physics=new BrPhysicsWorld();
    try {
      const structure=BR_STRUCTURES.find(s=>s.id===id)!;
      const ramp=BR_MAP_BLOCKS.find(b=>b.id===`${id}-stairs-1`)!;
      const rise=structure.size.y/structure.floors;
      const run=Math.max(6,Math.min(structure.size.z-3,rise*2.6));
      let feet={x:ramp.position.x,y:.4,z:ramp.position.z+run/2+.7};
      for(let step=0;step<600;step++){
        const movement=physics.move("stair-walk",feet,{x:0,y:-.07,z:-.1},false).movement;
        feet={x:feet.x+movement.x,y:feet.y+movement.y,z:feet.z+movement.z};
        if(feet.z<ramp.position.z-run/2-.35)break;
      }
      // Settle beyond the incline: floating briefly over the hole is not a landing.
      for(let step=0;step<20;step++){
        const movement=physics.move("stair-walk",feet,{x:0,y:-.1,z:0},false).movement;
        feet={x:feet.x+movement.x,y:feet.y+movement.y,z:feet.z+movement.z};
      }
      expect(feet.z).toBeLessThan(ramp.position.z-run/2-.3);
      expect(feet.y).toBeGreaterThan(rise);
    } finally {physics.dispose();}
  });
  it.each(["central-heights-1","relay-market-1","comet-hotel-1","horizon-homes-1"])("walks from deck to %s roof without jumping",(id)=>{
    const physics=new BrPhysicsWorld();
    try {
      const structure=BR_STRUCTURES.find(s=>s.id===id)!;
      const ramp=BR_MAP_BLOCKS.find(b=>b.id===`${structure.id}-roof-ramp`)!;
      const ns=structure.entrance==="north"||structure.entrance==="south";
      const sign=structure.entrance==="north"||structure.entrance==="east"?1:-1;
      const run=Math.max(10,structure.size.y*2.35);
      let feet={x:ramp.position.x+(ns?0:sign*(run/2+1)),y:.04,z:ramp.position.z+(ns?sign*(run/2+1):0)};
      // Character-controller slope projection shortens horizontal movement;
      // stop on arrival, rather than assuming input distance equals travel.
      for(let step=0;step<1000;step++){
        const result=physics.move("roof-walk",feet,{x:ns?0:-sign*.12,y:-.08,z:ns?-sign*.12:0},false);
        feet={x:feet.x+result.movement.x,y:feet.y+result.movement.y,z:feet.z+result.movement.z};
        if(feet.y>structure.size.y&&Math.abs(feet.x-structure.position.x)<structure.size.x/2-.6&&Math.abs(feet.z-structure.position.z)<structure.size.z/2-.6)break;
      }
      expect(feet.y).toBeGreaterThan(structure.size.y);
      expect(Math.abs(feet.x-structure.position.x)).toBeLessThan(structure.size.x/2);
      expect(Math.abs(feet.z-structure.position.z)).toBeLessThan(structure.size.z/2);
    } finally {physics.dispose();}
  });
  it("keeps a capsule on the authored island and blocks solid building walls",()=>{
    const physics=new BrPhysicsWorld();
    const floor=physics.move("pilot",{x:72,y:.08,z:72},{x:.2,y:-.3,z:0},false);expect(floor.grounded).toBe(true);expect(floor.movement.y).toBeLessThan(-.03);expect(floor.movement.y).toBeGreaterThan(-.09);
    const structure=BR_STRUCTURES[0];const start={x:structure.position.x-structure.size.x/2-1,y:0,z:structure.position.z};
    const wall=physics.move("pilot",start,{x:2,y:-.02,z:0},false);expect(wall.movement.x).toBeLessThan(1.2);expect(Number.isFinite(wall.movement.x+wall.movement.y+wall.movement.z)).toBe(true);
    physics.dispose();
  });

  it("uses the same colliders for weapon obstruction",()=>{
    const physics=new BrPhysicsWorld();const structure=BR_STRUCTURES[0];const distance=physics.rayDistance({x:structure.position.x-30,y:1,z:structure.position.z},{x:1,y:0,z:0},80);expect(distance).toBeGreaterThan(0);expect(distance).toBeLessThan(30);physics.dispose();
  });

  it("sweeps a falling capsule onto the main deck without tunneling",()=>{const physics=new BrPhysicsWorld();let feet={x:72,y:12,z:72};let grounded=false;for(let step=0;step<80&&!grounded;step++){const result=physics.move("drop",feet,{x:0,y:-.55,z:0},false);feet={x:feet.x+result.movement.x,y:feet.y+result.movement.y,z:feet.z+result.movement.z};grounded=result.grounded;}expect(grounded).toBe(true);expect(feet.y).toBeGreaterThanOrEqual(-.01);expect(feet.y).toBeLessThan(.12);physics.dispose();});

  it("holds a grounded capsule at a stable contact offset without flickering",()=>{const physics=new BrPhysicsWorld();let feet={x:72,y:.08,z:72};for(let step=0;step<90;step++){const result=physics.move("stable",feet,{x:.035,y:-.018,z:0},false);feet={x:feet.x+result.movement.x,y:feet.y+result.movement.y,z:feet.z+result.movement.z};expect(result.grounded).toBe(true);expect(Number.isFinite(feet.x+feet.y+feet.z)).toBe(true);}expect(feet.y).toBeGreaterThanOrEqual(.02);expect(feet.y).toBeLessThan(.06);physics.dispose();});

  it("crosses movement-sector seams and resizes the crouch capsule without losing contact",()=>{const physics=new BrPhysicsWorld();let feet={x:99.7,y:.04,z:-250};const first=physics.move("sector",feet,{x:.6,y:-.02,z:0},false,true);feet={x:feet.x+first.movement.x,y:feet.y+first.movement.y,z:feet.z+first.movement.z};const second=physics.move("sector",feet,{x:.6,y:-.02,z:0},false,false);expect(first.crouched).toBe(true);expect(second.crouched).toBe(false);expect(first.grounded&&second.grounded).toBe(true);expect(feet.x+second.movement.x).toBeGreaterThan(100.7);physics.dispose();});

  it.each([{label:"sprint",step:1.15},{label:"slide",step:1.55}])("sweeps maximum $label movement into thin walls",({step})=>{
    const physics=new BrPhysicsWorld();
    try{
      const structure=BR_STRUCTURES.find(entry=>entry.enterable)!;
      const wallX=structure.position.x-structure.size.x/2;
      let feet={x:wallX-2.2,y:.04,z:structure.position.z};
      for(let tick=0;tick<5;tick++){
        const result=physics.move("fast-wall",feet,{x:step,y:-.03,z:0},false,tick%2===1);
        feet={x:feet.x+result.movement.x,y:feet.y+result.movement.y,z:feet.z+result.movement.z};
      }
      expect(feet.x).toBeLessThanOrEqual(wallX-BR_BALANCE.playerRadius+.05);
    }finally{physics.dispose();}
  });

  it("blocks a high-delta diagonal corner approach without tunneling",()=>{
    const physics=new BrPhysicsWorld();
    try{
      const structure=BR_STRUCTURES.find(entry=>entry.enterable)!;
      const minX=structure.position.x-structure.size.x/2,minZ=structure.position.z-structure.size.z/2;
      let feet={x:minX-1.8,y:.04,z:minZ-1.8};
      for(let tick=0;tick<4;tick++){
        const result=physics.move("corner",feet,{x:1.25,y:-.04,z:1.25},false);
        feet={x:feet.x+result.movement.x,y:feet.y+result.movement.y,z:feet.z+result.movement.z};
      }
      const penetrated=feet.x>minX-BR_BALANCE.playerRadius*.8&&feet.z>minZ-BR_BALANCE.playerRadius*.8;
      expect(penetrated).toBe(false);
    }finally{physics.dispose();}
  });
});
