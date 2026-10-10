import { buildBrEntranceHeader, type BrStructure } from "@planetfall/shared";
import type { FacadePart } from "./br-facades";
import { buildBrDoorwayParts } from "./br-facade-attachments";

/** Shallow finish on the real entrance header, in WORLD coordinates including Y.
 * Feed these descriptors into the existing facade material/box batches. Every
 * part is backed by the literal upper wall; the pedestrian/cargo aperture stays
 * fully open. At most six boxes, no materials, meshes, or lights are allocated.
 */
export function buildBrEntranceHeaderFinish(structure: BrStructure): FacadePart[] {
  const header = buildBrEntranceHeader(structure);
  if (!header) return [];
  const face = structure.entrance;
  const ns = face === "north" || face === "south";
  const sign = face === "north" || face === "east" ? 1 : -1;
  const bottom = header.position.y - header.size.y / 2;
  const height = header.size.y;
  const parts: FacadePart[] = [];
  const add = (finish: FacadePart["finish"], y: number, width: number, h: number, offset: number, thickness: number) => {
    parts.push({ finish, face,
      position: { x: header.position.x + (ns ? 0 : sign * offset), y,
        z: header.position.z + (ns ? sign * offset : 0) },
      scale: { x: ns ? width : thickness, y: h, z: ns ? thickness : width } });
  };
  add("panel", header.position.y, 4.8, height, .39, .12);
  // Keep the light within the upper wall projection, even for a low roof.
  const ledHeight = Math.min(.055, height * .12);
  add("accent", bottom + Math.min(.15, height * .25), 4.36, ledHeight, .48, .035);
  const inset = .38;
  const along = ns ? "x" : "z";
  // Existing doorway descriptors use local Y. Reserve the entire attachment
  // silhouette (including the projecting canopy), not just its wall slice.
  const attachmentTop = Math.max(bottom, ...buildBrDoorwayParts(structure)
    .filter(p => p.face === face && Math.abs(p.position[along] - header.position[along]) < 2.4 + p.scale[along] / 2)
    .map(p => structure.position.y + p.position.y + p.scale.y / 2));
  const bandBottom = Math.max(bottom + inset, attachmentTop + .12);
  const bandTop = bottom + height - inset;
  const usable = bandTop - bandBottom;
  if (usable < .55) return parts;
  const cargo = ["warehouse", "hangar"].includes(structure.archetype) || structure.id === "thruster-foundry";
  // Tall headers receive two framed bands. Compact or industrial lintels get
  // one clerestory, preserving the broad matte industrial panel below it.
  const bands = !cargo && usable > 6 ? 2 : 1;
  const gap = bands === 2 ? .36 : 0;
  const bandHeight = cargo ? Math.min(1.1, usable) : (usable - gap) / bands;
  for (let i = 0; i < bands; i++) {
    const y = cargo ? bandTop - bandHeight / 2
      : bandBottom + bandHeight / 2 + i * (bandHeight + gap);
    add("frame", y, 4.18, bandHeight, .48, .08);
    add("glass", y, 3.9, Math.max(.15, bandHeight - .22), .535, .035);
  }
  return parts;
}
