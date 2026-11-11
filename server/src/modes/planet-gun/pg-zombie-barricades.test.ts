import {describe,expect,it,vi} from "vitest";
import type {PgCollisionSnapshot,PgSolid} from "@planetfall/shared";
import {PgZombieBarricades,type PgZombieBarricadeOccupant,type PgZombieBarricadeSite,type PgZombieBarricadeWorld} from "./pg-zombie-barricades.js";
import {PgModeWorld} from "./pg-mode-world.js";

function site(id="west"):PgZombieBarricadeSite{return {id,boards:Array.from({length:3},(_,i)=>({id:`${id}-${i}`,solid:{id:`solid-${id}-${i}`,kind:"structure",center:{x:0,y:.3+i*.6,z:0},half:{x:1,y:.1,z:.12},mantle:false} as PgSolid}))};}
function fixture(){
 const state:PgCollisionSnapshot={revision:0,topologyRevision:0,panels:[]};
 const world:PgZombieBarricadeWorld={panel:id=>{const panel=state.panels.find(panel=>panel.id===id);return panel?structuredClone(panel):null;},damage:vi.fn((id,amount)=>{
  const panel=state.panels.find(panel=>panel.id===id&&panel.active);if(!panel||amount<=0)return 0;
  const hit=Math.min(panel.hp,amount);panel.hp-=hit;if(!panel.hp){panel.active=false;state.topologyRevision!++;}panel.revision=++state.revision;return hit;
 }),rebuild:vi.fn(id=>{
  const panel=state.panels.find(panel=>panel.id===id&&!panel.active);if(!panel)return false;
  panel.hp=panel.maxHp;panel.active=true;panel.revision=++state.revision;state.topologyRevision!++;return true;
 }),repair:vi.fn((id,amount)=>{
  const panel=state.panels.find(panel=>panel.id===id&&panel.active);if(!panel)return 0;
  const gain=Math.min(amount,panel.maxHp-panel.hp);if(gain<=0)return 0;panel.hp+=gain;panel.revision=++state.revision;return gain;
 })};
 const controller=new PgZombieBarricades([site()],world);state.panels=controller.initialPanels();
 const unrelated={...structuredClone(state.panels[0]),id:"unrelated",solid:{...structuredClone(state.panels[0].solid),id:"unrelated-solid"}};state.panels.push(unrelated);
 return {controller,world,state,unrelated};
}
const body=(x=0,y=0,z=0,radius=.42,height=1.95):PgZombieBarricadeOccupant=>({position:{x,y,z},radius,height});

describe("authoritative zombie barricade boards",()=>{
 it("reads only requested boards with fresh HP and avoids cloning unrelated panels in the pursuit hot path",()=>{
  const world=new PgModeWorld(),controller=new PgZombieBarricades([site()],world),boards=controller.initialPanels();
  const unrelated=Array.from({length:64},(_,i)=>({...structuredClone(boards[0]),id:`unrelated-${i}`,solid:{...structuredClone(boards[0].solid),id:`unrelated-solid-${i}`}}));
  world.reset([...boards,...unrelated],0);
  const snapshot=vi.spyOn(world,"snapshot"),panel=vi.spyOn(world,"panel"),clone=vi.spyOn(globalThis,"structuredClone");
  const panelCopies=()=>clone.mock.calls.reduce((total,[value])=>{
   const payload=value as {panels?:unknown[];solid?:unknown};
   return total+(payload.panels?.length??(payload.solid?1:0));
  },0);
  try{
   // The former lookup copied every room panel, then copied its result again.
   // Count actual clone payloads rather than timing a noisy microbenchmark.
   for(let i=0;i<120;i++)structuredClone(world.snapshot().panels.find(p=>p.id===boards[0].id)!);
   expect(snapshot).toHaveBeenCalledTimes(120);expect(panelCopies()).toBe(120*68);
   snapshot.mockClear();clone.mockClear();
   for(let i=0;i<120;i++)expect(controller.nextBoard("west")!.id).toBe("west-0");
   expect(panelCopies()).toBe(120);expect(snapshot).not.toHaveBeenCalled();
   expect(panel.mock.calls.every(([id])=>id==="west-0")).toBe(true);
   panel.mockClear();clone.mockClear();
   expect(controller.status("west")).toMatchObject({hp:90,remaining:3});
   expect(panel.mock.calls.map(([id])=>id)).toEqual(["west-0","west-1","west-2"]);
   expect(panelCopies()).toBe(3);
   const topology=world.revision;world.damage("west-0",7,1);
   expect(world.revision).toBe(topology);expect(controller.nextBoard("west")!.hp).toBe(23);
   expect(controller.status("west")!.hp).toBe(83);
   expect(controller.canRepair("west",[])).toBe(true);expect(controller.repair("west",[],2)).toBe(true);
   expect(world.revision).toBe(topology);expect(controller.nextBoard("west")!.hp).toBe(30);
   expect(snapshot).not.toHaveBeenCalled();
   expect(panel.mock.calls.every(([id])=>boards.some(board=>board.id===id))).toBe(true);
  }finally{clone.mockRestore();panel.mockRestore();snapshot.mockRestore();}
 });
 it("creates exactly three independent nonreinforced 30HP panels and returns detached data",()=>{
  const {controller,state}=fixture(),panels=controller.initialPanels();expect(panels).toHaveLength(3);
  expect(panels.every(panel=>panel.active&&!panel.reinforced&&panel.hp===30&&panel.maxHp===30)).toBe(true);
  panels[0].solid.center.x=99;panels[0].hp=0;
  expect(controller.initialPanels()[0].solid.center.x).toBe(0);expect(controller.status("west")).toMatchObject({remaining:3,total:3,hp:90,maxHp:90});
  const next=controller.nextBoard("west")!;next.hp=1;next.solid.center.x=10;expect(state.panels[0].hp).toBe(30);expect(state.panels[0].solid.center.x).toBe(0);
 });
 it("reads real world damage, destroys one board per hit and never spills into another board",()=>{
  const {controller,state,world,unrelated}=fixture();expect(controller.damage("west",7,1)).toBe(7);
  expect(controller.status("west")).toMatchObject({remaining:3,hp:83,maxHp:90});expect(state.panels[0].maxHp).toBe(30);
  expect(controller.damage("west",1000,2)).toBe(23);expect(state.panels[0]).toMatchObject({active:false,hp:0,maxHp:30});expect(controller.nextBoard("west")!.id).toBe("west-1");
  expect(state.panels[1].hp).toBe(30);expect(controller.status("west")).toMatchObject({remaining:2,hp:60,maxHp:90});
  controller.damage("west",30,3);controller.damage("west",30,4);expect(controller.nextBoard("west")).toBeNull();expect(controller.damage("west",30,5)).toBe(0);
  expect(world.damage).toHaveBeenCalledTimes(4);expect(unrelated).toMatchObject({active:true,hp:30});
 });
 it("heals a partial board without rebuilding and restores one missing board per repair",()=>{
  const {controller,state,world}=fixture();controller.damage("west",10,1);expect(controller.canRepair("west",[])).toBe(true);
  expect(controller.repair("west",[],2)).toBe(true);expect(world.repair).toHaveBeenCalledWith("west-0",10,2);expect(world.rebuild).not.toHaveBeenCalled();
  expect(controller.canRepair("west",[])).toBe(false);expect(controller.repair("west",[],3)).toBe(false);
  for(let i=0;i<3;i++)controller.damage("west",100,4+i);expect(controller.status("west")!.remaining).toBe(0);
  for(let i=1;i<=3;i++){expect(controller.repair("west",[],10+i)).toBe(true);expect(controller.status("west")!.remaining).toBe(i);expect(state.panels[i-1]).toMatchObject({active:true,hp:30,maxHp:30});}
  expect(controller.repair("west",[],14)).toBe(false);expect(world.rebuild).toHaveBeenCalledTimes(3);expect(state.panels).toHaveLength(4);
 });
 it("honors externally changed health and active flags instead of retaining a shadow board state",()=>{
  const {controller,state}=fixture();state.panels[0].hp=12;expect(controller.status("west")!.hp).toBe(72);
  state.panels[0].hp=0;state.panels[0].active=false;expect(controller.nextBoard("west")!.id).toBe("west-1");expect(controller.status("west")!.remaining).toBe(2);
 });
 it("reports adapter rejection without inventing a repaired board",()=>{
  const {controller,world,state}=fixture();controller.damage("west",30,1);const before=structuredClone(state);
  vi.mocked(world.rebuild).mockReturnValue(false);expect(controller.repair("west",[],2)).toBe(false);expect(state).toEqual(before);
  state.panels[0].active=true;state.panels[0].hp=10;vi.mocked(world.repair).mockReturnValue(0);
  expect(controller.repair("west",[],3)).toBe(false);expect(state.panels[0].hp).toBe(10);
 });
 it.each([
  {name:"player in board",occupant:body(),blocked:true},
  {name:"infected crossing doorway",occupant:body(.8,0,.4,.5,1.8),blocked:true},
  {name:"touching horizontal edge",occupant:body(1.42,0,0),blocked:true},
  {name:"outside horizontal edge",occupant:body(1.42001,0,0),blocked:false},
  {name:"touching upper face",occupant:body(0,.4,0),blocked:true},
  {name:"above upper face",occupant:body(0,.40001,0),blocked:false},
  {name:"rounded corner overlap",occupant:body(1.29,0,.52,.5),blocked:true},
  {name:"outside rounded corner",occupant:body(1.31,0,.52,.5),blocked:false},
 ])("rejects rebuilding an occupied board: $name",({occupant,blocked})=>{
  const {controller,state,world}=fixture();controller.damage("west",30,1);const before=structuredClone(state);
  expect(controller.canRepair("west",[occupant])).toBe(!blocked);expect(controller.repair("west",[occupant],2)).toBe(!blocked);
  if(blocked){expect(state).toEqual(before);expect(world.rebuild).not.toHaveBeenCalled();}else expect(state.panels[0]).toMatchObject({active:true,hp:30});
 });
 it("rechecks occupants at repair time and permits safe partial-health repair without adding geometry",()=>{
  const {controller,state}=fixture();controller.damage("west",30,1);expect(controller.canRepair("west",[])).toBe(true);
  expect(controller.repair("west",[body()],2)).toBe(false);expect(state.panels[0].active).toBe(false);
  expect(controller.repair("west",[],3)).toBe(true);controller.damage("west",5,4);expect(controller.repair("west",[body()],5)).toBe(true);
 });
 it("rejects unknown sites, malformed bodies, nonfinite or nonpositive damage and invalid timestamps without mutations",()=>{
  const {controller,state,world}=fixture();const before=structuredClone(state);
  for(const amount of [0,-1,NaN,Infinity,-Infinity])expect(controller.damage("west",amount,1)).toBe(0);
  for(const now of [NaN,Infinity,-1]){expect(controller.damage("west",1,now)).toBe(0);expect(controller.repair("west",[],now)).toBe(false);}
  expect(controller.status("missing")).toBeNull();expect(controller.nextBoard("missing")).toBeNull();expect(controller.damage("missing",30,1)).toBe(0);expect(controller.canRepair("missing",[])).toBe(false);expect(controller.repair("missing",[],1)).toBe(false);
  expect(state).toEqual(before);expect(world.damage).not.toHaveBeenCalled();expect(world.rebuild).not.toHaveBeenCalled();expect(world.repair).not.toHaveBeenCalled();
  controller.damage("west",30,2);const broken=structuredClone(state);
  for(const occupant of [body(NaN),body(0,0,Infinity),body(0,0,0,-1),body(0,0,0,.42,0),body(0,0,0,Infinity)]){expect(controller.canRepair("west",[occupant])).toBe(false);expect(controller.repair("west",[occupant],3)).toBe(false);}
  expect(state).toEqual(broken);expect(world.rebuild).not.toHaveBeenCalled();
 });
 it("does not recreate missing adapter panels or share board identity across sites",()=>{
  const {controller,state,world}=fixture();state.panels=state.panels.filter(panel=>panel.id!=="west-0");expect(controller.repair("west",[],1)).toBe(false);expect(world.rebuild).not.toHaveBeenCalled();
  expect(()=>new PgZombieBarricades([{...site(),boards:site().boards.slice(0,2)}],world)).toThrow();
  expect(()=>new PgZombieBarricades([{...site(),boards:[...site().boards,...site("extra").boards.slice(0,1)]}],world)).toThrow();
  expect(()=>new PgZombieBarricades([site(),site()],world)).toThrow();
  expect(()=>new PgZombieBarricades([site(),{...site("east"),boards:site().boards}],world)).toThrow();
  const malformed=site();malformed.boards[0].solid.half.x=NaN;expect(()=>new PgZombieBarricades([malformed],world)).toThrow();
 });
 it("keeps independent sites isolated",()=>{
  const {world,state}=fixture(),controller=new PgZombieBarricades([site(),site("east")],world);state.panels=controller.initialPanels();
  controller.damage("east",100,1);expect(controller.status("east")!.remaining).toBe(2);expect(controller.status("west")!.hp).toBe(90);
  expect(controller.repair("east",[],2)).toBe(true);expect(controller.status("east")!.hp).toBe(90);
 });
});
