import { BR_MAP_BLOCKS, type BrMapBlock, type BrStructure, type Vec3 } from "@planetfall/shared";

export type ReactorInteriorFinish = "frame" | "panel" | "energy" | "warning";
export interface ReactorInteriorPart { finish: ReactorInteriorFinish; position: Vec3; scale: Vec3 }
export interface ReactorInteriorBounds { readonly min:Readonly<Vec3>; readonly max:Readonly<Vec3> }

/** Visual-only control hardware supported by Helios Core's literal back wall.
 * A whole bay is omitted if existing dressing or authoritative stairs block it.
 * The source structure must retain world Y; output/forbidden use local Y. */
export function buildReactorInterior(structure: BrStructure, forbidden:readonly ReactorInteriorBounds[]=[], blocks:readonly BrMapBlock[]=BR_MAP_BLOCKS): ReactorInteriorPart[] {
  if (structure.id !== "helios-core" || structure.districtId !== "helios-reactor" || !structure.enterable) return [];
  const dividerZ = structure.position.z + structure.size.z * .18;
  const faceZ = dividerZ - .29;
  const parts: ReactorInteriorPart[] = [];
  const add = (finish: ReactorInteriorFinish, x: number, y: number, width: number, height: number, depth = .08) => {
    const layer = finish === "energy" || finish === "warning" ? .14 : finish === "frame" ? .08 : .02;
    parts.push({ finish, position: { x, y, z: faceZ - layer }, scale: { x: width, y: height, z: depth } });
  };

  // Legacy mirrored bay descriptors supply the retained control-panel shapes.
  // Below, only the left bay is fitted to the literal authoritative back wall.
  for (const side of [-1, 1]) {
    const center = structure.position.x + side * 9.2;
    add("frame", center, 4.72, 8.2, .18, .18);
    add("frame", center, 1.38, 8.2, .18, .18);
    add("frame", center - 4.01, 3.05, .18, 3.52, .18);
    add("frame", center + 4.01, 3.05, .18, 3.52, .18);
    add("panel", center, 3.05, 7.65, 2.92, .11);
    add("energy", center, 4.25, 6.85, .12, .04);
    add("warning", center, 1.88, 6.85, .09, .04);
    for (let column = -1; column <= 1; column++) {
      add("frame", center + column * 2.05, 3.12, 1.52, 1.72, .14);
      add(column === 0 ? "energy" : "warning", center + column * 2.05, 3.3, 1.15, .72, .035);
      for (let row = 0; row < 2; row++) add("energy", center + column * 2.05, 2.7 - row * .25, .82, .055, .035);
    }
  }
  // Narrow vertical bus bars visually connect the controls to the reactor's
  // overhead systems without appearing to be extra cover.
  for (const x of [-14.7, -3.25, 3.25, 14.7]) {
    add("frame", structure.position.x + x, 5.45, .28, 2.25, .12);
    add("energy", structure.position.x + x, 5.45, .09, 1.88, .035);
  }
  // The old divider was removed from the authoritative tower plan. Mount a
  // compact left control bay on its literal back wall instead. Inputs use
  // world structure/block elevations; forbidden bounds and output use local Y.
  const wall=blocks.find(b=>b.id===`${structure.id}-back`&&b.kind==="wall"&&!b.rotation);
  if(!wall)return [];
  const wallFace=wall.position.z-wall.size.z/2;
  const center=structure.position.x-9.2;
  const candidate=parts.slice(0,19).map(p=>({ ...p,
    position:{x:center+(p.position.x-center)*.8,y:p.position.y+4,
      z:wallFace-(p.finish==="panel"?.057:p.finish==="frame"?.102:.2)},
    scale:{...p.scale,x:p.scale.x*.8}
  }));
  // Two existing bus pairs accompany this bay only; all right-bay hardware is
  // omitted. No extra parts, materials, lights or authoritative cover.
  for(const dx of [-3.55,3.55]){
    candidate.push({finish:"frame",position:{x:center+dx,y:9.45,z:wallFace-.062},scale:{x:.28,y:2.25,z:.12}});
    candidate.push({finish:"energy",position:{x:center+dx,y:9.45,z:wallFace-.135},scale:{x:.09,y:1.88,z:.025}});
  }
  const bounds=(p:ReactorInteriorPart):ReactorInteriorBounds=>({min:{x:p.position.x-p.scale.x/2,y:p.position.y-p.scale.y/2,z:p.position.z-p.scale.z/2},max:{x:p.position.x+p.scale.x/2,y:p.position.y+p.scale.y/2,z:p.position.z+p.scale.z/2}});
  const overlap=(a:ReactorInteriorBounds,b:ReactorInteriorBounds)=> (["x","y","z"] as const).every(k=>a.max[k]>b.min[k]-.08&&a.min[k]<b.max[k]+.08);
  const stairs=blocks.filter(b=>b.id.startsWith(`${structure.id}-stairs-`)).map(b=>{
    const angle=b.rotation?.x??0,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
    return bounds({finish:"frame",position:{...b.position,y:b.position.y-structure.position.y},scale:{x:b.size.x,y:c*b.size.y+s*b.size.z,z:s*b.size.y+c*b.size.z}});
  });
  if(candidate.some(p=>{const b=bounds(p);return b.min.x<wall.position.x-wall.size.x/2||b.max.x>wall.position.x+wall.size.x/2||
    b.min.y<wall.position.y-structure.position.y-wall.size.y/2||b.max.y>wall.position.y-structure.position.y+wall.size.y/2||
    [...stairs,...forbidden].some(obstacle=>overlap(b,obstacle));}))return [];
  return candidate;
}
