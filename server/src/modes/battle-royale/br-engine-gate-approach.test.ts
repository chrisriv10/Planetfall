import { describe, expect, it } from "vitest";
import { BR_MAP_BLOCKS } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

describe("Dock–Engine through-street and occupied approach", () => {
  const paths = [
    { label: "through-road to southern district ring", points: [{ x:340, y:.035, z:-205 }, { x:340, y:.035, z:-135 }] },
    { label: "workshop doorway", floor: "engine-gate-approach-workshop-floor", points: [{ x:340, y:.035, z:-198 }, { x:320, y:.395, z:-198 }] },
    { label: "relay doorway", floor: "engine-gate-approach-relay-floor", points: [{ x:340, y:.035, z:-162 }, { x:320, y:.395, z:-162 }] },
    { label: "open service court between buildings", points: [{ x:310, y:.035, z:-180 }, { x:340, y:.035, z:-180 }] }
  ];
  it.each(paths.flatMap(path => [false, true].map(reverse => ({ ...path, reverse }))))(
    "walks $label with real support and prediction parity (reverse=$reverse)", ({ label, points, floor:floorId, reverse }) => {
      const authority = new BrPhysicsWorld(), prediction = new BrPredictionPhysics();
      const path = reverse ? points.slice().reverse() : points;
      const floor = floorId ? BR_MAP_BLOCKS.find(b => b.id === floorId)! : null;
      let feet = { ...path[0] }, predicted = { ...feet };
      try {
        for (const target of path.slice(1)) {
          for (let frame = 0; frame < 1800 && Math.hypot(target.x-feet.x, target.z-feet.z) > .005; frame++) {
            const dx = target.x-feet.x, dz = target.z-feet.z, distance = Math.hypot(dx,dz), step = Math.min(.12,distance);
            const desired = { x:dx/distance*step, y:-.12, z:dz/distance*step };
            const actual = authority.move(label,feet,desired,false), anticipated = prediction.move(predicted,desired,false);
            feet = { x:feet.x+actual.movement.x, y:feet.y+actual.movement.y, z:feet.z+actual.movement.z };
            predicted = { x:predicted.x+anticipated.movement.x, y:predicted.y+anticipated.movement.y, z:predicted.z+anticipated.movement.z };
            expect(actual.grounded,JSON.stringify(feet)).toBe(true);
            expect(anticipated.grounded).toBe(true);
            // Autostep may raise feet immediately before crossing the .36m floor lip.
            const edge = floor ? Math.abs(Math.abs(feet.x-floor.position.x)-floor.size.x/2) : Infinity;
            if (edge > .6) expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1),JSON.stringify(feet)).toBeLessThan(.08);
            else { expect(feet.y).toBeGreaterThanOrEqual(0); expect(feet.y).toBeLessThanOrEqual(.44); }
            expect(predicted.x).toBeCloseTo(feet.x,5);
            expect(predicted.y).toBeCloseTo(feet.y,5);
            expect(predicted.z).toBeCloseTo(feet.z,5);
          }
          expect(Math.hypot(target.x-feet.x,target.z-feet.z)).toBeLessThan(.005);
          expect(feet.y).toBeCloseTo(target.y,1);
        }
      } finally { prediction.dispose(); authority.dispose(); }
    }
  );
});
