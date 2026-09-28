import { describe, expect, it } from "vitest";
import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_STRUCTURES, type BrMapBlock } from "@planetfall/shared";
import { buildRetailInterior } from "./br-retail-interiors";

describe("retail interior visual placement", () => {
  it("mounts every display on an authoritative divider without crossing its doorway", () => {
    let count=0;
    for (const structure of BR_STRUCTURES) for (const part of buildRetailInterior(structure).parts) {
      count++;
      const wall=BR_MAP_BLOCKS.find(b => {
        if(!b.id.startsWith(`${structure.id}-room-`))return false;
        const alongX=b.size.x>=b.size.z;
        const lateral=alongX?"x":"z",normal=alongX?"z":"x";
        const sign=(alongX?structure.entrance==="north":structure.entrance==="east")?1:-1;
        const face=b.position[normal]+sign*b.size[normal]/2;
        const distance=(part.position[normal]-face)*sign;
        return Math.abs(part.position[lateral]-b.position[lateral])+part.scale[lateral]/2<b.size[lateral]/2
          &&distance-part.scale[normal]/2>0&&distance+part.scale[normal]/2<.7
          &&part.position.y-part.scale.y/2>b.position.y-b.size.y/2-structure.position.y
          &&part.position.y+part.scale.y/2<b.position.y+b.size.y/2-structure.position.y+.001;
      });
      expect(wall).toBeDefined();
      const wallBottom=wall!.position.y-wall!.size.y/2-structure.position.y;
      const wallTop=wall!.position.y+wall!.size.y/2-structure.position.y;
      expect(part.position.y-part.scale.y/2).toBeGreaterThan(wallBottom);
      expect(part.position.y+part.scale.y/2).toBeLessThan(wallTop+.001);
      expect(Object.values(part.scale).every(v=>v>0&&Number.isFinite(v))).toBe(true);
    }
    expect(count).toBeGreaterThan(100);
  });
  it("orients east/west retail along Z walls and keeps every scale positive",()=>{
    const base=BR_STRUCTURES.find(s=>s.enterable&&s.archetype==="shop")!;
    for(const entrance of ["east","west"] as const){
      const structure={...base,id:"retail-axis-test",entrance,position:{x:10,y:0,z:20},size:{...base.size,x:22,z:22}};
      const wall:BrMapBlock={id:`${structure.id}-room-display`,districtId:base.districtId,
        position:{x:10,y:2,z:20},size:{x:.6,y:4,z:18},color:"#fff",kind:"wall"};
      const before=JSON.stringify([structure,wall]);
      const floor:BrMapBlock={id:`${structure.id}-floor`,districtId:base.districtId,
        position:{x:10,y:.18,z:20},size:{x:22,y:.36,z:22},color:"#fff",kind:"platform"};
      const result=buildRetailInterior(structure,[wall,floor]),sign=entrance==="east"?1:-1;
      expect(result.parts.length).toBeGreaterThan(20);
      expect(buildRetailInterior(structure,[wall,floor])).toEqual(result);
      for(const part of result.parts){
        expect(Object.values(part.scale).every(value=>value>0&&Number.isFinite(value))).toBe(true);
        expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
        expect((part.position.x-(10+sign*.3))*sign-part.scale.x/2).toBeGreaterThan(0);
        expect(Math.abs(part.position.z-20)+part.scale.z/2).toBeLessThan(9);
      }
      expect(result.signs.every(label=>label.rotationY===sign*Math.PI/2)).toBe(true);
      expect(JSON.stringify([structure,wall])).toBe(before);
      for(const bad of [{...wall,size:{x:.6,y:4,z:2}},{...wall,size:{x:.6,y:2,z:18}},
        {...wall,size:{x:NaN,y:4,z:18}},{...wall,rotation:{x:0,y:.2,z:0}}])
        expect(buildRetailInterior(structure,[bad,floor])).toEqual({parts:[],signs:[]});
    }
  });
  it("leaves loot sockets unobstructed and uses compact mounted signs", () => {
    for(const structure of BR_STRUCTURES) {
      const {parts,signs}=buildRetailInterior(structure);
      for(const socket of BR_LOOT_SOCKETS.filter(s=>s.structureId===structure.id)) for(const part of parts) {
        const overlaps=Math.abs(socket.position.x-part.position.x)<part.scale.x/2+.5 &&
          Math.abs(socket.position.y-structure.position.y-part.position.y)<part.scale.y/2+.5 &&
          Math.abs(socket.position.z-part.position.z)<part.scale.z/2+.5;
        expect(overlaps).toBe(false);
      }
      for(const sign of signs) {
        expect(sign.width).toBeLessThan(6);
        const storey=structure.size.y/structure.floors;
        expect(sign.position.y%storey).toBeGreaterThan(3);
        expect(sign.position.y%storey).toBeLessThan(3.35);
      }
    }
  });
  it("does not decorate non-enterable or non-retail structures", () => {
    for(const structure of BR_STRUCTURES.filter(s=>!s.enterable||!["shop","mall"].includes(s.archetype)))
      expect(buildRetailInterior(structure)).toEqual({parts:[],signs:[]});
  });
});
