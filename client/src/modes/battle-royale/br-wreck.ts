import { BR_LOOT_SOCKETS, type BrStructure, type Vec3 } from "@planetfall/shared";

export type WreckPart = { position: Vec3; scale: Vec3; rotationX: number; finish: "hull" | "frame" | "paint" };
export type WreckInteriorPart = {position:Vec3;scale:Vec3;finish:"panel"|"frame"|"light"};

/** Service lockers hug the hull walls; the long central cargo lane stays clear. */
export function buildWreckInterior(structure:BrStructure):WreckInteriorPart[] {
  const parts:WreckInteriorPart[]=[];
  const {x,z}=structure.position, {x:width,y:height,z:depth}=structure.size;
  const add=(finish:WreckInteriorPart["finish"],px:number,py:number,pz:number,w:number,h:number,d:number)=>
    parts.push({finish,position:{x:px,y:py,z:pz},scale:{x:w,y:h,z:d}});
  for(const fraction of [-.35,-.175,0,.175,.35]) {
    const px=x+width*fraction;
    add("frame",px,height-.6,z,.26,.24,depth-1.1);
    for(const side of [-1,1]) {
      const wall=z+side*(depth/2-.68);
      add("frame",px,1.75,wall,4.6,2.8,.55);
      add("panel",px,1.8,wall-side*.3,4.2,2.36,.08);
      for(const lateral of [-1,1]) {
        add("frame",px+lateral*1.35,1.8,wall-side*.36,.09,2.1,.04);
        add("light",px+lateral*.8,2.65,wall-side*.36,.8,.12,.04);
      }
      add("frame",px,height-1.5,wall,4.8,.9,.4);
      for(let slat=0;slat<3;slat++)add("panel",px,height-1.8+slat*.23,wall-side*.23,4.4,.08,.1);
    }
  }
  for(const side of [-1,1]) {
    add("frame",x,height-.52,z+side*depth*.32,width*.9,.16,.45);
    add("light",x,height-.62,z+side*depth*.32,width*.87,.025,.13);
  }
  return parts;
}

/** A fractured roof shell around the real fuselage, not a solid ship through
 * its occupied interior. Missing plate bays expose the structural ribs. */
export function buildWreckRoof(structure: BrStructure, roofLoot: readonly Vec3[] = BR_LOOT_SOCKETS
  .filter(s => s.structureId === structure.id && s.kind === "roof").map(s => s.position)): WreckPart[] {
  const parts: WreckPart[] = [];
  const bays = 8, pitch = (structure.size.x - 2) / bays;
  const halfSpan = structure.size.z / 2 - .8;
  const rise = Math.min(5.2, structure.size.z * .27);
  for (let bay = 0; bay < bays; bay++) {
    const x = structure.position.x - structure.size.x / 2 + 1 + (bay + .5) * pitch;
    // Preserve an entire open bay around any authored roof pickup.
    if (roofLoot.some(socket => Math.abs(socket.x - x) < pitch / 2 + 1.4)) continue;
    for (let segment = 0; segment < 6; segment++) {
      const a = segment * Math.PI / 6, b = (segment + 1) * Math.PI / 6;
      const z1 = Math.cos(a) * halfSpan, z2 = Math.cos(b) * halfSpan;
      const y1 = Math.sin(a) * rise, y2 = Math.sin(b) * rise;
      const length = Math.hypot(z2-z1,y2-y1);
      const rotationX = -Math.atan2(y2-y1,z2-z1);
      const position = { x, y: structure.size.y + .32 + (y1+y2)/2, z: structure.position.z + (z1+z2)/2 };
      // Repeated cross-section framing remains visible in torn-open bays.
      parts.push({position:{...position,x:x-pitch/2+.15},scale:{x:.22,y:.2,z:length+.1},rotationX,finish:"frame"});
      const missing = (bay === 2 || bay === 5) && segment >= 1 && segment <= 4;
      if (!missing) parts.push({position,scale:{x:pitch-.34,y:.16,z:length-.14},rotationX,finish:(bay===0||bay===7)&&segment===2?"paint":"hull"});
    }
  }
  return parts;
}
