import {PG_BALANCE as B} from "./balance.js";
import type {PgMap,PgNavNode,PgSolid} from "./types.js";

/** Structural subset avoids importing collision snapshot code back into navigation. */
export interface PgGroundNavigationPanel {id:string;active:boolean;solid:PgSolid;}
const EPS=1e-6;
const CLEARANCE=B.radius+.04;
const MAX_LINK_DISTANCE=12;

/** A ground standing body swept along a segment, including both endpoints.
 * Shrinking the expanded obstacle by epsilon excludes floor contact and exact
 * tangency; the additional .04m horizontal clearance remains conservative.
 */
function blocked(ax:number,az:number,bx:number,bz:number,solids:readonly PgSolid[]):boolean {
 for(const solid of solids){
  if(solid.center.y+solid.half.y<=EPS||solid.center.y-solid.half.y>=B.height-EPS)continue;
  let enter=0,exit=1;
  const minX=solid.center.x-solid.half.x-CLEARANCE+EPS,maxX=solid.center.x+solid.half.x+CLEARANCE-EPS,dx=bx-ax;
  if(Math.abs(dx)<EPS){if(ax<minX||ax>maxX)continue;}
  else {const t0=(minX-ax)/dx,t1=(maxX-ax)/dx;enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1));if(enter>exit)continue;}
  const minZ=solid.center.z-solid.half.z-CLEARANCE+EPS,maxZ=solid.center.z+solid.half.z+CLEARANCE-EPS,dz=bz-az;
  if(Math.abs(dz)<EPS){if(az<minZ||az>maxZ)continue;}
  else {const t0=(minZ-az)/dz,t1=(maxZ-az)/dz;enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1));}
  if(enter<=exit)return true;
 }
 return false;
}

/** Adds ground-only visibility corners to an already-pruned authored graph.
 * Call only when collision topology changes. Existing nodes/links are retained
 * in order, without mutation; only links incident to appended nodes are added.
 * With P panels, G ground nodes and S solids, at most 4P nodes are appended;
 * construction costs O(N + E + P log P + (P + PG + P²)S), including cloning
 * N authored nodes and E links. There is no gameplay panel-count cap.
 */
export function pgAddGroundPanelBypasses(map:PgMap,solids:readonly PgSolid[],panels:readonly PgGroundNavigationPanel[]):PgNavNode[] {
 const active=panels.filter(p=>p.active&&p.solid.center.y-p.solid.half.y<=EPS&&p.solid.center.y+p.solid.half.y>EPS)
  .sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 if(!active.length)return map.navigation;
 const navigation=map.navigation.map(n=>({...n,position:{...n.position},links:n.links.map(l=>({...l}))}));
 let nextId=map.navigation.reduce((max,n)=>Math.max(max,n.id),-1)+1;
 for(const panel of active){
  const {center,half}=panel.solid;
  for(const [sx,sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
   const x=center.x+sx*(half.x+CLEARANCE),z=center.z+sz*(half.z+CLEARANCE);
   if(Math.abs(x)>map.halfWidth-B.radius||Math.abs(z)>map.halfDepth-B.radius)continue;
   // Require the complete standing footprint on an existing ground surface.
   if(!solids.some(s=>Math.abs(s.center.y+s.half.y)<=EPS&&Math.abs(x-s.center.x)+B.radius<=s.half.x+EPS&&Math.abs(z-s.center.z)+B.radius<=s.half.z+EPS))continue;
   if(blocked(x,z,x,z,solids))continue;
   const node:PgNavNode={id:nextId++,position:{x,y:0,z},links:[]};
   for(const other of navigation){
    if(other.position.y!==0)continue;
    const distance=Math.hypot(x-other.position.x,z-other.position.z);
    if(distance<.1||distance>MAX_LINK_DISTANCE||blocked(x,z,other.position.x,other.position.z,solids))continue;
    node.links.push({to:other.id,kind:"walk"});other.links.push({to:node.id,kind:"walk"});
   }
   navigation.push(node);
  }
 }
 return navigation;
}
