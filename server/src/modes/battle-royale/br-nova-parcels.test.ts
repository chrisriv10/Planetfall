import { describe, expect, it } from "vitest";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";
import { BR_MAP_BLOCKS } from "@planetfall/shared";

describe("separated Nova building frontages", () => {
  it.each([
    ["market east entrance", -98, -115, -106],
    ["hotel west entrance", -146, -126, -197],
    ["hotel/tower alley", -150, -110, -186.5],
    ["studio/market alley", -129, -129, -103]
  ] as const)("keeps %s walkable with prediction parity and real floor support", (_label, fromX, toX, z) => {
    const authority = new BrPhysicsWorld(), prediction = new BrPredictionPhysics();
    let feet = { x: fromX, y: 5.035, z }, predicted = { ...feet };
    // The fourth fixture follows the new 8m studio/market passage north/south.
    const target = fromX === toX ? { x: toX, z: -117 } : { x: toX, z };
    const floor = BR_MAP_BLOCKS.find(b => b.id === (_label.startsWith("market ") ? "nova-market-floor" : _label.startsWith("hotel west") ? "nova-hotel-floor" : "unused"));
    try {
      for (let frame = 0; frame < 500 && Math.hypot(target.x - feet.x, target.z - feet.z) > .005; frame++) {
        const dx = target.x - feet.x, dz = target.z - feet.z, distance = Math.hypot(dx, dz), step = Math.min(.12, distance);
        const desired = { x: dx / distance * step, y: -.12, z: dz / distance * step };
        const actual = authority.move("nova-parcel", feet, desired, false), anticipated = prediction.move(predicted, desired, false);
        feet = { x: feet.x + actual.movement.x, y: feet.y + actual.movement.y, z: feet.z + actual.movement.z };
        predicted = { x: predicted.x + anticipated.movement.x, y: predicted.y + anticipated.movement.y, z: predicted.z + anticipated.movement.z };
        expect(actual.grounded, JSON.stringify(feet)).toBe(true);
        expect(anticipated.grounded).toBe(true);
        // Enterable floors have an intentional 36cm threshold. Autostep lifts
        // the capsule before its center crosses the edge, so center-ray support
        // is meaningful on the stable floors, not during that step transition.
        const edge = floor ? Math.min(Math.abs(Math.abs(feet.x-floor.position.x)-floor.size.x/2),Math.abs(Math.abs(feet.z-floor.position.z)-floor.size.z/2)) : Infinity;
        const inside = floor && Math.abs(feet.x-floor.position.x)<floor.size.x/2 && Math.abs(feet.z-floor.position.z)<floor.size.z/2;
        if(edge > .6){
          const floorY = inside ? floor!.position.y+floor!.size.y/2 : 5;
          expect(feet.y,JSON.stringify(feet)).toBeCloseTo(floorY+.035,1);
          expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1),JSON.stringify(feet)).toBeLessThan(.08);
        } else {
          expect(feet.y).toBeGreaterThanOrEqual(5);
          expect(feet.y).toBeLessThanOrEqual(floor!.position.y+floor!.size.y/2+.08);
        }
        expect(predicted.x).toBeCloseTo(feet.x, 5);
        expect(predicted.y).toBeCloseTo(feet.y, 5);
        expect(predicted.z).toBeCloseTo(feet.z, 5);
      }
      expect(Math.hypot(target.x - feet.x, target.z - feet.z)).toBeLessThan(.005);
    } finally { prediction.dispose(); authority.dispose(); }
  });
});
