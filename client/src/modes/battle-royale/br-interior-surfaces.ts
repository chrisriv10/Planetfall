import { BR_MAP_BLOCKS, type BrStructure, type Vec3 } from "@planetfall/shared";

export type InteriorSurfacePart = { position: Vec3; scale: Vec3; rotationX?: number; finish: "seam" | "trim" };

/** Inlays follow actual slabs and inclines, including split upper floors.
 * Never paint a continuous floor across the authoritative stair opening. */
export function buildInteriorSurfaces(structure: BrStructure): InteriorSurfacePart[] {
  if(!structure.enterable || !["mall","shop","academy"].includes(structure.archetype))return [];
  const parts:InteriorSurfacePart[]=[];
  for(const block of BR_MAP_BLOCKS.filter(b=>b.id.startsWith(`${structure.id}-`))) {
    if(block.kind==="platform" && !block.id.endsWith("-roof")) {
      const {x,z}=block.position, y=block.position.y+block.size.y/2+.012;
      const width=block.size.x-1.6, depth=block.size.z-1.6;
      if(width<1||depth<1)continue;
      for(const side of [-1,1]) {
        parts.push({finish:"trim",position:{x:x+side*width/2,y,z},scale:{x:.055,y:.012,z:depth}});
        parts.push({finish:"trim",position:{x,y,z:z+side*depth/2},scale:{x:width,y:.012,z:.055}});
      }
      // Long expansion joints, not a high-contrast checkerboard texture.
      for(let offset=-width/2+6;offset<width/2-1;offset+=6)
        parts.push({finish:"seam",position:{x:x+offset,y,z},scale:{x:.025,y:.012,z:depth}});
    }
    if(block.kind==="ramp" && block.id.includes("-stairs-")) {
      const angle=block.rotation?.x??0, normalOffset=block.size.y/2+.016;
      const add=(lx:number,lz:number,sx:number,sz:number)=>parts.push({finish:"trim" as const,
        position:{x:block.position.x+lx,y:block.position.y+normalOffset*Math.cos(angle)-lz*Math.sin(angle),z:block.position.z+normalOffset*Math.sin(angle)+lz*Math.cos(angle)},
        scale:{x:sx,y:.018,z:sz},rotationX:angle});
      for(const side of [-1,1])add(side*(block.size.x/2-.18),0,.09,block.size.z-.25);
      for(let distance=-block.size.z/2+.7;distance<block.size.z/2-.5;distance+=1.35)
        add(0,distance,block.size.x-.45,.06);
    }
  }
  return parts;
}
