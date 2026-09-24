import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { BR_LOOT_FLOAT, BR_LOOT_RARITY_COLORS, BrLootRarityResources } from "./br-loot-rarity";
import { BrLootLod } from "./br-loot-lod";

describe("BR loot rarity presentation", () => {
  it("uses four readable field colors without recoloring or rescaling item models", () => {
    const pool = new BrLootRarityResources();
    expect(new Set(Object.values(BR_LOOT_RARITY_COLORS)).size).toBe(4);
    for (const rarity of ["common", "rare", "epic", "legendary"] as const) {
      const material = new THREE.MeshStandardMaterial({ color: 0x19263b });
      const model = new THREE.Mesh(new THREE.BoxGeometry(), material);
      model.position.set(.1, .2, -.4); model.rotation.z = .3; model.scale.setScalar(.92);
      const original = model.matrix.clone(); model.updateMatrix(); original.copy(model.matrix);
      const visual = pool.create(model, rarity, "weapon", -.58);
      visual.update(1250, "high", 2);
      expect(visual.ring.material.color.getHex()).toBe(BR_LOOT_RARITY_COLORS[rarity]);
      expect(visual.aura.material.color.getHex()).toBe(BR_LOOT_RARITY_COLORS[rarity]);
      expect(visual.beam.material.color.getHex()).toBe(BR_LOOT_RARITY_COLORS[rarity]);
      expect(model.material).toBe(material); expect(material.color.getHex()).toBe(0x19263b);
      model.updateMatrix(); expect(model.matrix.equals(original)).toBe(true);
      expect(visual.beam.scale.y).toBeLessThanOrEqual(2);
      visual.release(); model.geometry.dispose(); material.dispose();
    }
    pool.dispose();
  });

  it("floats deterministically above a stationary support marker without root drift", () => {
    const pool = new BrLootRarityResources();
    const a = pool.create(new THREE.Group(), "rare", "same-id", -.58);
    const b = pool.create(new THREE.Group(), "rare", "same-id", -.58);
    const other = pool.create(new THREE.Group(), "rare", "other-id", -.58);
    a.position.set(24, 9.58, -18);
    const position = a.position.clone(), ringY = a.ring.position.y, beamY = a.beam.position.y;
    let minimum = Infinity, maximum = -Infinity;
    for (let now = 0; now < 10000; now += 16) {
      a.update(now, "high", 3); b.update(now, "high", 3); other.update(now, "high", 3);
      expect(a.itemPivot.position.y).toBe(b.itemPivot.position.y);
      expect(a.itemPivot.rotation.y).toBe(b.itemPivot.rotation.y);
      minimum = Math.min(minimum, a.itemPivot.position.y); maximum = Math.max(maximum, a.itemPivot.position.y);
      expect(a.position.equals(position)).toBe(true);
      expect(a.ring.position.y).toBe(ringY); expect(a.beam.position.y).toBe(beamY);
      a.traverse(object => expect([...object.position, ...object.scale, object.rotation.y].every(Number.isFinite)).toBe(true));
    }
    expect(minimum).toBeGreaterThanOrEqual(BR_LOOT_FLOAT.lift - BR_LOOT_FLOAT.amplitude);
    expect(maximum).toBeLessThanOrEqual(BR_LOOT_FLOAT.lift + BR_LOOT_FLOAT.amplitude);
    expect(maximum - minimum).toBeGreaterThan(.23);
    expect(a.itemPivot.rotation.y).not.toBe(other.itemPivot.rotation.y);
    expect(a.ring.position.y + a.position.y).toBeCloseTo(9.024); // Roof support, not world ground.
    pool.dispose();
  });

  it("shares exactly three geometries and twelve materials across many drops", () => {
    const pool = new BrLootRarityResources(), geometries = new Set(), materials = new Set();
    for (let index = 0; index < 160; index++) {
      const rarity = (["common", "rare", "epic", "legendary"] as const)[index % 4];
      const visual = pool.create(new THREE.Group(), rarity, `${index}`, -.58);
      let meshes = 0, lights = 0;
      visual.traverse(object => {
        if (object instanceof THREE.Mesh) { meshes++; geometries.add(object.geometry); materials.add(object.material); }
        if (object instanceof THREE.Light) lights++;
      });
      expect(meshes).toBe(3); expect(lights).toBe(0);
      const children = [...visual.children], ringMaterial = visual.ring.material;
      visual.update(1000, "high", 1); visual.update(2000, "low", 1);
      expect(visual.children).toEqual(children); expect(visual.ring.material).toBe(ringMaterial);
      expect(ringMaterial.opacity).toBe(.76);
    }
    expect(geometries.size).toBe(3); expect(materials.size).toBe(12);
    pool.dispose();
  });

  it("keeps the base ring on low, removes expensive distant layers, and respects detail LOD", () => {
    const pool = new BrLootRarityResources();
    const visual = pool.create(new THREE.Group(), "epic", "quality", -.58);
    const lod = new BrLootLod(visual, BR_LOOT_RARITY_COLORS.epic);
    for (const mesh of [visual.ring, visual.aura, visual.beam]) {
      expect(mesh.material.depthTest).toBe(true); expect(mesh.material.depthWrite).toBe(false);
      expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(false);
    }
    for (const quality of ["low", "medium", "high"] as const) {
      lod.updateDetail(new THREE.Vector3(2, 0, 0), quality); visual.update(500, quality, 2);
      expect(visual.ring.visible).toBe(true);
      expect(visual.beam.visible).toBe(quality !== "low"); expect(visual.aura.visible).toBe(quality !== "low");
      lod.updateDetail(new THREE.Vector3(150, 0, 0), quality); visual.update(500, quality, 150);
      expect(lod.detail.visible).toBe(false); expect(lod.marker.visible).toBe(true);
      expect(visual.beam.visible).toBe(false); expect(visual.aura.visible).toBe(false);
    }
    pool.dispose(); lod.marker.geometry.dispose(); (lod.marker.material as THREE.Material).dispose();
  });

  it("detaches pooled effects before generic cleanup and disposes each resource just once", () => {
    const pool = new BrLootRarityResources(), model = new THREE.Group();
    const a = pool.create(model, "rare", "a", -.58), b = pool.create(new THREE.Group(), "rare", "b", -.58);
    const geometryDisposals = [a.ring, a.aura, a.beam].map(mesh => vi.spyOn(mesh.geometry, "dispose"));
    const materialDisposals = [a.ring, a.aura, a.beam].map(mesh => vi.spyOn(mesh.material, "dispose"));
    a.release(); a.release();
    expect(a.children).toEqual([a.itemPivot]); expect(model.parent).toBe(a.itemPivot);
    expect(b.ring.parent).toBe(b);
    for (const spy of [...geometryDisposals, ...materialDisposals]) expect(spy).not.toHaveBeenCalled();
    pool.dispose(); pool.dispose();
    expect(b.children).toEqual([b.itemPivot]);
    for (const spy of [...geometryDisposals, ...materialDisposals]) expect(spy).toHaveBeenCalledTimes(1);
    expect(() => pool.create(new THREE.Group(), "rare", "c", -.58)).toThrow("disposed");
  });

  it("rejects invalid surface offsets and ignores invalid animation times", () => {
    const pool = new BrLootRarityResources();
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => pool.create(new THREE.Group(), "common", "bad", value)).toThrow("finite");
    }
    const visual = pool.create(new THREE.Group(), "common", "finite", -.58);
    const y = visual.itemPivot.position.y;
    visual.update(NaN, "high", 1); expect(visual.itemPivot.position.y).toBe(y);
    for (const distance of [NaN, Infinity, -1]) {
      visual.update(10, "high", distance); expect(visual.beam.visible).toBe(false); expect(visual.aura.visible).toBe(false);
    }
    const top = visual.beam.geometry.getAttribute("position"), colors = visual.beam.geometry.getAttribute("color");
    for (let i = 0; i < top.count; i++) if (top.getY(i) === .5) expect(colors.getX(i)).toBe(0);
    pool.dispose();
  });
});
