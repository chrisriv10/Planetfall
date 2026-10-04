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
      for (const block of BR_MAP_BLOCKS) {
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

  it("frames the South Terminal apron from player height on the elevated deck", () => {
    const review = BR_REVIEW_CAMERAS["south-terminal-apron"];
    expect(review).toBeDefined();
    for (const point of [review.position, review.focus]) {
      expect(point[0]).toBeGreaterThanOrEqual(-20);
      expect(point[0]).toBeLessThanOrEqual(50);
      expect(point[1]).toBeGreaterThan(3.6);
      expect(point[2]).toBeGreaterThanOrEqual(-448);
      expect(point[2]).toBeLessThanOrEqual(-382);
      for (const structure of BR_STRUCTURES.filter(candidate => candidate.districtId === "south-terminal")) {
        const inside = Math.abs(point[0] - structure.position.x) < structure.size.x / 2
          && point[1] > structure.position.y
          && point[1] < structure.position.y + structure.size.y
          && Math.abs(point[2] - structure.position.z) < structure.size.z / 2;
        expect(inside, `review point intersects ${structure.id}`).toBe(false);
      }
    }
    // The sightline begins on the apron and aims southeast across its markings
    // toward the terminal buildings rather than down at an aerial angle.
    expect(review.position[0]).toBeLessThan(review.focus[0]);
    expect(review.position[2]).toBeGreaterThan(review.focus[2]);
    expect(Math.abs(review.position[1] - review.focus[1])).toBeLessThan(2);
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

