import { describe, expect, it } from "vitest";
import { BR_ROADS, BR_STRUCTURES } from "@planetfall/shared";
import { BR_CORRIDOR_GROVE_MAX, BR_CORRIDOR_TREES_PER_GROVE, buildBrCorridorGroves } from "./br-corridor-groves";

describe("BR corridor groves", () => {
  it("is deterministic, bounded, and keeps trunks out of roads and buildings", () => {
    const first = buildBrCorridorGroves();
    expect(buildBrCorridorGroves()).toEqual(first);
    const trunks = first.filter(part => part.geometry === "cylinder");
    expect(trunks.length).toBeGreaterThanOrEqual(16);
    expect(trunks.length).toBeLessThanOrEqual(BR_CORRIDOR_GROVE_MAX * BR_CORRIDOR_TREES_PER_GROVE);
    for (const trunk of trunks) {
      expect(BR_STRUCTURES.every(structure => Math.abs(trunk.position.x - structure.position.x) > structure.size.x / 2
        || Math.abs(trunk.position.z - structure.position.z) > structure.size.z / 2)).toBe(true);
      expect(BR_ROADS.every(road => {
        const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, squared = dx * dx + dz * dz;
        const t = squared ? Math.max(0, Math.min(1, ((trunk.position.x - road.from.x) * dx + (trunk.position.z - road.from.z) * dz) / squared)) : 0;
        return Math.hypot(trunk.position.x - road.from.x - dx * t, trunk.position.z - road.from.z - dz * t) > road.width / 2 + 4;
      })).toBe(true);
    }
  });
});
