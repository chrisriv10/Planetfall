import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BR_MAP_BLOCKS, BR_STRUCTURES } from "@planetfall/shared";
import { BR_REVIEW_CAMERAS } from "./br-review-cameras";
import { buildRoadsideInfrastructure } from "./br-roadside-infrastructure";

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

  it("frames an actual authored roadside pocket instead of the South Terminal grade", () => {
    const review = BR_REVIEW_CAMERAS["roadside-south"];
    const site = buildRoadsideInfrastructure().find(candidate => candidate.roadId === "ring-s");
    expect(site).toBeDefined();
    expect(Math.hypot(review.focus[0] - site!.center.x, review.focus[2] - site!.center.z),JSON.stringify(site!.center)).toBeLessThan(1);
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[2]).toBeGreaterThan(review.focus[2]);
  });

  it("frames the raised bridge that joins South Terminal and South Shipworks", () => {
    const review = BR_REVIEW_CAMERAS["south-transfer-bridge"];
    expect(review).toBeDefined();
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[1]).toBeLessThan(3);
    expect(review.focus[0]).toBeGreaterThan(45);
    expect(review.focus[0]).toBeLessThan(160);
    expect(review.focus[1]).toBeGreaterThan(3.5);
    expect(review.focus[2]).toBeGreaterThan(-416);
    expect(review.focus[2]).toBeLessThan(-399);
  });

  it("frames the authored west neighborhood avenue at player height", () => {
    const review=BR_REVIEW_CAMERAS["west-neighborhood-link"];
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[1]).toBeLessThan(3);
    expect(review.position[0]).toBeGreaterThan(review.focus[0]);
    expect(review.position[2]).toBeGreaterThan(review.focus[2]);
  });

  it("frames the continuous west transit avenue toward Nova", () => {
    const review=BR_REVIEW_CAMERAS["west-transit-avenue"];
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[2]).toBeLessThan(review.focus[2]);
    expect(review.focus[0]).toBeGreaterThan(-375);
    expect(review.focus[0]).toBeLessThan(-254);
  });

  it("frames the North Gardens–Mall Annex promenade from its observation edge", () => {
    const review=BR_REVIEW_CAMERAS["north-garden-promenade"];
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[2]).toBeGreaterThan(review.focus[2]);
    expect(review.focus[0]).toBeLessThan(-100);
    expect(review.focus[0]).toBeGreaterThan(-175);
  });

  it("frames the southwest salvage grade from its lower service field", () => {
    const review=BR_REVIEW_CAMERAS["southwest-salvage-grade"];
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.focus[1]).toBeGreaterThan(review.position[1]);
    expect(review.position[2]).toBeLessThan(review.focus[2]);
  });

  it("frames the Cargo Spur–Dock Service freight boulevard at player height", () => {
    const review=BR_REVIEW_CAMERAS["south-freight-boulevard"];
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[1]).toBeLessThan(3);
    expect(review.position[2]).toBeLessThan(review.focus[2]);
    expect(review.focus[0]).toBeGreaterThan(125);
    expect(review.focus[0]).toBeLessThan(255);
  });

  it("frames the southeast industrial triangle from the outer freight apron", () => {
    const review=BR_REVIEW_CAMERAS["southeast-industrial-triangle"];
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[0]).toBeGreaterThan(review.focus[0]);
    expect(review.focus[1]).toBeGreaterThan(review.position[1]);
  });

  it("frames the north observation skywalk from its rim apron", () => {
    const review=BR_REVIEW_CAMERAS["north-skywalk"];
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[2]).toBeGreaterThan(review.focus[2]);
    expect(review.focus[0]).toBeGreaterThan(-205);
    expect(review.focus[0]).toBeLessThan(-75);
  });

  it("frames the Solar Field grade from its raised rim apron", () => {
    const review=BR_REVIEW_CAMERAS["solar-rim-grade"];
    expect(review.position[1]).toBeGreaterThan(5);
    expect(review.position[2]).toBeGreaterThan(review.focus[2]);
    expect(review.focus[1]).toBeLessThan(review.position[1]);
  });

  it("frames the southern civic promenade loop above its raised deck", () => {
    const review=BR_REVIEW_CAMERAS["south-rim-loop"];
    expect(review.position[1]).toBeGreaterThan(7);
    expect(review.position[2]).toBeLessThan(review.focus[2]);
    expect(review.focus[1]).toBeGreaterThan(3.5);
  });

  it("frames the central civic junction from its southern approach", () => {
    const review=BR_REVIEW_CAMERAS["central-civic-junction"];
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[2]).toBeLessThan(review.focus[2]);
    expect(review.focus[0]).toBeGreaterThan(-46);
    expect(review.focus[0]).toBeLessThan(52);
  });

  it("frames the south-central street grid from the hotel junction", () => {
    const review=BR_REVIEW_CAMERAS["south-central-grid"];
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[2]).toBeLessThan(review.focus[2]);
    expect(Math.abs(review.focus[0]+76)).toBeLessThan(2);
  });

  it("frames the direct Zero Point–Coolant Plant avenue", () => {
    const review=BR_REVIEW_CAMERAS["zero-coolant-avenue"];
    expect(review.position[1]).toBeGreaterThan(2.5);
    expect(review.position[0]).toBeLessThan(review.focus[0]);
    expect(review.focus[2]).toBeGreaterThan(58);
    expect(review.focus[2]).toBeLessThan(153);
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

