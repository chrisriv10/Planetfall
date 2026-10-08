import { BR_ELEVATION_REGIONS, BR_SECONDARY_GRADE_REGIONS, type BrTerrainPatch, type Vec3 } from "@planetfall/shared";

export interface BrTerrainSupportRegion { id:string;x:number;z:number;width:number;depth:number;height:number; }
export interface BrTerrainSurfaceFragment {
  patchId:string;
  regionId:string|undefined;
  deckHeight:number;
  vertices:Vec3[];
  /** Normalized original-patch coordinates; continuous across fragment seams. */
  uvs:{u:number;v:number}[];
  /** Upward-facing triangles indexing vertices. No triangle crosses a height seam. */
  indices:number[];
}
export const BR_TERRAIN_SURFACE_LIFT=.018;
const DEFAULT_REGIONS:readonly BrTerrainSupportRegion[]=[...BR_ELEVATION_REGIONS,...BR_SECONDARY_GRADE_REGIONS];
type Point={x:number;z:number};
const area=(polygon:readonly Point[])=>Math.abs(polygon.reduce((sum,p,i)=>{
  const q=polygon[(i+1)%polygon.length];return sum+p.x*q.z-q.x*p.z;
},0))/2;

function clip(polygon:readonly Point[],axis:"x"|"z",bound:number,positive:boolean):Point[]{
  const result:Point[]=[];
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=(a[axis]-bound)*(positive?1:-1),db=(b[axis]-bound)*(positive?1:-1);
    if(da>=0)result.push({...a});
    if((da>0&&db<0)||(da<0&&db>0)){
      const t=da/(da-db),p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
      p[axis]=bound;result.push(p);
    }
  }
  return result.filter((p,i)=>{const previous=result[(i+result.length-1)%result.length];return Math.hypot(p.x-previous.x,p.z-previous.z)>1e-10;});
}

/** Pure presentation polygons: preserve the rotated footprint, partition it at
 * real deck boundaries, and finish each floor at +.018m. Aprons are deliberately
 * excluded: they are road grades, not supporting terrain. Positive overlaps
 * use the upper deck; a negative region cuts the otherwise zero-height floor.
 * Build one BufferGeometry per patch from the fragment indices/vertices/UVs;
 * world-space output needs no patch translation or rotation. No vertical skirts,
 * authority, collision, materials, GPU resources or per-frame work are added. */
export function buildBrTerrainSurface(patch:BrTerrainPatch,regions:readonly BrTerrainSupportRegion[]=DEFAULT_REGIONS):BrTerrainSurfaceFragment[]{
  if(![patch.position.x,patch.position.z,patch.size.x,patch.size.z,patch.rotation].every(Number.isFinite)||patch.size.x<=0||patch.size.z<=0)return [];
  const cos=Math.cos(patch.rotation),sin=Math.sin(patch.rotation);
  const footprint=([[-1,-1],[1,-1],[1,1],[-1,1]] as const).map(([sx,sz])=>({
    x:patch.position.x+cos*sx*patch.size.x/2+sin*sz*patch.size.z/2,
    z:patch.position.z-sin*sx*patch.size.x/2+cos*sz*patch.size.z/2,
  }));
  let remaining:Point[][]=[footprint];
  const result:BrTerrainSurfaceFragment[]=[];
  const emit=(polygon:Point[],height:number,regionId?:string)=>{
    if(polygon.length<3||area(polygon)<1e-9)return;
    const indices:number[]=[];
    for(let i=1;i<polygon.length-1;i++)indices.push(0,i+1,i);
    result.push({patchId:patch.id,regionId,deckHeight:height,
      vertices:polygon.map(p=>({...p,y:height+BR_TERRAIN_SURFACE_LIFT})),
      uvs:polygon.map(p=>{const dx=p.x-patch.position.x,dz=p.z-patch.position.z;return {u:(dx*cos-dz*sin)/patch.size.x+.5,v:(dx*sin+dz*cos)/patch.size.z+.5};}),indices});
  };
  const ordered=regions.filter(r=>[r.x,r.z,r.width,r.depth,r.height].every(Number.isFinite)&&r.width>0&&r.depth>0)
    .slice().sort((a,b)=>b.height-a.height||a.id.localeCompare(b.id));
  for(const region of ordered){
    const x0=region.x-region.width/2,x1=region.x+region.width/2,z0=region.z-region.depth/2,z1=region.z+region.depth/2;
    const next:Point[][]=[];
    for(const polygon of remaining){
      if(polygon.every(p=>p.x<=x0)||polygon.every(p=>p.x>=x1)||polygon.every(p=>p.z<=z0)||polygon.every(p=>p.z>=z1)){next.push(polygon);continue;}
      let inside=polygon;
      // Peel disjoint outside pieces before keeping the rectangular intersection.
      for(const [axis,bound,positive] of [["x",x0,true],["x",x1,false],["z",z0,true],["z",z1,false]] as const){
        const outside=clip(inside,axis,bound,!positive);
        if(outside.length>=3&&area(outside)>=1e-9)next.push(outside);
        inside=clip(inside,axis,bound,positive);
        if(inside.length<3)break;
      }
      emit(inside,region.height,region.id);
    }
    remaining=next;
  }
  for(const polygon of remaining)emit(polygon,0);
  return result;
}
