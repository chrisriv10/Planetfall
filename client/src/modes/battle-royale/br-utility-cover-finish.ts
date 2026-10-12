import * as THREE from "three";
import type { BrMapBlock, Vec3 } from "@planetfall/shared";

export type BrUtilityCoverFinish = "brushedMetal" | "structuralDark" | "energyCyan";
export interface BrUtilityCoverPart {
  blockId: string;
  role: "service-panel" | "vent" | "status-indicator";
  finish: BrUtilityCoverFinish;
  position: Vec3;
  scale: Vec3;
  rotation: Vec3;
}
export interface BrUtilityCoverBatch {
  finish: BrUtilityCoverFinish;
  parts: BrUtilityCoverPart[];
}

/** Eight shallow box overlays on each real cover mass. The backing solid is
 * retained by the caller. Two opposite long sides receive a compact sealed
 * service panel, paired ventilation slots and one restrained status indicator.
 * No opening, handle, standing post, broad orange lid or new gameplay volume.
 * Box overlays extend at most 13mm beyond the face solely to avoid z fighting. All in-plane extents stay
 * within the authored solid. Full authored XYZ rotation is preserved. */
export function buildBrUtilityCoverFinish(block: Readonly<BrMapBlock>): BrUtilityCoverPart[] {
  if (block.kind !== "cover") return [];
  const values = [...Object.values(block.position), ...Object.values(block.size), ...Object.values(block.rotation ?? { x: 0, y: 0, z: 0 })];
  if (!values.every(Number.isFinite) || Math.min(block.size.x, block.size.y, block.size.z) < .5) return [];
  const rotation = { ...(block.rotation ?? { x: 0, y: 0, z: 0 }) };
  const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z));
  const alongX = block.size.x >= block.size.z;
  const width = alongX ? block.size.x : block.size.z;
  const depth = alongX ? block.size.z : block.size.x;
  const panelWidth = Math.min(3.2, width * .7);
  const panelHeight = Math.min(.95, block.size.y * .52);
  const parts: BrUtilityCoverPart[] = [];
  const add = (side: number, role: BrUtilityCoverPart["role"], finish: BrUtilityCoverFinish, u: number, y: number, w: number, h: number, layer: number) => {
    const normal = side * (depth / 2 + layer);
    const local = new THREE.Vector3(alongX ? u : normal, y, alongX ? normal : u).applyQuaternion(orientation);
    parts.push({ blockId: block.id, role, finish,
      position: { x: local.x + block.position.x, y: local.y + block.position.y, z: local.z + block.position.z },
      scale: alongX ? { x: w, y: h, z: .008 } : { x: .008, y: h, z: w }, rotation: { ...rotation } });
  };
  for (const side of [-1, 1]) {
    // A small horizontal panel cannot be mistaken for a human entrance.
    add(side, "service-panel", "brushedMetal", 0, 0, panelWidth, panelHeight, .001);
    for (const y of [-.15, .10]) add(side, "vent", "structuralDark", -panelWidth * .06, y * panelHeight, panelWidth * .72, panelHeight * .075, .006);
    add(side, "status-indicator", "energyCyan", panelWidth * .39, panelHeight * .28, Math.min(.075, panelWidth * .05), panelHeight * .12, .009);
  }
  return parts;
}

/** At most three existing-material batches; unitBox, cameraCollision=false.
 * Caller retains every authored cover solid and removes only its hazard cap. */
export function buildBrUtilityCoverBatches(blocks: readonly BrMapBlock[]): BrUtilityCoverBatch[] {
  const batches = new Map<BrUtilityCoverFinish, BrUtilityCoverPart[]>();
  for (const block of blocks) for (const part of buildBrUtilityCoverFinish(block)) {
    let parts = batches.get(part.finish);
    if (!parts) { parts = []; batches.set(part.finish, parts); }
    parts.push(part);
  }
  return [...batches].map(([finish, parts]) => ({ finish, parts }));
}
