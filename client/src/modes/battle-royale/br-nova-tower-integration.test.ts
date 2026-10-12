import {expect,it} from "vitest";
import {BR_STRUCTURES,type BrStructure} from "@planetfall/shared";
import {BrWorldRenderer} from "./br-world";
import type {NovaPanel} from "./br-nova-tower-panel-identity";

it("replaces only supported Tower B boards while preserving existing interior dressing",()=>{
  const source=BR_STRUCTURES.find(s=>s.id==="nova-tower-b")!;
  const build=Reflect.get(BrWorldRenderer.prototype,"addInteriorKit") as (s:BrStructure,light:NovaPanel[],dark:NovaPanel[],emissive:NovaPanel[],source:BrStructure)=>void;
  const capture=(enabled:boolean)=>{
    const light:NovaPanel[]=[],dark:NovaPanel[]=[],emissive:NovaPanel[]=[];
    build.call({}, {...source,id:enabled?source.id:"comparison-only",position:{...source.position,y:0}},light,dark,emissive,source);
    return{light,dark,emissive};
  };
  const before=capture(false),after=capture(true),key=(p:NovaPanel)=>JSON.stringify(p);
  const isBoard=(p:NovaPanel)=>p.scale.x===5.75&&p.scale.y===2.5&&p.scale.z===.12;
  expect(before.light.filter(isBoard)).toHaveLength(18);
  expect(after.light.filter(isBoard)).toHaveLength(4);
  for(const part of before.light.filter(p=>!isBoard(p)))expect(after.light.map(key)).toContain(key(part));
  expect(after.dark.slice(0,before.dark.length).map(key)).toEqual(before.dark.map(key));
  expect(after.emissive.slice(0,before.emissive.length).map(key)).toEqual(before.emissive.map(key));
  expect(after.dark.length-before.dark.length).toBe(14);
  expect(after.emissive.length-before.emissive.length).toBe(42);
  expect(after.light.length-before.light.length).toBe(28);
});
