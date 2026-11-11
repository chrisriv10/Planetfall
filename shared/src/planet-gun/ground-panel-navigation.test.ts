import {describe,expect,it} from "vitest";
import {PG_BALANCE as B} from "./balance.js";
import {PG_MAP} from "./map.js";
import {pgAddGroundPanelBypasses,type PgGroundNavigationPanel} from "./ground-panel-navigation.js";
import type {PgMap,PgNavNode,PgSolid} from "./types.js";

const box=(id:string,x:number,y:number,z:number,hx:number,hy:number,hz:number):PgSolid=>({id,kind:"structure",center:{x,y,z},half:{x:hx,y:hy,z:hz},mantle:false});
const floor=box("floor",0,-.5,0,20,.5,20);
const panel=(id="cover",x=0,z=0):PgGroundNavigationPanel=>({id,active:true,solid:box(id,x,.5,z,1,.5,.175)});
const node=(id:number,x:number,z:number,y=0):PgNavNode=>({id,position:{x,y,z},links:[]});
const map=(navigation=[node(10,0,-4),node(20,0,4)],solids=[floor]):PgMap=>({id:"nova-block",name:"test",halfWidth:20,halfDepth:20,solids,spawns:[],navigation});
const augment=(base:PgMap,panels:PgGroundNavigationPanel[],extra:PgSolid[]=[])=>pgAddGroundPanelBypasses(base,[...base.solids,...panels.filter(p=>p.active).map(p=>p.solid),...extra],panels);
function distance(graph:PgNavNode[],from:number,to:number):number {
 const nodes=new Map(graph.map(n=>[n.id,n])),cost=new Map([[from,0]]),pending=new Set(nodes.keys());
 while(pending.size){
  const id=[...pending].sort((a,b)=>(cost.get(a)??Infinity)-(cost.get(b)??Infinity))[0],d=cost.get(id)??Infinity;
  if(id===to||!Number.isFinite(d))return d;
  pending.delete(id);const n=nodes.get(id)!;
  for(const link of n.links){const t=nodes.get(link.to)!;cost.set(t.id,Math.min(cost.get(t.id)??Infinity,d+Math.hypot(t.position.x-n.position.x,t.position.z-n.position.z)));}
 }
 return Infinity;
}

describe("ground panel bypass visibility graph",()=>{
 it("routes around paired and overlapping panels without exceeding four corners each",()=>{
  for(const separation of [.3,.8163]){
   const base=map(),panels=[panel("b",.07135,separation),panel("a")],graph=augment(base,panels);
   expect(graph.length).toBeGreaterThan(base.navigation.length);
   expect(graph.length).toBeLessThanOrEqual(base.navigation.length+8);
   expect(distance(graph,10,20)).toBeLessThan(10);
   expect(graph[0].links.some(l=>l.to===20)).toBe(false);
  }
 });
 it("recovers the measured east bypass around cover-11 and cover-17",()=>{
  const base={...PG_MAP,navigation:[node(0,-40,-32),node(1,-40,-24)]};
  const graph=augment(base,[panel("cover-11",-40.0714917819,-25.8369091252),panel("cover-17",-40.0001395612,-25.0206248975)]);
  expect(distance(graph,0,1)).toBeGreaterThan(8);
  expect(distance(graph,0,1)).toBeLessThan(9.5);
  expect(graph.some(n=>Math.abs(n.position.x-(-38.6114917819))<1e-8&&Math.abs(n.position.z-(-26.4719091252))<1e-8)).toBe(true);
 });
 it("does not create a through-wall path at a flush socket",()=>{
  const base=map([node(10,0,-4),node(20,0,4)],[floor,box("left",-10.5,1,0,9.5,1,.175),box("right",10.5,1,0,9.5,1,.175)]);
  expect(distance(augment(base,[panel()]),10,20)).toBe(Infinity);
 });
 it("checks low and overhead obstacles across the full standing body",()=>{
  const base=map(),cover=panel();
  for(const [y,hy] of [[.1,.1],[B.height-.05,.05]]){
   // Obstruct all candidate locations, while neither obstacle spans eye height.
   expect(augment(base,[cover],[box("blocker",0,y,0,3,hy,3)])).toHaveLength(2);
  }
  expect(augment(base,[cover],[box("ceiling",0,B.height+.1,0,3,.1,3)])).toHaveLength(6);
 });
 it("checks full standing sweep between otherwise clear endpoints",()=>{
  const base=map([node(10,0,-5)]),cover=panel();
  const graph=augment(base,[cover],[box("low-bar",0,.1,-2.5,4,.1,.1)]);
  expect(graph).toHaveLength(5);
  expect(graph[0].links).toEqual([]);
 });
 it("rejects unsupported corners and footprints beyond map bounds",()=>{
  expect(augment(map([],[]),[panel()])).toEqual([]);
  const base=map([],[box("small-floor",0,-.5,0,1.6,.5,1)]);
  expect(augment(base,[panel()])).toEqual([]);
  const bounded={...map([]),halfWidth:1.8};
  expect(augment(bounded,[panel()])).toEqual([]);
  expect(augment(map([]),[{...panel(),solid:box("floating",0,3,0,1,.5,.175)}])).toEqual([]);
 });
 it("preserves every existing node, ID, link and authored traversal without mutation",()=>{
  const base=map([node(40,0,-4),node(7,0,4),node(90,0,3,3.5)]);
  base.navigation[0].links=[{to:90,kind:"mantle"},{to:7,kind:"walk"}];
  base.navigation[2].links=[{to:40,kind:"mantle"}];
  const original=structuredClone(base),panels=[panel("z",3),panel("a")],before=structuredClone(panels),graph=augment(base,panels);
  expect(base).toEqual(original);expect(panels).toEqual(before);
  expect(graph.slice(0,3).map(n=>({id:n.id,position:n.position}))).toEqual(original.navigation.map(n=>({id:n.id,position:n.position})));
  expect(graph[0].links.slice(0,2)).toEqual(original.navigation[0].links);
  expect(graph[2]).toEqual(original.navigation[2]);
  expect(graph.slice(3).every(n=>n.id>90&&n.links.every(l=>l.kind==="walk"&&l.to!==90))).toBe(true);
  graph[0].position.x=99;graph[0].links[0].to=99;expect(base).toEqual(original);
 });
 it("sorts panel IDs deterministically and restores the exact base graph when inactive",()=>{
  const base=map(),a=panel("a"),z=panel("z",3);
  expect(augment(base,[z,a])).toEqual(augment(base,[a,z]));
  a.active=false;z.active=false;
  expect(augment(base,[z,a])).toBe(base.navigation);
  expect(augment(base,[])).toBe(base.navigation);
 });
});
