import type { Vec3 } from "@planetfall/shared";
import type { GraphicsQuality } from "../../settings";
import type { BrDistrictPropPart } from "./br-authored-district-props";

export interface BrNovaStreetPocket {
  id: string;
  center: Vec3;
  radius: number;
  context: "cafe" | "promenade" | "transit";
  parts: BrDistrictPropPart[];
}

// Individual authored placements in the gaps BETWEEN the existing Nova prop
// pockets. No interval placement, candidate search, random seed or relocation.
const POCKETS = [
  ["cafe-arrival", -214, -123, 0, "cafe", true],
  ["tower-a-promenade", -211, -147, 2, "promenade", true],
  ["junction-waiting", -188, -147, 2, "transit", false],
  ["tower-b-promenade", -145, -147, 2, "promenade", true],
  ["studio-arrival", -144, -124, 0, "cafe", false],
  ["market-stop", -110, -124, 0, "transit", true],
] as const;

/** World-space presentation only. Append these to Nova's existing district prop
 * batches (same geometry/finish/surface contract), with cameraCollision=false.
 * Low keeps four landmark lamps and the same low furniture, omitting secondary
 * pockets; medium/high add detail without changing surviving placements. All
 * parts fit the supplied 2.1m clearance circles. Optional isClear can omit an
 * entire pocket when a future map changes, never silently move it elsewhere.
 * No textures, point lights, physics, per-frame work or owned GPU resources. */
export function buildBrNovaStreetscape(
  quality: GraphicsQuality,
  isClear: (center: Vec3, radius: number) => boolean = () => true,
): BrNovaStreetPocket[] {
  const pockets: BrNovaStreetPocket[] = [];
  for (const [id, x, z, turns, context, essential] of POCKETS) {
    if (quality === "low" && !essential) continue;
    const center = { x, y: 0, z }, radius = 2.1;
    if (!isClear(center, radius)) continue;
    const parts: BrDistrictPropPart[] = [], yaw = turns * Math.PI / 2;
    const add = (geometry: BrDistrictPropPart["geometry"], finish: BrDistrictPropPart["finish"],
      px: number, py: number, pz: number, sx: number, sy: number, sz: number) => {
      parts.push({ geometry, finish, surface: false, rotationY: yaw,
        position: { x: x + px * Math.cos(yaw) + pz * Math.sin(yaw), y: py, z: z - px * Math.sin(yaw) + pz * Math.cos(yaw) },
        scale: { x: sx, y: sy, z: sz } });
    };
    // Three-metre-plus stems are readable from ground level; the narrow warm
    // downlight is backed by metal rather than a floating emissive cube.
    add("box", "structuralDark", -1.25, 1.85, .45, .1, 3.7, .1);
    add("box", "brushedMetal", -.97, 3.64, .45, .66, .12, .22);
    add("box", "windowLit", -.96, 3.572, .45, .43, .018, .13);
    // Slatted backless seating stays below .55m: no false hard-cover mass.
    for (const offset of [-.21, 0, .21]) add("box", "brushedMetal", .15, .48, -.38 + offset, 1.75, .09, .15);
    for (const px of [-.48, .78]) add("box", "structuralDark", px, .218, -.38, .1, .435, .54);
    if (context !== "transit") {
      add("box", "paintedMetal", .56, .19, .68, 1.55, .32, .65);
      add("box", "soil", .56, .354, .68, 1.37, .018, .49);
      for (const px of [.08, .72]) add("octahedron", "canopy", px, .53, .68, .28, .23, .22);
    } else {
      // Small timetable attached to the lamp, not an opaque shelter or wall.
      add("box", "paintedMetal", -1.25, 2.02, .38, .42, .58, .085);
      if (quality !== "low") {
        for (const py of [1.88, 2, 2.12]) add("box", "brushedMetal", -1.25, py, .328, .27, .025, .012);
      }
    }
    if (quality === "high") add("box", "industrialOrange", -1.25, .74, .385, .11, .12, .022);
    pockets.push({ id: `nova-street-${id}`, center, radius, context, parts });
  }
  return pockets;
}
