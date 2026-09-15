import type { BrStructure, Vec3 } from "@planetfall/shared";

export type FacadeFinish = "panel" | "frame" | "glass" | "lit" | "accent" | "foliage" | "metal";
export interface FacadePart {
  finish: FacadeFinish;
  position: Vec3;
  scale: Vec3;
  face: BrStructure["entrance"];
}

/** Skin dimensions use the same .65m wall and 4.8m entrance as the map.
 * All layers sit OUTSIDE the wall, and the full authoritative door slit stays
 * open. No renderer-only lintel, pane, or plinth can masquerade as collision. */
export function buildFacadeParts(structure: BrStructure): FacadePart[] {
  const parts: FacadePart[] = [];
  const { x, z } = structure.position;
  const { x: width, y: height, z: depth } = structure.size;
  const industrial = ["warehouse", "hangar", "industrial", "utility"].includes(structure.archetype) || ["reactor","industrial","dock"].includes(structure.style);
  const cargo = structure.archetype === "warehouse" || structure.archetype === "hangar" || structure.id === "thruster-foundry";
  const fuselage = structure.id === "crash-fuselage";
  const tower = ["tower", "hotel", "apartment"].includes(structure.archetype);
  const residential = structure.archetype === "apartment" || structure.archetype === "hotel";
  const shop = ["shop", "transit", "mall"].includes(structure.archetype);
  const levels = cargo || fuselage ? 1 : Math.max(1, Math.round(height / (industrial ? 6 : tower ? 4.8 : 4)));
  const floor = height / levels;
  for (const face of ["north", "south", "east", "west"] as const) {
    const ns = face === "north" || face === "south";
    const sign = face === "north" || face === "east" ? 1 : -1;
    const span = ns ? width : depth;
    const normal = (ns ? depth : width) / 2;
    const entrance = structure.enterable && face === structure.entrance;
    const intervals = entrance ? [[-span / 2 + .8, -2.55], [2.55, span / 2 - .8]] : [[-span / 2 + .8, span / 2 - .8]];
    const add = (finish: FacadeFinish, lateral: number, y: number, w: number, h: number, offset: number, thickness: number) => {
      parts.push({ finish, face,
        position: { x: x + (ns ? lateral : sign * (normal + offset)), y, z: z + (ns ? sign * (normal + offset) : lateral) },
        scale: { x: ns ? w : thickness, y: h, z: ns ? thickness : w }
      });
    };
    for (const [start, end] of intervals) {
      const length = end - start;
      if (length < .6) continue;
      add(fuselage ? "metal" : "panel", (start + end) / 2, height / 2, length, height - .35, .40, .12);
      add("frame", (start + end) / 2, .38, length, .64, .53, .18);
      // Strong roof cornices are neutral metal, not enormous neon roof slabs.
      add("frame", (start + end) / 2, height - .12, length, .3, .69, .58);
      const bays = Math.max(1, Math.floor(length / (fuselage ? 8 : shop ? 5.8 : industrial ? 6.2 : 4.2)));
      const pitch = length / bays;
      for (let bay = 0; bay < bays; bay++) {
        const center = start + pitch * (bay + .5);
        const windowWidth = fuselage ? Math.min(1.6, pitch - 1) : residential ? Math.min(2.65, pitch - 1.1) : pitch - (industrial ? 1.35 : .65);
        for (let level = 0; level < levels; level++) {
          const y = fuselage ? height * .72 : cargo ? height * .8 : level * floor + floor * .54;
          const windowHeight = Math.min(floor - 1.15, fuselage ? .72 : cargo ? height * .12 : industrial ? 1.5 : residential ? 2.35 : tower ? 4.2 : shop ? 2.65 : 2.8);
          if (windowWidth <= .3 || windowHeight <= .3) continue;
          add("frame", center, y, windowWidth + .25, windowHeight + .26, .51, .15);
          const lit = !fuselage && (bay * 3 + level + structure.id.length) % 9 === 0;
          add(lit ? "lit" : "glass", center, y, windowWidth, windowHeight, .605, .06);
          add("frame", center, y - windowHeight / 2 - .18, windowWidth + .45, .13, .73, .42);
          if (shop || tower) add("frame", center, y, .09, windowHeight, .66, .06);
          if (residential) {
            // Shallow, wall-supported shade cassettes: residential openings
            // read as individual rooms, not another floor-to-ceiling office grid.
            add("panel", center, y + windowHeight / 2 + .22, windowWidth + .62, .18, .76, .58);
            add("frame", center, y, windowWidth + .52, windowHeight + .62, .48, .14);
            // The frame above is behind the existing inset glazing. A low
            // spandrel establishes human scale without pretending to be a balcony.
            add("metal", center, y - windowHeight / 2 - .53, windowWidth + .26, .48, .55, .12);
            add("frame", center, y - windowHeight * .12, windowWidth, .085, .66, .06);
          }
        }
        if (cargo) {
          // High clerestory glazing and recessed sheet-metal cassettes give
          // loading halls a different wall rhythm from offices. These sit on
          // solid wall intervals only, never across an authoritative opening.
          add("metal", center, height * .35, windowWidth, height * .53, .54, .12);
          for (let rib = 0; rib < 4; rib++) add("panel", center + (rib - 1.5) * windowWidth / 4,
            height * .35, .09, height * .5, .635, .06);
        }
        if (fuselage) {
          add(bay % 3 === 1 ? "frame" : "panel", center, height * .34, pitch * .76, height * .38, .53, .12);
          add("frame", center, height * .56, pitch * .8, .12, .61, .06);
        }
        // Recessed window bays framed by broad structural fins, not pinprick windows.
        if (bay < bays - 1) add(residential ? "panel" : "frame", center + pitch / 2, height / 2, residential ? .38 : .18, height - .4, tower ? .83 : .62, tower ? .9 : .3);
      }
      if (industrial) {
        for (let i = 0; i < 3; i++) add("frame", start + length * .18, 1.5 + i * .22, Math.min(2, length * .25), .09, .59, .16);
      }
      if (structure.style === "city" && length > 4) {
        // Low wall-mounted planted sills add pedestrian scale without creating
        // new apparent full-height cover or narrowing the authoritative door.
        const troughWidth = Math.min(3.2, length * .45);
        const troughX = (start + end) / 2;
        add("panel", troughX, .35, troughWidth, .35, .74, .65);
        add("frame", troughX, .55, troughWidth + .12, .1, .75, .72);
        for (let sprig = 0; sprig < 5; sprig++) {
          add("foliage", troughX + (sprig - 2) * troughWidth / 5, .73 + (sprig % 2) * .05,
            troughWidth / 5 * .85, .32, .75, .38);
        }
      }
      add("accent", start + length * .2, height - .6, Math.min(length * .35, 4), .14, .76, .09);
    }
  }
  return parts;
}

/** Distant glazing keeps each floor readable with one band per wall section.
 * Door halves stay separate; sills, mullions and interior detail are omitted. */
export function buildDistantFacadeParts(structure: BrStructure): FacadePart[] {
  const bands = new Map<string, FacadePart>();
  for (const part of buildFacadeParts(structure)) {
    if (part.finish !== "glass" && part.finish !== "lit") continue;
    const axis = part.face === "north" || part.face === "south" ? "x" : "z";
    const doorHalf = structure.enterable && part.face === structure.entrance
      ? Math.sign(part.position[axis] - structure.position[axis]) : 0;
    const key = `${part.face}:${part.position.y}:${doorHalf}`;
    const band = bands.get(key);
    if (!band) {
      bands.set(key, { ...part, finish: "glass", position: { ...part.position }, scale: { ...part.scale } });
      continue;
    }
    const min = Math.min(band.position[axis] - band.scale[axis] / 2, part.position[axis] - part.scale[axis] / 2);
    const max = Math.max(band.position[axis] + band.scale[axis] / 2, part.position[axis] + part.scale[axis] / 2);
    band.position[axis] = (min + max) / 2;
    band.scale[axis] = max - min;
  }
  return [...bands.values()];
}

/** Shallow service ribs replace old solid annex volumes INSIDE playable rooms.
 * Use the back wall, not the entrance or roof access, as their mounting plane. */
export function buildExteriorServiceParts(structure: BrStructure): FacadePart[] {
  if (!["office", "lab", "academy", "mall", "industrial", "utility", "greenhouse"].includes(structure.archetype)) return [];
  const opposite = { north: "south", south: "north", east: "west", west: "east" } as const;
  const face = opposite[structure.entrance];
  const ns = face === "north" || face === "south";
  const sign = face === "north" || face === "east" ? 1 : -1;
  const span = ns ? structure.size.x : structure.size.z;
  const normal = (ns ? structure.size.z : structure.size.x) / 2;
  const industrial = structure.archetype === "industrial" || structure.archetype === "utility";
  const greenhouse = structure.archetype === "greenhouse";
  const parts: FacadePart[] = [];
  const add = (finish: FacadeFinish, lateral: number, y: number, width: number, height: number, thickness: number) => {
    const offset = .34 + thickness / 2;
    parts.push({ finish, face,
      position: {
        x: structure.position.x + (ns ? lateral : sign * (normal + offset)), y,
        z: structure.position.z + (ns ? sign * (normal + offset) : lateral)
      },
      scale: { x: ns ? width : thickness, y: height, z: ns ? thickness : width }
    });
  };
  for (const side of [-1, 1]) {
    const lateral = side * span * .34;
    add("frame", lateral, structure.size.y * .5, greenhouse ? .22 : industrial ? 1.05 : .7, structure.size.y - .4, .48);
    if (industrial) {
      for (let band = 0; band < 4; band++) add("panel", lateral, 1.2 + band * .38, 1.35, .15, .55);
    } else {
      add("accent", lateral, structure.size.y - .85, .28, .55, .53);
    }
  }
  return parts;
}
