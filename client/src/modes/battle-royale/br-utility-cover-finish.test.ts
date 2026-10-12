import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BR_MAP_BLOCKS } from "@planetfall/shared";
import { buildBrUtilityCoverFinish, buildBrUtilityCoverBatches } from "./br-utility-cover-finish";

describe("collision-backed utility enclosure finishes", () => {
  it("dresses every authored cover with eight supported parts in three reused batches", () => {
    const before = JSON.stringify(BR_MAP_BLOCKS), covers = BR_MAP_BLOCKS.filter(block => block.kind === "cover");
    expect(covers.length).toBe(123);
    const batches = buildBrUtilityCoverBatches(BR_MAP_BLOCKS);
    expect(batches).toHaveLength(3);
    expect(batches.flatMap(batch => batch.parts)).toHaveLength(covers.length * 8);
    for (const block of covers) {
      const parts = buildBrUtilityCoverFinish(block);
      expect(parts.filter(part => part.role === "service-panel")).toHaveLength(2);
      expect(parts.filter(part => part.role === "vent")).toHaveLength(4);
      expect(parts.filter(part => part.role === "status-indicator")).toHaveLength(2);
      for (const part of parts) {
        expect([...Object.values(part.position), ...Object.values(part.scale)].every(Number.isFinite)).toBe(true);
        expect(part.scale.y).toBeLessThan(1);
        expect(part.rotation).toEqual(block.rotation ?? { x: 0, y: 0, z: 0 });
      }
    }
    expect(JSON.stringify(BR_MAP_BLOCKS)).toBe(before);
  });
  it("keeps panels within actual faces under full XYZ rotation with only millimetric depth bias", () => {
    const source = BR_MAP_BLOCKS.find(block => block.id === "cover-25")!;
    for (const rotation of [{ x: 0, y: 0, z: 0 }, { x: .2, y: .8, z: -.1 }]) {
      const block = { ...source, rotation };
      const inverse = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z)).invert();
      for (const part of buildBrUtilityCoverFinish(block)) {
        const p = new THREE.Vector3(part.position.x - block.position.x, part.position.y - block.position.y, part.position.z - block.position.z).applyQuaternion(inverse);
        const longX = block.size.x >= block.size.z;
        const normal = longX ? Math.abs(p.z) : Math.abs(p.x), halfDepth = (longX ? block.size.z : block.size.x) / 2;
        expect(normal - halfDepth).toBeGreaterThanOrEqual(.0009);
        expect(normal + .004 - halfDepth).toBeLessThan(.0131);
        expect(Math.abs(p.y) + part.scale.y / 2).toBeLessThan(block.size.y / 2);
        expect(Math.abs(longX ? p.x : p.z) + (longX ? part.scale.x : part.scale.z) / 2).toBeLessThan((longX ? block.size.x : block.size.z) / 2);
      }
    }
  });
  it("ignores non-cover and invalid inputs without mutation", () => {
    const block = BR_MAP_BLOCKS.find(block => block.id === "cover-25")!;
    expect(buildBrUtilityCoverFinish({ ...block, kind: "wall" })).toEqual([]);
    expect(buildBrUtilityCoverFinish({ ...block, size: { ...block.size, x: NaN } })).toEqual([]);
  });
});
