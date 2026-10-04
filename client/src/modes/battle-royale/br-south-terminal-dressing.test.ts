import { describe, expect, it } from "vitest";
import { BR_ROADS, BR_STRUCTURES } from "@planetfall/shared";
import { buildBrSouthTerminalDressing } from "./br-south-terminal-dressing";

const distanceToSegment = (point: { x: number; z: number }, from: { x: number; z: number }, to: { x: number; z: number }) => {
  const dx = to.x - from.x, dz = to.z - from.z, squared = dx * dx + dz * dz;
  const t = squared ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / squared)) : 0;
  return Math.hypot(point.x - from.x - dx * t, point.z - from.z - dz * t);
};

describe("South Terminal presentation pocket", () => {
  it("is deterministic, finite, bounded and quality-gating friendly", () => {
    const first = buildBrSouthTerminalDressing(), second = buildBrSouthTerminalDressing();
    expect(first).toEqual(second);
    expect(first.parts).toHaveLength(42);
    expect(new Set(first.parts.map(part => part.name)).size).toBe(42);
    expect(first.parts.some(part => part.detail === "enhanced")).toBe(true);
    expect(first.parts.filter(part => part.detail === "essential").length).toBeGreaterThan(18);
    for (const part of first.parts) {
      expect([...Object.values(part.position), ...Object.values(part.scale), part.rotationY].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value => value > 0)).toBe(true);
      expect(part.position.x - part.scale.x / 2).toBeGreaterThanOrEqual(-18.51);
      expect(part.position.x + part.scale.x / 2).toBeLessThanOrEqual(25.01);
      expect(part.position.z - part.scale.z / 2).toBeGreaterThanOrEqual(-445.61);
      expect(part.position.z + part.scale.z / 2).toBeLessThanOrEqual(-385.3);
    }
  });

  it("uses only flush surface graphics for the expanded hardstand composition", () => {
    const expanded = buildBrSouthTerminalDressing().parts.filter(part =>
      part.name.startsWith("apron-") || part.name.startsWith("holding-") || part.name.startsWith("terminal-code-"));
    expect(expanded).toHaveLength(18);
    expect(expanded.every(part => part.surface)).toBe(true);
    expect(expanded.every(part => part.position.y + part.scale.y / 2 <= 3.64)).toBe(true);
    expect(expanded.every(part => part.position.x - part.scale.x / 2 >= -17.1
      && part.position.x + part.scale.x / 2 <= 8.1
      && part.position.z - part.scale.z / 2 >= -407.7
      && part.position.z + part.scale.z / 2 <= -385.3)).toBe(true);
    const roads = BR_ROADS.filter(road => road.id.startsWith("south-terminal-") || road.id === "service-9-deck");
    const structures = BR_STRUCTURES.filter(structure => structure.districtId === "south-terminal");
    for (const part of expanded) {
      const minX = part.position.x - part.scale.x / 2, maxX = part.position.x + part.scale.x / 2;
      const minZ = part.position.z - part.scale.z / 2, maxZ = part.position.z + part.scale.z / 2;
      for (const road of roads) {
        const roadMinX = Math.min(road.from.x, road.to.x) - road.width / 2;
        const roadMaxX = Math.max(road.from.x, road.to.x) + road.width / 2;
        const roadMinZ = Math.min(road.from.z, road.to.z) - road.width / 2;
        const roadMaxZ = Math.max(road.from.z, road.to.z) + road.width / 2;
        expect(maxX > roadMinX && minX < roadMaxX && maxZ > roadMinZ && minZ < roadMaxZ,
          `${part.name} / ${road.id}`).toBe(false);
      }
      for (const structure of structures) expect(
        maxX > structure.position.x - structure.size.x / 2
          && minX < structure.position.x + structure.size.x / 2
          && maxZ > structure.position.z - structure.size.z / 2
          && minZ < structure.position.z + structure.size.z / 2,
        `${part.name} / ${structure.id}`
      ).toBe(false);
    }
  });

  it("keeps every raised element clear of terminal roads and every surface element flush", () => {
    const roads = BR_ROADS.filter(road => road.id.startsWith("south-terminal-") || road.id === "service-9-deck");
    expect(roads).toHaveLength(3);
    for (const part of buildBrSouthTerminalDressing().parts) {
      if (part.surface) {
        expect(part.position.y + part.scale.y / 2, part.name).toBeLessThanOrEqual(3.64);
        continue;
      }
      const radius = Math.hypot(part.scale.x, part.scale.z) / 2;
      for (const road of roads) expect(distanceToSegment(part.position, road.from, road.to) - radius,
        `${part.name} / ${road.id}`).toBeGreaterThanOrEqual(road.width / 2 + .35);
    }
  });

  it("uses only slender open fixtures or real wall-mounted schedule panels", () => {
    const terminal = BR_STRUCTURES.find(structure => structure.id === "south-terminal-1")!;
    expect(terminal).toBeDefined();
    for (const part of buildBrSouthTerminalDressing().parts.filter(part => !part.surface)) {
      const wallMounted = part.name.startsWith("terminal-");
      if (wallMounted) {
        const westFace = terminal.position.x - terminal.size.x / 2;
        expect(Math.abs(part.position.x - westFace)).toBeLessThanOrEqual(.14);
        expect(part.scale.x).toBeLessThanOrEqual(.12);
        expect(Math.abs(part.position.z - terminal.position.z) - part.scale.z / 2,
          `${part.name} entrance`).toBeGreaterThanOrEqual(3);
      } else if (part.name === "directory-header" || part.name === "directory-lens") {
        expect(part.position.y - part.scale.y / 2).toBeGreaterThanOrEqual(6.45);
      } else {
        expect(part.scale.x).toBeLessThanOrEqual(.2);
        expect(part.scale.z).toBeLessThanOrEqual(.2);
      }
    }
  });

  it("returns fresh transforms so renderer-side LOD filtering cannot mutate the plan", () => {
    const first = buildBrSouthTerminalDressing();
    first.parts[0].position.z = 0;
    first.parts[0].scale.z = 100;
    const second = buildBrSouthTerminalDressing();
    expect(second.parts[0].position.z).toBe(-385.5);
    expect(second.parts[0].scale.z).toBe(.18);
  });
});
