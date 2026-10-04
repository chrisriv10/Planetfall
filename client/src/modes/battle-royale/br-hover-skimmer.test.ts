import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createBrHoverSkimmer, disposeBrHoverSkimmer, updateBrHoverSkimmer, type BrHoverSkimmerVisual } from "./br-hover-skimmer";
import { BR_ENVIRONMENT_SCALE, isWithinBrPresentationScale } from "./br-environment-scale";

const visuals: BrHoverSkimmerVisual[] = [];
afterEach(() => { for (const visual of visuals.splice(0)) disposeBrHoverSkimmer(visual); });

describe("Orbital Hover Skimmer visual", () => {
  it("has a compact one-seat transport silhouette with ground-centred anchors", () => {
    const visual = createBrHoverSkimmer(); visuals.push(visual);
    visual.group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(visual.group);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThanOrEqual(2.15);
    expect(size.x).toBeLessThanOrEqual(2.3);
    expect(size.z).toBeGreaterThanOrEqual(4.35);
    expect(size.z).toBeLessThanOrEqual(4.65);
    expect(bounds.min.y).toBeGreaterThanOrEqual(.4);
    expect(bounds.max.y).toBeLessThanOrEqual(1.9);
    expect(isWithinBrPresentationScale(size.x, BR_ENVIRONMENT_SCALE.oneSeatTransportWidth)).toBe(true);
    expect(isWithinBrPresentationScale(size.z, BR_ENVIRONMENT_SCALE.oneSeatTransportLength)).toBe(true);
    expect(isWithinBrPresentationScale(bounds.max.y - bounds.min.y, BR_ENVIRONMENT_SCALE.oneSeatTransportHeight)).toBe(true);
    // The BR player rig adds .26m; its lower torso capsule extends -.02m.
    expect(visual.driverAnchor.position.y + .26 - .02).toBeCloseTo(visual.seatAnchor.position.y);
    expect(visual.driverAnchor.position.z).toBeGreaterThan(-.4);
    expect(visual.driverAnchor.position.z).toBeLessThan(.2);
  });

  it("makes front, rear, cockpit and all four hover modules explicit", () => {
    const visual = createBrHoverSkimmer(); visuals.push(visual);
    expect(visual.hoverModules).toHaveLength(4);
    expect(visual.headLights).toHaveLength(2);
    expect(visual.tailLights).toHaveLength(2);
    expect(visual.headLights.every(light => light.position.z > 2)).toBe(true);
    expect(visual.tailLights.every(light => light.position.z < -2)).toBe(true);
    expect(visual.group.getObjectByName("skimmer-seat-back")).toBeDefined();
    expect(visual.group.getObjectByName("skimmer-windscreen")).toBeDefined();
    expect(visual.group.getObjectsByProperty("name", "skimmer-rear-thruster")).toHaveLength(2);
    const seat = visual.group.getObjectByName("skimmer-seat-base") as THREE.Mesh<THREE.BoxGeometry>;
    // Canonical astronaut torso width is 2 * .48 * 1.06 = 1.018m.
    expect(seat.geometry.parameters.width).toBeGreaterThanOrEqual(1.018);
    expect(seat.geometry.parameters.width).toBeLessThan(1.12);
    const deck = visual.group.getObjectByName("skimmer-upper-deck") as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(deck.material.emissive.getHex()).toBe(0);
    expect(visual.group.getObjectsByProperty("name", "skimmer-control-grip")).toHaveLength(2);
    const console = visual.group.getObjectByName("skimmer-controls")!;
    expect(console.position.y - visual.seatAnchor.position.y).toBeGreaterThan(.3);
    expect(console.position.y - visual.seatAnchor.position.y).toBeLessThan(.5);
    for (const glow of visual.group.getObjectsByProperty("name", "skimmer-thruster-glow")) {
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(glow.quaternion);
      expect(normal.z).toBeCloseTo(-1);
      expect(normal.y).toBeCloseTo(0);
    }
  });

  it("winds every opaque prism face outward so top and side silhouettes render", () => {
    const visual = createBrHoverSkimmer(); visuals.push(visual);
    for (const name of ["skimmer-tapered-hull", "skimmer-underbody", "skimmer-upper-deck"]) {
      const part = visual.group.getObjectByName(name) as THREE.Mesh;
      const points = part.geometry.getAttribute("position");
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let index = 0; index < points.count; index += 3) {
        a.fromBufferAttribute(points, index); b.fromBufferAttribute(points, index + 1); c.fromBufferAttribute(points, index + 2);
        const centre = a.clone().add(b).add(c).divideScalar(3);
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        expect(normal.dot(centre)).toBeGreaterThan(0);
      }
    }
    visual.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(.8, 5, 0), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObject(visual.group.getObjectByName("skimmer-tapered-hull")!).length).toBeGreaterThan(0);
  });

  it("animates presentation inputs smoothly and clamps malformed values", () => {
    const visual = createBrHoverSkimmer(); visuals.push(visual);
    updateBrHoverSkimmer(visual, { time: 1, speed: 7, steering: .5, occupied: true });
    expect(Math.abs(visual.model.position.y)).toBeLessThan(.05);
    expect(visual.model.rotation.z).toBeLessThan(0);
    expect(visual.model.rotation.x).toBeLessThan(0);
    const firstPodY = visual.hoverModules[0].position.y;
    updateBrHoverSkimmer(visual, { time: Number.NaN, speed: Infinity, steering: 99, occupied: false });
    expect([...visual.model.position.toArray(), visual.model.rotation.x, visual.model.rotation.y, visual.model.rotation.z]
      .every(Number.isFinite)).toBe(true);
    expect(Math.abs(visual.model.rotation.z)).toBeLessThanOrEqual(.061);
    expect(visual.hoverModules[0].position.y).not.toBe(firstPodY);
    expect(visual.headLights.every(light => light.scale.x === .72)).toBe(true);
  });

  it("owns a bounded shared resource set and disposes it exactly once", () => {
    const visual = createBrHoverSkimmer(); visuals.push(visual);
    expect(visual.resources.geometries.length).toBeLessThanOrEqual(18);
    expect(visual.resources.materials.length).toBeLessThanOrEqual(8);
    let meshes = 0;
    visual.group.traverse(child => { if (child instanceof THREE.Mesh) meshes++; });
    expect(meshes).toBeLessThanOrEqual(48);
    const geometrySpies = visual.resources.geometries.map(resource => vi.spyOn(resource, "dispose"));
    const materialSpies = visual.resources.materials.map(resource => vi.spyOn(resource, "dispose"));
    const parent = new THREE.Group(); parent.add(visual.group);
    disposeBrHoverSkimmer(visual); disposeBrHoverSkimmer(visual);
    expect(parent.children).not.toContain(visual.group);
    expect(visual.group.children).toHaveLength(0);
    expect(visual.model.children).toHaveLength(0);
    const position = visual.model.position.clone();
    updateBrHoverSkimmer(visual, { time: 2, speed: 14, steering: 1 });
    expect(visual.model.position).toEqual(position);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
  });
});
