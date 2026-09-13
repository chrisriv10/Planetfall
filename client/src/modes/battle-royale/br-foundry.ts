import type { BrStructure, Vec3 } from "@planetfall/shared";

export type FoundryPart = {
  position: Vec3; scale: Vec3; rotationX?: number; rotationZ?: number;
  shape: "box" | "barrel" | "bell" | "ring";
  finish: "frame" | "shell" | "metal" | "paint" | "energy";
};

/** Rooftop engine-test racks. A clear central aisle and perimeter preserve
 * the authored roof loot and stair arrival. Cylinders use their local Y axis;
 * rings use their local Z axis. All dimensions are world metres. */
export function buildFoundryEngines(structure: BrStructure): FoundryPart[] {
  const parts: FoundryPart[] = [];
  const add = (shape:FoundryPart["shape"],finish:FoundryPart["finish"],x:number,y:number,z:number,w:number,h:number,d:number,rotationX=0,rotationZ=0)=>
    parts.push({shape,finish,position:{x:structure.position.x+x,y:structure.size.y+y,z:structure.position.z+z},scale:{x:w,y:h,z:d},rotationX,rotationZ});
  for(const side of [-1,1]) {
    const x=side*13;
    // Thin test-stand legs, not a solid volume covering the roof.
    for(const dx of [-2.9,2.9])for(const z of [-6,6]) {
      add("box","frame",x+dx,1.8,z,.42,3.1,.5);
      add("box","metal",x+dx,.31,z,1,.18,1.3);
    }
    for(const z of [-6,6])add("box","frame",x,3.45,z,8.3,.35,.65);
    add("barrel","shell",x,7,-2,3.8,12,3.8,Math.PI/2);
    add("bell","metal",x,7,6.3,3.8,4.6,3.8,Math.PI/2);
    for(const z of [-7,-3,1,4])add("ring","metal",x,7,z,3.82,3.82,.3);
    add("ring","paint",x,7,8.65,3.95,3.95,.4);
    // A recessed dark face and restrained energized inner rim read as a nozzle,
    // rather than another bright solid sphere or glowing cylinder.
    add("barrel","frame",x,7,8.35,3.7,.12,3.7,Math.PI/2);
    add("ring","energy",x,7,8.46,2.25,2.25,.12);
    add("barrel","metal",x,7,8.5,.64,.18,.64,Math.PI/2);
    for(let blade=0;blade<8;blade++) {
      const angle=blade*Math.PI/4;
      add("box","metal",x+Math.cos(angle)*1.3,7+Math.sin(angle)*1.3,8.49,2.1,.15,.09,0,angle+.3);
    }
    for(const dx of [-1.9,1.9])add("box","paint",x+dx,10.4,-2,.3,.2,8.8);
    // Upper casing fins are visually readable without competing with the nozzle.
    for(const z of [-5.5,-3.5,-1.5,.5])add("box","frame",x,10.7,z,4.1,.35,.22);
  }
  return parts;
}
