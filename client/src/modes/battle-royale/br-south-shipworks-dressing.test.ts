import { describe, expect, it } from "vitest";
import { BR_ROADS, BR_STRUCTURES } from "@planetfall/shared";
import { buildBrSouthShipworksDressing } from "./br-south-shipworks-dressing";

const roadCenterX = 190;
const doorHalfWidth = 3;

describe("South Shipworks maintenance-route dressing", () => {
  it("is deterministic, finite and deliberately bounded", () => {
    const first = buildBrSouthShipworksDressing(), second = buildBrSouthShipworksDressing();
    expect(first).toEqual(second);
    expect(first.parts).toHaveLength(30);
    expect(new Set(first.parts.map(part => part.name)).size).toBe(first.parts.length);
    for (const part of first.parts) {
      expect([...Object.values(part.position), ...Object.values(part.scale), part.rotationY].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value => value > 0)).toBe(true);
      expect(part.position.x - part.scale.x / 2).toBeGreaterThanOrEqual(178.9);
      expect(part.position.x + part.scale.x / 2).toBeLessThanOrEqual(202.1);
      expect(part.position.z - part.scale.z / 2).toBeGreaterThanOrEqual(-425.7);
      expect(part.position.z + part.scale.z / 2).toBeLessThanOrEqual(-375.3);
    }
  });

  it("keeps the full road centre and east-west junction clear", () => {
    const roads = BR_ROADS.filter(road => road.id === "service-24-deck" || road.id === "south-shipworks-cross");
    expect(roads).toHaveLength(2);
    for (const part of buildBrSouthShipworksDressing().parts) {
      const raised = !part.surface;
      if (raised) {
        const nearestX = Math.max(0, Math.abs(part.position.x - roadCenterX) - part.scale.x / 2);
        expect(nearestX, part.name).toBeGreaterThanOrEqual(9);
      } else {
        // Flush paint is confined to the two outer lane edges, never the
        // 8.8m-wide central travel corridor or the crossing road at z=-400.
        const nearestX = Math.max(0, Math.abs(part.position.x - roadCenterX) - part.scale.x / 2);
        expect(nearestX, part.name).toBeGreaterThanOrEqual(4.49);
        expect(Math.abs(part.position.z + 400) - part.scale.z / 2, part.name).toBeGreaterThanOrEqual(4.5);
        expect(part.position.y + part.scale.y / 2).toBeLessThan(.04 + 4.1);
      }
    }
  });

  it("mounts every raised piece shallowly on actual walls and outside entrance gaps", () => {
    const structures = BR_STRUCTURES.filter(structure => structure.districtId === "south-shipworks");
    expect(structures).toHaveLength(3);
    for (const part of buildBrSouthShipworksDressing().parts.filter(part => !part.surface)) {
      const support = structures.find(structure => {
        const west = structure.entrance === "west", wallX = structure.position.x + (west ? -1 : 1) * structure.size.x / 2;
        const insideZ = Math.abs(part.position.z - structure.position.z) + part.scale.z / 2 <= structure.size.z / 2;
        return Math.abs(part.position.x - wallX) <= .18 && insideZ;
      });
      expect(support, `${part.name} wall support`).toBeDefined();
      expect(part.scale.x, `${part.name} wall depth`).toBeLessThanOrEqual(.12);
      expect(Math.abs(part.position.z - support!.position.z) - part.scale.z / 2,
        `${part.name} entrance clearance`).toBeGreaterThanOrEqual(doorHalfWidth);
      expect(part.position.y - part.scale.y / 2).toBeGreaterThan(support!.position.y + .9);
      expect(part.position.y + part.scale.y / 2).toBeLessThan(support!.position.y + support!.size.y);
    }
  });

  it("returns fresh caller-owned transforms", () => {
    const first = buildBrSouthShipworksDressing();
    first.parts[0].position.x = 0;
    first.parts[0].scale.x = 100;
    const second = buildBrSouthShipworksDressing();
    expect(second.parts[0].position.x).toBe(185.15);
    expect(second.parts[0].scale.x).toBe(.16);
  });
});
