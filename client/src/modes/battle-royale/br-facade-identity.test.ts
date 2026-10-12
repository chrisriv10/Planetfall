import {describe,it,expect} from "vitest";
import type {BrStructure} from "@planetfall/shared";
import {selectBrFacadeIdentityReplacements as select,brIdentityBounds,type BrIdentityPart,type BrIdentityBounds} from "./br-facade-identity";
function fixture(face:BrStructure["entrance"]){
 const ns=face==="north"||face==="south",along=ns?"x":"z",normal=ns?"z":"x",sign=face==="north"||face==="east"?1:-1;
 const structure={enterable:true,entrance:face,position:{x:40,y:12,z:60},size:{x:20,y:6,z:20}} as BrStructure;
 const parts:BrIdentityPart[]=[-1,1].map(side=>({finish:"accent",face,position:{...structure.position,y:5,[along]:structure.position[along]+side*5,[normal]:structure.position[normal]+sign*10.6},scale:{x:.09,y:.14,z:.09,[along]:4}}));
 const posts:BrIdentityPart[]=[-1,1].map(side=>({finish:"frame",face,position:{...structure.position,y:2.1,[along]:structure.position[along]+side*2.47,[normal]:structure.position[normal]+sign*10.48},scale:{x:.5,y:4.2,z:.5,[along]:.12}}));
 const walls:BrIdentityBounds[]=[-1,1].map(side=>({min:{...structure.position,y:0,[along]:structure.position[along]+(side<0?-10:2.4),[normal]:structure.position[normal]+sign*10-.325},max:{...structure.position,y:6,[along]:structure.position[along]+(side<0?-2.4:10),[normal]:structure.position[normal]+sign*10+.325}}));
 return {structure,parts,posts,walls,along,normal,sign} as const;
}
describe("doorpost-mounted entrance identity",()=>{
 for(const face of ["north","south","east","west"] as const)it(`derives supported ${face} coats preserving input/count`,()=>{
  const f=fixture(face),before=JSON.stringify(f),r=select(f.structure,f.parts,f.posts,f.walls,f.posts.map(brIdentityBounds));
  expect(r).toHaveLength(2);expect(JSON.stringify(f)).toBe(before);
  expect(f.parts.map((p,i)=>r.find(x=>x.index===i)?.part??p)).toHaveLength(f.parts.length);
  r.forEach((v,i)=>{const p=v.part,post=f.posts[i];expect(p.position[f.along]).toBe(post.position[f.along]);
   expect((p.position[f.normal]-post.position[f.normal])*f.sign-post.scale[f.normal]/2-p.scale[f.normal]/2).toBeCloseTo(.002,10);
   expect((post.scale[f.along]-p.scale[f.along])/2).toBeCloseTo(.02);
   expect(Math.abs(p.position[f.along]-f.structure.position[f.along])-.04).toBeGreaterThanOrEqual(2.43-1e-9);
   expect(p.scale.y*p.scale[f.along]).toBeCloseTo(.112);expect(p.position.y).toBe(1.8);expect(v.route).toBe("led");
  });
 });
 it("derives placement from changed post geometry",()=>{
  const f=fixture("north");f.posts[1]={...f.posts[1],position:{...f.posts[1].position,x:42.7,z:70.55},scale:{...f.posts[1].scale,z:.6}};
  const r=select(f.structure,f.parts,f.posts,f.walls);expect(r[1].part.position.x).toBe(42.7);expect(r[1].part.position.z).toBeCloseTo(70.862);
 });
 it("retains originals without complete support or clearance",()=>{
  const f=fixture("east");expect(select(f.structure,f.parts,[],f.walls)).toEqual([]);expect(select(f.structure,f.parts,f.posts,[])).toEqual([]);
  expect(select(f.structure,f.parts,f.posts.map(p=>({...p,position:{...p.position,z:p.position.z+(p.position.z>60?6:-6)}})),f.walls)).toEqual([]);
  const r=select(f.structure,f.parts,f.posts,f.walls);
  expect(select(f.structure,f.parts,f.posts,f.walls,[brIdentityBounds(r[0].part)])).toHaveLength(1);
  expect(select(f.structure,[...f.parts,{...r[0].part,finish:"glass"}],f.posts,f.walls)).toHaveLength(1);
 });
 it("checks 3D clearance and leaves unrelated parts unchanged",()=>{
  const f=fixture("south"),other={...f.parts[0],finish:"metal"},parts=[...f.parts,other];
  const remote={min:{x:30,y:0,z:48},max:{x:50,y:6,z:48.5}};
  const r=select(f.structure,parts,f.posts,f.walls,[remote]);expect(r).toHaveLength(2);
  expect(parts.map((p,i)=>r.find(x=>x.index===i)?.part??p)[2]).toBe(other);
 });
});
