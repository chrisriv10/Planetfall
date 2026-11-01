import type {Vec3} from "../index.js";
import {PG_BALANCE as B} from "./balance.js";
import {PG_MAP} from "./map.js";
import {pgRayBox} from "./math.js";
import type {PgMap,PgSolid} from "./types.js";

export interface PgDynamicPanel {id:string;solid:PgSolid;hp:number;maxHp:number;reinforced:boolean;active:boolean;revision:number;}
/** Complete room-local state, including inactive panels so destruction is replayable. */
export interface PgCollisionSnapshot {revision:number;topologyRevision?:number;panels:PgDynamicPanel[];}
export interface PgPanelSocket {id:string;compound:"west"|"east"|"maintenance";solid:PgSolid;approaches:readonly [Vec3,Vec3];}
const panel=(id:string,compound:PgPanelSocket["compound"],x:number,z:number,hx:number,hz:number,axis:"x"|"z"):PgPanelSocket=>({
 id,compound,solid:{id:`panel-${id}`,kind:"structure",center:{x,y:1.4,z},half:{x:hx,y:1.4,z:hz},mantle:false},
 approaches:axis==="x"?[{x:x-1.2,y:0,z},{x:x+1.2,y:0,z}]:[{x,y:0,z:z-1.2},{x,y:0,z:z+1.2}],
});
// All sockets occupy existing ground-level gaps. Structural walls remain intact.
// Each compound has two independent approaches, including the maintenance room.
export const PG_PANEL_SOCKETS:readonly PgPanelSocket[]=[
 panel("west-south","west",-25,-1,2,.18,"z"),
 panel("west-end","west",-35,-11,.18,2,"x"),
 // The stair flight leaves a narrow ground corridor at x=34.5. Keep the
 // inner approach in that corridor instead of placing it inside a stair.
 {...panel("east-east","east",35,15,.06,4,"x"),approaches:[{x:34.5,y:0,z:15},{x:36.2,y:0,z:15}]},
 panel("east-west","east",19,15,.18,4,"x"),
 panel("maintenance-front","maintenance",-2,21,2,.18,"z"),
 panel("maintenance-back","maintenance",-2,29,1,.18,"z"),
];
const copySolid=(solid:PgSolid):PgSolid=>({...solid,center:{...solid.center},half:{...solid.half},...(solid.wallRunFaces?{wallRunFaces:[...solid.wallRunFaces]}:{})});
export function pgCloneCollisionSnapshot(snapshot:PgCollisionSnapshot):PgCollisionSnapshot{return {revision:snapshot.revision,...(snapshot.topologyRevision!==undefined?{topologyRevision:snapshot.topologyRevision}:{}),panels:snapshot.panels.map(p=>({...p,solid:copySolid(p.solid)}))};}
export function pgCreateCollisionSnapshot(active=true):PgCollisionSnapshot{return {revision:0,panels:PG_PANEL_SOCKETS.map(socket=>({id:socket.id,solid:copySolid(socket.solid),hp:100,maxHp:100,reinforced:false,active,revision:0}))};}

/** Returns true when no solid intersects the open segment between the points. */
export function pgHasLineOfSight(from:Vec3,to:Vec3,map:PgMap=PG_MAP):boolean {
 const distance=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
 if(distance<1e-8)return true;
 const direction={x:(to.x-from.x)/distance,y:(to.y-from.y)/distance,z:(to.z-from.z)/distance};
 return !map.solids.some(s=>{const hit=pgRayBox(from,direction,s);return hit!==null&&hit<distance-1e-6;});
}
/** Merges additive panel geometry, never replacing or mutating a base-map solid. */
export function pgCollisionMap(snapshot:PgCollisionSnapshot,base:PgMap=PG_MAP):PgMap {
 const ids=new Set(base.solids.map(s=>s.id));
 const panels=snapshot.panels.filter(p=>p.active).map(p=>{
  if(ids.has(p.solid.id))throw new Error(`Duplicate PlanetGun collision solid: ${p.solid.id}`);
  ids.add(p.solid.id);return copySolid(p.solid);
 });
 const map:PgMap={...base,solids:[...base.solids,...panels]};
 // Prune only obstructed walk links; opening a panel restores the base graph.
 const padded={...map,solids:panels.map(s=>({...s,half:{x:s.half.x+B.radius,y:s.half.y,z:s.half.z+B.radius}}))};
 const nodes=new Map(base.navigation.map(node=>[node.id,node]));
 map.navigation=base.navigation.map(node=>({...node,links:node.links.filter(link=>{
  const target=nodes.get(link.to);
  return link.kind!=="walk"||!target||pgHasLineOfSight({...node.position,y:node.position.y+1},{...target.position,y:target.position.y+1},padded);
 })}));
 return map;
}

/** Full snapshots apply atomically. Equal/stale or per-panel regressions are ignored. */
export function pgAcceptCollisionSnapshot(current:PgCollisionSnapshot|null,incoming:PgCollisionSnapshot):PgCollisionSnapshot {
 if(!Number.isSafeInteger(incoming.revision)||incoming.revision<0)throw new Error("Invalid PlanetGun collision revision");
 if(incoming.topologyRevision!==undefined&&(!Number.isSafeInteger(incoming.topologyRevision)||incoming.topologyRevision<0||incoming.topologyRevision>incoming.revision))throw new Error("Invalid PlanetGun topology revision");
 if(current&&(incoming.revision<=current.revision||(incoming.topologyRevision??incoming.revision)<(current.topologyRevision??current.revision)))return current;
 const ids=new Set<string>(),solidIds=new Set<string>();
 for(const panel of incoming.panels){
  if(ids.has(panel.id)||solidIds.has(panel.solid.id)||!Number.isSafeInteger(panel.revision)||panel.revision<0||panel.revision>incoming.revision)throw new Error("Invalid PlanetGun panel revision");
  ids.add(panel.id);solidIds.add(panel.solid.id);
  const previous=current?.panels.find(p=>p.id===panel.id);
  if(previous&&panel.revision<previous.revision)return current!;
 }
 return pgCloneCollisionSnapshot(incoming);
}
