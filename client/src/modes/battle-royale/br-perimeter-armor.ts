import { BR_ISLAND_OUTLINE, type Vec3 } from "@planetfall/shared";

/** Render-shell contract: buildGround's ExtrudeGeometry bevelSize is 4.6m.
 * Reserve that entire outward supporting-line envelope plus 0.2m clearance.
 * All local armor offsets below are measured FROM this envelope, so even the
 * nearest rotated box corner must exceed 4.8m from the authored outline.
 * If the shell bevel grows, update this contract before changing its renderer. */
export const BR_PERIMETER_SHELL_CLEARANCE = 4.8;

export interface PerimeterArmorPart {
  segmentIndex: number;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
}
export interface PerimeterArmorBatch {
  shape: "box" | "chamferedBox";
  finish: "structuralDark" | "brushedMetal" | "energyCyan";
  parts: PerimeterArmorPart[];
}

/** Replaces the centered edge-armor/maintenance-band loop in buildGround.
 * All full box bounds clear the rendered shell's bevel envelope and remain
 * below the playable deck. Winding is detected, never assumed. At most 96
 * sampled modules plus 64 segment bands, <=328 instances across four batches.
 * Reuse unitBox/unitChamferedBox and materials.get(finish), collision=false.
 * This owns no top rail, surface, sign, light object or per-frame behavior. */
export function buildPerimeterArmor(outline: readonly (readonly [number, number])[] = BR_ISLAND_OUTLINE): PerimeterArmorBatch[] {
  if (outline.length < 3 || outline.length > 64 || outline.some(point => !point.every(Number.isFinite))) return [];
  const area = outline.reduce((sum, [x, z], index) => {
    const [nx, nz] = outline[(index + 1) % outline.length];
    return sum + x * nz - nx * z;
  }, 0);
  if (!Number.isFinite(area) || Math.abs(area) < 1) return [];
  const winding = Math.sign(area);
  const segments = outline.map(([x, z], index) => {
    const [nx, nz] = outline[(index + 1) % outline.length];
    const length = Math.hypot(nx - x, nz - z);
    return { x, z, dx: nx - x, dz: nz - z, length };
  });
  if (segments.some(segment => !Number.isFinite(segment.length) || segment.length < 8)) return [];
  // A supporting-line guarantee requires a convex simple polygon. Validate
  // every vertex against every segment; reject malformed/concave input rather
  // than placing armor inside another portion of the playable deck.
  for (const segment of segments) for (const [x, z] of outline) {
    if (winding * (segment.dx * (z - segment.z) - segment.dz * (x - segment.x)) < -1e-6) return [];
  }
  const batches: PerimeterArmorBatch[] = [
    { shape: "box", finish: "structuralDark", parts: [] },
    { shape: "chamferedBox", finish: "brushedMetal", parts: [] },
    { shape: "chamferedBox", finish: "structuralDark", parts: [] },
    { shape: "box", finish: "energyCyan", parts: [] }
  ];
  const add = (batch: number, segmentIndex: number, along: number, outward: number, y: number, width: number, height: number, depth: number) => {
    const segment = segments[segmentIndex];
    const tx = segment.dx / segment.length, tz = segment.dz / segment.length;
    const ox = winding * tz, oz = -winding * tx;
    const shellOffset = BR_PERIMETER_SHELL_CLEARANCE + outward;
    batches[batch].parts.push({ segmentIndex, rotationY: -Math.atan2(segment.dz, segment.dx),
      position: { x: segment.x + tx * along + ox * shellOffset, y, z: segment.z + tz * along + oz * shellOffset },
      scale: { x: width, y: height, z: depth }
    });
  };
  for (const [index, segment] of segments.entries()) {
    // Continuous recessed skirt connects the plate rhythm without a walkable
    // shelf; its entire 0.9m thickness clears the shell bevel supporting line.
    add(0, index, segment.length / 2, .7, -14.5, segment.length - 5, 8, .9);
  }
  const perimeter = segments.reduce((sum, segment) => sum + segment.length, 0);
  const count = Math.min(96, Math.max(3, Math.floor(perimeter / 30)));
  const pitch = perimeter / count;
  let segmentIndex = 0, start = 0;
  for (let module = 0; module < count; module++) {
    const distance = (module + .5) * pitch;
    while (segmentIndex < segments.length - 1 && distance > start + segments[segmentIndex].length) start += segments[segmentIndex++].length;
    const along = distance - start, segment = segments[segmentIndex];
    const endRoom = Math.min(along, segment.length - along);
    if (endRoom < 4) continue;
    const width = Math.min(26, pitch - 2, endRoom * 2 - 1.5);
    add(1, segmentIndex, along, 1.05, -5.3, width, 7.6, 1.6);
    add(1, segmentIndex, along, 1.2, -12.2, width * .72, 5.4, 1.8);
    if (module % 2 === 0) {
      // Thin downward ribs carry the silhouette to the underside, with no
      // protrusion above or inward of the deck edge.
      add(2, segmentIndex, along, 1.8, -18, .72, 24, 2.8);
    }
    // A readable exterior lens every fourth module, seated 5mm beyond the
    // lower armor face. Still sparse; no continuous illuminated band.
    if (module % 4 === 1) add(3, segmentIndex, along, 2.165, -11.8, 2.2, .38, .12);
  }
  return batches.filter(batch => batch.parts.length);
}
