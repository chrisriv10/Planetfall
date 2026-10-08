import { Euler, Vector3 } from "three";

type Point = { x: number; z: number };
type Box = { position: Point & { y: number }; size: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number } };
const cross = (a: Point, b: Point, c: Point) => (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);

/** Test-only exact horizontal projection of an XYZ-rotated box. Sphere/AABB
 * broad phases overestimate long diagonal road grades by tens of metres. */
export function projectedBlock(block: Box) {
  const r=block.rotation,rotation=new Euler(r?.x??0,r?.y??0,r?.z??0,"XYZ");
  const corners: Vector3[]=[];
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])
    corners.push(new Vector3(x*block.size.x/2,y*block.size.y/2,z*block.size.z/2).applyEuler(rotation).add(new Vector3(block.position.x,block.position.y,block.position.z)));
  const points=corners.slice().sort((a,b)=>a.x-b.x||a.z-b.z);
  const half=(sequence: Point[])=>{const result:Point[]=[];for(const p of sequence){while(result.length>=2&&cross(result.at(-2)!,result.at(-1)!,p)<=0)result.pop();result.push(p);}return result;};
  const lower=half(points),upper=half(points.slice().reverse());
  const hull=[...lower.slice(0,-1),...upper.slice(0,-1)];
  return { hull, bottom:Math.min(...corners.map(p=>p.y)), top:Math.max(...corners.map(p=>p.y)) };
}

/** Floors entirely below the actual world-space art are supports, not walls.
 * Elevated blocks above it are also separate; intersecting ramps stay checked. */
export function blockClearance(p:Point,bottom:number,top:number,block:Box):number {
  const projected=projectedBlock(block);
  if(projected.top<=bottom+1e-8||projected.bottom>=top-1e-8)return Infinity;
  let inside=true,distance=Infinity;
  for(let i=0;i<projected.hull.length;i++){
    const a=projected.hull[i],b=projected.hull[(i+1)%projected.hull.length];
    if(cross(a,b,p)<0)inside=false;
    const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
    const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/length)):0;
    distance=Math.min(distance,Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t));
  }
  return inside?0:distance;
}

export function partHeightBounds(parts:readonly {position:{y:number};scale:{y:number};geometry:string}[],offset=0){
  return {bottom:Math.min(...parts.map(p=>p.position.y-p.scale.y*(p.geometry==="octahedron"?1:.5)))+offset,
    top:Math.max(...parts.map(p=>p.position.y+p.scale.y*(p.geometry==="octahedron"?1:.5)))+offset};
}
