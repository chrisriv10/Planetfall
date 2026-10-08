import { expect,it } from "vitest";
import { BR_ROADS,BR_ROAD_ROUTES,BR_STRUCTURES } from "@planetfall/shared";
import { brRoadDetailClear,brRoadRouteId,buildBrRoadDetailClear } from "./br-road-detail";
it("does not paint intersecting curbs or road arrows through buildings",()=>{
  for(const structure of BR_STRUCTURES)expect(brRoadDetailClear(BR_ROADS[0],structure.position.x,structure.position.z)).toBe(false);
  const radial=BR_ROAD_ROUTES.find(r=>r.id==="radial-0")!;
  expect(brRoadDetailClear(radial,0,0)).toBe(false);
  expect(brRoadDetailClear(radial,-175,-135)).toBe(false);
});
it("identifies sibling grades without merging separately authored intersecting streets",()=>{
  expect(brRoadRouteId({id:"radial-0-grade-part-2"})).toBe("radial-0");
  expect(brRoadRouteId({id:"radial-0-grade"})).toBe("radial-0-grade");
  let clearGradedStations=0;
  for(const route of BR_ROAD_ROUTES){
    const pieces=BR_ROADS.filter(p=>brRoadRouteId(p)===route.id);
    if(pieces.length<2)continue;
    for(const piece of pieces){
      const x=(piece.from.x+piece.to.x)/2,z=(piece.from.z+piece.to.z)/2;
      expect(brRoadDetailClear(piece,x,z)).toBe(brRoadDetailClear(route,x,z));
      if(brRoadDetailClear(route,x,z))clearGradedStations++;
    }
  }
  expect(clearGradedStations).toBeGreaterThan(10);
});
it("reserves the complete six-metre approach outside each enterable door",()=>{
  for(const s of BR_STRUCTURES.filter(s=>s.enterable)){
    const ns=s.entrance==="north"||s.entrance==="south",sign=s.entrance==="north"||s.entrance==="east"?1:-1;
    const x=s.position.x+(ns?0:sign*(s.size.x/2+5));
    const z=s.position.z+(ns?sign*(s.size.z/2+5):0);
    expect(brRoadDetailClear(BR_ROAD_ROUTES[0],x,z),s.id).toBe(false);
  }
});
it("masks actual bent road legs without masking their empty endpoint chord",()=>{
  const road={...BR_ROADS[0],id:"bent",width:10,from:{x:0,y:.1,z:0},to:{x:100,y:.1,z:0}};
  const second={...road,id:"bent-grade-part-1",from:road.to,to:{x:100,y:.1,z:100}};
  const pieces=[road,second],before=JSON.stringify(pieces);
  const clear=buildBrRoadDetailClear(pieces,[]),other={...road,id:"crossing"};
  expect(clear(other,50,0)).toBe(false);
  expect(clear(other,100,50)).toBe(false);
  expect(clear(other,50,50)).toBe(true);
  expect(clear(road,100,50)).toBe(true);
  expect(clear(second,50,0)).toBe(true);
  const split=pieces.flatMap((piece,index)=>Array.from({length:20},(_,i)=>({...piece,
    id:`bent-grade-part-${index*20+i}`,
    from:{x:piece.from.x+(piece.to.x-piece.from.x)*i/20,y:.1,z:piece.from.z+(piece.to.z-piece.from.z)*i/20},
    to:{x:piece.from.x+(piece.to.x-piece.from.x)*(i+1)/20,y:.1,z:piece.from.z+(piece.to.z-piece.from.z)*(i+1)/20},
  })));
  const divided=buildBrRoadDetailClear(split,[]);
  for(let x=-10;x<=110;x+=5)for(let z=-10;z<=110;z+=5)expect(divided(other,x,z)).toBe(clear(other,x,z));
  expect(JSON.stringify(pieces)).toBe(before);
});
