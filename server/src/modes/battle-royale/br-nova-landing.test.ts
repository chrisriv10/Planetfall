import { describe, expect, it } from "vitest";
import { BR_BALANCE, BR_MAP_BLOCKS } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics.js";

describe("Nova upper street, continuous descent and ground entrances", () => {
  it("measures actual collider support across the office threshold grade",()=>{
    const authority=new BrPhysicsWorld();
    try{
      for(let step=0;step<=20;step++){
        const t=step/20,feet={x:-198,y:.36*t+.035,z:-17.5-1.5*t};
        expect(authority.rayDistance(feet,{x:0,y:-1,z:0},1),JSON.stringify(feet)).toBeCloseTo(.035,3);
      }
    }finally{authority.dispose();}
  });
  const paths = [
    { label: "upper street through both descent seams to ground", points: [{ x: -175, y: 5.035, z: -70 }, { x: -175, y: 4.771842105263158, z: -48 }, { x: -175, y: .035, z: -12 }, { x: -175, y: .035, z: 8 }] },
    { label: "west office court", points: [{ x: -175, y: .035, z: -12 }, { x: -198, y: .035, z: -12 }] },
    { label: "east service court", points: [{ x: -175, y: .035, z: -12 }, { x: -151, y: .035, z: -12 }] },
    { label: "shop doorway", floor: "nova-landing-shop-floor", axis: "x", points: [{ x: -175, y: .035, z: 3 }, { x: -195, y: .395, z: 3 }] },
    { label: "office doorway", floor: "nova-landing-office-floor", axis: "z", points: [{ x: -198, y: .035, z: -12 }, { x: -198, y: .395, z: -23 }] },
    { label: "service doorway", floor: "nova-landing-service-floor", axis: "z", points: [{ x: -151, y: .035, z: -12 }, { x: -151, y: .395, z: -23 }] },
  ] as const;
  it.each(paths.flatMap(path => [false, true].map(reverse => ({ ...path, reverse }))))(
    "walks $label with support and prediction parity (reverse=$reverse)", ({ label, points, reverse, ...entry }) => {
      const authority = new BrPhysicsWorld(), prediction = new BrPredictionPhysics();
      const path = reverse ? points.slice().reverse() : points;
      const floor = "floor" in entry ? BR_MAP_BLOCKS.find(b => b.id === entry.floor)! : null;
      let feet = { ...path[0] }, predicted = { ...feet };
      try {
        for (const target of path.slice(1)) {
          for (let frame = 0; frame < 1800 && Math.hypot(target.x - feet.x, target.z - feet.z) > .005; frame++) {
            const dx = target.x - feet.x, dz = target.z - feet.z, distance = Math.hypot(dx, dz), step = Math.min(.12, distance);
            const desired = { x: dx / distance * step, y: -.12, z: dz / distance * step };
            const actual = authority.move(label, feet, desired, false), anticipated = prediction.move(predicted, desired, false);
            feet = { x: feet.x + actual.movement.x, y: feet.y + actual.movement.y, z: feet.z + actual.movement.z };
            predicted = { x: predicted.x + anticipated.movement.x, y: predicted.y + anticipated.movement.y, z: predicted.z + anticipated.movement.z };
            expect(actual.grounded, JSON.stringify(feet)).toBe(true); expect(anticipated.grounded).toBe(true);
            const axis = "axis" in entry ? entry.axis : "x";
            const edge = floor ? Math.abs(Math.abs(feet[axis] - floor.position[axis]) - floor.size[axis] / 2) : Infinity;
            // Only the narrow .36m doorway lip uses controller autostep.
            // Every road/grade frame and the rest of each doorway path must
            // retain measured contact, not just a grounded flag.
            if (edge > .6) expect(authority.rayDistance(feet, { x: 0, y: -1, z: 0 }, 1), JSON.stringify(feet)).toBeLessThan(.08);
            else {
              expect(feet.y, JSON.stringify(feet)).toBeGreaterThanOrEqual(0); expect(feet.y).toBeLessThanOrEqual(.44);
              // At the lip the capsule can contact the floor ahead of its
              // center. Measure within its real footprint as well.
              if (label === "office doorway") expect(Math.min(...[-BR_BALANCE.playerRadius, 0, BR_BALANCE.playerRadius].map(offset =>
                authority.rayDistance({ ...feet, [axis]: feet[axis] + offset }, { x: 0, y: -1, z: 0 }, 1))), JSON.stringify(feet)).toBeLessThan(.08);
            }
            if (!floor) expect(authority.rayDistance({ ...feet, y: feet.y + .1 }, { x: 0, y: 1, z: 0 }, BR_BALANCE.playerHeight), JSON.stringify(feet)).toBe(BR_BALANCE.playerHeight);
            expect(predicted.x).toBeCloseTo(feet.x, 5); expect(predicted.y).toBeCloseTo(feet.y, 5); expect(predicted.z).toBeCloseTo(feet.z, 5);
          }
          expect(Math.hypot(target.x - feet.x, target.z - feet.z)).toBeLessThan(.005);
          expect(feet.y).toBeCloseTo(target.y, 1);
        }
      } finally { prediction.dispose(); authority.dispose(); }
    },
  );
});
