import {describe,it,expect} from "vitest";
import {PG_MAP,PG_PANEL_SOCKETS,PG_BALANCE,pgRayBox,type PgDynamicPanel,type Vec3} from "@planetfall/shared";
import {PgModeWorld} from "./pg-mode-world.js";
const first=PG_PANEL_SOCKETS[0];
const make=(id="test-panel",position:Vec3={x:0,y:1,z:-16}):PgDynamicPanel=>({id,solid:{id:`solid-${id}`,kind:"structure",mantle:false,center:{...position},half:{x:1,y:1,z:.2}},hp:100,maxHp:100,reinforced:false,active:true,revision:1});
const rayHits=(solids:ReturnType<PgModeWorld["shotSolids"]>,solidId:string,origin:Vec3={x:0,y:1,z:-14})=>solids.some(s=>s.id===solidId&&pgRayBox(origin,{x:0,y:0,z:-1},s)!==null);

describe("room-local dynamic collision and bounded shot history",()=>{
 it("returns fresh isolated single-panel reads across health changes without a topology revision",()=>{
  const world=new PgModeWorld();world.reset([make(),make("other",{x:4,y:1,z:-16})],0);
  const topology=world.revision,map=world.map,firstRead=world.panel("test-panel")!;
  firstRead.hp=0;firstRead.active=false;firstRead.solid.center.x=99;firstRead.solid.half.x=99;
  expect(world.panel("test-panel")).toMatchObject({hp:100,active:true,solid:{center:{x:0},half:{x:1}}});
  expect(world.panel("missing")).toBeNull();
  expect(world.damage("test-panel",30,10)).toBe(30);
  expect(world.panel("test-panel")!.hp).toBe(70);expect(world.revision).toBe(topology);expect(world.map).toBe(map);
  expect(world.repair("test-panel",20,20)).toBe(20);
  expect(world.panel("test-panel")!.hp).toBe(90);expect(world.revision).toBe(topology);
  const snapshot=world.snapshot();snapshot.panels[0].hp=1;
  expect(world.panel("test-panel")!.hp).toBe(90);expect(world.panel("other")!.hp).toBe(100);
  world.damage("test-panel",100,30);expect(world.panel("test-panel")).toMatchObject({hp:0,active:false});
  world.rebuild("test-panel",40);expect(world.panel("test-panel")).toMatchObject({hp:100,active:true});
 });
 it("keeps snapshot inputs, room state, and canonical map independent",()=>{
  const canonical=structuredClone(PG_MAP),a=new PgModeWorld(),b=new PgModeWorld(),panel=make();a.reset([panel],0);
  panel.hp=1;panel.solid.center.x=40;const exported=a.snapshot();exported.panels[0].solid.center.x=-40;exported.panels[0].hp=0;
  expect(a.snapshot().panels[0].hp).toBe(100);expect(a.snapshot().panels[0].solid.center.x).toBe(0);expect(b.map.solids.some(s=>s.id===panel.solid.id)).toBe(false);
  a.damage(panel.id,100,100);expect(b.revision).toBe(0);expect(PG_MAP).toEqual(canonical);
 });
 it("advances revisions deterministically, bounds health and reinforcement, and ignores invalid damage",()=>{
  const world=new PgModeWorld();world.reset([make()],0);expect(world.revision).toBe(1);expect(world.reinforce("test-panel",10)).toBe(true);expect(world.snapshot().revision).toBe(2);expect(world.revision).toBe(1);expect(world.reinforce("test-panel",20)).toBe(false);
  expect(world.damage("test-panel",100,30)).toBe(8);expect(world.snapshot().panels[0].hp).toBe(592);expect(world.snapshot().revision).toBe(3);expect(world.revision).toBe(1);
  for(const damage of [NaN,Infinity,0,-5])expect(world.damage("test-panel",damage,40)).toBe(0);expect(world.snapshot().revision).toBe(3);expect(world.revision).toBe(1);
  expect(world.damage("test-panel",1000,50,true)).toBe(592);expect(world.snapshot().panels[0]).toMatchObject({hp:0,active:false,revision:4});expect(world.snapshot().revision).toBe(4);expect(world.revision).toBe(2);expect(world.damage("test-panel",10,60)).toBe(0);expect(world.snapshot().revision).toBe(4);expect(world.revision).toBe(2);
 });
 it("orders bounded repair state without invalidating collision or rebuilding navigation",()=>{
  const world=new PgModeWorld();world.reset([make()],0);const map=world.map,topology=world.revision;
  world.damage("test-panel",30,10);expect(world.repair("test-panel",20,20)).toBe(20);
  expect(world.snapshot().panels[0].hp).toBe(90);expect(world.snapshot().revision).toBe(3);
  expect(world.repair("test-panel",100,30)).toBe(10);expect(world.repair("test-panel",100,40)).toBe(0);
  expect(world.map).toBe(map);expect(world.revision).toBe(topology);
 });
 it("blocks rewound shots on historical panels destroyed after firing",()=>{
  const world=new PgModeWorld(),panel=make();world.reset([],0);world.add(panel,10);world.damage(panel.id,100,100);
  expect(rayHits(world.shotSolids(50,100),panel.solid.id)).toBe(true);expect(rayHits(world.shotSolids(100,100),panel.solid.id)).toBe(false);expect(world.visible({x:0,y:1,z:-14},{x:0,y:1,z:-18})).toBe(true);
 });
 it("also blocks old shots with newly deployed current panels",()=>{
  const world=new PgModeWorld(),panel=make();world.reset([],0);world.add(panel,100);expect(rayHits(world.shotSolids(50,100),panel.solid.id)).toBe(true);expect(world.visible({x:0,y:1,z:-14},{x:0,y:1,z:-18})).toBe(false);
 });
 it("unions historical destroyed panels and newly deployed blockers without duplicating unchanged solids",()=>{
  const world=new PgModeWorld(),old=make("old"),current=make("new",{x:4,y:1,z:-16});world.reset([old],0);world.damage(old.id,100,100);world.add(current,110);
  const solids=world.shotSolids(50,110);expect(solids.some(s=>s.id===old.solid.id)).toBe(true);expect(solids.some(s=>s.id===current.solid.id)).toBe(true);expect(solids.filter(s=>s.id===PG_MAP.solids[0].id)).toHaveLength(1);
 });
 it("retains blockers throughout the rewind window and prunes them after the bounded window",()=>{
  const world=new PgModeWorld(),panel=make();world.reset([panel],0);world.damage(panel.id,100,10);const within=PG_BALANCE.rewindMs;world.reset([],within);expect(world.shotSolids(0,within).some(s=>s.id===panel.solid.id)).toBe(true);
  world.reset([],PG_BALANCE.rewindMs+100);expect(world.shotSolids(0,PG_BALANCE.rewindMs+100).some(s=>s.id===panel.solid.id)).toBe(false);
 });
 it("recomputes navigation only for this room and restores authored ground links after breach",()=>{
  const world=new PgModeWorld();const panel:PgDynamicPanel={id:first.id,solid:structuredClone(first.solid),hp:100,maxHp:100,reinforced:false,active:true,revision:1};
  const baseline=PG_MAP.navigation.reduce((n,p)=>n+p.links.length,0);world.reset([panel],0);const closed=world.map.navigation.reduce((n,p)=>n+p.links.length,0);expect(closed).toBeLessThan(baseline);expect(PG_MAP.navigation.reduce((n,p)=>n+p.links.length,0)).toBe(baseline);
  world.damage(panel.id,100,10);expect(world.map.navigation.reduce((n,p)=>n+p.links.length,0)).toBe(baseline);
 });
});
