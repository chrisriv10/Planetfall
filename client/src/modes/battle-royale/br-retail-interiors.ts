import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, type BrMapBlock, type BrStructure, type Vec3 } from "@planetfall/shared";

export type RetailFinish = "frame" | "panel" | "glass" | "light" | "accent";
export type RetailPart = {
  finish: RetailFinish;
  position: Vec3;
  scale: Vec3;
  /** Presentation-only classification. The renderer batches both kinds through
   * the same shared material/geometry registry. */
  role?: "storefront" | "amenity";
};
export type RetailSign = { text: string; position: Vec3; width: number; rotationY: number; role?: "storefront" | "amenity" };

type LocalRetailPart = { finish: RetailFinish; u: number; y: number; v: number; su: number; sy: number; sv: number };

function addMallGroundFloorAmenities(structure: BrStructure, blocks: readonly BrMapBlock[], parts: RetailPart[], signs: RetailSign[]) {
  if (structure.archetype !== "mall") return;
  const alongZ = structure.entrance === "east" || structure.entrance === "west";
  const localWidth = alongZ ? structure.size.z : structure.size.x;
  const localDepth = alongZ ? structure.size.x : structure.size.z;
  if (localWidth < 18 || localDepth < 18) return;
  const floor = blocks.find(block => block.id === `${structure.id}-floor` && block.kind === "platform" && !block.rotation);
  if (!floor) return;
  const baseY = floor.position.y + floor.size.y / 2 - structure.position.y;
  const worldAt = (u: number, y: number, v: number): Vec3 => {
    if (structure.entrance === "south") return { x: structure.position.x + u, y, z: structure.position.z - structure.size.z / 2 + v };
    if (structure.entrance === "north") return { x: structure.position.x + u, y, z: structure.position.z + structure.size.z / 2 - v };
    if (structure.entrance === "east") return { x: structure.position.x + structure.size.x / 2 - v, y, z: structure.position.z + u };
    return { x: structure.position.x - structure.size.x / 2 + v, y, z: structure.position.z + u };
  };
  const worldScale = (su: number, sy: number, sv: number): Vec3 => alongZ
    ? { x: sv, y: sy, z: su }
    : { x: su, y: sy, z: sv };
  const overlap = (position: Vec3, scale: Vec3, otherPosition: Vec3, otherScale: Vec3, padding = 0) =>
    Math.abs(position.x - otherPosition.x) < (scale.x + otherScale.x) / 2 + padding
    && Math.abs(position.y - otherPosition.y) < (scale.y + otherScale.y) / 2 + padding
    && Math.abs(position.z - otherPosition.z) < (scale.z + otherScale.z) / 2 + padding;
  const addGroup = (source: readonly LocalRetailPart[], label?: { text: string; u: number; y: number; v: number; width: number }) => {
    const group = source.map(part => ({
      finish: part.finish,
      position: worldAt(part.u, baseY + part.y, part.v),
      scale: worldScale(part.su, part.sy, part.sv),
      role: "amenity" as const
    }));
    const unsafe = group.some(part => {
      const outside = Math.abs(part.position.x - structure.position.x) + part.scale.x / 2 > structure.size.x / 2 - .72
        || Math.abs(part.position.z - structure.position.z) + part.scale.z / 2 > structure.size.z / 2 - .72
        || part.position.y - part.scale.y / 2 < baseY - .01;
      if (outside) return true;
      if (BR_LOOT_SOCKETS.some(socket => socket.structureId === structure.id
        && overlap(part.position, part.scale, { ...socket.position, y: socket.position.y - structure.position.y }, { x: 1.5, y: 1.7, z: 1.5 }, .35))) return true;
      return blocks.some(block => block.id.startsWith(`${structure.id}-`)
        && (block.kind === "ramp" || block.id.includes("-room-")) && (() => {
          const angle = block.rotation?.x ?? 0;
          const size = {
            x: block.size.x,
            y: Math.abs(Math.cos(angle)) * block.size.y + Math.abs(Math.sin(angle)) * block.size.z,
            z: Math.abs(Math.sin(angle)) * block.size.y + Math.abs(Math.cos(angle)) * block.size.z
          };
          return overlap(part.position, part.scale, { ...block.position, y: block.position.y - structure.position.y }, size, .32);
        })());
    });
    if (unsafe) return;
    parts.push(...group);
    if (label) {
      const position = worldAt(label.u, baseY + label.y, label.v);
      const rotationY = structure.entrance === "south" ? Math.PI
        : structure.entrance === "north" ? 0
          : structure.entrance === "east" ? Math.PI / 2 : -Math.PI / 2;
      signs.push({ text: label.text, position, width: label.width, rotationY, role: "amenity" });
    }
  };

  // A compact service kiosk anchors the deep corner without interrupting the
  // straight entrance-to-atrium lane. Layered canopy, display glass and a low
  // counter make it read as a real retail unit from player height.
  const kioskU = -localWidth / 2 + 3.4;
  const kioskV = localDepth - 1.55;
  addGroup([
    { finish: "frame", u: kioskU, y: .18, v: kioskV, su: 5.2, sy: .28, sv: 1.65 },
    { finish: "panel", u: kioskU, y: .82, v: kioskV - .18, su: 4.75, sy: 1.05, sv: 1.08 },
    { finish: "panel", u: kioskU, y: 1.38, v: kioskV - .62, su: 5.15, sy: .17, sv: .64 },
    { finish: "glass", u: kioskU, y: 1.82, v: kioskV - .3, su: 3.55, sy: .72, sv: .08 },
    { finish: "frame", u: kioskU - 2.25, y: 1.85, v: kioskV, su: .16, sy: 2.9, sv: .2 },
    { finish: "frame", u: kioskU + 2.25, y: 1.85, v: kioskV, su: .16, sy: 2.9, sv: .2 },
    { finish: "panel", u: kioskU, y: 3.26, v: kioskV, su: 5.25, sy: .2, sv: 1.55 },
    { finish: "light", u: kioskU, y: 3.06, v: kioskV - .72, su: 4.6, sy: .07, sv: .05 },
    { finish: "accent", u: kioskU - 1.82, y: .96, v: kioskV - .76, su: .17, sy: .6, sv: .08 }
  ], { text: structure.id.includes("food") ? "ION BITES" : "VOID MARKET", u: kioskU, y: 2.7, v: kioskV - .76, width: 3.5 });

  // Two small lounge pockets hug the long side walls. Seats face into the
  // atrium, while paired illuminated planters give the ground floor a composed
  // rhythm. The middle remains a broad combat/loot lane.
  for (const side of [-1, 1]) {
    const u = side * (localWidth / 2 - 1.75);
    const v = Math.min(localDepth - 7, Math.max(7, localDepth * (side < 0 ? .42 : .68)));
    addGroup([
      { finish: "frame", u, y: .21, v, su: 1.72, sy: .28, sv: 4.25 },
      { finish: "panel", u: u - side * .2, y: .58, v, su: 1.18, sy: .22, sv: 3.65 },
      { finish: "panel", u: u + side * .43, y: 1.02, v, su: .18, sy: .92, sv: 3.65 },
      { finish: "light", u: u - side * .42, y: .45, v, su: .05, sy: .08, sv: 3.2 },
      { finish: "frame", u, y: .42, v: v - 2.65, su: 1.85, sy: .72, sv: 1.15 },
      { finish: "accent", u: u - .42, y: 1.02, v: v - 2.65, su: .5, sy: .85, sv: .52 },
      { finish: "accent", u: u + .42, y: .9, v: v - 2.65, su: .5, sy: .62, sv: .52 }
    ]);
  }
}

/** Display cases are a shallow skin on REAL partition walls, not extra rooms
 * or invisible-collision furniture standing in the concourse. */
export function buildRetailInterior(structure: BrStructure, blocks: readonly BrMapBlock[] = BR_MAP_BLOCKS): { parts: RetailPart[]; signs: RetailSign[] } {
  const parts: RetailPart[] = [], signs: RetailSign[] = [];
  if (!structure.enterable || !["mall", "shop"].includes(structure.archetype)) return { parts, signs };
  const names = structure.id.includes("food") || structure.id.includes("cafe")
    ? ["ORBITAL CAFE", "FRESH DAILY", "ION JUICE"] : ["STAR SUPPLY", "ORBIT OUTFITTERS", "NOVA AUDIO"];
  let index = 0;
  for (const wall of blocks.filter(b => b.kind === "wall" && b.id.startsWith(`${structure.id}-room-`))) {
    // Authored room plans rotate with the entrance. Orient each shallow bay
    // along the actual long wall axis and expose its entrance-facing skin.
    const alongX = wall.size.x >= wall.size.z;
    const sign = (alongX ? structure.entrance === "north" : structure.entrance === "east") ? 1 : -1;
    const length = alongX ? wall.size.x : wall.size.z;
    if (![...Object.values(wall.position), ...Object.values(wall.size)].every(Number.isFinite)
      || length < 4.2 || Math.min(wall.size.x, wall.size.z) <= 0 || wall.size.y < 3.9
      || (wall.rotation && Object.values(wall.rotation).some(value => value !== 0))) continue;
    const face = (alongX ? wall.position.z : wall.position.x) + sign * (alongX ? wall.size.z : wall.size.x) / 2;
    const usable = length - 1.6, count = Math.max(1, Math.floor(usable / 7.5));
    const pitch = usable / count, width = Math.min(7.6, pitch - .5);
    for (let bay = 0; bay < count; bay++) {
      const lateral = (alongX ? wall.position.x : wall.position.z) - usable / 2 + pitch * (bay + .5);
      // A divider exists on EACH storey. Bind to the slab under this particular
      // bay instead of drawing every level at ground-floor absolute heights.
      const wallBase=wall.position.y-wall.size.y/2,wallTop=wall.position.y+wall.size.y/2;
      const center=alongX?{x:lateral,z:face+sign*.35}:{x:face+sign*.35,z:lateral};
      const footprint=alongX?{x:width+.1,z:.7}:{x:.7,z:width+.1};
      const floor=blocks.find(block=>block.id.startsWith(`${structure.id}-`)&&block.kind==="platform"&&!block.rotation
        &&!block.id.endsWith("-roof")&&block.position.y+block.size.y/2>=wallBase-.001
        &&block.position.y+block.size.y/2<=wallBase+.5
        &&Math.abs(center.x-block.position.x)+footprint.x/2<=block.size.x/2
        &&Math.abs(center.z-block.position.z)+footprint.z/2<=block.size.z/2);
      if(!floor)continue; // No display spanning a real stairwell opening.
      const baseY=structure.position.y;
      const floorY=floor.position.y+floor.size.y/2-baseY;
      const wallTopLocal=wallTop-baseY;
      const verticalScale=Math.min(1,(wallTopLocal-floorY-.07)/3.72);
      if(verticalScale<.8)continue;
      const kitY=(height:number)=>floorY+.02+(height-.21)*verticalScale;
      const bayParts:RetailPart[]=[];
      const at = (dx: number, y: number, distance: number): Vec3 => alongX
        ? { x: lateral + dx, y:kitY(y), z: face + sign * distance }
        : { x: face + sign * distance, y:kitY(y), z: lateral + dx };
      const add = (finish: RetailFinish, dx: number, y: number, distance: number, sx: number, sy: number, sz: number) =>
        bayParts.push({finish,position:at(dx,y,distance),scale:alongX?{x:sx,y:sy*verticalScale,z:sz}:{x:sz,y:sy*verticalScale,z:sx},role:"storefront"});
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
      const overlap=(p:RetailPart,position:Vec3,size:Vec3,padding=0)=>
        Math.abs(p.position.x-position.x)<(p.scale.x+size.x)/2+padding&&
        Math.abs(p.position.y-position.y)<(p.scale.y+size.y)/2+padding&&
        Math.abs(p.position.z-position.z)<(p.scale.z+size.z)/2+padding;
      if(bayParts.some(part=>Math.abs(part.position.x-structure.position.x)+part.scale.x/2>structure.size.x/2-.325
        ||Math.abs(part.position.z-structure.position.z)+part.scale.z/2>structure.size.z/2-.325
        ||BR_LOOT_SOCKETS.some(socket=>socket.structureId===structure.id&&overlap(part,{...socket.position,y:socket.position.y-baseY},{x:1.2,y:1.2,z:1.2}))
        ||blocks.some(block=>block.id.startsWith(`${structure.id}-`)
          &&block.id!==wall.id&&(block.kind==="ramp"||block.id.includes("-room-"))&&(()=>{
            const angle=block.rotation?.x??0;
            return overlap(part,{...block.position,y:block.position.y-baseY},{x:block.size.x,y:Math.abs(Math.cos(angle))*block.size.y+Math.abs(Math.sin(angle))*block.size.z,
              z:Math.abs(Math.sin(angle))*block.size.y+Math.abs(Math.cos(angle))*block.size.z},.08);
          })())))continue;
      parts.push(...bayParts);
      signs.push({text:names[index++%names.length],position:at(0,3.18,.43),width:width*.72,
        rotationY:alongX?(sign>0?0:Math.PI):sign*Math.PI/2,role:"storefront"});
    }
  }
  addMallGroundFloorAmenities(structure, blocks, parts, signs);
  return {parts, signs};
}
