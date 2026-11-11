import type { PgSolid } from "@planetfall/shared";

export type PgRailBox = readonly [number, number, number, number, number, number];
export interface PgRailDetail {
  key: string;
  material: "trim" | "deck" | "ivory" | "amber";
  box: PgRailBox;
}

/** Opaque body/cap exactly partition the authoritative envelope. Centimetre-scale
 * relief is backed by the body, with no floating sheets or competing top faces. */
export function pgPerimeterRailArt(solid: PgSolid): {
  body: PgRailBox;
  details: readonly PgRailDetail[];
} {
  const c = solid.center, h = solid.half;
  const wide = h.x > h.z, length = 2 * (wide ? h.x : h.z);
  const height = h.y * 2, bottom = c.y - h.y;
  const cap = Math.min(.12, height * .15);
  const body: PgRailBox = [c.x, c.y - cap / 2, c.z, h.x * 2, height - cap, h.z * 2];
  const details: PgRailDetail[] = [{ key: "barrier-coping", material: "trim",
    box: [c.x, c.y + h.y - cap / 2, c.z, h.x * 2, cap, h.z * 2] }];
  const face = (sign: number, along: number, y: number, width: number, tall: number,
    relief: number, key: string, material: PgRailDetail["material"]) => {
    // The rear sits 6mm inside the body. Only the visible fronts need spacing.
    const depth = relief + .006, offset = relief - depth / 2;
    details.push({ key, material, box: wide
      ? [c.x + along, y, c.z + sign * (h.z + offset), width, tall, depth]
      : [c.x + sign * (h.x + offset), y, c.z + along, depth, tall, width] });
  };
  const count = Math.min(32, Math.max(1, Math.floor(length / 3.2)));
  for (const sign of [-1, 1]) {
    face(sign, 0, bottom + height * .477, Math.max(.01, length - .1), height * .438,
      .02, "barrier-inset", "deck");
    for (let i = 0; i < count; i++) {
      const along = -length / 2 + length * (i + .5) / count;
      face(sign, along, bottom + height * .477, Math.min(.12, length * .2), height * .785,
        .04, "barrier-rib", "ivory");
      face(sign, along, bottom + height * .846, Math.min(.28, length * .4), height * .042,
        .06, "barrier-reflector", "amber");
    }
  }
  return { body, details };
}
