import {describe,expect,it,vi} from "vitest";
import * as THREE from "three";
import {BR_MAP_BLOCKS,BR_ROADS,BR_STRUCTURES,BR_TERRACES,BR_POIS} from "@planetfall/shared";
import {brAuthoredRoomTint,brAuthoredWallFinish} from "./br-authored-wall-finish";
import {BrMaterialLibrary} from "./br-materials";
const luminance=(c:THREE.Color)=>c.r*.2126+c.g*.7152+c.b*.0722;

describe("literal authored wall and slab finishes",()=>{
  it("gives actual room partitions medium neutral paint without changing structure slabs or unrelated solids",()=>{
    const before=JSON.stringify(BR_MAP_BLOCKS);
    const partitions=BR_MAP_BLOCKS.filter(b=>b.kind==="wall"&&b.id.includes("-room-"));
    expect(partitions.length).toBeGreaterThan(100);
    for(const block of partitions){
      const finish=brAuthoredWallFinish(block);
      expect(finish.kind).toBe("room-wall");
      expect(luminance(finish.wallTint)).toBeGreaterThan(.2);
      expect(luminance(finish.wallTint)).toBeLessThan(.34);
    }
    const terraceIds=new Set(BR_TERRACES.flatMap(t=>[`${t.id}-platform`,`${t.id}-ramp`]));
    for(const block of BR_MAP_BLOCKS.filter(b=>(b.kind==="platform"||b.kind==="ramp")&&!terraceIds.has(b.id)&&!BR_ROADS.some(r=>b.id===`${r.id}-surface`)&&!BR_STRUCTURES.some(s=>s.roofAccess&&b.id===`${s.id}-roof-ramp`)&&BR_STRUCTURES.some(s=>b.id.startsWith(`${s.id}-`)))){
      const f=brAuthoredWallFinish(block);expect(f.kind).toBe("interior-slab");
      expect(f.slab.top.getHexString()).toBe("263548");expect(f.slab.side.getHexString()).toBe("b7c6cb");
      expect(f.slab.underside).toEqual(f.slab.side);
    }
    for(const block of BR_MAP_BLOCKS.filter(b=>b.kind==="cover"||b.id.startsWith("bridge-pier-")||b.id.endsWith("-trunk")))expect(brAuthoredWallFinish(block).kind).toBe("unchanged");
    expect(JSON.stringify(BR_MAP_BLOCKS)).toBe(before);
  });
  it("isolates every canonical road surface in one dark engineered slab batch",()=>{
    const before=JSON.stringify(BR_MAP_BLOCKS),ids=new Set(BR_ROADS.map(road=>`${road.id}-surface`));
    const slabs=BR_MAP_BLOCKS.filter(block=>ids.has(block.id)&&(block.kind==="ramp"||block.kind==="platform"));
    expect(slabs.length).toBeGreaterThan(20);
    const keys=new Set<string>(),palettes=new Set<string>();
    for(const block of slabs){
      const f=brAuthoredWallFinish(block);expect(f.kind,block.id).toBe("exterior-road-slab");
      keys.add(f.slabBatchKey);palettes.add([f.slab.top,f.slab.side,f.slab.underside].map(c=>c.getHexString()).join(":"));
      expect(luminance(f.slab.side)).toBeGreaterThan(.04);expect(luminance(f.slab.side)).toBeLessThan(.09);
      expect(luminance(f.slab.underside)).toBeLessThan(luminance(f.slab.side));
      expect(f.slab.top.getHexString()).toBe("263548");
      const recolored=brAuthoredWallFinish({...block,color:"#ffffff",districtId:"custom"},[],[{id:"custom",color:"#ff00ff"}]);
      expect(recolored.slab).toEqual(f.slab);expect(recolored.slabBatchKey).toBe(f.slabBatchKey);
      const unknown=brAuthoredWallFinish({...block,id:`unknown-${block.id}`});
      expect(unknown.kind).toBe("interior-slab");expect(unknown.slab.side.getHexString()).toBe("b7c6cb");
    }
    expect([...keys]).toEqual(["road-slab"]);expect(palettes.size).toBe(1);
    const nova=BR_MAP_BLOCKS.find(block=>block.id==="ring-nova-east-surface")!;
    expect(brAuthoredWallFinish(nova).kind).toBe("exterior-road-slab");
    expect(brAuthoredWallFinish({...nova,kind:"wall"}).kind).not.toBe("exterior-road-slab");
    const isolated=brAuthoredWallFinish(nova);isolated.slab.side.set("#ffffff");
    expect(brAuthoredWallFinish(nova).slab.side.getHexString()).toBe("424e5b");
    expect(JSON.stringify(BR_MAP_BLOCKS)).toBe(before);
  });
  it("finishes only literal exterior roof-access ramps with bounded dark district metal",()=>{
    const before=JSON.stringify(BR_MAP_BLOCKS),keys=new Set<string>();
    const ramps=BR_MAP_BLOCKS.filter(b=>BR_STRUCTURES.some(s=>s.roofAccess&&b.id===`${s.id}-roof-ramp`));
    expect(ramps.length).toBeGreaterThan(5);
    for(const block of ramps){
      const finish=brAuthoredWallFinish(block);
      expect(finish.kind,block.id).toBe("exterior-roof-ramp");
      expect(finish.slabBatchKey).toBe(`roof-ramp:${finish.family}`);
      expect(luminance(finish.slab.side)).toBeGreaterThan(.05);
      expect(luminance(finish.slab.side)).toBeLessThan(.14);
      expect(luminance(finish.slab.underside)).toBeLessThan(luminance(finish.slab.side));
      expect(finish.slab.top.getHexString()).toBe("263548");keys.add(finish.slabBatchKey);
      const unknown=brAuthoredWallFinish({...block,id:`${block.id}-unknown`});
      expect(unknown.kind).toBe("interior-slab");expect(unknown.slab.side.getHexString()).toBe("b7c6cb");
    }
    expect(keys.size).toBeLessThanOrEqual(8);
    const nova=brAuthoredWallFinish(BR_MAP_BLOCKS.find(b=>b.id==="nova-studio-roof-ramp")!);
    expect(nova.family).toBe("nova");expect(nova.kind).toBe("exterior-roof-ramp");
    expect(JSON.stringify(BR_MAP_BLOCKS)).toBe(before);
  });
  it("uses explicit terrace and basin ownership and eight bounded darker face palettes",()=>{
    const seen=new Set<string>();
    for(const terrace of BR_TERRACES){
      const block=BR_MAP_BLOCKS.find(b=>b.id===`${terrace.id}-platform`);if(!block)continue;
      const f=brAuthoredWallFinish(block);expect(f.kind,block.id).toBe("district-slab");
      expect(luminance(f.slab.side),block.id).toBeLessThan(.16);
      expect(luminance(f.slab.side),block.id).toBeGreaterThan(.035);
      expect(luminance(f.slab.underside)).toBeLessThan(luminance(f.slab.side));
      expect(f.slab.top.getHexString()).toBe("263548");seen.add(f.family);
    }
    expect(seen.size).toBeGreaterThan(3);expect(seen.size).toBeLessThanOrEqual(8);
    for(const block of BR_MAP_BLOCKS.filter(b=>b.id.includes("-retaining-")))expect(brAuthoredWallFinish(block).kind).toBe("retaining-wall");
    const farm=brAuthoredWallFinish(BR_MAP_BLOCKS.find(b=>b.id==="farm-production-deck-platform")!);
    const nova=brAuthoredWallFinish(BR_MAP_BLOCKS.find(b=>b.id==="nova-commercial-deck-platform")!);
    expect(farm.family).toBe("farm");expect(nova.family).toBe("nova");
    expect(farm.slab.side.g).toBeGreaterThan(farm.slab.side.r);
    expect(nova.slab.side.r).toBeGreaterThan(nova.slab.side.g);
    const fake={...BR_MAP_BLOCKS.find(b=>b.id==="nova-commercial-deck-platform")!,id:"unknown-platform"};
    expect(brAuthoredWallFinish(fake).kind).toBe("interior-slab");
    const first=brAuthoredWallFinish(fake);first.slab.top.set(0xffffff);
    expect(brAuthoredWallFinish(fake).slab.top.getHexString()).toBe("263548");
  });
  it("prioritizes literal terraces over overlapping structure prefixes for both finish and palette",()=>{
    const block=BR_MAP_BLOCKS.find(b=>b.id==="astra-lab-court-platform")!;
    const owner=BR_STRUCTURES.find(s=>s.id==="astra-lab")!;
    expect(owner).toBeDefined();expect(block).toBeDefined();
    const finish=brAuthoredWallFinish(block,[{...owner,color:"#ff6bba"}],[{id:block.districtId,color:"#63ef8b"}]);
    expect(finish.kind).toBe("district-slab");expect(finish.family).toBe("farm");
    expect(finish.sourceColor).toBe("#63ef8b");
  });
  it("caches eight room materials and one replacement slab while borrowing and disposing maps exactly once",()=>{
    const context=new Proxy({}, {get:(_,key)=>key==="createLinearGradient"?()=>({addColorStop(){}}):()=>{}});
    vi.stubGlobal("document",{createElement:()=>({getContext:()=>context})});
    try{
      const lib=new BrMaterialLibrary(),wall=lib.get("interiorWall") as THREE.MeshStandardMaterial,floor=lib.get("interiorFloor") as THREE.MeshStandardMaterial;
      const original=wall.color.clone(),room=new Set<THREE.MeshStandardMaterial>();
      for(let hue=0;hue<360;hue++)room.add(lib.authoredRoomWall(new THREE.Color().setHSL(hue/360,.8,.5)));
      expect(room.size).toBe(8);
      for(const m of room){
        expect(m.bumpMap).toBe(wall.bumpMap);expect(m.roughnessMap).toBe(wall.roughnessMap);expect(m.map).toBe(wall.map);
        expect(m.emissive.getHex()).toBe(0);expect(m.vertexColors).toBe(false);expect(m.metalness).toBe(.04);
      }
      for(const poi of BR_POIS)expect(lib.authoredRoomWall(poi.color).color).toEqual(brAuthoredRoomTint(poi.color));
      const slab=lib.authoredSlabMaterial();expect(lib.authoredSlabMaterial()).toBe(slab);
      expect(slab.color.getHex()).toBe(0xffffff);expect(slab.vertexColors).toBe(true);expect(slab.emissive.getHex()).toBe(0);
      expect(slab.bumpMap).toBe(floor.bumpMap);expect(slab.roughnessMap).toBe(floor.roughnessMap);
      expect(wall.color).toEqual(original);
      const disposals=[...room,slab].map(m=>vi.spyOn(m,"dispose"));
      const textureDispose=vi.spyOn(wall.bumpMap!,"dispose");
      lib.dispose();lib.dispose();
      for(const spy of disposals)expect(spy).toHaveBeenCalledTimes(1);
      expect(textureDispose).toHaveBeenCalledTimes(1);
    }finally{vi.unstubAllGlobals();}
  });
});
