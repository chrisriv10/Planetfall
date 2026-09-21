import type { BrStructure } from "@planetfall/shared";
import type { FacadeFinish, FacadePart } from "./br-facades";

/** Small wall-mounted details for Nova's three named shops. Coordinates are
 * world-space, like buildFacadeParts, and use its existing material batches.
 * The displays sit in front of the window skin; nothing occupies the door slit
 * or adds freestanding street furniture that could be mistaken for cover. */
export function buildNovaStorefrontParts(structure: BrStructure): FacadePart[] {
  const shop = structure.id === "nova-cafe" ? "cafe"
    : structure.id === "nova-arcade" ? "arcade"
    : structure.id === "nova-market" ? "market" : null;
  if (!shop || structure.districtId !== "nova-plaza" || !structure.enterable) return [];

  const face = structure.entrance;
  const ns = face === "north" || face === "south";
  const sign = face === "north" || face === "east" ? 1 : -1;
  const span = ns ? structure.size.x : structure.size.z;
  const normal = (ns ? structure.size.z : structure.size.x) / 2;
  if (span < 12 || structure.size.y < 4) return [];

  const parts: FacadePart[] = [];
  const add = (finish: FacadeFinish, lateral: number, y: number, width: number, height: number, offset: number, thickness: number) => {
    parts.push({ finish, face,
      position: {
        x: structure.position.x + (ns ? lateral : sign * (normal + offset)),
        y,
        z: structure.position.z + (ns ? sign * (normal + offset) : lateral)
      },
      scale: { x: ns ? width : thickness, y: height, z: ns ? thickness : width }
    });
  };

  // Slim paired fixtures read as door lighting without generating point lights.
  // Their backs clear the .65m wall and the existing window/sill layers.
  for (const side of [-1, 1]) {
    add("frame", side * 3.12, 3.18, .3, .94, .84, .16);
    add("lit", side * 3.12, 3.18, .13, .7, .945, .04);
    add("metal", side * 3.12, 3.7, .42, .1, .91, .34);
  }

  const display = 4.3;
  add("frame", display, 2.42, 1.45, 1.85, .84, .16);
  add("panel", display, 2.42, 1.27, 1.67, .942, .03);
  // A restrained accent underline and two pale menu rows are legible at street
  // distance; the small pictogram supplies identity without another texture.
  add("accent", display, 1.69, 1.04, .065, .973, .025);
  add("lit", display, 2.16, .88, .065, .973, .025);
  add("lit", display - .13, 1.98, .62, .055, .973, .025);
  const icon = (dx: number, y: number, width: number, height: number) =>
    add("accent", display + dx, y, width, height, .973, .025);

  if (shop === "cafe") {
    // Cup, handle, saucer, and a single rising steam stroke.
    icon(-.08, 2.69, .49, .31);
    icon(.23, 2.72, .15, .07);
    icon(.23, 2.57, .15, .07);
    icon(.3, 2.645, .06, .21);
    icon(-.02, 2.45, .72, .065);
    icon(-.12, 3.0, .055, .17);
  } else if (shop === "arcade") {
    // Pixel invader: stepped shoulders, antennae, and separated feet.
    icon(0, 2.71, .64, .18);
    icon(0, 2.88, .44, .16);
    for (const side of [-1, 1]) {
      icon(side * .26, 3.02, .09, .16);
      icon(side * .28, 2.5, .13, .16);
    }
  } else {
    // Shopping basket and raised handle.
    icon(0, 2.61, .65, .08);
    for (const side of [-1, 1]) {
      icon(side * .28, 2.77, .08, .35);
      icon(side * .14, 3.02, .065, .2);
    }
    icon(0, 3.11, .34, .065);
    icon(0, 2.92, .76, .065);
  }
  return parts;
}
