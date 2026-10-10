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
it("treats only local equal-width level elbows as continuations",()=>{
  const first={...BR_ROADS[0],id:"entry",width:8,from:{x:-30,y:.1,z:0},to:{x:0,y:.1,z:0}};
  const second={...first,id:"exit",from:first.to,to:{x:0,y:.1,z:30}};
  expect(buildBrRoadDetailClear([first,second],[])(first,-4,3)).toBe(true);
  for(const neighbor of [{...second,to:{...second.to,y:5}},{...second,width:10}])
    expect(buildBrRoadDetailClear([first,neighbor],[])(first,-4,3)).toBe(false);
  const branch={...first,id:"branch",from:first.to,to:{x:30,y:.1,z:0}};
  expect(buildBrRoadDetailClear([first,second,branch],[])(first,-4,3)).toBe(false);
  const crossing={...first,id:"crossing",from:{x:-20,y:.1,z:5},to:{x:20,y:.1,z:5}};
  expect(buildBrRoadDetailClear([first,second,crossing],[])(first,-4,3)).toBe(false);
});

it("recognizes only local supported distinct-route elbows, retaining branch and grade masks",()=>{
  const a={...BR_ROADS[0],id:"elbow-a",from:{x:-15,y:.1,z:130},to:{x:-15,y:.1,z:170},width:6};
  const b={...a,id:"elbow-b",from:a.to,to:{x:5,y:.1,z:198}};
  const clear=buildBrRoadDetailClear([a,b],[]);
  expect(clear(a,-12,168)).toBe(true);
  expect(clear(a,4,195)).toBe(false); // Same neighbor, far outside the join.
  const branch={...a,id:"branch",from:a.to,to:{x:-40,y:.1,z:170}};
  expect(buildBrRoadDetailClear([a,b,branch],[])(a,-12,168)).toBe(false);
  expect(buildBrRoadDetailClear([a,{...b,to:{...b.to,y:3}}],[])(a,-12,168)).toBe(false);
  expect(buildBrRoadDetailClear([a,{...b,width:8}],[])(a,-12,168)).toBe(false);
  const crossing={...a,id:"crossing",from:{x:-30,y:.1,z:168},to:{x:10,y:.1,z:168}};
  expect(buildBrRoadDetailClear([a,b,crossing],[])(a,-12,168)).toBe(false);
});
