import { BR_LOOT_SOCKETS, type BrStructure, type Vec3 } from "@planetfall/shared";

export type IndustrialPart = { position: Vec3; scale: Vec3; finish: "frame" | "paint" | "metal" | "glass"; rotationZ?: number };

/** Original 2.3m mast footprint and 24m height retained; all overhangs are
 * above the occupied ground-level loading lanes. */
export function buildCargoCrane(direction: -1 | 1): IndustrialPart[] {
  const parts:IndustrialPart[]=[];
  const add=(finish:IndustrialPart["finish"],x:number,y:number,z:number,w:number,h:number,d:number,rotationZ=0)=>
    parts.push({finish,position:{x:x*direction,y,z},scale:{x:w,y:h,z:d},rotationZ:rotationZ*direction});
  const diagonal=(x1:number,y1:number,x2:number,y2:number,z:number,thickness:number,finish:IndustrialPart["finish"]="metal")=>{
    const dx=x2-x1,dy=y2-y1;
    add(finish,(x1+x2)/2,(y1+y2)/2,z,thickness,Math.hypot(dx,dy),thickness,-Math.atan2(dx,dy));
  };
  for(const x of [-.9,.9])for(const z of [-.9,.9])add("frame",x,12,z,.35,24,.35);
  for(let level=0;level<6;level++) {
    const y=level*4;
    for(const z of [-.92,.92]) {add("paint",0,y+.22,z,2.1,.28,.28);diagonal(-.82,y+.35,.82,y+3.8,z,.18);}
    for(const x of [-.92,.92])add("metal",x,y+2,0,.16,.2,2);
  }
  // Open truss boom with trolley track and a rear counterweight.
  for(const z of [-.75,.75]) {
    add("paint",5.1,22.3,z,25,.32,.25);add("paint",5.1,24,z,25,.32,.25);
    for(let bay=0;bay<10;bay++) {
      const bx=-7.2+bay*2.5;
      diagonal(bx,22.5,bx+2.35,23.8,z,.14);
    }
  }
  add("frame",6,22.1,0,23,.18,.3);
  add("metal",-5.5,22.9,0,3.8,1.2,2.1);
  add("frame",2.5,20.9,0,3.5,2.2,2.7);
  add("glass",2.6,21.15,-1.37,2.6,1.3,.08);
  add("glass",2.6,21.15,1.37,2.6,1.3,.08);
  add("paint",2.5,22.08,0,3.8,.2,2.95);
  add("metal",14.5,21.8,0,2.2,.65,2.3);
  for(const z of [-.8,.8])add("frame",14.5,17.2,z,.065,9,.065);
  add("paint",14.5,12.55,0,3.8,.28,2.5);
  return parts;
}

/** Roof machinery is kept in narrow service strips rather than a giant
 * blank raised slab. No machinery over authored aerial loot sockets. */
export function buildIndustrialRoof(structure: BrStructure): IndustrialPart[] {
  if(!["warehouse","hangar"].includes(structure.archetype))return [];
  const parts:IndustrialPart[]=[];
  const {x,z}=structure.position, roof=structure.size.y;
  for(const side of [-1,1])for(const fraction of [-.22,.22]) {
    const cx=x+side*structure.size.x*.34,cz=z+fraction*structure.size.z;
    const w=Math.min(4.4,structure.size.x*.16),d=Math.min(6,structure.size.z*.2);
    if(BR_LOOT_SOCKETS.some(s=>s.structureId===structure.id&&s.kind==="roof"&&Math.abs(s.position.x-cx)<w/2+1.1&&Math.abs(s.position.z-cz)<d/2+1.1))continue;
    const add=(finish:IndustrialPart["finish"],dx:number,y:number,dz:number,sx:number,sy:number,sz:number)=>parts.push({finish,position:{x:cx+dx,y:roof+y,z:cz+dz},scale:{x:sx,y:sy,z:sz}});
    add("frame",0,.4,0,w,.65,d);
    add("metal",0,.78,0,w+.1,.12,d+.1);
    for(let slat=0;slat<6;slat++)add("frame",0,.86,(slat-2.5)*d/7,w*.84,.06,.13);
    add("paint",-w*.4,.79,0,.13,.15,d*.8);
  }
  return parts;
}
