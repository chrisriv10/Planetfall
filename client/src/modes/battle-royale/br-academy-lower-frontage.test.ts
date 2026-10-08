import {describe,expect,it,vi} from "vitest";
import * as THREE from "three";
import {BR_ELEVATION_REGIONS,BR_MAP_BLOCKS,BR_ROADS,BR_STRUCTURES} from "@planetfall/shared";
import {buildBrAcademyLowerFrontage,createBrAcademyLowerFrontage} from "./br-academy-lower-frontage";

const deck=BR_ELEVATION_REGIONS.find(region=>region.id==="astra-campus-deck")!;
const bounds=(p:ReturnType<typeof buildBrAcademyLowerFrontage>[number])=>({
  x0:p.position.x-p.scale.x/2,x1:p.position.x+p.scale.x/2,
  y0:p.position.y-p.scale.y/2,y1:p.position.y+p.scale.y/2,
  z0:p.position.z-p.scale.z/2,z1:p.position.z+p.scale.z/2,
});
describe("Academy lower retaining frontage",()=>{
  it("attaches a bounded five-bay rhythm to the authoritative north retaining face",()=>{
    const before=JSON.stringify([BR_ELEVATION_REGIONS,BR_MAP_BLOCKS,BR_ROADS,BR_STRUCTURES]);
    const parts=buildBrAcademyLowerFrontage();
    expect(parts).toHaveLength(38);
    expect(parts.filter(p=>p.role==="panel")).toHaveLength(5);
    expect(parts.filter(p=>p.role==="indicator")).toHaveLength(2);
    const support=BR_MAP_BLOCKS.find(b=>b.id==="astra-campus-deck-platform")!;
    expect(support.position.z+support.size.z/2).toBe(deck.z+deck.depth/2);
    for(const part of parts){
      const b=bounds(part);
      expect([...Object.values(part.position),...Object.values(part.scale)].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(n=>n>0)).toBe(true);
      expect(b.x0).toBeGreaterThanOrEqual(deck.x-deck.width/2+3.9);
      expect(b.x1).toBeLessThanOrEqual(deck.x-deck.width/2+36.1);
      expect(b.y0).toBeGreaterThan(0);
      expect(b.y1).toBeLessThan(deck.height);
      // Shallow surface skins, never deep boxes reading as usable cover.
      expect(b.z0).toBeGreaterThanOrEqual(deck.z+deck.depth/2-.001);
      expect(b.z1).toBeLessThanOrEqual(deck.z+deck.depth/2+.11);
    }
    expect(buildBrAcademyLowerFrontage()).toEqual(parts);
    expect(JSON.stringify([BR_ELEVATION_REGIONS,BR_MAP_BLOCKS,BR_ROADS,BR_STRUCTURES])).toBe(before);
  });
  it("leaves actual road rectangles, access ramps and the dorm entrance approach empty",()=>{
    for(const part of buildBrAcademyLowerFrontage()){
      const b=bounds(part);
      for(const road of BR_ROADS){
        if(b.y0>Math.max(road.from.y,road.to.y)+.5)continue;
        const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz);
        if(!length)continue;
        const ux=dx/length,uz=dz/length,cx=(road.from.x+road.to.x)/2,cz=(road.from.z+road.to.z)/2;
        // Rectangle SAT on both world and road axes, using full skin widths.
        const separate=[[1,0],[0,1],[ux,uz],[-uz,ux]].some(([ax,az])=>{
          const gap=Math.abs((part.position.x-cx)*ax+(part.position.z-cz)*az);
          const art=Math.abs(ax)*part.scale.x/2+Math.abs(az)*part.scale.z/2;
          const lane=Math.abs(ax*ux+az*uz)*length/2+Math.abs(-ax*uz+az*ux)*road.width/2;
          return gap>=art+lane;
        });
        expect(separate,`${part.role}: ${road.id}`).toBe(true);
      }
      for(const s of BR_STRUCTURES){
        expect(b.x1<=s.position.x-s.size.x/2||b.x0>=s.position.x+s.size.x/2
          ||b.z1<=s.position.z-s.size.z/2||b.z0>=s.position.z+s.size.z/2,`${part.role}: ${s.id}`).toBe(true);
      }
      const dorm=BR_STRUCTURES.find(s=>s.id==="academy-dorms-1")!;
      expect(dorm.entrance).toBe("east");
      const doorX=dorm.position.x+dorm.size.x/2;
      expect(b.x1<=doorX||b.x0>=doorX+6||b.z1<=dorm.position.z-2.5||b.z0>=dorm.position.z+2.5).toBe(true);
    }
  });
  it("follows supplied deck bounds and omits unsuitable decks",()=>{
    const moved={...deck,x:deck.x+10,z:deck.z-20,height:10};
    const original=buildBrAcademyLowerFrontage(),parts=buildBrAcademyLowerFrontage(moved);
    expect(parts).toHaveLength(original.length);
    parts.forEach((part,i)=>{
      expect(part.position.x).toBeCloseTo(original[i].position.x+10);
      expect(part.position.z).toBeCloseTo(original[i].position.z-20);
      expect(bounds(part).y1).toBeLessThan(10);
    });
    expect(buildBrAcademyLowerFrontage({...deck,height:0})).toEqual([]);
    expect(buildBrAcademyLowerFrontage({...deck,width:20})).toEqual([]);
  });
  it("batches borrowed resources and disposes only instance allocations once",()=>{
    const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial();
    const geometryDispose=vi.spyOn(geometry,"dispose"),materialDispose=vi.spyOn(material,"dispose");
    const kit=createBrAcademyLowerFrontage({unitBox:geometry,get:()=>material});
    const scene=new THREE.Group();scene.add(kit.group);
    expect(kit.group.children).toHaveLength(4);
    const meshes=kit.group.children as THREE.InstancedMesh[];
    expect(meshes.reduce((sum,mesh)=>sum+mesh.count,0)).toBe(38);
    const disposal=meshes.map(mesh=>vi.spyOn(mesh,"dispose"));
    for(const mesh of meshes){expect(mesh.geometry).toBe(geometry);expect(mesh.material).toBe(material);expect(mesh.boundingSphere).not.toBeNull();}
    kit.dispose();kit.dispose();
    expect(scene.children).toHaveLength(0);expect(kit.group.children).toHaveLength(0);
    for(const dispose of disposal)expect(dispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).not.toHaveBeenCalled();expect(materialDispose).not.toHaveBeenCalled();
    geometry.dispose();material.dispose();
  });
});
