import {PG_BALANCE,pgCapsuleClear,pgRayBox,type PgMap,type PgSolid,type Vec3} from "@planetfall/shared";

const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
interface Footprint {minX:number;maxX:number;minZ:number;maxZ:number;}
interface NavigationSolid extends Footprint {solid:PgSolid;top:number;supportRadius:number;}
interface FlatLevel {supports:PgSolid[];obstacles:NavigationSolid[];steps:NavigationSolid[];}
interface NavigationCell {supports:NavigationSolid[];collision:PgMap;}
const cellSize=4;
function footprintOverlaps(a:Footprint,b:Footprint):boolean {
 return a.maxX>=b.minX&&a.minX<=b.maxX&&a.maxZ>=b.minZ&&a.minZ<=b.maxZ;
}
// The same rectangular footprint used by pgCapsuleClear, swept continuously.
function intersectsFootprint(a:Vec3,b:Vec3,s:PgSolid):boolean {
 let lo=0,hi=1;
 for(const axis of footprintAxes){
  const half=s.half[axis]+PG_BALANCE.radius-.02,origin=a[axis]-s.center[axis],delta=b[axis]-a[axis];
  if(Math.abs(delta)<1e-10){if(Math.abs(origin)>=half)return false;continue;}
  const first=(-half-origin)/delta,last=(half-origin)/delta;
  lo=Math.max(lo,Math.min(first,last));hi=Math.min(hi,Math.max(first,last));if(lo>=hi)return false;
 }
 return true;
}
const footprintAxes=["x","z"] as const;
/** Shared reverse routes: every infected targeting a survivor reuses one field. */
export class PgZombieNavigation {
 private revision=-1;
 private fields=new Map<number,Map<number,number>>();
 private fieldDistances=new Map<number,Map<number,number>>();
 private nearestCache=new Map<string,number|null>();
 private supportedCache=new Map<string,boolean>();
 private blockers:PgSolid[]=[];
 private walkCache=new Map<string,boolean>();
 private incoming=new Map<number,number[]>();
 private flatLevels=new Map<number,FlatLevel>();
 private solids:NavigationSolid[]=[];
 private cells=new Map<number,Map<number,NavigationCell>>();
 constructor(private map:PgMap,private options:{groundLevelOnly?:boolean}={}){this.rebuild();}
 private rebuild():void{
  this.blockers=this.map.solids.map(s=>({...s,half:{x:s.half.x+.43,y:s.half.y,z:s.half.z+.43}}));this.fields.clear();this.fieldDistances.clear();this.nearestCache.clear();this.supportedCache.clear();this.walkCache.clear();
  this.incoming.clear();
  this.flatLevels.clear();
  this.cells.clear();
  this.solids=this.map.solids.map(solid=>{
   const {center,half}=solid,top=center.y+half.y,level=this.flatLevels.get(top)??{supports:[],obstacles:[],steps:[]};
   level.supports.push(solid);this.flatLevels.set(top,level);
   return {solid,top,supportRadius:solid.kind==="stair"?PG_BALANCE.radius-.01:PG_BALANCE.radius*.65,
    minX:center.x-half.x,maxX:center.x+half.x,minZ:center.z-half.z,maxZ:center.z+half.z};
  });
  for(const [y,level] of this.flatLevels){
   level.obstacles=this.solids.filter(({solid:s,top})=>y<top-.025&&y+PG_BALANCE.height>s.center.y-s.half.y+.025);
   level.steps=level.obstacles.filter(({top})=>top<=y+.400001);
  }
  // Every sample only needs solids within standing capsule distance. The full
  // shared capsule test and rounded stair support test still decide contact.
  for(const solid of this.solids){
   const radius=PG_BALANCE.radius;
   for(let x=Math.floor((solid.minX-radius)/cellSize);x<=Math.floor((solid.maxX+radius)/cellSize);x++){
    let row=this.cells.get(x);
    if(!row){row=new Map();this.cells.set(x,row);}
    for(let z=Math.floor((solid.minZ-radius)/cellSize);z<=Math.floor((solid.maxZ+radius)/cellSize);z++){
     let cell=row.get(z);
     if(!cell){cell={supports:[],collision:{...this.map,solids:[]}};row.set(z,cell);}
     cell.supports.push(solid);
     cell.collision.solids.push(solid.solid);
    }
   }
  }
  for(const node of this.map.navigation)for(const edge of node.links){
   const target=this.map.navigation[edge.to];
   // Walk links are authored for the full movement repertoire. Infected cannot
   // jump or mantle, and a ray at chest height misses low obstacles and risers.
   if(edge.kind!=="walk"||!target||!this.walkable(node.position,target.position))continue;
   const entries=this.incoming.get(target.id)??[];entries.push(node.id);this.incoming.set(target.id,entries);
  }
  // Connect stair feet to actual nearby ground approaches. The shared graph may
  // anchor a flight across a wall (or a closed quarantine door).
  for(const a of this.map.navigation)for(const b of this.map.navigation){
   if(a.id===b.id||a.position.y===0&&b.position.y===0||Math.abs(a.position.y-b.position.y)>.45||distance(a.position,b.position)>8)continue;
   if(!this.walkable(a.position,b.position))continue;
   const entries=this.incoming.get(b.id)??[];if(!entries.includes(a.id))entries.push(a.id);this.incoming.set(b.id,entries);
  }
 }
 update(map:PgMap,revision:number):void{if(revision!==this.revision){this.map=map;this.revision=revision;this.rebuild();}}
 private cellAt(position:Vec3):NavigationCell|undefined {
  return this.cells.get(Math.floor(position.x/cellSize))?.get(Math.floor(position.z/cellSize));
 }
 /** Follow support heights along a capsule corridor, including both stair directions. */
 private walkable(a:Vec3,b:Vec3):boolean {
  const key=`${a.x},${a.y},${a.z}:${b.x},${b.y},${b.z}`,cached=this.walkCache.get(key);if(cached!==undefined)return cached;
  const result=this.corridor(a,b);if(this.walkCache.size>=2048)this.walkCache.clear();this.walkCache.set(key,result);return result;
 }
 private corridor(a:Vec3,b:Vec3):boolean {
  const radius=PG_BALANCE.radius;
  const footprint={minX:Math.min(a.x,b.x)-radius,maxX:Math.max(a.x,b.x)+radius,minZ:Math.min(a.z,b.z)-radius,maxZ:Math.max(a.z,b.z)+radius};
  // Most pursuits stay on the orbital deck or one gallery. A convex support
  // covering both ends supports the entire segment; sweep its full capsule
  // against preselected height blockers instead of sampling every 16cm.
  const level=a.y===b.y?this.flatLevels.get(a.y):undefined;
  if(level&&level.supports.some(s=>Math.abs(a.x-s.center.x)<=s.half.x&&Math.abs(a.z-s.center.z)<=s.half.z&&Math.abs(b.x-s.center.x)<=s.half.x&&Math.abs(b.z-s.center.z)<=s.half.z)){
   if(!level.obstacles.some(s=>footprintOverlaps(footprint,s)&&intersectsFootprint(a,b,s.solid)))return true;
   // Tactical ground routes go around stair flights. A same-height shortcut
   // must not silently climb a tread and drop off its rounded corner.
   if(this.options.groundLevelOnly&&a.y===0)return false;
   // Without a first climbable riser there is no way to gain height before
   // the blocking solid. Only actual step routes need the sampled fallback.
   if(!level.steps.some(s=>footprintOverlaps(footprint,s)&&intersectsFootprint(a,b,s.solid)))return false;
  }
  const runX=b.x-a.x,runZ=b.z-a.z;
  const steps=Math.max(1,Math.ceil(Math.hypot(runX,runZ)/.16));
  let y=a.y;
  const origin=this.cellAt(a);
  if(origin&&!pgCapsuleClear(a,PG_BALANCE.height,origin.collision))return false;
  for(let i=1;i<=steps;i++){
   const t=i/steps,p={x:a.x+runX*t,y,z:a.z+runZ*t};let support=-Infinity;
   const cell=this.cellAt(p);
   if(!cell)return false;
   for(const {solid:s,top,supportRadius} of cell.supports){
    if(top>y+.400001||top<=support)continue;
    const dx=Math.max(0,Math.abs(p.x-s.center.x)-s.half.x),dz=Math.max(0,Math.abs(p.z-s.center.z)-s.half.z);
    if(dx*dx+dz*dz<=supportRadius*supportRadius)support=top;
   }
   if(!Number.isFinite(support)||support<y-.65)return false;
   p.y=support;if(!pgCapsuleClear(p,PG_BALANCE.height,cell.collision))return false;y=support;
  }
  return Math.abs(y-b.y)<.25;
 }
 /** Physical connector check, including the selected route policy. */
 connects(a:Vec3,b:Vec3):boolean {return this.walkable(a,b);}
 nearest(position:Vec3):number|null {
  const key=`${position.x},${position.y},${position.z}`;
  if(this.nearestCache.has(key))return this.nearestCache.get(key)!;
  const nodes=this.map.navigation.map(n=>({n,d:distance(position,n.position)})).sort((a,b)=>a.d-b.d);
  let nearest:number|null=null;for(const {n}of nodes)if(this.walkable(position,n.position)){nearest=n.id;break;}
  if(this.nearestCache.size>=512)this.nearestCache.clear();this.nearestCache.set(key,nearest);return nearest;
 }
 clear(a:Vec3,b:Vec3):boolean {
  const from={...a,y:a.y+.9},to={...b,y:b.y+.9},n=distance(from,to);if(n<.01)return true;
  const dir={x:(to.x-from.x)/n,y:(to.y-from.y)/n,z:(to.z-from.z)/n};
  return !this.blockers.some(s=>{const hit=pgRayBox(from,dir,s);return hit!==null&&hit<n-.05;});
 }
 field(goal:number):Map<number,number> {
  const cached=this.fields.get(goal);if(cached)return cached;
  const field=new Map<number,number>([[goal,goal]]),distances=new Map<number,number>([[goal,0]]),queue=[goal];
  for(let i=0;i<queue.length;i++)for(const previous of this.incoming.get(queue[i])??[]){if(field.has(previous))continue;field.set(previous,queue[i]);distances.set(previous,distances.get(queue[i])!+distance(this.map.navigation[previous].position,this.map.navigation[queue[i]].position));queue.push(previous);}
  if(this.fields.size>12){this.fields.clear();this.fieldDistances.clear();}this.fields.set(goal,field);this.fieldDistances.set(goal,distances);return field;
 }
 reachable(from:Vec3,to:Vec3):boolean {if(this.walkable(from,to))return true;const a=this.nearest(from),b=this.nearest(to);return a!==null&&b!==null&&this.walkable(this.map.navigation[b].position,to)&&this.field(b).has(a);}
 destination(from:Vec3,to:Vec3):Vec3|null {
  if(this.walkable(from,to))return to;
  const goal=this.nearest(to);if(goal===null)return null;
  this.field(goal);
  // Compare the complete remaining route, rather than snapping back to the
  // nearest anchor as its Voronoi boundary changes mid-edge. A previously
  // selected corridor stays a candidate while we walk it, with decreasing
  // remaining length. Fields and their costs are shared; no actor route state
  // can leak between infected, survivors, goals, or topology revisions.
  const candidates=[...this.fieldDistances.get(goal)!].map(([id,remaining])=>({id,remaining,cost:distance(from,this.map.navigation[id].position)+remaining})).sort((a,b)=>a.cost-b.cost||a.remaining-b.remaining);
  for(const {id} of candidates){const target=this.map.navigation[id].position;if(this.walkable(from,target))return target;}
  return null;
 }
 supported(position:Vec3):boolean {
  const key=`${position.x},${position.y},${position.z}`,cached=this.supportedCache.get(key);if(cached!==undefined)return cached;
  const cell=this.cellAt(position);
  const supported=!!cell&&pgCapsuleClear(position,1.8,cell.collision)&&cell.collision.solids.some(s=>Math.abs(s.center.y+s.half.y-position.y)<.25&&Math.abs(s.center.x-position.x)<=s.half.x&&Math.abs(s.center.z-position.z)<=s.half.z);
  if(this.supportedCache.size>=512)this.supportedCache.clear();this.supportedCache.set(key,supported);return supported;
 }
}
