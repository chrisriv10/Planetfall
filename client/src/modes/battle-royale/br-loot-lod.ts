import * as THREE from "three";
import type { GraphicsQuality } from "../../settings";

/** Retains a depth-tested rarity marker at distance; never removes a pickup.
 * The authoritative state and interaction position remain outside this class. */
export class BrLootLod extends THREE.Group {
  readonly marker: THREE.Mesh;
  private readonly beam: THREE.Object3D | undefined;

  constructor(readonly detail: THREE.Group, color: number) {
    super();
    this.marker = new THREE.Mesh(new THREE.OctahedronGeometry(.3, 0), new THREE.MeshBasicMaterial({ color }));
    this.marker.visible = false;
    this.beam = detail.getObjectByName("loot-beam");
    this.add(detail, this.marker);
  }

  updateDetail(camera: THREE.Vector3, quality: GraphicsQuality): void {
    const range = quality === "high" ? 80 : quality === "medium" ? 60 : 40;
    const exitRange = range + (this.detail.visible ? 10 : 0);
    const distanceSquared = this.position.distanceToSquared(camera);
    this.detail.visible = distanceSquared < exitRange * exitRange;
    this.marker.visible = !this.detail.visible;
    if (this.beam) {
      const beamRange = quality === "high" ? 72 : quality === "medium" ? 48 : 26;
      this.beam.visible = distanceSquared < beamRange * beamRange;
    }
  }
}
