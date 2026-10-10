import {describe,expect,it} from "vitest";
import {BR_STRUCTURES,BR_ROADS,BR_MAP_BLOCKS,BR_NAV_NODES,BR_LOOT_SOCKETS,BR_GREENWAY_TREES,brRoadIntersectsFootprint,brAuthoredDeckHeight} from "./index.js";

const ids=["coolant-frontage-office","coolant-frontage-maintenance"];
describe("occupied Coolant approach",()=>{
  it("appends opposing enterable parcels with internal elevation and supported loot",()=>{
    expect(BR_STRUCTURES.slice(185,187).map(s=>s.id)).toEqual(ids);
    for(const id of ids){
      const s=BR_STRUCTURES.find(s=>s.id===id)!;
      expect(s.enterable).toBe(true);expect(s.roofAccess).toBe(false);expect(s.position.y).toBe(0);
      expect(brAuthoredDeckHeight(s.position)).toBe(0);
      expect(BR_MAP_BLOCKS.find(b=>b.id===`${id}-floor`)).toBeDefined();
      expect(BR_MAP_BLOCKS.filter(b=>b.id.startsWith(`${id}-`)&&b.kind==="wall").length).toBeGreaterThanOrEqual(5);
      expect(BR_LOOT_SOCKETS.filter(l=>l.structureId===id&&l.kind==="interior").length).toBeGreaterThanOrEqual(2);
      for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,s.position,s.size,.5),`${id}/${road.id}`).toBe(false);
    }
    const office=BR_STRUCTURES.find(s=>s.id===ids[0])!,service=BR_STRUCTURES.find(s=>s.id===ids[1])!;
    expect(office.entrance).toBe("east");expect(service.entrance).toBe("west");expect(office.floors).toBe(2);
    expect(BR_MAP_BLOCKS.find(b=>b.id===`${office.id}-stairs-1`)).toBeDefined();
    expect(BR_LOOT_SOCKETS.find(l=>l.id===`${office.id}-upper-loot`)!.position.y).toBeGreaterThan(5.5);
  });
  it("joins two existing streets at exact support heights and in the navigation graph",()=>{
    const street=BR_ROADS.find(r=>r.id==="coolant-frontage-street")!,north=BR_ROADS.find(r=>r.id==="coolant-frontage-north")!;
    expect(street.from).toEqual({x:37,y:.1,z:58});expect(street.to).toEqual(north.from);
    expect(north.to).toEqual({x:70+10*63/95,y:.1,z:121});
    const a=BR_NAV_NODES.find(n=>Math.abs(n.position.x-37)<.001&&n.position.z===58)!;
    const b=BR_NAV_NODES.find(n=>Math.abs(n.position.x-north.to.x)<.001&&n.position.z===121)!;
    expect(a.neighbors).toContain("road-70:0.1:58");expect(b.neighbors).toContain("road-80:0.1:153");
    expect(street.width).toBe(6);expect(north.width).toBe(6);
  });
  it("preserves the garden trunks, basin and clear doorway approaches",()=>{
    const streets=BR_ROADS.filter(r=>r.id.startsWith("coolant-frontage-"));
    expect(BR_GREENWAY_TREES.filter(t=>t.band==="central-garden").map(t=>t.id)).toEqual([0,1,2,3,4,5,6].map(i=>`greenway-central-garden-${i}`));
    for(const trunk of BR_MAP_BLOCKS.filter(b=>b.id.startsWith("greenway-central-garden-")&&b.id.endsWith("-trunk"))){
      for(const road of streets)expect(brRoadIntersectsFootprint(road,trunk.position,trunk.size,.5),trunk.id).toBe(false);
      for(const id of ids){const s=BR_STRUCTURES.find(s=>s.id===id)!;expect(Math.abs(s.position.z-trunk.position.z)-(s.size.z+trunk.size.z)/2).toBeGreaterThan(2);}
    }
    expect(BR_STRUCTURES.find(s=>s.id==="transit-cafe")!.position).toEqual({x:110,y:-3,z:76});
    for(const id of ids){const s=BR_STRUCTURES.find(s=>s.id===id)!;
      for(const b of BR_MAP_BLOCKS.filter(b=>!b.id.startsWith(`${id}-`)&&b.kind!=="platform")){
        const xMin=Math.min(37,s.position.x),xMax=Math.max(37,s.position.x);
        const crosses=b.position.x+b.size.x/2>xMin&&b.position.x-b.size.x/2<xMax&&Math.abs(b.position.z-98)<b.size.z/2+1.6&&b.position.y-b.size.y/2<2;
        expect(crosses,`${id} door/${b.id}`).toBe(false);
      }
    }
  });
});
