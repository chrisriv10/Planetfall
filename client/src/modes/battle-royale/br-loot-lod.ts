import * as THREE from "three";
import type { GraphicsQuality } from "../../settings";
import type { BrLootCategory } from "./br-item-presentation";

/** A small three-dimensional silhouette, visible from every approach. One mesh
 * per marker, including the medical cross; materials remain ordinary depth-tested
 * surfaces so buildings/terrain occlude loot exactly like the original model. */
export function brLootMarkerGeometry(category: BrLootCategory): THREE.BufferGeometry {
  if (category === "weapon") return new THREE.BoxGeometry(.86, .2, .22);
  if (category === "ammo") return new THREE.CylinderGeometry(.2, .2, .58, 6);
  if (category === "shield") return new THREE.IcosahedronGeometry(.36, 0);
  if (category === "health") {
    const shape = new THREE.Shape();
    const points = [[-.12,.36],[.12,.36],[.12,.12],[.36,.12],[.36,-.12],[.12,-.12],[.12,-.36],[-.12,-.36],[-.12,-.12],[-.36,-.12],[-.36,.12],[-.12,.12]];
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .2, bevelEnabled: false });
    geometry.translate(0, 0, -.1);
    return geometry;
  }
  return new THREE.OctahedronGeometry(.3, 0);
}

/** Retains a depth-tested rarity marker at distance; never removes a pickup.
 * The authoritative state and interaction position remain outside this class. */
export class BrLootLod extends THREE.Group {
  readonly marker: THREE.Mesh;
  private readonly beam: THREE.Object3D | undefined;
  private readonly worldPosition = new THREE.Vector3();

  constructor(readonly detail: THREE.Group, color: number, readonly category: BrLootCategory = "unknown") {
    super();
    this.marker = new THREE.Mesh(brLootMarkerGeometry(category), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    this.marker.name = `loot-marker-${category}`;
    this.marker.rotation.set(.16, Math.PI / 4, category === "weapon" ? .16 : 0);
    this.marker.visible = false;
    this.beam = detail.getObjectByName("loot-beam");
    this.add(detail, this.marker);
  }

  updateDetail(camera: THREE.Vector3, quality: GraphicsQuality): void {
    const range = quality === "high" ? 80 : quality === "medium" ? 60 : 40;
    const exitRange = range + (this.detail.visible ? 10 : 0);
    this.getWorldPosition(this.worldPosition);
    const distanceSquared = this.worldPosition.distanceToSquared(camera);
    this.detail.visible = distanceSquared < exitRange * exitRange;
    this.marker.visible = !this.detail.visible;
    // Gentle angular-size compensation: identifiable at medium/long range,
    // bounded to avoid oversized floating icons on the skyline.
    const markerScale = Number.isFinite(distanceSquared) ? Math.min(2.4, Math.max(1, Math.sqrt(distanceSquared) / 55)) : 1;
    this.marker.scale.setScalar(markerScale);
    if (this.beam) {
      const beamRange = quality === "high" ? 72 : quality === "medium" ? 48 : 26;
      this.beam.visible = distanceSquared < beamRange * beamRange;
    }
  }
}
