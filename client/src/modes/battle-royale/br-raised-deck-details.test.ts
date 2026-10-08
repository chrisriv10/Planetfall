import { describe, expect, it } from "vitest";
import { BR_ROADS, BR_STRUCTURES, BR_TERRACES, type BrRoadSegment } from "@planetfall/shared";
import { buildBrRaisedDeckDetails, BR_RAISED_DECK_MAX_PARTS, BR_RAISED_DECK_ROAD_CLEARANCE } from "./br-raised-deck-details";

const decks=BR_TERRACES.filter(terrace=>terrace.gradedRoadAccess);
const pointSegment=(x:number,z:number,road:BrRoadSegment)=>{
  const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,squared=dx*dx+dz*dz;
  const t=squared?Math.max(0,Math.min(1,((x-road.from.x)*dx+(z-road.from.z)*dz)/squared)):0;
  return Math.hypot(x-road.from.x-dx*t,z-road.from.z-dz*t);
};
describe("raised district edge construction",()=>{
  it("dresses every fixed raised district with a restrained deterministic instance/material budget",()=>{
    expect(decks.length).toBeGreaterThanOrEqual(8);
    const before=JSON.stringify([BR_TERRACES,BR_ROADS]);
    for(const deck of decks){
      const parts=buildBrRaisedDeckDetails(deck);
      // A road can mask every exposed bay on a real deck. Verify kit richness
      // without road masks, and keep the production masks/budgets independent.
      expect(buildBrRaisedDeckDetails(deck,[]).length,deck.id).toBeGreaterThan(12);
      expect(parts.length).toBeLessThanOrEqual(BR_RAISED_DECK_MAX_PARTS);
      expect(parts.filter(part=>part.role==="light").length).toBeLessThanOrEqual(4);
      expect(new Set(parts.map(part=>part.finish)).size).toBeLessThanOrEqual(3);
      expect(buildBrRaisedDeckDetails(deck)).toEqual(parts);
      expect(buildBrRaisedDeckDetails(deck,BR_ROADS.slice().reverse())).toEqual(parts);
    }
    expect(JSON.stringify([BR_TERRACES,BR_ROADS])).toBe(before);
  });
  it("keeps complete boxes outside the supporting deck and strictly below its top without fake rails or cover",()=>{
    for(const deck of decks)for(const part of buildBrRaisedDeckDetails(deck)){
      expect([...Object.values(part.position),...Object.values(part.scale),part.rotationY].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(n=>n>0)).toBe(true);
      expect(part.geometry).toBe("box");expect(part.rotationY).toBe(0);
      const ns=part.side==="north"||part.side==="south",normal=ns?"z":"x",along=ns?"x":"z";
      const nearest=Math.abs(part.position[normal]-deck.position[normal])-part.scale[normal]/2;
      const furthest=Math.abs(part.position[normal]-deck.position[normal])+part.scale[normal]/2;
      expect(nearest).toBeGreaterThanOrEqual(deck.size[normal]/2+.019);
      expect(furthest).toBeLessThanOrEqual(deck.size[normal]/2+.251);
      expect(Math.abs(part.position[along]-deck.position[along])+part.scale[along]/2).toBeLessThan(deck.size[along]/2-1);
      expect(part.position.y+part.scale.y/2).toBeLessThan(deck.height-.15);
      expect(part.position.y-part.scale.y/2).toBeGreaterThan(.35);
      for(const building of BR_STRUCTURES){
        const overlaps=Math.abs(part.position.x-building.position.x)<(part.scale.x+building.size.x)/2
          &&Math.abs(part.position.z-building.position.z)<(part.scale.z+building.size.z)/2
          &&part.position.y+part.scale.y/2>building.position.y&&part.position.y-part.scale.y/2<building.position.y+building.size.y;
        expect(overlaps,`${deck.id}: ${building.id}`).toBe(false);
      }
    }
  });
  it("gives tall retaining walls visible vertical structure without increasing the instance budget",()=>{
    for(const deck of decks.filter(deck=>deck.height>=3)){
      const parts=buildBrRaisedDeckDetails(deck,[]),ribs=parts.filter(part=>part.role==="rib");
      expect(ribs.length,deck.id).toBeGreaterThan(4);
      for(const rib of ribs){
        expect(rib.position.y-rib.scale.y/2).toBeCloseTo(.925);
        expect(rib.position.y+rib.scale.y/2).toBeCloseTo(deck.height-.175);
        expect(rib.scale.y).toBeGreaterThan(deck.height*.6);
        expect(Math.min(rib.scale.x,rib.scale.z)).toBeLessThanOrEqual(.09);
      }
      for(const armor of parts.filter(part=>part.role==="armor")){
        expect(armor.scale.y).toBeGreaterThanOrEqual(.78);
        expect(armor.scale.y).toBeLessThanOrEqual(1.6);
      }
    }
  });
  it("leaves whole road-width openings at offset, diagonal and level collector crossings",()=>{
    for(const deck of decks)for(const part of buildBrRaisedDeckDetails(deck))for(const road of BR_ROADS){
      // Sample every 10cm along each complete footprint edge as an independent
      // oracle, including mid-edge road crossings that corner-only tests miss.
      const minX=part.position.x-part.scale.x/2,minZ=part.position.z-part.scale.z/2;
      let distance=Infinity;
      for(let i=0;i<=Math.ceil(part.scale.x/.1);i++)for(const side of [0,1]){
        const x=minX+Math.min(part.scale.x,i*.1),z=minZ+side*part.scale.z;
        distance=Math.min(distance,pointSegment(x,z,road));
      }
      for(let i=0;i<=Math.ceil(part.scale.z/.1);i++)for(const side of [0,1]){
        const x=minX+side*part.scale.x,z=minZ+Math.min(part.scale.z,i*.1);
        distance=Math.min(distance,pointSegment(x,z,road));
      }
      expect(distance,`${deck.id}: ${road.id}`).toBeGreaterThanOrEqual(road.width/2+BR_RAISED_DECK_ROAD_CLEARANCE-1e-8);
    }
  });
  it("rejects malformed/non-district decks and masks an entire cassette even when a narrow road crosses only its middle",()=>{
    const deck=decks[0],unmasked=buildBrRaisedDeckDetails(deck,[]);
    const armor=unmasked.find(part=>part.role==="armor"&&part.side==="north")!;
    const crossing:BrRoadSegment={id:"offset-crossing",color:"#fff",width:1,
      from:{x:armor.position.x,y:deck.height,z:armor.position.z-10},to:{x:armor.position.x,y:deck.height,z:armor.position.z+10}};
    const masked=buildBrRaisedDeckDetails(deck,[crossing]);
    expect(masked.some(part=>part.side==="north"&&part.position.x===armor.position.x)).toBe(false);
    expect(masked.length).toBeLessThan(unmasked.length);
    for(const bad of [{...deck,gradedRoadAccess:false},{...deck,height:NaN},{...deck,height:1},
      {...deck,size:{x:1,z:70}},{...deck,size:{x:241,z:70}},{...deck,position:{x:Infinity,y:0,z:0}}])expect(buildBrRaisedDeckDetails(bad)).toEqual([]);
  });
  it("never forces decorative bays into an entirely occupied perimeter",()=>{
    const deck=decks[0];
    const roads:BrRoadSegment[]=["x","z"].flatMap(axis=>[-1,1].map(side=>({
      id:`perimeter-${axis}-${side}`,color:"#fff",width:4,
      from:{x:deck.position.x+(axis==="x"?side*deck.size.x/2:-deck.size.x),y:deck.height,z:deck.position.z+(axis==="z"?side*deck.size.z/2:-deck.size.z)},
      to:{x:deck.position.x+(axis==="x"?side*deck.size.x/2:deck.size.x),y:deck.height,z:deck.position.z+(axis==="z"?side*deck.size.z/2:deck.size.z)}
    })));
    expect(buildBrRaisedDeckDetails(deck,[]).length).toBeGreaterThan(12);
    expect(buildBrRaisedDeckDetails(deck,roads)).toEqual([]);
  });
});
