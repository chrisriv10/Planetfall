import { describe,expect,it } from "vitest";
import { BR_ROADS, BR_ROAD_ROUTES, type BrRoadSegment } from "@planetfall/shared";
import { buildBrRoadGradeDetails, buildBrRoadRouteGradeDetails } from "./br-road-grade-details";

describe("BR authored road-grade presentation",()=>{
  const piecesFor=(road:BrRoadSegment)=>BR_ROADS.filter(piece=>piece.id.replace(/-grade-part-\d+$/,"")===road.id);
  const grades=BR_ROAD_ROUTES.filter(road=>{
    const heights=piecesFor(road).flatMap(piece=>[piece.from.y,piece.to.y]);
    return Math.hypot(road.to.x-road.from.x,road.to.z-road.from.z)>=8
      &&Math.max(...heights)-Math.min(...heights)>=.5;
  });
  const reference:BrRoadSegment={id:"reference-grade",color:"#fff",width:8,
    from:{x:0,y:.1,z:0},to:{x:40,y:4.1,z:30}};

  it("dresses every authored grade deterministically without entering the driving lane",()=>{
    expect(grades.length).toBeGreaterThanOrEqual(8);
    for(const road of grades){
      const pieces=piecesFor(road),parts=buildBrRoadGradeDetails(road,pieces);
      expect(parts.length).toBeGreaterThanOrEqual(pieces.length*2+6);
      expect(buildBrRoadGradeDetails(road,pieces)).toEqual(parts);
      expect(parts.filter(part=>part.role==="edge")).toHaveLength(pieces.length*2);
      expect(parts.filter(part=>part.role==="light")).toHaveLength(6);
      expect(parts.filter(part=>part.role==="support").length).toBeLessThanOrEqual(9);
      const edges=parts.filter(part=>part.role==="edge");
      for(const [i,piece]of pieces.entries()){
        const h=Math.hypot(piece.to.x-piece.from.x,piece.to.z-piece.from.z);
        expect(edges[i].position.y).toBeCloseTo((piece.from.y+piece.to.y)/2-.18);
        expect(edges[i].rotationZ).toBeCloseTo(Math.atan2(piece.to.y-piece.from.y,h));
      }
      for(const part of parts){
        expect([...Object.values(part.position),...Object.values(part.scale),part.rotationY??0,part.rotationZ??0].every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(value=>value>0)).toBe(true);
      }
      for(const part of parts.filter(part=>part.role==="edge"||part.role==="light")){
        const piece=pieces.find(piece=>Math.abs(-Math.atan2(piece.to.z-piece.from.z,piece.to.x-piece.from.x)-(part.rotationY??0))<1e-8)!;
        const dx=piece.to.x-piece.from.x,dz=piece.to.z-piece.from.z,horizontal=Math.hypot(dx,dz);
        const signed=((part.position.x-piece.from.x)*-dz+(part.position.z-piece.from.z)*dx)/horizontal;
        expect(Math.abs(signed)).toBeGreaterThan(road.width/2);
      }
    }
    // Original complete-grade richness is retained; a sunken road has no
    // above-ground columns, rather than forcing floating/underground supports.
    expect(buildBrRoadGradeDetails(reference).length).toBeGreaterThanOrEqual(11);
    expect(buildBrRoadRouteGradeDetails()).toEqual(BR_ROAD_ROUTES.flatMap(road=>
      road.id==="south-transfer-bridge"?[]:buildBrRoadGradeDetails(road,piecesFor(road))));
  });

  it("stations bent grades on the real path with subdivision-independent lights and supports",()=>{
    const a={...reference,from:{x:0,y:.1,z:0},to:{x:30,y:3.1,z:0}};
    const b={...reference,from:a.to,to:{x:30,y:6.1,z:40}};
    const route={...reference,to:b.to};
    const parts=buildBrRoadGradeDetails(route,[a,b]);
    for(const part of parts.filter(part=>part.role==="light")){
      if(Math.abs(part.rotationY??0)<1e-8){expect(part.position.x).toBeCloseTo(12.6);expect(Math.abs(part.position.z)).toBeGreaterThan(4);}
      else{expect(Math.abs(part.position.x-30)).toBeGreaterThan(4);expect([5,27.4].some(z=>Math.abs(part.position.z-z)<1e-7)).toBe(true);}
    }
    const divided=[a,b].flatMap(piece=>Array.from({length:10},(_,i)=>({...piece,
      from:{x:piece.from.x+(piece.to.x-piece.from.x)*i/10,y:piece.from.y+(piece.to.y-piece.from.y)*i/10,z:piece.from.z+(piece.to.z-piece.from.z)*i/10},
      to:{x:piece.from.x+(piece.to.x-piece.from.x)*(i+1)/10,y:piece.from.y+(piece.to.y-piece.from.y)*(i+1)/10,z:piece.from.z+(piece.to.z-piece.from.z)*(i+1)/10}})));
    const stations=(parts:ReturnType<typeof buildBrRoadGradeDetails>)=>parts.filter(part=>part.role!=="edge");
    const expected=stations(parts),actual=stations(buildBrRoadGradeDetails(route,divided));
    expect(actual).toHaveLength(expected.length);
    for(const [i,part] of actual.entries()){
      expect(part.role).toBe(expected[i].role);
      for(const axis of ["x","y","z"] as const)expect(part.position[axis]).toBeCloseTo(expected[i].position[axis],8);
    }
  });

  it("rejects level, malformed, short, and implausibly narrow roads",()=>{
    const base=reference;
    for(const road of [
      {...base,to:{...base.to,y:base.from.y}},
      {...base,to:{...base.to,x:base.from.x+2,z:base.from.z+2}},
      {...base,width:2},
      {...base,from:{...base.from,x:Number.NaN}}
    ] as BrRoadSegment[])expect(buildBrRoadGradeDetails(road)).toEqual([]);
  });

  it("orients each support crosshead across the grade so it joins both column tops",()=>{
    for(const road of [reference]){
      const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz);
      const forward={x:dx/length,z:dz/length},normal={x:-forward.z,z:forward.x};
      const supports=buildBrRoadGradeDetails(road).filter(part=>part.role==="support");
      const beams=supports.filter(part=>part.scale.y===.16);
      expect(beams.length).toBeGreaterThan(0);
      for(const beam of beams){
        const yaw=beam.rotationY??0,axis={x:Math.cos(yaw),z:-Math.sin(yaw)};
        expect(axis.x*forward.x+axis.z*forward.z).toBeCloseTo(0);
        expect(Math.abs(axis.x*normal.x+axis.z*normal.z)).toBeCloseTo(1);
        const columns=supports.filter(part=>part.scale.x===.18&&Math.abs((part.position.x-beam.position.x)*forward.x+(part.position.z-beam.position.z)*forward.z)<.01);
        expect(columns).toHaveLength(2);
        for(const column of columns){
          const separation=Math.abs((column.position.x-beam.position.x)*normal.x+(column.position.z-beam.position.z)*normal.z);
          expect(separation+column.scale.x/2).toBeLessThan(beam.scale.x/2);
          expect(column.position.y+column.scale.y/2).toBeGreaterThan(beam.position.y-beam.scale.y/2);
        }
      }
    }
  });
});
