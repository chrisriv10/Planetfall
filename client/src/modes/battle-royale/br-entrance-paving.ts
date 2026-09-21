import type { BrStructure, Vec3 } from "@planetfall/shared";

export interface NovaEntrancePavingPart {
  finish: "paver" | "inset" | "drain";
  position: Vec3;
  scale: Vec3;
}

/** Thin surface dressing, never a raised platform or collider. The three shop
 * approaches get a small field of alternating pavers and an inset drain, all
 * aligned to the real entrance. Render with unitBox and surface materials:
 * paver = sidewalk, inset = concrete, drain = paintedMetal (layer 6).
 * Positions are world-space and can use the district detail group's LOD. */
export function buildNovaEntrancePaving(structure: BrStructure): NovaEntrancePavingPart[] {
  if (structure.districtId !== "nova-plaza" || !structure.enterable
    || !["nova-cafe", "nova-arcade", "nova-market"].includes(structure.id)) return [];
  const ns = structure.entrance === "north" || structure.entrance === "south";
  const outward = structure.entrance === "north" || structure.entrance === "east" ? 1 : -1;
  const normal = (ns ? structure.size.z : structure.size.x) / 2;
  if ((ns ? structure.size.x : structure.size.z) < 6) return [];

  const parts: NovaEntrancePavingPart[] = [];
  const add = (finish: NovaEntrancePavingPart["finish"], lateral: number, offset: number, width: number, depth: number) => {
    parts.push({ finish,
      position: {
        x: structure.position.x + (ns ? lateral : outward * (normal + offset)),
        y: .057,
        z: structure.position.z + (ns ? outward * (normal + offset) : lateral)
      },
      scale: { x: ns ? width : depth, y: .012, z: ns ? depth : width }
    });
  };

  // Dark joints are simply the exposed ground between tiles; there is no new
  // solid backing slab. The full field fits inside the 4.8m entrance width.
  for (let row = 0; row < 3; row++) for (let column = -1; column <= 1; column++) {
    add((row + column) % 2 === 0 ? "paver" : "inset", column * 1.42, 1.2 + row * .8, 1.34, .72);
  }
  // A broken metal strip reads as a recessed drain at walking speed, with no
  // luminous route arrow or apparent step at the outer edge of the approach.
  for (let slot = 0; slot < 7; slot++) add("drain", (slot - 3) * .58, 3.32, .47, .13);
  return parts;
}
