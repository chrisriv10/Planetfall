import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BR_WEAPONS, BR_HEALS, type BrWeaponId, type BrHealId } from "@planetfall/shared";
import { buildBrWeaponModel } from "./br-weapons";
import { BrHealModelLibrary } from "./br-heal-models";
import { brLootModelSupportLift, brLootWeaponTransform } from "./br-item-presentation";
import { BrLootRarityResources } from "./br-loot-rarity";
import { BrLootLod } from "./br-loot-lod";

describe("actual loot geometry support through animation and LOD", () => {
  it("keeps every actual weapon/heal model above base, deck and roof throughout bob/spin", () => {
    const heals = new BrHealModelLibrary(), pool = new BrLootRarityResources();
    const models: [string, THREE.Group][] = [];
    for (const id of Object.keys(BR_WEAPONS) as BrWeaponId[]) {
      const model = new THREE.Group(); buildBrWeaponModel(model, id, 0xffffff);
      const t = brLootWeaponTransform(id); model.position.set(...t.position); model.rotation.set(...t.rotation); model.scale.setScalar(t.scale);
      models.push([id, model]);
    }
    for (const id of Object.keys(BR_HEALS) as BrHealId[]) models.push([id, heals.create(id)]);
    for (const ammo of ["light", "heavy", "energy"]) {
      const model = new THREE.Group();
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .58, 8)); cell.rotation.z = Math.PI / 2; model.add(cell);
      for (const side of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .08, 8)); cap.rotation.z = Math.PI / 2; cap.position.x = side * .32; model.add(cap);
      }
      models.push([ammo, model]);
    }
    for (const [id, model] of models) {
      const lift = brLootModelSupportLift(model);
      const visual = pool.create(model, "rare", id, -.555, lift);
      for (const ground of [0, 5, 22]) {
        visual.position.y = ground + .58;
        for (let time = 0; time <= 12566; time += 101) {
          visual.update(time, "high", 3);
          visual.updateWorldMatrix(true, true);
          expect(new THREE.Box3().setFromObject(model).min.y, `${id} at ${time}`).toBeGreaterThanOrEqual(ground + .025);
        }
      }
    }
    pool.dispose(); heals.dispose();
  });

  it("reserves bob amplitude for a transformed model deeper than the nominal hover lift", () => {
    const pool = new BrLootRarityResources(), model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(.4, 1.4, .4))); model.rotation.z = .3;
    const visual = pool.create(model, "common", "deep-geometry", -.555, brLootModelSupportLift(model));
    visual.position.y = .58;
    for (let time = 0; time < 6284; time += 31) {
      visual.update(time, "low", 2); visual.updateWorldMatrix(true, true);
      expect(new THREE.Box3().setFromObject(model).min.y).toBeGreaterThanOrEqual(.095 - 1e-8);
    }
    pool.dispose();
  });

  it("keeps every scaled category marker above its exact support across quality transitions", () => {
    const pool = new BrLootRarityResources();
    for (const category of ["weapon", "ammo", "health", "shield", "unknown"] as const) {
      const visual = pool.create(new THREE.Group(), "rare", category, -.555);
      const lod = new BrLootLod(visual, 0xffffff, category); lod.position.set(0, 10.58, 0);
      for (const quality of ["high", "medium", "low"] as const) for (const distance of [3, 55, 90, 150, 300]) {
        lod.updateDetail(new THREE.Vector3(distance, 10.58, 0), quality);
        expect(new THREE.Box3().setFromObject(lod.marker).min.y, `${category}/${quality}/${distance}`).toBeGreaterThanOrEqual(10.025);
        expect(lod.position.y).toBe(10.58);
      }
      lod.marker.geometry.dispose(); (lod.marker.material as THREE.Material).dispose();
    }
    pool.dispose();
  });
});
