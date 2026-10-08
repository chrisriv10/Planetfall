import { describe, expect, it } from "vitest";
import { BR_BASE_DECK_CELLS, BR_ELEVATION_REGIONS, BR_SECONDARY_GRADE_REGIONS, BR_TERRACES, BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_POIS, BR_ROADS, BR_ROAD_ROUTES, BR_STRUCTURES, brAuthoredDeckHeight, brBaseDeckHeight, brFlatDeckCollision, brFloorHeightAt, brRoadGradeFloorAt, brJoinServiceGrades } from "./index.js";

describe("authored multilevel Orbital Isle",()=>{
  it("does not extend a grade endpoint into its descending continuation",()=>{
    const road=BR_ROADS.filter(r=>r.id.startsWith("transit-court-north-link")).at(-1)!;
    const block=BR_MAP_BLOCKS.find(b=>b.id===`${road.id}-surface`)!;
    const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz);
    const beyond={x:road.to.x+dx/length*.15,y:road.to.y,z:road.to.z+dz/length*.15};
    expect(brRoadGradeFloorAt(block,beyond,.38)).toBeNull();
    expect(brRoadGradeFloorAt(block,road.to,.38)).toBeCloseTo(road.to.y-.1);
  });
  it("joins a feeder to the actual arterial bridge plane, not the lower terrain apron",()=>{
    const roads=brJoinServiceGrades([
      {id:"arterial",kind:"arterial",from:{x:0,y:6.1,z:0},to:{x:100,y:4.1,z:0},width:12,color:"#304766"},
      {id:"service-test-grade",kind:"service",from:{x:50,y:4.6,z:30},to:{x:50,y:4.1,z:0},width:4,color:"#304766"}
    ]);
    expect(roads[1].to.y).toBeCloseTo(5.1);expect(roads[1].from.y).toBe(4.6);
  });
  it("preserves the lower floor when an elevated road passes above the capsule",()=>{
    const feet={x:225,y:.035,z:375};
    const result=brFlatDeckCollision(feet,{x:0,y:-.08,z:.01},false)!;
    expect(result.grounded).toBe(true);expect(feet.y+result.movement.y).toBeCloseTo(.035);
  });
  it("hands solid retaining-deck sides to Rapier instead of treating them as overhead floors",()=>{
    // West Nova boundary, away from any road opening. This is a 5m solid
    // district deck, not an elevated ceiling that can be walked underneath.
    expect(brFlatDeckCollision({x:-262.5,y:.035,z:-170},{x:.3,y:-.08,z:0},false)).toBeNull();
  });
  it("does not extend a raised platform floor past its retaining edge",()=>{
    // The broadphase capsule still touches Nova, but its feet are on the
    // descending Horizon access road. Do not snap to an invisible y=5 floor.
    expect(brFlatDeckCollision({x:-255,y:5.035,z:-49.8},{x:0,y:-.12,z:.12},false)).toBeNull();
    const supported=brFlatDeckCollision({x:-255,y:5.035,z:-51},{x:0,y:-.12,z:.12},false)!;
    expect(supported.grounded).toBe(true);
    expect(5.035+supported.movement.y).toBeCloseTo(5.035);
  });
  it("keeps connective-road grade boundaries in exact agreement with their solid decks",()=>{
    for(const region of BR_SECONDARY_GRADE_REGIONS){
      const deck=BR_TERRACES.find(deck=>deck.id===region.id)!;
      expect([deck.position.x,deck.position.z,deck.size.x,deck.size.z,deck.height])
        .toEqual([region.x,region.z,region.width,region.depth,region.height]);
    }
  });
  it("raises whole primary blocks and lowers a real connective service court",()=>{
    for(const [id,height] of [["nova-plaza",5],["astra-academy",8],["helios-reactor",6],["orbital-farms",4]] as const){
      const poi=BR_POIS.find(p=>p.id===id)!;expect(poi.position.y).toBe(height);
      const region=BR_ELEVATION_REGIONS.find(r=>r.districtId===id)!;
      expect(region.width*region.depth).toBeGreaterThan(20000);
      for(const s of BR_STRUCTURES.filter(s=>s.districtId===id))expect(s.position.y).toBe(brAuthoredDeckHeight(s.position));
    }
    const court={x:123,y:-2.965,z:100};
    expect(brBaseDeckHeight(court)).toBe(-3);
    expect(brFloorHeightAt(court,court.y+2.5)).toBe(-3);
    expect(BR_BASE_DECK_CELLS.filter(c=>court.x>c.minX&&court.x<c.maxX&&court.z>c.minZ&&court.z<c.maxZ).map(c=>c.height)).toEqual([-3]);
    const support=brFlatDeckCollision(court,{x:.02,y:-.12,z:0},false)!;
    expect(support.grounded).toBe(true);expect(court.y+support.movement.y).toBeCloseTo(-2.965);
    for(const socket of BR_LOOT_SOCKETS.filter(socket=>socket.districtId==="transit-court"))expect(socket.position.y).toBeGreaterThan(-3);
    expect(BR_STRUCTURES.filter(s=>s.districtId==="transit-court"&&s.enterable)).toHaveLength(4);
  });
  it("keeps each grade chain continuous and supported in both directions",()=>{
    for(const route of BR_ROAD_ROUTES){
      const pieces=BR_ROADS.filter(r=>r.id===route.id||r.id.startsWith(`${route.id}-grade-part-`));
      for(let i=1;i<pieces.length;i++)expect(pieces[i].from).toEqual(pieces[i-1].to);
      for(const piece of pieces){
        const rise=piece.to.y-piece.from.y,run=Math.hypot(piece.to.x-piece.from.x,piece.to.z-piece.from.z);
        expect(Math.abs(rise)/run,`${piece.id} excessive grade`).toBeLessThan(.4);
        if(Math.abs(rise)>.05||Math.abs(piece.from.y-.1)>.05){
          const block=BR_MAP_BLOCKS.find(b=>b.id===`${piece.id}-surface`)!;expect(block).toBeDefined();
          for(const t of [.1,.5,.9]){
            const point={x:piece.from.x+(piece.to.x-piece.from.x)*t,y:0,z:piece.from.z+(piece.to.z-piece.from.z)*t};
            expect(brRoadGradeFloorAt(block,point)).toBeCloseTo(piece.from.y+rise*t-.1);
          }
        }
      }
    }
  });
});
