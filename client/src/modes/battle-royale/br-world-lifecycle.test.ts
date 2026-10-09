import { describe, expect, it, vi } from "vitest";
import { BoxGeometry, Group, InstancedMesh, MeshBasicMaterial, Sprite } from "three";
import { BrWorldRenderer } from "./br-world";

describe("BR world lifetime", () => {
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
      animated: [ordinary], energyMaterials: [material], secondaryLabels: [sprite],
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
      for (const key of ["qualityStreetscapes", "presentationDisposers", "districtDetails", "animated", "energyMaterials", "secondaryLabels"]) {
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
