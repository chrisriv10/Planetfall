import { BR_TERRAIN_PATCHES, type BrTerrainPatch, type Vec3 } from "@planetfall/shared";

export type BrLandingMarkingFinish = "brushedMetal" | "sidewalk" | "industrialOrange" | "warningRed";

export interface BrLandingMarkingPart {
  finish: BrLandingMarkingFinish;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
}

const transform = (patch: BrTerrainPatch, localX: number, localZ: number): Vec3 => ({
  x: patch.position.x + Math.cos(patch.rotation) * localX + Math.sin(patch.rotation) * localZ,
  y: .022,
  z: patch.position.z - Math.sin(patch.rotation) * localX + Math.cos(patch.rotation) * localZ
});

/** Flush, visual-only markings for the two authored landing patches. */
export function buildBrLandingZoneMarkings(
  patches: readonly BrTerrainPatch[] = BR_TERRAIN_PATCHES
): BrLandingMarkingPart[] {
  const parts: BrLandingMarkingPart[] = [];
  for (const patch of [...patches].filter(item => item.kind === "landing").sort((a, b) => a.id.localeCompare(b.id))) {
    if (![patch.position.x, patch.position.z, patch.size.x, patch.size.z, patch.rotation].every(Number.isFinite)
      || patch.size.x < 36 || patch.size.z < 28) continue;
    const accent: BrLandingMarkingFinish = patch.id.includes("crash") ? "warningRed" : "industrialOrange";
    const add = (finish: BrLandingMarkingFinish, x: number, z: number, width: number, depth: number) => parts.push({
      finish,
      position: transform(patch, x, z),
      scale: { x: width, y: .008, z: depth },
      rotationY: patch.rotation
    });

    const halfWidth = patch.size.x / 2 - 5;
    const halfDepth = patch.size.z / 2 - 5;
    // Broken perimeter corners communicate a serviced zone without sealing or
    // visually blocking any road/structure approach into the actual patch.
    const cornerRun = Math.min(22, patch.size.x * .18);
    for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) {
      add("brushedMetal", sideX * (halfWidth - cornerRun / 2), sideZ * halfDepth, cornerRun, .28);
      add("brushedMetal", sideX * halfWidth, sideZ * (halfDepth - cornerRun / 2), .28, cornerRun);
    }
    // A restrained broken runway axis and paired service bars read from the
    // Starliner but leave more exposed deck than paint.
    const dashCount = Math.max(4, Math.min(8, Math.floor((patch.size.x - 30) / 15)));
    for (let index = 0; index < dashCount; index++) {
      const x = (index - (dashCount - 1) / 2) * 14;
      add("sidewalk", x, 0, 6.5, .45);
    }
    for (const side of [-1, 1]) {
      add(accent, 0, side * Math.min(halfDepth - 5, 15), Math.min(34, patch.size.x * .28), .65);
      for (const x of [-12, 0, 12]) add(accent, x, side * Math.min(halfDepth - 8, 11), 5.5, .24);
    }
  }
  return parts;
}
