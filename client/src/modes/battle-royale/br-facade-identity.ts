import type { BrStructure } from "@planetfall/shared";
type Point = Readonly<{x:number;y:number;z:number}>;
export interface BrIdentityPart {readonly finish:string;readonly face:BrStructure["entrance"];readonly position:Point;readonly scale:Point}
export interface BrIdentityBounds {readonly min:Point;readonly max:Point}
export interface BrFacadeIdentityReplacement {index:number;route:"led";part:BrIdentityPart}
export const brIdentityBounds=(p:BrIdentityPart):BrIdentityBounds=>({min:{x:p.position.x-p.scale.x/2,y:p.position.y-p.scale.y/2,z:p.position.z-p.scale.z/2},max:{x:p.position.x+p.scale.x/2,y:p.position.y+p.scale.y/2,z:p.position.z+p.scale.z/2}});
const axes=["x","y","z"] as const;
const valid=(b:BrIdentityBounds)=>axes.every(k=>Number.isFinite(b.min[k])&&Number.isFinite(b.max[k])&&b.min[k]<b.max[k]);
const overlap=(a:BrIdentityBounds,b:BrIdentityBounds,m:number)=>axes.every(k=>a.max[k]>b.min[k]-m+1e-9&&a.min[k]<b.max[k]+m-1e-9);
const same=(a:BrIdentityBounds,b:BrIdentityBounds)=>axes.every(k=>Math.abs(a.min[k]-b.min[k])<1e-9&&Math.abs(a.max[k]-b.max[k])<1e-9);

/** WORLD X/Z and BUILDING-LOCAL Y for every input. `parts` is full skin;
 * `posts` contains actual entrance posts only, `walls` authoritative entrance
 * wall solids. Supply every other frame/sign/attachment as forbidden. Only the
 * selected mount's identical bounds are exempt; the opposite post is checked.
 * Glazing clearance .08m; other attachments .02m. Replace output indices, never
 * append: these .002m-separated surface coats own no resources or collisions. */
export function selectBrFacadeIdentityReplacements(structure:Readonly<BrStructure>,parts:readonly BrIdentityPart[],posts:readonly BrIdentityPart[],walls:readonly BrIdentityBounds[],forbidden:readonly BrIdentityBounds[]=[]):BrFacadeIdentityReplacement[]{
 if(!structure.enterable)return [];
 const face=structure.entrance,ns=face==="north"||face==="south",along=ns?"x":"z",normal=ns?"z":"x";
 const sign=face==="north"||face==="east"?1:-1,origin=structure.position[along],plane=structure.position[normal]+sign*structure.size[normal]/2;
 const result:BrFacadeIdentityReplacement[]=[];
 for(const side of [-1,1]){
  const index=parts.findIndex(p=>p.finish==="accent"&&p.face===face&&Math.sign(p.position[along]-origin)===side);if(index<0)continue;
  const mounts=posts.filter(p=>p.face===face&&Math.sign(p.position[along]-origin)===side).sort((a,b)=>Math.abs(a.position[along]-origin)-Math.abs(b.position[along]-origin));
  for(const post of mounts){
   const mount=brIdentityBounds(post);
   if(!valid(mount)||post.scale[along]<.12-1e-9||Math.abs(post.position[along]-origin)>3||mount.min.y>1.1||mount.max.y<2.5)continue;
   const position={...post.position,y:1.8},scale={x:.02,y:1.4,z:.02};scale[along]=.08;position[normal]=post.position[normal]+sign*(post.scale[normal]/2+.012);
   const part:BrIdentityPart={...parts[index],position,scale},bounds=brIdentityBounds(part);
   if(Math.abs(position[along]-origin)-.04<2.43-1e-9)continue;
   if(!walls.some(w=>valid(w)&&w.min[normal]<=plane+.001&&w.max[normal]>=plane-.001&&bounds.min[along]>=w.min[along]-1e-9&&bounds.max[along]<=w.max[along]+1e-9&&bounds.min.y>=w.min.y&&bounds.max.y<=w.max.y))continue;
   if(parts.some(p=>p.face===face&&(p.finish==="glass"||p.finish==="lit")&&overlap(bounds,brIdentityBounds(p),.08)))continue;
   if(forbidden.some(b=>!same(b,mount)&&overlap(bounds,b,.02)))continue;
   if(posts.some(p=>p!==post&&overlap(bounds,brIdentityBounds(p),.02)))continue;
   result.push({index,route:"led",part});break;
  }
 }
 return result;
}
