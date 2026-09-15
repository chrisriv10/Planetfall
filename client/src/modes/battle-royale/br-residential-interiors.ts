import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, type BrStructure, type Vec3 } from "@planetfall/shared";

export type ResidentialPart = { finish: "frame" | "panel" | "glass" | "light" | "accent"; position: Vec3; scale: Vec3 };
export type ResidentialSign = { text: string; position: Vec3; width: number };

/** Shallow lounge furniture against the west wall, away from the east stair.
 * Whole bays are omitted at doorways, dividers or loot, never partially clipped. */
export function buildResidentialInterior(structure: BrStructure): {parts: ResidentialPart[]; signs: ResidentialSign[]} {
  const parts: ResidentialPart[]=[], signs: ResidentialSign[]=[];
  if(!structure.enterable || !["apartment","hotel"].includes(structure.archetype))return {parts,signs};
  const {x,z}=structure.position, width=structure.size.x, depth=structure.size.z;
  const wallFace=x-width/2+.325;
  const blocks=BR_MAP_BLOCKS.filter(b=>b.id.startsWith(`${structure.id}-`));
  const loot=BR_LOOT_SOCKETS.filter(s=>s.structureId===structure.id);
  for(let floor=0;floor<structure.floors;floor++) {
    const floorY=floor===0?.36:floor*structure.size.y/structure.floors+.175;
    for(const side of [-1,1]) {
      const center=z+side*depth*.29, bay:ResidentialPart[]=[];
      const add=(finish:ResidentialPart["finish"],distance:number,y:number,dz:number,sx:number,sy:number,sz:number)=>
        bay.push({finish,position:{x:wallFace+distance,y:floorY+y,z:center+dz},scale:{x:sx,y:sy,z:sz}});
      const bayHeight=structure.size.y/structure.floors-1;
      // Broad wall bay and high lintel give these tall rooms human-scale layers.
      add("panel",.03,bayHeight/2+.1,0,.04,bayHeight,4.25);
      for(const end of [-1,1])add("frame",.075,bayHeight/2+.1,end*2.13,.09,bayHeight,.065);
      add("frame",.07,bayHeight+.1,0,.1,.12,4.3);
      // Framed wall textile/artwork with an asymmetric orbital city motif.
      add("frame",.085,2.42,0,.14,2.24,3.65);
      add("glass",.17,2.42,0,.035,1.94,3.34);
      for(let stripe=0;stripe<3;stripe++) {
        add(stripe===1?"accent":"panel",.2,2.14+stripe*.25,-.88+stripe*.78,.025,.16,1.04);
        add("panel",.21,2.68-stripe*.16,-.96+stripe*.65,.025,.4,.065);
      }
      // Bench: separate cushions, backrest, arms and feet, not a solid cover box.
      add("frame",.43,.38,0,.7,.14,3.6);
      for(const end of [-1,1]) {
        add("frame",.43,.15,end*1.4,.46,.3,.16);
        add("panel",.45,.72,end*1.72,.78,.18,.2);
        add("frame",.45,.54,end*1.72,.58,.26,.13);
      }
      for(const seat of [-1,0,1]) {
        add("panel",.46,.53,seat*1.07,.64,.18,1.01);
        add("panel",.16,.92,seat*1.07,.2,.62,1.01);
      }
      for(const end of [-1,1]) {
        add("frame",.16,2.56,end*2.04,.22,.74,.19);
        add("light",.285,2.56,end*2.04,.025,.46,.08);
      }
      const bounds={minX:wallFace,maxX:wallFace+.88,minZ:center-2.2,maxZ:center+2.2};
      if(structure.entrance==="west"&&bounds.minZ<z+2.8&&bounds.maxZ>z-2.8)continue;
      if(blocks.some(b=>b.id.includes("-room-")&&b.position.y+b.size.y/2>floorY&&
        b.position.x+b.size.x/2>bounds.minX&&b.position.x-b.size.x/2<bounds.maxX&&
        b.position.z+b.size.z/2+.2>bounds.minZ&&b.position.z-b.size.z/2-.2<bounds.maxZ))continue;
      if(loot.some(s=>s.position.y>floorY-.5&&s.position.y<floorY+3.7&&
        s.position.x>bounds.minX-1&&s.position.x<bounds.maxX+1&&s.position.z>bounds.minZ-1&&s.position.z<bounds.maxZ+1))continue;
      parts.push(...bay);
    }
    // High mounted wayfinding is readable from the stair landing, not a false door.
    const signZ=z-depth*.36;
    signs.push({text:floor===0?(structure.archetype==="hotel"?"HOTEL LOUNGE":"RESIDENT LOUNGE"):`LEVEL ${String(floor+1).padStart(2,"0")}`,
      position:{x:wallFace+.25,y:floorY+Math.min(4,structure.size.y/structure.floors-.85),z:signZ},width:3.4});
  }
  return {parts,signs};
}
