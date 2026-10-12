import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SHOP_CATALOG } from "@planetfall/shared";
import { createCosmeticPreviewScene, shopCosmeticPreviewPlan } from "./shop-cosmetic-preview";
import { createAstronautVisual } from "./astronaut";
import { createCosmeticFlightTrail, updateCosmeticFlightTrail } from "./cosmetic-flight-trail";

function resourceSpies(root: THREE.Object3D) {
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  root.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.geometry) resources.add(mesh.geometry); if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => resources.add(material)); });
  return [...resources].map(resource => vi.spyOn(resource, "dispose"));
}

describe("canonical cosmetic previews", () => {
  it("keeps outer category names distinct from the canvas and validates colors/IDs", () => {
    for (const item of SHOP_CATALOG) {
      const plan = shopCosmeticPreviewPlan(item);
      expect(plan.kind).toBe(item.category);
      expect(plan.className).toContain(`cosmetic-kind-${item.category}`);
      expect(plan.markup).toBe('<canvas class="cosmetic-preview-image" aria-hidden="true"></canvas>');
      expect(plan.markup).not.toContain(`cosmetic-kind-${item.category}`);
    }
    const plan = shopCosmeticPreviewPlan({ ...SHOP_CATALOG[0], id: 'bad" onclick="bad', color: "red; background:url(bad)" });
    expect(plan.className).not.toContain("onclick"); expect(plan.color).toBe("#70f5ff");
  });
  it("uses canonical astronaut geometry and the equipped suit material", () => {
    const canonical = createAstronautVisual({ identityColor: "#70f5ff", suitAccent: "#ffd84d", isBot: false });
    const visual = createCosmeticPreviewScene(SHOP_CATALOG[0]);
    expect(visual.astronaut!.group.children.map(child => child.type)).toEqual(canonical.group.children.map(child => child.type));
    expect(visual.astronaut!.suitMaterial.color.getHexString()).toBe("ffd84d");
    expect(visual.astronaut!.helmet.children.length).toBe(canonical.helmet.children.length);
    const seen = new Set<THREE.BufferGeometry | THREE.Material>();
    canonical.group.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.geometry) seen.add(mesh.geometry); if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => seen.add(material)); });
    seen.forEach(resource => resource.dispose()); visual.dispose();
  });
  it("shows the curved canonical Verity face instead of a flat smile icon", () => {
    const visual = createCosmeticPreviewScene(SHOP_CATALOG.find(item => item.id === "verity")!);
    expect(visual.planet!.shell.geometry.parameters.widthSegments).toBe(64);
    expect(visual.planet!.face.name).toBe("verity-happy-face");
    const ink = visual.planet!.face.geometry.getAttribute("position");
    expect(ink.count).toBeGreaterThan(100);
    expect(Math.abs(ink.getZ(0) - ink.getZ(100))).toBeGreaterThan(.001);
    for(const time of [0,10000,100000,1000000]){
      visual.update(time);visual.root.updateMatrixWorld(true);
      const normal=new THREE.Vector3(0,0,1).transformDirection(visual.planet!.group.matrixWorld);
      const towardCamera=visual.camera.position.clone().normalize();
      expect(normal.dot(towardCamera)).toBeGreaterThan(.8);
    }
    visual.dispose();
  });
  it("frames every animated cosmetic fully at Shop and narrow Pass aspect ratios", () => {
    for (const item of SHOP_CATALOG) {
      const visual = createCosmeticPreviewScene(item);
      for (const aspect of [.6, 1, 1.8]) for (const time of [0, 850, 1900, 3400]) {
        visual.update(time, aspect); visual.scene.updateMatrixWorld(true); visual.camera.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(visual.root);
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const projected = new THREE.Vector3(x, y, z).project(visual.camera);
          expect(Math.abs(projected.x), `${item.id} x at ${aspect}`).toBeLessThan(1);
          expect(Math.abs(projected.y), `${item.id} y at ${aspect}`).toBeLessThan(1);
        }
      }
      visual.dispose();
    }
  });
  it("uses actual production colored line trails with bounded storage", () => {
    for (const item of SHOP_CATALOG.filter(item => item.category === "trail")) {
      const visual = createCosmeticPreviewScene(item);
      expect(visual.trail!.material.opacity).toBe(.72);
      expect(visual.trail!.material.color.getHexString()).toBe(item.color!.slice(1));
      expect(visual.trail!.geometry.drawRange.count).toBe(12);
      visual.dispose();
    }
    const line = createCosmeticFlightTrail("#ffd84d");
    updateCosmeticFlightTrail(line, Array.from({ length: 30 }, (_, i) => new THREE.Vector3(i, i / 2, 0)));
    expect(line.geometry.drawRange.count).toBe(12); expect(line.geometry.getAttribute("position").count).toBe(12);
    line.geometry.dispose(); line.material.dispose();
  });
  it("holds a meaningful still pose in reduced motion and releases every resource exactly once", () => {
    for (const item of SHOP_CATALOG) {
      const visual = createCosmeticPreviewScene(item), spies = resourceSpies(visual.root);
      visual.update(100, 1, true); visual.root.updateMatrixWorld(true);
      const before: number[][] = []; visual.root.traverse(object => before.push(object.matrixWorld.toArray()));
      visual.update(9000, 1, true); visual.root.updateMatrixWorld(true);
      const after: number[][] = []; visual.root.traverse(object => after.push(object.matrixWorld.toArray()));
      expect(after).toEqual(before);
      visual.dispose(); visual.dispose(); spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    }
  });
});
