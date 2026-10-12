import { describe, expect, it } from "vitest";
import { BR_MAP_BLOCKS, BR_STRUCTURES } from "@planetfall/shared";
import { buildBrFacadeSkin } from "./br-facade-skin";
import { buildFacadeParts, buildExteriorServiceParts } from "./br-facades";
import { buildNovaStorefrontParts } from "./br-storefronts";
import { buildBrSolarServiceFrontage } from "./br-solar-service-frontage";
import { buildBrDoorwayParts } from "./br-facade-attachments";

describe("canonical facade identity composition",()=>{
 it("replaces at most two accents without altering any other canonical descriptor",()=>{
  let selected=0;const faces=new Set<string>();
  for(const s of BR_STRUCTURES){
   const solar=buildBrSolarServiceFrontage(s);
   const original=[...buildFacadeParts(s).filter(p=>!solar.replaceGenericFacadePanels||p.finish!=="panel"),...buildExteriorServiceParts(s),...buildNovaStorefrontParts(s),...solar.facadeParts];
   const actual=buildBrFacadeSkin(s,solar),markers=actual.filter(p=>p.identityLed);
   expect(actual.length,s.id).toBe(original.length);expect(markers.length,s.id).toBeLessThanOrEqual(2);
   actual.forEach((p,i)=>{if(!p.identityLed)expect(p,s.id).toEqual(original[i]);else expect(original[i].finish,s.id).toBe("accent");});
   expect(buildBrFacadeSkin({...s,position:{...s.position,y:0}}),s.id).toEqual(actual);
   for(const p of markers){
    selected++;faces.add(p.face);const ns=p.face==="north"||p.face==="south",along=ns?"x":"z",normal=ns?"z":"x",sign=p.face==="north"||p.face==="east"?1:-1;
    const post=buildBrDoorwayParts(s).find(v=>v.scale.y>=4&&Math.abs(v.position[along]-p.position[along])<1e-9)!;
    expect(post,s.id).toBeDefined();expect((p.position[normal]-post.position[normal])*sign-post.scale[normal]/2-p.scale[normal]/2,s.id).toBeCloseTo(.002,9);
    expect(Math.abs(p.position[along]-s.position[along])-.04,s.id).toBeGreaterThanOrEqual(2.43-1e-9);
    expect(Math.abs(p.position[along]-s.position[along]),s.id).toBeLessThanOrEqual(3);
    expect(p.scale[along]*p.scale.y,s.id).toBeCloseTo(.112);
    const walls=BR_MAP_BLOCKS.filter(b=>b.id===`${s.id}-door-left`||b.id===`${s.id}-door-right`);
    expect(walls.some(w=>p.position[along]-.04>=w.position[along]-w.size[along]/2-1e-9&&p.position[along]+.04<=w.position[along]+w.size[along]/2+1e-9&&1.1>=w.position.y-s.position.y-w.size.y/2&&2.5<=w.position.y-s.position.y+w.size.y/2),s.id).toBe(true);
    for(const pane of actual.filter(v=>v.face===p.face&&(v.finish==="glass"||v.finish==="lit"))){
     const overlaps=(["x","y","z"] as const).every(a=>p.position[a]+p.scale[a]/2>pane.position[a]-pane.scale[a]/2-.08+1e-9&&p.position[a]-p.scale[a]/2<pane.position[a]+pane.scale[a]/2+.08-1e-9);
     expect(overlaps,s.id).toBe(false);
    }
   }
  }
  expect(selected).toBeGreaterThan(0);expect(faces.size).toBe(4);
 });
});
