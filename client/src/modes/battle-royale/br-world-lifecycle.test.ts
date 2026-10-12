import { describe, expect, it, vi } from "vitest";
import { BoxGeometry, Group, InstancedMesh, MeshBasicMaterial, Mesh, PerspectiveCamera, Sprite, Vector3 } from "three";
import { BrWorldRenderer } from "./br-world";

describe("BR world lifetime", () => {
  it("retains structural shells across facade LOD without distant shadow casters", () => {
    const world = Object.create(BrWorldRenderer.prototype) as BrWorldRenderer;
    const root = new Group(), group = new Group(), distant = new Group(), silhouette = new Group();
    distant.visible = false;
    const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
    const shell = new Mesh(geometry, material);
    shell.userData.cameraCollision = true; silhouette.add(shell); root.add(group, distant, silhouette);
    const detail = { group, distant, silhouette, center: new Vector3(), visible: true };
    Object.assign(world, { root, quality: "high", districtDetails: [detail], animated: [], energyMaterials: [], secondaryLabels: [], wayfindingLabels: [], qualityStreetscapes: [] });
    const camera = new PerspectiveCamera();
    try {
      for (const quality of ["high", "medium", "low"] as const) {
        world.setQuality(quality);
        for (const near of [true, false, true]) {
          camera.position.set(0, 2, near ? 1 : 2000); world.update(camera, 0);
          expect(group.visible).toBe(near); expect(distant.visible).toBe(!near);
          const visible: unknown[] = []; root.traverseVisible(o => visible.push(o));
          expect(visible).toContain(shell);
          expect(shell.castShadow).toBe(quality === "high" && near);
        }
        // Switching quality while already distant must not revive its shadows.
        camera.position.z = 2000; world.update(camera, 0); world.setQuality("high");
        expect(shell.castShadow).toBe(false);
      }
    } finally { geometry.dispose(); material.dispose(); }
  });
  it("releases world instance buffers exactly once, without disposing borrowed assets", () => {
    // No map construction or canvas needed: exercise the production teardown
    // with real Three batches and a helper using the same ownership contract.
    const world = Object.create(BrWorldRenderer.prototype) as BrWorldRenderer;
    const root = new Group(), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
    const ordinary = new InstancedMesh(geometry, material, 2);
    const helperGroup = new Group(), helper = new InstancedMesh(geometry, material, 1);
    const sprite = new Sprite();
    root.add(ordinary, helperGroup, sprite); helperGroup.add(helper);
    const batchDispose = vi.fn(), helperDispose = vi.fn(), borrowedDispose = vi.fn();
    const spriteDispose = vi.fn(), ownGeometryDispose = vi.fn(), libraryDispose = vi.fn();
    ordinary.addEventListener("dispose", batchDispose);
    helper.addEventListener("dispose", helperDispose);
    geometry.addEventListener("dispose", borrowedDispose);
    sprite.geometry.addEventListener("dispose", spriteDispose);
    Object.assign(world, { root, disposed: false,
      presentationDisposers: [() => { helper.dispose(); helperGroup.removeFromParent(); }],
      geometries: new Set([{ dispose: ownGeometryDispose }]), materials: { dispose: libraryDispose },
      collidableMeshes: [ordinary], poiLabels: [sprite], districtDetails: [helperGroup],
      animated: [ordinary], energyMaterials: [material], secondaryLabels: [sprite], wayfindingLabels: [sprite],
      qualityStreetscapes: [{ high: helperGroup, medium: helperGroup, low: helperGroup }],
      connectiveClusterDetail: helperGroup, maintenanceDetail: helperGroup, deckTransitionDetail: helperGroup,
      sectorFieldDetail: helperGroup, corridorGroveDetail: helperGroup, roadsideDetail: helperGroup,
      southShipworksDetail: helperGroup, southTerminalEnhancedDetail: helperGroup
    });
    try {
      world.dispose(); world.dispose();
      expect(batchDispose).toHaveBeenCalledTimes(1);
      expect(helperDispose).toHaveBeenCalledTimes(1);
      expect(ownGeometryDispose).toHaveBeenCalledTimes(1);
      expect(libraryDispose).toHaveBeenCalledTimes(1);
      expect(borrowedDispose).not.toHaveBeenCalled();
      expect(spriteDispose).not.toHaveBeenCalled();
      expect(root.children).toHaveLength(0);
      expect(world.collidableMeshes).toHaveLength(0);
      expect(world.poiLabels).toHaveLength(0);
      for (const key of ["qualityStreetscapes", "presentationDisposers", "districtDetails", "animated", "energyMaterials", "secondaryLabels", "wayfindingLabels"]) {
        expect(Reflect.get(world, key), key).toHaveLength(0);
      }
      for (const key of ["connectiveClusterDetail", "maintenanceDetail", "deckTransitionDetail", "sectorFieldDetail", "corridorGroveDetail", "roadsideDetail", "southShipworksDetail", "southTerminalEnhancedDetail"]) {
        expect(Reflect.get(world, key), key).toBeNull();
      }
    } finally {
      sprite.geometry.removeEventListener("dispose", spriteDispose);
      geometry.dispose(); material.dispose(); sprite.material.dispose();
    }
  });
});
