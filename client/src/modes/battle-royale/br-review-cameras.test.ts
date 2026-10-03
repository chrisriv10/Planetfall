import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BR_MAP_BLOCKS, BR_STRUCTURES } from "@planetfall/shared";
import { BR_REVIEW_CAMERAS } from "./br-review-cameras";

describe("Battle Royale art-review cameras", () => {
  it("stay finite, directed, and outside authoritative solid colliders", () => {
    expect(Object.keys(BR_REVIEW_CAMERAS).length).toBeGreaterThan(30);
    for (const [id, review] of Object.entries(BR_REVIEW_CAMERAS)) {
      expect([...review.position, ...review.focus].every(Number.isFinite), id).toBe(true);
      expect(Math.hypot(
        review.focus[0] - review.position[0],
        review.focus[1] - review.position[1],
        review.focus[2] - review.position[2]
      ), id).toBeGreaterThan(2);
      const point = new THREE.Vector3(...review.position);
      for (const block of BR_MAP_BLOCKS.filter(candidate => candidate.kind !== "platform" && candidate.kind !== "bridge")) {
        const local = point.clone().sub(new THREE.Vector3(block.position.x, block.position.y, block.position.z));
        if (block.rotation) local.applyQuaternion(new THREE.Quaternion().setFromEuler(
          new THREE.Euler(block.rotation.x, block.rotation.y, block.rotation.z, "XYZ")
        ).invert());
        const inside = Math.abs(local.x) < block.size.x / 2 - .03
          && Math.abs(local.y) < block.size.y / 2 - .03
          && Math.abs(local.z) < block.size.z / 2 - .03;
        expect(inside, `${id} camera intersects ${block.id}`).toBe(false);
      }
    }
  });

  it("retains aliases for previously shared review links", () => {
    expect(BR_REVIEW_CAMERAS["hotel-lobby"]).toEqual(BR_REVIEW_CAMERAS["hotel-lounge"]);
  });

  it("keeps named interior cameras inside the intended authored structure", () => {
    for (const [view, structureId] of [["housing-lounge", "central-heights-1"], ["hotel-lounge", "comet-hotel-1"]] as const) {
      const structure = BR_STRUCTURES.find(candidate => candidate.id === structureId)!;
      const [x, y, z] = BR_REVIEW_CAMERAS[view].position;
      expect(Math.abs(x - structure.position.x), view).toBeLessThan(structure.size.x / 2);
      expect(Math.abs(z - structure.position.z), view).toBeLessThan(structure.size.z / 2);
      expect(y, view).toBeGreaterThan(structure.position.y);
      expect(y, view).toBeLessThan(structure.position.y + structure.size.y);
    }
  });
});

