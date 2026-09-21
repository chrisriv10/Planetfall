import type { BrStructure, Vec3 } from "@planetfall/shared";

export type ReactorInteriorFinish = "frame" | "panel" | "energy" | "warning";
export interface ReactorInteriorPart { finish: ReactorInteriorFinish; position: Vec3; scale: Vec3 }

/** Visual-only control hardware mounted to Helios Core's existing partition.
 * It deliberately leaves the authoritative central doorway and floor clear. */
export function buildReactorInterior(structure: BrStructure): ReactorInteriorPart[] {
  if (structure.id !== "helios-core" || structure.districtId !== "helios-reactor" || !structure.enterable) return [];
  const dividerZ = structure.position.z + structure.size.z * .18;
  const faceZ = dividerZ - .29;
  const parts: ReactorInteriorPart[] = [];
  const add = (finish: ReactorInteriorFinish, x: number, y: number, width: number, height: number, depth = .08) => {
    const layer = finish === "energy" || finish === "warning" ? .14 : finish === "frame" ? .08 : .02;
    parts.push({ finish, position: { x, y, z: faceZ - layer }, scale: { x: width, y: height, z: depth } });
  };

  // Mirrored containment-control bays give the large room a focal point while
  // preserving the five-metre opening between the authored partition halves.
  for (const side of [-1, 1]) {
    const center = structure.position.x + side * 9.2;
    add("frame", center, 4.72, 8.2, .18, .18);
    add("frame", center, 1.38, 8.2, .18, .18);
    add("frame", center - 4.01, 3.05, .18, 3.52, .18);
    add("frame", center + 4.01, 3.05, .18, 3.52, .18);
    add("panel", center, 3.05, 7.65, 2.92, .11);
    add("energy", center, 4.25, 6.85, .12, .04);
    add("warning", center, 1.88, 6.85, .09, .04);
    for (let column = -1; column <= 1; column++) {
      add("frame", center + column * 2.05, 3.12, 1.52, 1.72, .14);
      add(column === 0 ? "energy" : "warning", center + column * 2.05, 3.3, 1.15, .72, .035);
      for (let row = 0; row < 2; row++) add("energy", center + column * 2.05, 2.7 - row * .25, .82, .055, .035);
    }
  }
  // Narrow vertical bus bars visually connect the controls to the reactor's
  // overhead systems without appearing to be extra cover.
  for (const x of [-14.7, -3.25, 3.25, 14.7]) {
    add("frame", structure.position.x + x, 5.45, .28, 2.25, .12);
    add("energy", structure.position.x + x, 5.45, .09, 1.88, .035);
  }
  return parts;
}
