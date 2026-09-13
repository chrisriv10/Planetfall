import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BrLootLod } from "./br-loot-lod";

describe("BR loot presentation budget", () => {
  const make = () => {
    const detail = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1), material = new THREE.MeshBasicMaterial();
    for (let i = 0; i < 18; i++) detail.add(new THREE.Mesh(geometry, material));
    const beam = new THREE.Group(); beam.name = "loot-beam"; detail.add(beam);
    return new BrLootLod(detail, 0x54b8ff);
  };
  const meshCount = (root: THREE.Object3D) => {
    let count = 0; root.traverseVisible(object => { if (object instanceof THREE.Mesh) count++; }); return count;
  };
  it("reduces a distant multi-part weapon to one visible, depth-tested marker", () => {
    const loot = make();
    loot.updateDetail(new THREE.Vector3(0, 0, 20), "high");
    expect(meshCount(loot)).toBe(18);
    loot.updateDetail(new THREE.Vector3(0, 0, 150), "high");
    expect(meshCount(loot)).toBe(1);
    expect(loot.marker.material).toHaveProperty("depthTest", true);
    expect(loot.visible).toBe(true);
  });
  it("uses hysteresis and restores the real item at every quality's interaction range", () => {
    for (const quality of ["high", "medium", "low"] as const) {
      const loot = make(), range = quality === "high" ? 80 : quality === "medium" ? 60 : 40;
      loot.updateDetail(new THREE.Vector3(range + 4, 0, 0), quality);
      expect(loot.detail.visible).toBe(true);
      loot.updateDetail(new THREE.Vector3(range + 11, 0, 0), quality);
      expect(loot.detail.visible).toBe(false);
      loot.updateDetail(new THREE.Vector3(range + 4, 0, 0), quality);
      expect(loot.detail.visible).toBe(false);
      loot.updateDetail(new THREE.Vector3(3, 0, 0), quality);
      expect(loot.detail.visible).toBe(true);
      expect(loot.marker.visible).toBe(false);
    }
  });
  it("evaluates distance from the loot world position without moving it", () => {
    const loot = make(); loot.position.set(400, 8, -200);
    const original = loot.position.clone();
    loot.updateDetail(new THREE.Vector3(401, 10, -201), "low");
    expect(loot.detail.visible).toBe(true);
    expect(loot.position.equals(original)).toBe(true);
  });
});
