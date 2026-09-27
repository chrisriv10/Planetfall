import { describe, expect, it } from "vitest";
import { BR_DISTRICT_PLANS, BR_ISLAND_OUTLINE, BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_POIS, BR_ROADS, BR_STRUCTURES, BR_TRAVERSAL } from "@planetfall/shared";
import { buildBrAuthoredDistrictProps } from "./br-authored-district-props";

const segmentDistance = (p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx=b.x-a.x,dz=b.z-a.z,squared=dx*dx+dz*dz;
  const t=squared?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/squared)):0;
  return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);
};

describe("fixed primary district prop composition",()=>{
  it("covers all nine POIs with explicit stable contexts, no input mutation and a small budget",()=>{
    const before=JSON.stringify([BR_POIS,BR_ROADS,BR_STRUCTURES,BR_MAP_BLOCKS]);
    const all=BR_POIS.flatMap(buildBrAuthoredDistrictProps);
    expect(new Set(all.map(group=>group.poiId)).size).toBe(9);
    expect(all).toHaveLength(29);
    expect(new Set(all.map(group=>group.id)).size).toBe(all.length);
    expect(all.reduce((count,group)=>count+group.parts.length,0)).toBe(188);
    for(const poi of BR_POIS){
      const groups=buildBrAuthoredDistrictProps(poi);
      expect(groups.length).toBeGreaterThanOrEqual(2);expect(groups.length).toBeLessThanOrEqual(poi.id==="nova-plaza"?7:3);
      expect(buildBrAuthoredDistrictProps({id:poi.id})).toEqual(groups);
      expect(groups.every(group=>group.context.length>8&&group.parts.length<=7)).toBe(true);
    }
    expect(BR_POIS.slice().reverse().flatMap(buildBrAuthoredDistrictProps).sort((a,b)=>a.id.localeCompare(b.id)))
      .toEqual(all.slice().sort((a,b)=>a.id.localeCompare(b.id)));
    expect(buildBrAuthoredDistrictProps({id:"unknown-secondary"})).toEqual([]);
    expect(JSON.stringify([BR_POIS,BR_ROADS,BR_STRUCTURES,BR_MAP_BLOCKS])).toBe(before);
  });

  it.each(BR_POIS)("keeps $id clear of roads, buildings, approaches, blocks, loot, open zones and traversal",poi=>{
    const all=BR_POIS.flatMap(buildBrAuthoredDistrictProps);
    for(const [index,group] of all.entries()){
      if(group.poiId!==poi.id)continue;
      const p=group.center,r=group.radius;
      for(const road of BR_ROADS) expect(segmentDistance(p,road.from,road.to),`${group.id}: ${road.id}`).toBeGreaterThanOrEqual(road.width/2+r+2);
      for(const structure of BR_STRUCTURES){
        const gap=Math.hypot(Math.max(0,Math.abs(p.x-structure.position.x)-structure.size.x/2),
          Math.max(0,Math.abs(p.z-structure.position.z)-structure.size.z/2));
        expect(gap,`${group.id}: ${structure.id}`).toBeGreaterThanOrEqual(r+3);
        if(structure.enterable){
          const ns=structure.entrance==="north"||structure.entrance==="south";
          const sign=structure.entrance==="north"||structure.entrance==="east"?1:-1;
          const doorX=structure.position.x+(ns?0:sign*(structure.size.x/2+3));
          const doorZ=structure.position.z+(ns?sign*(structure.size.z/2+3):0);
          // Five metre frontage, six metres outward from the authoritative door.
          const approachGap=Math.hypot(Math.max(0,Math.abs(p.x-doorX)-(ns?2.5:3)),
            Math.max(0,Math.abs(p.z-doorZ)-(ns?3:2.5)));
          expect(approachGap,`${group.id}: entrance ${structure.id}`).toBeGreaterThanOrEqual(r+1);
        }
      }
      for(const block of BR_MAP_BLOCKS){
        expect(Math.hypot(p.x-block.position.x,p.z-block.position.z),`${group.id}: ${block.id}`)
          .toBeGreaterThanOrEqual(Math.hypot(block.size.x,block.size.y,block.size.z)/2+r+2);
      }
      for(const t of BR_TRAVERSAL) expect(Math.hypot(p.x-t.position.x,p.z-t.position.z)).toBeGreaterThanOrEqual(r+9);
      for(const loot of BR_LOOT_SOCKETS) expect(Math.hypot(p.x-loot.position.x,p.z-loot.position.z),`${group.id}: loot ${loot.id}`)
        .toBeGreaterThanOrEqual(r+1);
      for(const plan of BR_DISTRICT_PLANS)expect(Math.hypot(p.x-plan.openZone.position.x,p.z-plan.openZone.position.z),`${group.id}: open ${plan.id}`)
        .toBeGreaterThanOrEqual(r+plan.openZone.radius+1);
      for(const other of all.slice(index+1)) expect(Math.hypot(p.x-other.center.x,p.z-other.center.z)).toBeGreaterThanOrEqual(r+other.radius+2);
      let inside=false;
      for(let i=0,j=BR_ISLAND_OUTLINE.length-1;i<BR_ISLAND_OUTLINE.length;j=i++){
        const [x,z]=BR_ISLAND_OUTLINE[i],[px,pz]=BR_ISLAND_OUTLINE[j];
        expect(segmentDistance(p,{x,z},{x:px,z:pz})).toBeGreaterThanOrEqual(r+5);
        if((z>p.z)!==(pz>p.z)&&p.x<(px-x)*(p.z-z)/(pz-z)+x)inside=!inside;
      }
      expect(inside).toBe(true);
    }
  });

  it("authors five distinct Nova street pockets with fixed street-facing rotations and a restrained instance delta",()=>{
    const nova=buildBrAuthoredDistrictProps({id:"nova-plaza"});
    const street=nova.slice(2);
    expect(street.map(group=>[group.center.x,group.center.z,group.kit])).toEqual([
      [-238,-147,"garden"],[-238,-123,"waiting"],[-198,-123,"garden"],
      [-162,-147,"waiting"],[-158,-123,"garden"],
    ]);
    expect(street.map(group=>group.parts[0].rotationY)).toEqual([Math.PI,Math.PI,Math.PI/2,Math.PI*1.5,Math.PI*1.5]);
    expect(street.flatMap(group=>group.parts)).toHaveLength(32);
    expect(street.filter(group=>group.kit==="garden")).toHaveLength(3);
    expect(street.flatMap(group=>group.parts).filter(part=>part.finish==="windowLit")).toHaveLength(2);
    for(const group of street){
      // Every new pocket is 12m off Street A, rather than distant filler at the
      // district perimeter. The radius includes each planter crown and lamp.
      expect(Math.abs(group.center.z+135)).toBe(12);
      expect(group.radius).toBe(3);
    }
    const first=nova[2];first.parts[0].position.x=0;first.center.x=0;
    expect(buildBrAuthoredDistrictProps({id:"nova-plaza"})[2].center.x).toBe(-238);
    expect(buildBrAuthoredDistrictProps({id:"nova-plaza"})[2].parts[0].position.x).toBe(-238);
  });

  it("bounds finite transforms without broad opaque eye-level cover or solid cargo stacks",()=>{
    for(const group of BR_POIS.flatMap(buildBrAuthoredDistrictProps))for(const part of group.parts){
      expect([...Object.values(part.position),part.rotationY].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(n=>Number.isFinite(n)&&n>0)).toBe(true);
      const factor=part.geometry==="box"?.5:1,vertical=part.geometry==="octahedron"?1:.5;
      expect(part.position.y-part.scale.y*vertical).toBeGreaterThanOrEqual(0);
      if(part.surface)expect(part.position.y+part.scale.y/2).toBeLessThan(.06);
      if(part.finish!=="canopy"&&part.position.y+part.scale.y*vertical>.45){
        expect(part.scale.x*factor*2).toBeLessThanOrEqual(.28);
        expect(part.scale.z*factor*2).toBeLessThanOrEqual(.28);
      }
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const dx=part.position.x-group.center.x+Math.cos(part.rotationY)*sx*part.scale.x*factor+Math.sin(part.rotationY)*sz*part.scale.z*factor;
        const dz=part.position.z-group.center.z-Math.sin(part.rotationY)*sx*part.scale.x*factor+Math.cos(part.rotationY)*sz*part.scale.z*factor;
        expect(Math.hypot(dx,dz)).toBeLessThan(group.radius);
      }
    }
  });
});
