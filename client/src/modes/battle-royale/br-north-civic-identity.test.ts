import {describe,expect,it} from "vitest";
import {BR_STRUCTURES,BR_MAP_BLOCKS,BR_LOOT_SOCKETS} from "@planetfall/shared";
import {Box3,Vector3,Euler,Matrix4} from "three";
import {buildBrNorthCivicIdentity} from "./br-north-civic-identity";
const structures=["north-civic-archive","north-civic-exchange"].map(id=>BR_STRUCTURES.find(s=>s.id===id)!);
const bounds=(position:{x:number;y:number;z:number},scale:{x:number;y:number;z:number})=>new Box3().setFromCenterAndSize(new Vector3(position.x,position.y,position.z),new Vector3(scale.x,scale.y,scale.z));

describe("North Civic supported identity replacement",()=>{
  it("replaces six partition bays with bounded distinct archive and retail identities",()=>{
    const before=JSON.stringify([BR_STRUCTURES,BR_MAP_BLOCKS,BR_LOOT_SOCKETS]);
    const [archive,exchange]=structures.map(s=>buildBrNorthCivicIdentity(s));
    expect(archive.supported).toBe(true);expect(exchange.supported).toBe(true);
    expect(archive.parts).toHaveLength(96);expect(archive.parts.length).toBeLessThanOrEqual(100);expect(exchange.parts).toHaveLength(22);
    expect(archive.parts.filter(p=>p.name.includes("archive-bay"))).toHaveLength(12);
    expect(exchange.parts.filter(p=>p.name.includes("retail-display"))).toHaveLength(6);
    expect(archive.parts.some(p=>p.finish==="industrialOrange"&&p.position.y>4.5)).toBe(true);
    expect(exchange.parts.some(p=>p.finish==="energyPurple")).toBe(true);
    expect([...archive.parts,...exchange.parts].filter(p=>p.attachment==="ceiling")).toHaveLength(6);
    expect([...archive.parts,...exchange.parts].filter(p=>p.attachment==="ceiling").every(p=>p.finish==="windowLit")).toBe(true);
    for(const s of structures)for(const p of buildBrNorthCivicIdentity(s).parts){
      expect(p.geometry).toBe("box");expect(p.rotationY).toBe(0);
      expect(Object.values(p.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(p.scale).every(v=>Number.isFinite(v)&&v>0)).toBe(true);
    }
    expect(JSON.stringify([BR_STRUCTURES,BR_MAP_BLOCKS,BR_LOOT_SOCKETS])).toBe(before);
  });
  it("organizes shallow cartridge rows within each archive bay without crossing rails or index bands",()=>{
    const archive=buildBrNorthCivicIdentity(structures[0]);
    const rows=archive.parts.filter(p=>/cartridge-\d-\d$/.test(p.name));
    expect(rows).toHaveLength(36);
    expect(archive.parts.filter(p=>p.name.includes("cartridge-core"))).toHaveLength(12);
    for(const row of rows){
      const bay=archive.parts.find(p=>p.wallId===row.wallId&&p.name.includes("archive-bay")&&p.position.z===row.position.z)!;
      expect(row.scale.z).toBeLessThanOrEqual(bay.scale.z-.4);
      expect(row.scale.y).toBeLessThanOrEqual(.24);
      for(const rail of archive.parts.filter(p=>p.wallId===row.wallId&&(p.name.includes("catalogue-rail")||/index-\d$/.test(p.name))))
        expect(bounds(row.position,row.scale).intersectsBox(bounds(rail.position,rail.scale))).toBe(false);
    }
  });
  it("attaches complete shallow footprints to literal partitions, floors or ceiling slabs",()=>{
    for(const s of structures)for(const p of buildBrNorthCivicIdentity(s).parts){
      const support=BR_MAP_BLOCKS.find(b=>b.id===p.supportId)!;
      const b=bounds({...p.position,y:p.position.y+s.position.y},p.scale),sb=bounds(support.position,support.size);
      if(p.attachment==="wall"){
        expect(b.min.z).toBeGreaterThan(sb.min.z+.5);expect(b.max.z).toBeLessThan(sb.max.z-.5);
        expect(b.min.y).toBeGreaterThan(sb.min.y);expect(b.max.y).toBeLessThan(sb.max.y);
        const face=s.position.x>support.position.x?sb.max.x:sb.min.x;
        expect(Math.max(Math.abs(b.min.x-face),Math.abs(b.max.x-face))).toBeLessThan(.13);
      }else{
        expect(b.min.x).toBeGreaterThan(sb.min.x);expect(b.max.x).toBeLessThan(sb.max.x);
        expect(b.min.z).toBeGreaterThan(sb.min.z);expect(b.max.z).toBeLessThan(sb.max.z);
        if(p.attachment==="floor"){expect(b.min.y).toBeGreaterThanOrEqual(sb.max.y);expect(b.max.y-sb.max.y).toBeLessThan(.02);}
        else{expect(b.max.y).toBeLessThan(sb.min.y);expect(sb.min.y-b.min.y).toBeLessThan(.03);}
      }
      for(const loot of BR_LOOT_SOCKETS.filter(l=>l.structureId===s.id))expect(b.intersectsBox(bounds(loot.position,{x:1.7,y:2.1,z:1.7}))).toBe(false);
      for(const block of BR_MAP_BLOCKS.filter(block=>block.id.startsWith(`${s.id}-`)&&block.kind==="ramp")){
        const ramp=bounds({x:0,y:0,z:0},block.size).applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(block.rotation?.x,block.rotation?.y,block.rotation?.z))).translate(new Vector3(block.position.x,block.position.y,block.position.z));
        expect(b.intersectsBox(ramp.expandByScalar(.08))).toBe(false);
      }
      // All replacement pieces remain behind the front aisle and off the doorway.
      expect(Math.abs(p.position.x-s.position.x)).toBeLessThan(s.size.x/2-1);
    }
  });
  it("declines incomplete support and obstruction instead of suppressing generic dressing",()=>{
    for(const s of structures){
      expect(buildBrNorthCivicIdentity(s,[])).toEqual({supported:false,parts:[]});
      expect(buildBrNorthCivicIdentity({...s,enterable:false}).supported).toBe(false);
      const first=buildBrNorthCivicIdentity(s).parts[0];
      const blocked=[...BR_LOOT_SOCKETS,{...BR_LOOT_SOCKETS[0],structureId:s.id,position:{...first.position,y:first.position.y+s.position.y}}];
      expect(buildBrNorthCivicIdentity(s,BR_MAP_BLOCKS,blocked)).toEqual({supported:false,parts:[]});
      const missing=BR_MAP_BLOCKS.filter(b=>b.id!==first.wallId);
      expect(buildBrNorthCivicIdentity(s,missing).supported).toBe(false);
    }
  });
  it("applies elevation once and returns independent transforms",()=>{
    const s=structures[0],base=buildBrNorthCivicIdentity(s),lift=12;
    const raised=buildBrNorthCivicIdentity({...s,position:{...s.position,y:lift}},BR_MAP_BLOCKS.map(b=>b.id.startsWith(`${s.id}-`)?{...b,position:{...b.position,y:b.position.y+lift}}:b),BR_LOOT_SOCKETS.map(l=>l.structureId===s.id?{...l,position:{...l.position,y:l.position.y+lift}}:l));
    expect(raised.supported).toBe(true);
    raised.parts.forEach((p,i)=>expect(p.position.y).toBeCloseTo(base.parts[i].position.y));
    base.parts[0].position.x=100;expect(buildBrNorthCivicIdentity(s).parts[0].position.x).not.toBe(100);
  });
});
