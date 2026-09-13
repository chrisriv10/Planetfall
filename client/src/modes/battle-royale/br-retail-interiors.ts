import { BR_MAP_BLOCKS, type BrStructure, type Vec3 } from "@planetfall/shared";

export type RetailFinish = "frame" | "panel" | "glass" | "light" | "accent";
export type RetailPart = { finish: RetailFinish; position: Vec3; scale: Vec3 };
export type RetailSign = { text: string; position: Vec3; width: number };

/** Display cases are a shallow skin on REAL partition walls, not extra rooms
 * or invisible-collision furniture standing in the concourse. */
export function buildRetailInterior(structure: BrStructure): { parts: RetailPart[]; signs: RetailSign[] } {
  const parts: RetailPart[] = [], signs: RetailSign[] = [];
  if (!structure.enterable || !["mall", "shop"].includes(structure.archetype)) return { parts, signs };
  const names = structure.id.includes("food") || structure.id.includes("cafe")
    ? ["ORBITAL CAFE", "FRESH DAILY", "ION JUICE"] : ["STAR SUPPLY", "ORBIT OUTFITTERS", "NOVA AUDIO"];
  let index = 0;
  for (const wall of BR_MAP_BLOCKS.filter(b => b.id.startsWith(`${structure.id}-room-`))) {
    // Only the south-facing skin: the east-side stair runs on the north side.
    const faceZ = wall.position.z - wall.size.z / 2;
    const usable = wall.size.x - 1.6, count = Math.max(1, Math.floor(usable / 7.5));
    const pitch = usable / count, width = Math.min(7.6, pitch - .5);
    for (let bay = 0; bay < count; bay++) {
      const x = wall.position.x - usable / 2 + pitch * (bay + .5);
      const add = (finish: RetailFinish, dx: number, y: number, distance: number, sx: number, sy: number, sz: number) =>
        parts.push({finish,position:{x:x+dx,y,z:faceZ-distance},scale:{x:sx,y:sy,z:sz}});
      add("frame",0,2.07,.08,width,3.72,.14);
      add("panel",0,.57,.3,width-.18,.65,.45);
      add("glass",0,2.1,.17,width-.6,2.1,.12);
      // Thin layered shelves and grouped product silhouettes supply depth,
      // while remaining less than 0.7m from the collision surface.
      for (const level of [1.22,2.13]) {
        add("panel",0,level,.37,width-.7,.1,.48);
        for (let item=0;item<5;item++) {
          const dx=(item-2)*(width-.9)/5;
          add(item%3===0?"accent":"panel",dx,level+.26+(item%2)*.06,.29,.4,.4+(item%2)*.12,.18);
          add("frame",dx,level+.31,.395,.24,.12,.035);
        }
      }
      for (const side of [-1,1]) add("panel",side*(width/2-.15),2.07,.24,.21,3.65,.31);
      add("panel",0,3.7,.27,width+.1,.26,.45);
      add("light",0,3.52,.4,width-.45,.055,.04);
      add("accent",-width*.42,.65,.535,.1,.32,.025);
      signs.push({text:names[index++%names.length],position:{x,y:3.18,z:faceZ-.43},width:width*.72});
    }
  }
  return {parts, signs};
}
