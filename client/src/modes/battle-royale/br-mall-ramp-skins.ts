import { BR_MAP_BLOCKS, type BrMapBlock, type BrStructure, type Vec3 } from "@planetfall/shared";

export interface MallRampSkinPart {
  finish: "structuralDark" | "brushedMetal" | "energyPurple" | "energyCyan";
  position: Vec3;
  scale: Vec3;
  rotationX: number;
}
export interface MallRampSkin {
  rampId: string;
  parts: MallRampSkinPart[];
}

const finite = (vector: Vec3) => Object.values(vector).every(Number.isFinite);

/** Cosmetic underside construction for authored Void Mall interior stairs.
 * All parts are inside the ramp's local X/Z footprint, below its underside by
 * at most 14cm, and inset 90cm from both ends. No rails, posts, new top surfaces
 * or collision volumes are generated. Use unitBox and get(part.finish), copy
 * rotationX, and cameraCollision=false. Positions are world-space. */
export function buildMallRampSkins(structure: BrStructure, blocks: readonly BrMapBlock[] = BR_MAP_BLOCKS): MallRampSkin[] {
  if (!structure.enterable || structure.districtId !== "void-mall" || structure.archetype !== "mall") return [];
  const result: MallRampSkin[] = [];
  for (let level = 1; level < structure.floors; level++) {
    const ramp = blocks.find(block => block.id === `${structure.id}-stairs-${level}` && block.kind === "ramp");
    const lower = blocks.find(block => block.id === (level === 1 ? `${structure.id}-floor` : `${structure.id}-deck-${level - 1}-landing`)
      && block.kind === "platform" && !block.rotation);
    const upper = blocks.find(block => block.id === `${structure.id}-deck-${level}-landing` && block.kind === "platform" && !block.rotation);
    if (!ramp || !lower || !upper || !finite(ramp.position) || !finite(ramp.size)) continue;
    const angle = ramp.rotation?.x;
    if (angle === undefined || !Number.isFinite(angle) || angle <= .05 || angle >= 1.1
      || (ramp.rotation?.y ?? 0) !== 0 || (ramp.rotation?.z ?? 0) !== 0
      || ramp.size.x < 1 || ramp.size.x > 8 || ramp.size.y < .1 || ramp.size.y > .6 || ramp.size.z < 4) continue;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // Require actual slabs at both authored ends. Half a metre allows the
    // ground slab's .36m thickness; unsupported/shifted ramps get no skin.
    const supported = (slab: BrMapBlock, direction: -1 | 1) => {
      if (!finite(slab.position) || !finite(slab.size)) return false;
      const y = ramp.position.y - direction * ramp.size.z / 2 * sin;
      const z = ramp.position.z + direction * ramp.size.z / 2 * cos;
      return Math.abs(y - (slab.position.y + slab.size.y / 2)) <= .5
        && Math.abs(ramp.position.x - slab.position.x) + ramp.size.x / 2 <= slab.size.x / 2 + .05
        && Math.abs(z - slab.position.z) <= slab.size.z / 2 + .05;
    };
    if (!supported(lower, 1) || !supported(upper, -1)) continue;

    const parts: MallRampSkinPart[] = [];
    const underside = -ramp.size.y / 2;
    const add = (finish: MallRampSkinPart["finish"], x: number, y: number, z: number, width: number, tall: number, length: number) => {
      parts.push({ finish, rotationX: angle,
        position: { x: ramp.position.x + x, y: ramp.position.y + y * cos - z * sin, z: ramp.position.z + y * sin + z * cos },
        scale: { x: width, y: tall, z: length }
      });
    };
    const length = ramp.size.z - 1.8;
    for (const side of [-1, 1]) {
      add("structuralDark", side * (ramp.size.x / 2 - .08), underside - .066, 0, .14, .12, length);
      for (const z of [-length * .25, length * .25]) {
        // Lens is tucked into the underside edge, never above walking level.
        add(side < 0 ? "energyPurple" : "energyCyan", side * (ramp.size.x / 2 - .08), underside - .133, z, .055, .012, .65);
      }
    }
    for (let rib = 0; rib < 4; rib++) {
      add("brushedMetal", 0, underside - .045, (rib - 1.5) * length / 4, ramp.size.x - .34, .07, .12);
    }
    result.push({ rampId: ramp.id, parts });
  }
  return result;
}
