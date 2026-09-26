import type { BrLootSocket, BrStructure, Vec3 } from "@planetfall/shared";

export type BrRoofFinish = "edge" | "accent" | "solar" | "vent";
export type BrRoofShape = "box" | "cylinder";
export interface BrRoofPart {
  finish: BrRoofFinish;
  shape: BrRoofShape;
  position: Vec3;
  scale: Vec3;
  rotationX?: number;
  rotationY?: number;
}

const distance2d = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

/** Low-profile visual kit for otherwise blank roofs. Parts remain inside the
 * authoritative roof footprint and reserve the authored loot/ramp approach.
 * They are visual detail, never gameplay cover. */
export function buildBrRooftopDetails(structure: BrStructure, roofLoot?: BrLootSocket): BrRoofPart[] {
  if (!structure.enterable || structure.size.x < 12 || structure.size.z < 10
    || ["greenhouse", "hangar", "warehouse"].includes(structure.archetype)
    || ["crash-fuselage", "thruster-foundry", "astra-observatory"].includes(structure.id)) return [];
  const { x, z } = structure.position;
  const y = structure.size.y + .27;
  const width = structure.size.x, depth = structure.size.z;
  const parts: BrRoofPart[] = [];
  const add = (part: BrRoofPart) => {
    if (roofLoot && distance2d(part.position, roofLoot.position) < 3.3 + Math.max(part.scale.x, part.scale.z) * .5) return;
    parts.push(part);
  };

  // The access edge remains visually open so the authoritative ramp does not
  // appear to terminate at a rail or service curb.
  const accessSide=structure.roofAccessSide??structure.entrance;
  if (!structure.roofAccess || accessSide !== "north") add({finish:"edge",shape:"box",position:{x,y,z:z+depth/2-.62},scale:{x:width-1.4,y:.09,z:.18}});
  if (!structure.roofAccess || accessSide !== "south") add({finish:"edge",shape:"box",position:{x,y,z:z-depth/2+.62},scale:{x:width-1.4,y:.09,z:.18}});
  if (!structure.roofAccess || accessSide !== "east") add({finish:"edge",shape:"box",position:{x:x+width/2-.62,y,z},scale:{x:.18,y:.09,z:depth-1.4}});
  if (!structure.roofAccess || accessSide !== "west") add({finish:"edge",shape:"box",position:{x:x-width/2+.62,y,z},scale:{x:.18,y:.09,z:depth-1.4}});

  const back = structure.entrance === "north" ? -1 : structure.entrance === "south" ? 1 : 0;
  const side = structure.entrance === "east" ? -1 : structure.entrance === "west" ? 1 : 0;
  const equipmentCenter = {
    x: x + side * width * .28 + (back ? width * .14 : 0),
    y: y + .14,
    z: z + back * depth * .28 + (side ? depth * .14 : 0)
  };
  const cityLike = ["city", "academy", "mall"].includes(structure.style);
  if (cityLike) {
    for (const offset of [-1, 1]) add({
      finish:"solar", shape:"box",
      position:{x:equipmentCenter.x + (back ? offset * width * .11 : 0),y:equipmentCenter.y,z:equipmentCenter.z + (side ? offset * depth * .11 : 0)},
      scale:{x:Math.min(4.8,width*.2),y:.16,z:Math.min(3.2,depth*.18)},
      rotationX:back ? -.12*back : undefined,
      rotationY:side ? Math.PI/2 : undefined
    });
    add({finish:"accent",shape:"box",position:{x,y:y+.03,z},scale:{x:Math.min(6,width*.3),y:.05,z:.16},rotationY:structure.entrance==="east"||structure.entrance==="west"?Math.PI/2:0});
  } else {
    for (const offset of [-1,1]) add({finish:"vent",shape:"cylinder",position:{x:equipmentCenter.x+offset*1.5,y:y+.32,z:equipmentCenter.z},scale:{x:.62,y:.64,z:.62}});
  }
  return parts;
}
