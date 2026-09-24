import * as THREE from "three";
import type { BrRarity } from "@planetfall/shared";
import type { GraphicsQuality } from "../../settings";

/** Item surfaces retain their authored palette; these colors belong to the field only. */
export const BR_LOOT_RARITY_COLORS: Readonly<Record<BrRarity, number>> = Object.freeze({
  common: 0xb8c4dc, rare: 0x54b8ff, epic: 0xc565ff, legendary: 0xffc84f,
});
export const BR_LOOT_FLOAT = Object.freeze({ lift: .28, amplitude: .12, speed: .002 });
const BEAM_HEIGHT: Record<BrRarity, number> = { common: 1.05, rare: 1.4, epic: 1.7, legendary: 2 };
type FieldMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
type FieldMaterials = { ring: THREE.MeshBasicMaterial; aura: THREE.MeshBasicMaterial; beam: THREE.MeshBasicMaterial };

// Three broken arcs form a compact orbital reticle, not a solid glowing disc.
function orbitalRing(): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  for (let arc = 0; arc < 3; arc++) {
    const offset = positions.length / 3;
    for (let step = 0; step <= 12; step++) {
      const angle = arc * Math.PI * 2 / 3 + .12 + step / 12 * (Math.PI * 2 / 3 - .24);
      for (const radius of [.68, .715]) positions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      if (step < 12) { const i = offset + step * 2; indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}

function fadedBeam(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(.01, .075, 1, 8, 4, true);
  const positions = geometry.getAttribute("position"), colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const brightness = 1 - Math.pow(positions.getY(i) + .5, 1.4);
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = brightness;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** A local presentation layer. The caller's authoritative/LOD root never animates.
 * Release before recursively disposing its parent: only the item model is caller-owned.
 * Wrap this group in BrLootLod; its distance marker remains owned by that class.
 */
export class BrLootRarityVisual extends THREE.Group {
  readonly itemPivot = new THREE.Group();
  readonly ring: FieldMesh;
  readonly aura: FieldMesh;
  readonly beam: FieldMesh;
  private released = false;
  private readonly phase: number;

  constructor(model: THREE.Object3D, id: string, surfaceOffsetY: number,
    geometries: readonly [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry],
    materials: FieldMaterials, height: number, private readonly onRelease: () => void) {
    super(); this.name = "loot-rarity-visual";
    let hash = 2166136261;
    for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
    this.phase = (hash >>> 0) / 4294967296 * Math.PI * 2;
    this.itemPivot.name = "loot-item-pivot"; this.itemPivot.add(model);
    this.ring = new THREE.Mesh(geometries[0], materials.ring);
    this.aura = new THREE.Mesh(geometries[1], materials.aura);
    this.beam = new THREE.Mesh(geometries[2], materials.beam);
    this.ring.name = "loot-rarity-ring"; this.aura.name = "loot-rarity-aura";
    // Deliberately not 'loot-beam': this layer owns quality/distance visibility.
    this.beam.name = "loot-rarity-beam";
    this.ring.position.y = surfaceOffsetY + .024;
    this.aura.position.y = surfaceOffsetY + .018; this.aura.rotation.x = -Math.PI / 2;
    this.beam.scale.y = height; this.beam.position.y = surfaceOffsetY + .03 + height / 2;
    this.add(this.itemPivot, this.ring, this.aura, this.beam);
    this.update(0, "low", 0);
  }

  /** Milliseconds, like performance.now(). No allocations or shared material mutations. */
  update(now: number, quality: GraphicsQuality, distance: number): void {
    if (this.released || !Number.isFinite(now)) return;
    const wave = Math.sin(now * BR_LOOT_FLOAT.speed + this.phase);
    this.itemPivot.position.y = BR_LOOT_FLOAT.lift + wave * BR_LOOT_FLOAT.amplitude;
    this.itemPivot.rotation.y = now * .00055 + this.phase;
    this.ring.rotation.y = this.phase; // Stationary base; only its item floats/spins.
    this.aura.scale.setScalar(1 + wave * .045);
    const validDistance = Number.isFinite(distance) && distance >= 0;
    this.aura.visible = validDistance && quality !== "low" && distance < (quality === "high" ? 45 : 30);
    this.beam.visible = validDistance && quality !== "low" && distance < (quality === "high" ? 48 : 28);
  }

  /** Idempotent. Detaches shared meshes but never disposes/reparents the caller's model. */
  release(): void {
    if (this.released) return;
    this.released = true; this.remove(this.ring, this.aura, this.beam); this.onRelease();
  }
}

/** Per-game resource owner: exactly three geometries and twelve materials,
 * independent of loot count. No textures, lights, timers, or per-frame allocation.
 * Keep alive across match reset; release each visual before generic scene cleanup.
 */
export class BrLootRarityResources {
  private readonly geometries = [orbitalRing(), new THREE.RingGeometry(.38, .77, 24), fadedBeam()] as const;
  private readonly materials = new Map<BrRarity, FieldMaterials>();
  private readonly visuals = new Set<BrLootRarityVisual>();
  private disposed = false;

  constructor() {
    for (const rarity of Object.keys(BR_LOOT_RARITY_COLORS) as BrRarity[]) {
      const base = { color: BR_LOOT_RARITY_COLORS[rarity], transparent: true, depthWrite: false,
        depthTest: true, toneMapped: false, side: THREE.DoubleSide };
      this.materials.set(rarity, {
        ring: new THREE.MeshBasicMaterial({ ...base, opacity: .76 }),
        aura: new THREE.MeshBasicMaterial({ ...base, opacity: .1, blending: THREE.AdditiveBlending }),
        beam: new THREE.MeshBasicMaterial({ ...base, opacity: .13, vertexColors: true, blending: THREE.AdditiveBlending }),
      });
    }
  }

  /** surfaceOffsetY is the supporting surface relative to the stationary loot root.
   * Pass the known surface offset; never infer a global ground plane for roof loot.
   * Model transforms/materials remain intact inside a separate animation pivot.
   */
  create(model: THREE.Object3D, rarity: BrRarity, id: string, surfaceOffsetY: number): BrLootRarityVisual {
    if (this.disposed) throw new Error("Loot rarity resources are disposed");
    if (!Number.isFinite(surfaceOffsetY)) throw new Error("Loot surface offset must be finite");
    const materials = this.materials.get(rarity);
    if (!materials) throw new Error("Unknown loot rarity");
    const visual = new BrLootRarityVisual(model, id, surfaceOffsetY, this.geometries, materials,
      BEAM_HEIGHT[rarity], () => this.visuals.delete(visual));
    this.visuals.add(visual); return visual;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const visual of this.visuals) visual.release();
    for (const geometry of this.geometries) geometry.dispose();
    for (const materials of this.materials.values()) {
      materials.ring.dispose(); materials.aura.dispose(); materials.beam.dispose();
    }
    this.materials.clear();
  }
}
