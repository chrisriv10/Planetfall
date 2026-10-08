import { describe, expect, it } from "vitest";
import { BR_MAP_BLOCKS } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

describe("Comet Hotel actual entrance and street support", () => {
  const paths = [
    { label: "Nova arrival ramp", points: [{ x: -101, y: 5.035, z: -214 }, { x: -46, y: .035, z: -214 }] },
    { label: "hotel frontage and south avenue", points: [{ x: -65, y: .035, z: -189 }, { x: -65, y: .035, z: -270 }, { x: -76, y: .035, z: -270 }, { x: -76, y: .035, z: -335 }] },
    { label: "civic through route", points: [{ x: 0, y: .035, z: -80 }, { x: -65, y: .035, z: -175 }, { x: -65, y: .035, z: -214 }] },
    { label: "hotel east entrance", points: [{ x: -65, y: .035, z: -236 }, { x: -92, y: .395, z: -236 }], interior: true }
  ];
  it.each(paths.flatMap(path => [false, true].map(reverse => ({ ...path, reverse }))))(
    "walks $label with actual support and prediction parity (reverse=$reverse)", ({ label, points, reverse, interior }) => {
      const authority = new BrPhysicsWorld(), prediction = new BrPredictionPhysics();
      const path = reverse ? points.slice().reverse() : points;
      const floor = interior ? BR_MAP_BLOCKS.find(b => b.id === "comet-hotel-1-floor")! : null;
      let feet = { ...path[0] }, predicted = { ...feet };
      try {
        for (const target of path.slice(1)) {
          for (let frame = 0; frame < 1800 && Math.hypot(target.x - feet.x, target.z - feet.z) > .005; frame++) {
            const dx = target.x - feet.x, dz = target.z - feet.z, distance = Math.hypot(dx, dz), step = Math.min(.12, distance);
            const desired = { x: dx / distance * step, y: -.12, z: dz / distance * step };
            const actual = authority.move(label, feet, desired, false), anticipated = prediction.move(predicted, desired, false);
            feet = { x: feet.x + actual.movement.x, y: feet.y + actual.movement.y, z: feet.z + actual.movement.z };
            predicted = { x: predicted.x + anticipated.movement.x, y: predicted.y + anticipated.movement.y, z: predicted.z + anticipated.movement.z };
            expect(actual.grounded, JSON.stringify(feet)).toBe(true);
            expect(anticipated.grounded).toBe(true);
            // The existing enterable floor is a 36cm autostep. Only its narrow
            // edge transition may have support offset from the capsule centre.
            const edge = floor ? Math.abs(Math.abs(feet.x - floor.position.x) - floor.size.x / 2) : Infinity;
            if (edge > .6) expect(authority.rayDistance(feet, { x: 0, y: -1, z: 0 }, 1), JSON.stringify(feet)).toBeLessThan(.08);
            else { expect(feet.y).toBeGreaterThanOrEqual(0); expect(feet.y).toBeLessThanOrEqual(.44); }
            expect(predicted.x).toBeCloseTo(feet.x, 5);
            expect(predicted.y).toBeCloseTo(feet.y, 5);
            expect(predicted.z).toBeCloseTo(feet.z, 5);
          }
          expect(Math.hypot(target.x - feet.x, target.z - feet.z)).toBeLessThan(.005);
          expect(feet.y).toBeCloseTo(target.y, 1);
        }
      } finally { prediction.dispose(); authority.dispose(); }
    }
  );
});
