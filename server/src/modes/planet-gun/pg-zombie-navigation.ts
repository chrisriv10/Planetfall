import {PG_BALANCE,pgCapsuleClear,pgRayBox,type PgMap,type PgSolid,type Vec3} from "@planetfall/shared";

const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
interface FlatLevel {supports:PgSolid[];obstacles:PgSolid[];steps:PgSolid[];}
// The same rectangular footprint used by pgCapsuleClear, swept continuously.
function intersectsFootprint(a:Vec3,b:Vec3,s:PgSolid):boolean {
 let lo=0,hi=1;
 for(const axis of ["x","z"] as const){
  const half=s.half[axis]+PG_BALANCE.radius-.02,origin=a[axis]-s.center[axis],delta=b[axis]-a[axis];
  if(Math.abs(delta)<1e-10){if(Math.abs(origin)>=half)return false;continue;}
  const first=(-half-origin)/delta,last=(half-origin)/delta;
  lo=Math.max(lo,Math.min(first,last));hi=Math.min(hi,Math.max(first,last));if(lo>=hi)return false;
 }
 return true;
}
/** Shared reverse routes: every infected targeting a survivor reuses one field. */
export class PgZombieNavigation {
 private revision=-1;
 private fields=new Map<number,Map<number,number>>();
 private nearestCache=new Map<string,number|null>();
 private supportedCache=new Map<string,boolean>();
 private blockers:PgSolid[]=[];
 private walkCache=new Map<string,boolean>();
 private incoming=new Map<number,number[]>();
 private flatLevels=new Map<number,FlatLevel>();
 constructor(private map:PgMap){this.rebuild();}
 private rebuild():void{
  this.blockers=this.map.solids.map(s=>({...s,half:{x:s.half.x+.43,y:s.half.y,z:s.half.z+.43}}));this.fields.clear();this.nearestCache.clear();this.supportedCache.clear();this.walkCache.clear();
  this.incoming.clear();
  this.flatLevels.clear();
  for(const solid of this.map.solids){
   const y=solid.center.y+solid.half.y,level=this.flatLevels.get(y)??{supports:[],obstacles:[],steps:[]};
   level.supports.push(solid);this.flatLevels.set(y,level);
  }
  for(const [y,level] of this.flatLevels){
   level.obstacles=this.map.solids.filter(s=>y<s.center.y+s.half.y-.025&&y+PG_BALANCE.height>s.center.y-s.half.y+.025);
   level.steps=level.obstacles.filter(s=>s.center.y+s.half.y<=y+.400001);
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
 /** Follow support heights along a capsule corridor, including both stair directions. */
 private walkable(a:Vec3,b:Vec3):boolean {
  const key=`${a.x},${a.y},${a.z}:${b.x},${b.y},${b.z}`,cached=this.walkCache.get(key);if(cached!==undefined)return cached;
  const result=this.corridor(a,b);if(this.walkCache.size>=2048)this.walkCache.clear();this.walkCache.set(key,result);return result;
 }
 private corridor(a:Vec3,b:Vec3):boolean {
  // Most pursuits stay on the orbital deck or one gallery. A convex support
  // covering both ends supports the entire segment; sweep its full capsule
  // against preselected height blockers instead of sampling every 16cm.
  const level=a.y===b.y?this.flatLevels.get(a.y):undefined;
  if(level&&level.supports.some(s=>Math.abs(a.x-s.center.x)<=s.half.x&&Math.abs(a.z-s.center.z)<=s.half.z&&Math.abs(b.x-s.center.x)<=s.half.x&&Math.abs(b.z-s.center.z)<=s.half.z)){
   if(!level.obstacles.some(s=>intersectsFootprint(a,b,s)))return true;
   // Without a first climbable riser there is no way to gain height before
   // the blocking solid. Only actual step routes need the sampled fallback.
   if(!level.steps.some(s=>intersectsFootprint(a,b,s)))return false;
  }
  const solids=this.map.solids.filter(s=>s.center.x+s.half.x>=Math.min(a.x,b.x)-PG_BALANCE.radius&&s.center.x-s.half.x<=Math.max(a.x,b.x)+PG_BALANCE.radius&&s.center.z+s.half.z>=Math.min(a.z,b.z)-PG_BALANCE.radius&&s.center.z-s.half.z<=Math.max(a.z,b.z)+PG_BALANCE.radius);
  const local={...this.map,solids},n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.16);let y=a.y;
  if(!pgCapsuleClear(a,PG_BALANCE.height,local))return false;
  for(let i=1;i<=Math.max(1,n);i++){
   const t=i/Math.max(1,n),p={x:a.x+(b.x-a.x)*t,y,z:a.z+(b.z-a.z)*t};let support=-Infinity;
   for(const s of solids){
    const radius=s.kind==="stair"?PG_BALANCE.radius-.01:PG_BALANCE.radius*.65;
    if(Math.hypot(Math.max(0,Math.abs(p.x-s.center.x)-s.half.x),Math.max(0,Math.abs(p.z-s.center.z)-s.half.z))>radius)continue;
    const top=s.center.y+s.half.y;if(top<=y+.400001&&top>support)support=top;
   }
   if(!Number.isFinite(support)||support<y-.65)return false;
   p.y=support;if(!pgCapsuleClear(p,PG_BALANCE.height,local))return false;y=support;
  }
  return Math.abs(y-b.y)<.25;
 }
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
  const field=new Map<number,number>([[goal,goal]]),queue=[goal];
  for(let i=0;i<queue.length;i++)for(const previous of this.incoming.get(queue[i])??[]){if(field.has(previous))continue;field.set(previous,queue[i]);queue.push(previous);}
  if(this.fields.size>12)this.fields.clear();this.fields.set(goal,field);return field;
 }
 reachable(from:Vec3,to:Vec3):boolean {if(this.walkable(from,to))return true;const a=this.nearest(from),b=this.nearest(to);return a!==null&&b!==null&&this.walkable(this.map.navigation[b].position,to)&&this.field(b).has(a);}
 destination(from:Vec3,to:Vec3):Vec3|null {
  if(this.walkable(from,to))return to;
  const start=this.nearest(from),goal=this.nearest(to);if(start===null||goal===null)return null;
  const next=this.field(goal).get(start);if(next===undefined)return null;
  const near=this.map.navigation[start].position,target=this.map.navigation[next].position;
  // Keep advancing while the next corridor is walkable. Returning to the
  // nearest anchor after leaving its radius causes permanent edge oscillation.
  return this.walkable(from,target)?target:near;
 }
 supported(position:Vec3):boolean {
  const key=`${position.x},${position.y},${position.z}`,cached=this.supportedCache.get(key);if(cached!==undefined)return cached;
  const supported=pgCapsuleClear(position,1.8,this.map)&&this.map.solids.some(s=>Math.abs(s.center.y+s.half.y-position.y)<.25&&Math.abs(s.center.x-position.x)<=s.half.x&&Math.abs(s.center.z-position.z)<=s.half.z);
  if(this.supportedCache.size>=512)this.supportedCache.clear();this.supportedCache.set(key,supported);return supported;
 }
}
