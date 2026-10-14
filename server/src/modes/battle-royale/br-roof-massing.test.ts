import { describe, expect, it } from "vitest";
import { BR_MAP_BLOCKS, BR_STRUCTURES, brFloorHeightAt, buildBrRoofMassing } from "@planetfall/shared";
import { BrPhysicsWorld } from "./br-physics.js";
import { BrPredictionPhysics } from "../../../../client/src/modes/battle-royale/br-physics";

describe("solid rooftop presentation agreement", () => {
  it("lands on Nova's visible tier and blocks camera rays through its side", () => {
    const authority = new BrPhysicsWorld(), prediction = new BrPredictionPhysics();
    try {
      const origin = { x: -155, y: 34.7, z: -177.458448 };
      expect(authority.rayDistance(origin, { x: 1, y: 0, z: 0 }, 15)).toBeCloseTo(5.5, 3);
      expect(prediction.cameraDistance(origin, { x: 1, y: 0, z: 0 }, 15)).toBeCloseTo(5.5, 3);
      let serverFeet = { x: -148.377535, y: 45, z: -177.458448 }, clientFeet = { ...serverFeet };
      for (let frame = 0; frame < 160; frame++) {
        const server = authority.move("roof-landing", serverFeet, { x: 0, y: -.15, z: 0 }, false);
        const client = prediction.move(clientFeet, { x: 0, y: -.15, z: 0 }, false);
        serverFeet.y += server.movement.y; clientFeet.y += client.movement.y;
        expect(clientFeet.y).toBeCloseTo(serverFeet.y, 3);
      }
      expect(serverFeet.y).toBeCloseTo(36.085, 2);
      expect(prediction.supportDistance(clientFeet)).toBeCloseTo(.055, 2);
      expect(brFloorHeightAt(serverFeet, 45)).toBeCloseTo(36.05, 3);
    } finally { authority.dispose(); prediction.dispose(); }
  });

  it("registers each visible apartment, hotel and tower roof volume once", () => {
    for (const structure of BR_STRUCTURES) {
      const parts = buildBrRoofMassing(structure);
      for (const part of parts) {
        const matches = BR_MAP_BLOCKS.filter(block => block.id === part.id);
        expect(matches, part.id).toHaveLength(1);
        expect(matches[0].position).toEqual(part.position);
        expect(matches[0].size).toEqual(part.size);
      }
    }
    for (const id of ["astra-observatory", "crash-fuselage", "thruster-foundry", "zero-spire"]) {
      expect(buildBrRoofMassing(BR_STRUCTURES.find(s => s.id === id)!), id).toEqual([]);
    }
  });
});
