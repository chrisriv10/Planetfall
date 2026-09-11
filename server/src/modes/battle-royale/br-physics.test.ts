import { describe,expect,it } from "vitest";
import { BR_STRUCTURES } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";

describe("Battle Royale Rapier world",()=>{
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
});
