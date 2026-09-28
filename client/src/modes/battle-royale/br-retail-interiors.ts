import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, type BrMapBlock, type BrStructure, type Vec3 } from "@planetfall/shared";

export type RetailFinish = "frame" | "panel" | "glass" | "light" | "accent";
export type RetailPart = { finish: RetailFinish; position: Vec3; scale: Vec3 };
export type RetailSign = { text: string; position: Vec3; width: number; rotationY: number };

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
        bayParts.push({finish,position:at(dx,y,distance),scale:alongX?{x:sx,y:sy*verticalScale,z:sz}:{x:sz,y:sy*verticalScale,z:sx}});
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
        rotationY:alongX?(sign>0?0:Math.PI):sign*Math.PI/2});
    }
  }
  return {parts, signs};
}
