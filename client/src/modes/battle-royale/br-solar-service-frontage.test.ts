import {describe,expect,it} from "vitest";
import {BR_LOOT_SOCKETS,BR_ROADS,BR_STRUCTURES,type BrStructure,type Vec3} from "@planetfall/shared";
import {buildFacadeParts} from "./br-facades";
import {buildBrSolarServiceFrontage} from "./br-solar-service-frontage";

const structures=BR_STRUCTURES.filter(s=>["solar-service-1","solar-service-2","solar-service-3"].includes(s.id));
type Box={position:Vec3;scale:Vec3};
const overlaps=(a:Box,b:Box)=>["x","y","z"].every(axis=>{
  const key=axis as keyof Vec3;
  return Math.abs(a.position[key]-b.position[key])<(a.scale[key]+b.scale[key])/2-1e-8;
});
const allParts=(s:BrStructure)=>{
  const kit=buildBrSolarServiceFrontage(s);return [...kit.cornerParts,...kit.shellParts,...kit.facadeParts];
};
describe("Solar Service attached frontage",()=>{
  it("limits scope and preserves deterministic inputs, finite transforms and small budgets",()=>{
    const before=JSON.stringify([BR_STRUCTURES,BR_ROADS,BR_LOOT_SOCKETS]);
    expect(structures).toHaveLength(3);
    expect(structures.map(s=>allParts(s).length)).toEqual([18,20,37]);
    for(const s of structures){
      const kit=buildBrSolarServiceFrontage(s);
      expect(kit.replaceGenericCorners).toBe(true);
      expect(kit.cornerParts).toHaveLength(12);
      // Utility replaces ten wall zones and five existing backing panels;
      // these are exact-envelope replacements, not additional facade clutter.
      expect(allParts(s).length-kit.shellParts.length-(kit.replaceGenericFacadePanels?5:0)).toBeLessThanOrEqual(24);
      expect(buildBrSolarServiceFrontage(s)).toEqual(kit);
      for(const part of allParts(s)){
        expect([...Object.values(part.position),...Object.values(part.scale)].every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(n=>n>0)).toBe(true);
      }
      // Match existing renderer convention: changing the world base must not
      // bake a second base translation into these local-height transforms.
      expect(buildBrSolarServiceFrontage({...s,position:{...s.position,y:12}})).toEqual(kit);
    }
    for(const s of BR_STRUCTURES.filter(s=>!structures.includes(s)))expect(buildBrSolarServiceFrontage(s))
      .toEqual({replaceGenericCorners:false,replaceGenericShell:false,replaceGenericFacadePanels:false,cornerParts:[],shellParts:[],facadeParts:[]});
    expect(JSON.stringify([BR_STRUCTURES,BR_ROADS,BR_LOOT_SOCKETS])).toBe(before);
  });
  it.each(structures)("exactly partitions the old corner envelopes of $id without growing roof or ground mass",s=>{
    const {cornerParts}=buildBrSolarServiceFrontage(s);
    const corner=s.style==="city"?Math.max(2.1,Math.min(4.2,Math.min(s.size.x,s.size.z)*.11)):1.55;
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const x=s.position.x+sx*(s.size.x/2-corner*.42),z=s.position.z+sz*(s.size.z/2-corner*.42);
      const column=cornerParts.filter(p=>p.position.x===x&&p.position.z===z).sort((a,b)=>a.position.y-b.position.y);
      expect(column.map(p=>p.role)).toEqual(["contact","body","cap"]);
      let edge=-.55;
      for(const part of column){
        expect(part.scale.x).toBe(corner);expect(part.scale.z).toBe(corner);
        expect(part.position.y-part.scale.y/2).toBeCloseTo(edge,10);
        edge=part.position.y+part.scale.y/2;
      }
      expect(edge).toBeCloseTo(s.size.y+.55,10);
      expect(column.reduce((volume,p)=>volume+p.scale.x*p.scale.y*p.scale.z,0))
        .toBeCloseTo(corner*corner*(s.size.y+1.1),9);
    }
    const bodies=cornerParts.filter(p=>p.role==="body");
    expect(bodies.every(p=>p.finish===(s.id==="solar-service-3"?"concrete":"structuralDark"))).toBe(true);
  });
  it.each(structures)("keeps $id belts on solid spandrels, away from glazing, the door and roof",s=>{
    const kit=buildBrSolarServiceFrontage(s),ns=s.entrance==="north"||s.entrance==="south";
    const axis=ns?"x":"z",normal=ns?"z":"x";
    const glazing=buildFacadeParts(s).filter(p=>p.face===s.entrance&&(p.finish==="glass"||p.finish==="lit"));
    expect(glazing.length).toBeGreaterThan(0);
    for(const p of kit.facadeParts.slice(kit.replaceGenericFacadePanels?5:0)){
      expect(p.face).toBe(s.entrance);
      expect(Math.abs(p.position[axis]-s.position[axis])-p.scale[axis]/2).toBeGreaterThanOrEqual(3.1-1e-8);
      expect(Math.abs(p.position[normal]-s.position[normal])-p.scale[normal]/2).toBeGreaterThan(s.size[normal]/2+.64);
      expect(Math.abs(p.position[normal]-s.position[normal])+p.scale[normal]/2).toBeLessThan(s.size[normal]/2+.8);
      expect(p.position.y-p.scale.y/2).toBeGreaterThan(0);
      expect(p.position.y+p.scale.y/2).toBeLessThan(s.size.y);
      for(const pane of glazing){
        const lateralOverlap=Math.abs(p.position[axis]-pane.position[axis])<(p.scale[axis]+pane.scale[axis])/2;
        const verticalOverlap=Math.abs(p.position.y-pane.position.y)<(p.scale.y+pane.scale.y)/2;
        expect(lateralOverlap&&verticalOverlap,`${s.id}: ${p.finish} obscures glazing`).toBe(false);
      }
    }
  });
  it("recolors the actual utility shell and backing panels without adding any surface footprint",()=>{
    const s=structures.find(s=>s.id==="solar-service-3")!,kit=buildBrSolarServiceFrontage(s);
    expect(kit.replaceGenericShell).toBe(true);expect(kit.replaceGenericFacadePanels).toBe(true);
    const originalPanels=buildFacadeParts(s).filter(p=>p.finish==="panel");
    expect(originalPanels).toHaveLength(5);
    expect(kit.facadeParts.slice(0,5)).toEqual(originalPanels.map(p=>({...p,finish:"concrete"})));
    const {x,z}=s.position,{x:w,z:d,y:h}=s.size;
    const walls=[{x,z:z-d/2,sx:w,sz:.65},{x,z:z+d/2,sx:w,sz:.65},
      {x:x-w/2,z,sx:.65,sz:d},
      {x:x+w/2,z:z-(d+4.8)/4,sx:.65,sz:(d-4.8)/2},
      {x:x+w/2,z:z+(d+4.8)/4,sx:.65,sz:(d-4.8)/2}];
    expect(kit.shellParts).toHaveLength(10);
    for(const wall of walls){
      const parts=kit.shellParts.filter(p=>p.position.x===wall.x&&p.position.z===wall.z);
      expect(parts).toHaveLength(2);
      expect(parts.map(p=>p.finish)).toEqual(["structuralDark","concrete"]);
      let edge=0;
      for(const p of parts){
        expect(p.scale.x).toBe(wall.sx);expect(p.scale.z).toBe(wall.sz);
        expect(p.position.y-p.scale.y/2).toBeCloseTo(edge,10);edge=p.position.y+p.scale.y/2;
      }
      expect(edge).toBeCloseTo(h,10);
    }
    for(const other of structures.filter(s=>s.id!=="solar-service-3")){
      const otherKit=buildBrSolarServiceFrontage(other);
      expect(otherKit.replaceGenericShell).toBe(false);expect(otherKit.shellParts).toEqual([]);
      expect(otherKit.replaceGenericFacadePanels).toBe(false);
    }
  });
  it("keeps full part footprints clear of roads, other buildings, entrance approaches and loot",()=>{
    for(const s of structures)for(const part of allParts(s)){
      const world={...part,position:{...part.position,y:part.position.y+s.position.y}};
      for(const other of BR_STRUCTURES.filter(other=>other.id!==s.id))
        expect(overlaps(world,{position:{...other.position,y:other.position.y+other.size.y/2},scale:other.size}),`${s.id}: ${other.id}`).toBe(false);
      for(const loot of BR_LOOT_SOCKETS)expect(overlaps(world,{position:loot.position,scale:{x:1.2,y:1.2,z:1.2}}),`${s.id}: ${loot.id}`).toBe(false);
      for(const owner of structures){
        const ns=owner.entrance==="north"||owner.entrance==="south";
        const sign=owner.entrance==="north"||owner.entrance==="east"?1:-1;
        const approach={position:{x:owner.position.x+(ns?0:sign*(owner.size.x/2+3)),y:owner.position.y+2.1,
          z:owner.position.z+(ns?sign*(owner.size.z/2+3):0)},scale:{x:ns?5.6:6,y:4.2,z:ns?6:5.6}};
        const kit=buildBrSolarServiceFrontage(s);
        const replacingExistingSurface=kit.replaceGenericShell&&(kit.shellParts.some(p=>JSON.stringify(p)===JSON.stringify(part))
          ||kit.facadeParts.slice(0,5).some(p=>JSON.stringify(p)===JSON.stringify(part)));
        if(replacingExistingSurface&&owner.id===s.id){
          // Existing walls bound the real 4.8m opening; the stricter 5.6m
          // decorative setback below continues to apply to every added band.
          const opening={...approach,scale:{...approach.scale,x:ns?4.8:6,z:ns?6:4.8}};
          expect(overlaps(world,opening),`${s.id}: authoritative doorway`).toBe(false);
        }else expect(overlaps(world,approach),`${s.id}: ${owner.id} approach`).toBe(false);
      }
      for(const road of BR_ROADS){
        const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz);
        if(!length)continue;
        const ux=dx/length,uz=dz/length,cx=(road.from.x+road.to.x)/2,cz=(road.from.z+road.to.z)/2;
        const separate=[[1,0],[0,1],[ux,uz],[-uz,ux]].some(([ax,az])=>{
          const distance=Math.abs((part.position.x-cx)*ax+(part.position.z-cz)*az);
          const skin=Math.abs(ax)*part.scale.x/2+Math.abs(az)*part.scale.z/2;
          const lane=Math.abs(ax*ux+az*uz)*length/2+Math.abs(-ax*uz+az*ux)*road.width/2;
          return distance>=skin+lane;
        });
        expect(separate,`${s.id}: ${road.id}`).toBe(true);
      }
    }
  });
  it("returns independent arrays and safely declines unsuitable dimensions",()=>{
    const s=structures[0],kit=buildBrSolarServiceFrontage(s);
    kit.cornerParts[0].position.x=0;kit.facadeParts.length=0;
    expect(buildBrSolarServiceFrontage(s).cornerParts[0].position.x).not.toBe(0);
    expect(buildBrSolarServiceFrontage(s).facadeParts.length).toBeGreaterThan(0);
    expect(buildBrSolarServiceFrontage({...s,size:{...s.size,x:0}}).replaceGenericCorners).toBe(false);
    expect(buildBrSolarServiceFrontage({...s,size:{...s.size,y:NaN}}).replaceGenericCorners).toBe(false);
  });
  it("uses low-metalness concrete bodies, dark contact trim and unchanged metal caps",()=>{
    const kit=buildBrSolarServiceFrontage(structures.find(s=>s.id==="solar-service-3")!);
    for(const p of [...kit.shellParts,...kit.cornerParts])
      expect(p.finish).toBe(p.role==="contact"?"structuralDark":p.role==="cap"?"brushedMetal":"concrete");
    expect(kit.facadeParts.slice(0,5).every(p=>p.finish==="concrete")).toBe(true);
    expect(kit.facadeParts.slice(5).filter(p=>p.finish==="frame")).toHaveLength(2);
    expect(new Set([...kit.shellParts,...kit.cornerParts].map(p=>p.finish)))
      .toEqual(new Set(["structuralDark","brushedMetal","concrete"]));
  });
});
