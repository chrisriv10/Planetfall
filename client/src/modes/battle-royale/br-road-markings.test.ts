import { describe,expect,it } from "vitest";
import { BR_ROADS,BR_ROAD_ROUTES, type BrRoadSegment } from "@planetfall/shared";
import { buildBrRoadMarkings } from "./br-road-markings";
import { brRoadDetailClear } from "./br-road-detail";
import { buildBrRoadBends } from "./br-road-bends";

describe("route-stationed presentation detail",()=>{
  const route:BrRoadSegment={...BR_ROAD_ROUTES[0],id:"test-route",from:{x:0,y:.1,z:0},to:{x:240,y:12.1,z:0},width:12};
  const split=(count:number)=>Array.from({length:count},(_,i)=>({...route,id:`test-route-grade-part-${i}`,from:{x:240*i/count,y:.1+12*i/count,z:0},to:{x:240*(i+1)/count,y:.1+12*(i+1)/count,z:0}}));
  // These fixtures use axis-aligned legs; compare full footprints, not centers.
  const expectNoCornerOverlap=(parts:ReturnType<typeof buildBrRoadMarkings>)=>{
    const strips=parts.filter(p=>!p.role.startsWith("lamp-"));
    const halfExtents=(p:typeof strips[number])=>({
      x:(Math.abs(Math.cos(p.rotationY))*p.scale.x*Math.cos(p.rotationZ)+Math.abs(Math.sin(p.rotationY))*p.scale.z)/2,
      z:(Math.abs(Math.sin(p.rotationY))*p.scale.x*Math.cos(p.rotationZ)+Math.abs(Math.cos(p.rotationY))*p.scale.z)/2,
    });
    for(const [index,a] of strips.entries())for(const b of strips.slice(index+1)){
      if(a.role!==b.role||Math.abs(Math.sin(a.rotationY-b.rotationY))<.5)continue;
      const ah=halfExtents(a),bh=halfExtents(b);
      const overlapX=ah.x+bh.x-Math.abs(a.position.x-b.position.x);
      const overlapZ=ah.z+bh.z-Math.abs(a.position.z-b.position.z);
      expect(Math.min(overlapX,overlapZ),`${a.role}: ${a.pieceId} / ${b.pieceId}`).toBeLessThanOrEqual(1e-8);
    }
  };
  it("preserves lamp stations and paint length when a road gains many tiny grade pieces",()=>{
    const whole=buildBrRoadMarkings([route],[route],()=>true),divided=buildBrRoadMarkings([route],split(80),()=>true);
    const lamps=(parts:typeof whole)=>parts.filter(p=>p.role==="lamp-post").map(p=>p.position);
    expect(lamps(whole)).toHaveLength(6);
    expect(lamps(divided)).toEqual(lamps(whole));
    for(const role of ["curb","dash","edge-light"] as const){
      const length=(parts:typeof whole)=>parts.filter(p=>p.role===role).reduce((sum,p)=>sum+p.scale.x,0);
      expect(length(divided)).toBeCloseTo(length(whole),8);
    }
    expect(whole.filter(p=>p.role==="dash")).toHaveLength(20);
    expect(buildBrRoadMarkings([route],split(80),()=>false)).toEqual([]);
  });
  it("follows exact piece heights and slopes at a seam instead of interpolating route endpoint heights",()=>{
    const pieces=split(2);
    pieces[0].to.y=8.1;pieces[1].from.y=8.1;
    const parts=buildBrRoadMarkings([route],pieces,()=>true);
    for(const p of parts){
      const piece=pieces.find(piece=>piece.id===p.pieceId)!;
      const slope=(piece.to.y-piece.from.y)/(piece.to.x-piece.from.x);
      const lift={curb:.039,"edge-light":.037,dash:.013,crossing:.017,"lamp-post":2.215,"lamp-bulb":4.585}[p.role];
      expect(p.position.y).toBeCloseTo(piece.from.y+(p.position.x-piece.from.x)*slope-.065+lift,9);
      if(p.role.startsWith("lamp-"))expect(p.rotationZ).toBe(0);
      else {
        expect(p.rotationZ).toBeCloseTo(Math.atan(slope),9);
        const hx=p.scale.x*Math.cos(p.rotationZ)/2;
        expect(p.position.x-hx).toBeGreaterThanOrEqual(piece.from.x-1e-8);
        expect(p.position.x+hx).toBeLessThanOrEqual(piece.to.x+1e-8);
      }
    }
  });
  it("follows an L-shaped path with piece headings and continuous stations across the corner",()=>{
    const bent={...route,to:{x:100,y:.1,z:140}};
    const pieces=[{...bent,to:{x:100,y:.1,z:0}},
      {...bent,id:"test-route-grade-part-1",from:{x:100,y:.1,z:0}}];
    const before=JSON.stringify([bent,pieces]);
    const parts=buildBrRoadMarkings([bent],pieces,()=>true);
    const lamps=parts.filter(p=>p.role==="lamp-post");
    const expectedLamps=[[60,-7.44],[60,7.44],[107.44,20],[92.56,20],[107.44,80],[92.56,80]];
    expect(lamps).toHaveLength(expectedLamps.length);
    lamps.forEach((lamp,index)=>{
      expect(lamp.position.x).toBeCloseTo(expectedLamps[index][0],10);
      expect(lamp.position.z).toBeCloseTo(expectedLamps[index][1],10);
    });
    for(const p of parts){
      const first=p.pieceId===bent.id;
      expect(p.rotationY).toBeCloseTo(first?0:-Math.PI/2,10);
      if(p.role.startsWith("lamp-"))continue;
      const along=first?p.position.x:p.position.z;
      expect(along-p.scale.x/2).toBeGreaterThanOrEqual(-1e-8);
      expect(along+p.scale.x/2).toBeLessThanOrEqual((first?100:140)+1e-8);
      if(p.role==="dash")expect(first?p.position.z:p.position.x).toBe(first?0:100);
    }
    const divided=pieces.flatMap((piece,index)=>Array.from({length:10},(_,i)=>({...piece,
      id:`test-route-grade-part-${index*10+i}`,
      from:{x:piece.from.x+(piece.to.x-piece.from.x)*i/10,y:.1,z:piece.from.z+(piece.to.z-piece.from.z)*i/10},
      to:{x:piece.from.x+(piece.to.x-piece.from.x)*(i+1)/10,y:.1,z:piece.from.z+(piece.to.z-piece.from.z)*(i+1)/10},
    })));
    const subdivided=buildBrRoadMarkings([bent],divided,()=>true);
    expect(subdivided.filter(p=>p.role==="lamp-post").map(p=>p.position))
      .toEqual(parts.filter(p=>p.role==="lamp-post").map(p=>p.position));
    for(const role of ["curb","dash","edge-light"] as const){
      const length=(marks:typeof parts)=>marks.filter(p=>p.role===role).reduce((sum,p)=>sum+p.scale.x,0);
      expect(length(subdivided)).toBeCloseTo(length(parts),9);
    }
    // Mask a narrow footprint on the vertical leg; no emitted strip may cross it.
    const masked=buildBrRoadMarkings([bent],pieces,(_road,_x,z)=>z<38||z>42);
    expect(masked.length).toBeLessThan(parts.length);
    for(const p of masked.filter(p=>p.pieceId===pieces[1].id&&!p.role.startsWith("lamp-"))){
      expect(p.position.z+p.scale.x/2<38||p.position.z-p.scale.x/2>42).toBe(true);
    }
    expect(JSON.stringify([bent,pieces])).toBe(before);
  });
  it("restores visible detail on graded routes within a bounded static budget and leaves authoritative data untouched",()=>{
    const before=JSON.stringify([BR_ROADS,BR_ROAD_ROUTES]);
    const parts=buildBrRoadMarkings();
    expect(parts.filter(p=>p.role==="lamp-post").length).toBeGreaterThan(10);
    expect(parts.length).toBeLessThan(10000);
    expect(parts.some(p=>p.role==="dash"&&Math.abs(p.rotationZ)>.01)).toBe(true);
    for(const p of parts){
      const route=BR_ROAD_ROUTES.find(r=>r.id===p.routeId)!;
      expect(brRoadDetailClear(route,p.position.x,p.position.z),`${p.role}: ${p.routeId}`).toBe(true);
      expect([...Object.values(p.position),...Object.values(p.scale),p.rotationY,p.rotationZ].every(Number.isFinite)).toBe(true);
      expect(Object.values(p.scale).every(v=>v>0)).toBe(true);
    }
    expect(JSON.stringify([BR_ROADS,BR_ROAD_ROUTES])).toBe(before);
  });
  it.each([-1,1])("keeps full strip footprints separate at a %s quarter-turn, including a dash spanning the bend",sign=>{
    const bent={...route,to:{x:30,y:.1,z:sign*90}};
    const pieces=[{...bent,to:{x:30,y:.1,z:0}},
      {...bent,id:"test-route-grade-part-1",from:{x:30,y:.1,z:0}}];
    const marks=buildBrRoadMarkings([bent],pieces,()=>true);
    expectNoCornerOverlap(marks);
    // The station at 30m straddles this corner. Preserve paint on both legs.
    const cornerDash=marks.filter(p=>p.role==="dash"&&Math.hypot(p.position.x-30,p.position.z)<2);
    expect(cornerDash).toHaveLength(2);
    const subdivided=pieces.flatMap((piece,index)=>Array.from({length:40},(_,i)=>({...piece,
      id:`test-route-grade-part-${index*40+i}`,
      from:{x:piece.from.x+(piece.to.x-piece.from.x)*i/40,y:.1,z:piece.from.z+(piece.to.z-piece.from.z)*i/40},
      to:{x:piece.from.x+(piece.to.x-piece.from.x)*(i+1)/40,y:.1,z:piece.from.z+(piece.to.z-piece.from.z)*(i+1)/40},
    })));
    const divided=buildBrRoadMarkings([bent],subdivided,()=>true);
    expectNoCornerOverlap(divided);
    for(const role of ["curb","dash","edge-light"] as const){
      const length=(parts:typeof marks)=>parts.filter(p=>p.role===role).reduce((sum,p)=>sum+p.scale.x,0);
      expect(length(divided)).toBeCloseTo(length(marks),9);
    }
    expect(divided.filter(p=>p.role==="lamp-post").map(p=>p.position))
      .toEqual(marks.filter(p=>p.role==="lamp-post").map(p=>p.position));
  });
  it("keeps service-23 curb tops separate at both authored bends",()=>{
    const route=BR_ROAD_ROUTES.find(r=>r.id==="service-23")!;
    const pieces=BR_ROADS.filter(p=>p.id===route.id||p.id.startsWith(`${route.id}-grade-part-`));
    const marks=buildBrRoadMarkings([route],pieces,()=>true);
    expect(marks.filter(p=>p.role==="curb").length).toBeGreaterThan(10);
    expectNoCornerOverlap(marks);
    expectNoCornerOverlap(buildBrRoadMarkings([route],pieces));
  });
  it("aligns separate North Civic route curbs with the shared inner tangencies",()=>{
    const parts=buildBrRoadMarkings();
    for(const bend of buildBrRoadBends(BR_ROADS).filter(b=>[-5,-15].includes(b.center.x)&&[86,104,170].includes(b.center.z))){
      expect(bend.arms).toHaveLength(2);
      for(const arm of bend.arms){
        const other=bend.arms.find(a=>a!==arm)!,road=BR_ROADS.find(r=>r.id===arm.roadId)!;
        const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
        const sign=Math.sign(-uz*other.direction.x+ux*other.direction.z),offset=sign*road.width*.49;
        const dot=arm.direction.x*other.direction.x+arm.direction.z*other.direction.z,cot=Math.sqrt((1+dot)/(1-dot));
        const tangent=arm.tangent+(Math.abs(offset)-bend.radius)*cot+.075;
        const curbs=parts.filter(p=>p.pieceId===road.id&&p.role==="curb"
          &&Math.abs((p.position.x-road.from.x)*-uz+(p.position.z-road.from.z)*ux-offset)<.01);
        expect(curbs.length,road.id).toBeGreaterThan(0);
        const distances=curbs.map(p=>(p.position.x-bend.center.x)*arm.direction.x+(p.position.z-bend.center.z)*arm.direction.z-p.scale.x/2);
        expect(Math.min(...distances),road.id).toBeCloseTo(tangent,5);
      }
    }
  });
});

it("trims distinct-route inside curbs to the supported North Civic fillet without overrunning either leg",()=>{
  const a=BR_ROADS.find(r=>r.id==="north-civic-street")!,b=BR_ROADS.find(r=>r.id==="north-civic-mall-link")!;
  const parts=buildBrRoadMarkings([a,b],[a,b],()=>true);
  expect(parts.filter(p=>p.role==="curb"&&Math.hypot(p.position.x+15,p.position.z-170)<8).length).toBeGreaterThan(0);
  for(const p of parts.filter(p=>p.role==="curb")){
    const road=p.pieceId===a.id?a:b,dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz);
    const along=((p.position.x-road.from.x)*dx+(p.position.z-road.from.z)*dz)/length;
    expect(along-p.scale.x/2).toBeGreaterThanOrEqual(0);
    expect(along+p.scale.x/2).toBeLessThanOrEqual(length);
  }
});
