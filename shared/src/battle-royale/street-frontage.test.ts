import { describe,expect,it } from "vitest";
import { BR_ROADS,BR_STRUCTURES } from "./index.js";

function heightAt(routeId:string,x:number,z:number):number[] {
  return BR_ROADS.filter(r=>r.id===routeId||r.id.startsWith(`${routeId}-grade-part-`)).flatMap(r=>{
    const dx=r.to.x-r.from.x,dz=r.to.z-r.from.z,lengthSq=dx*dx+dz*dz;
    const t=((x-r.from.x)*dx+(z-r.from.z)*dz)/lengthSq;
    if(t<-.00001||t>1.00001||Math.hypot(x-r.from.x-dx*t,z-r.from.z-dz*t)>.00001)return[];
    return [r.from.y+(r.to.y-r.from.y)*t-.1];
  });
}

describe("Helios Relay access grade",()=>{
  it("eases both ends without moving the landings or midpoint",()=>{
    const grade=BR_ROADS.filter(r=>r.id.startsWith("helios-relay-cross-grade-part-")&&Math.abs(r.to.y-r.from.y)>.001);
    expect(grade).toHaveLength(3);
    const slopes=grade.map(r=>Math.abs(r.to.y-r.from.y)/Math.hypot(r.to.x-r.from.x,r.to.z-r.from.z));
    expect(slopes[0]).toBeCloseTo(.2);expect(slopes[2]).toBeCloseTo(.2);
    for(const slope of slopes)expect(slope).toBeLessThan(.4);
    for(let i=1;i<slopes.length;i++)expect(Math.abs(Math.atan(slopes[i])-Math.atan(slopes[i-1]))).toBeLessThan(.15);
    for(const [z,y] of [[144,6],[153,3],[162,0]]){
      const heights=heightAt("helios-relay-cross",375,z);expect(heights.length).toBeGreaterThan(0);
      for(const actual of heights)expect(actual).toBeCloseTo(y,5);
    }
  });
});

describe("East Freight diagonal access grade",()=>{
  it("eases both landings while preserving the diagonal midpoint and traversal budget",()=>{
    const grade=BR_ROADS.filter(r=>r.id.startsWith("service-25-grade-grade-part-")&&Math.abs(r.to.y-r.from.y)>.001);
    expect(grade).toHaveLength(5);
    const slopes=grade.map(r=>Math.abs(r.to.y-r.from.y)/Math.hypot(r.to.x-r.from.x,r.to.z-r.from.z));
    expect(slopes[0]).toBeLessThan(.22);expect(slopes.at(-1)).toBeLessThan(.22);
    for(const slope of slopes)expect(slope).toBeLessThan(.4);
    for(let i=1;i<slopes.length;i++)expect(Math.abs(Math.atan(slopes[i])-Math.atan(slopes[i-1]))).toBeLessThan(.15);
    for(const [x,z,y] of [[300,-271,8],[294.75,-261,4],[289.5,-251,0]]){
      const heights=heightAt("service-25-grade",x,z);expect(heights.length).toBeGreaterThan(0);
      for(const actual of heights)expect(actual).toBeCloseTo(y,5);
    }
  });
});

describe("Academy lower campus frontage",()=>{
  it("eases both ends of the shared access grades without moving landings",()=>{
    for(const id of ["academy-dorms-main","service-4","west-park-main"]){
      const pieces=BR_ROADS.filter(r=>r.id===id||r.id.startsWith(`${id}-grade-part-`));
      const slopes=pieces.map(p=>(p.to.y-p.from.y)/Math.hypot(p.to.x-p.from.x,p.to.z-p.from.z));
      expect(slopes).toHaveLength(7);
      expect(slopes[0]).toBe(0);expect(slopes[6]).toBe(0);
      expect(slopes[1]).toBeGreaterThan(0);expect(slopes[1]).toBeLessThan(slopes[2]);expect(slopes[2]).toBeLessThan(slopes[3]);
      expect(slopes[5]).toBeCloseTo(slopes[1]);expect(slopes[4]).toBeCloseTo(slopes[2]);
      expect(Math.max(...slopes)).toBeLessThan(.4);
      expect(Math.max(...slopes.slice(1).map((s,i)=>Math.abs(Math.atan(s)-Math.atan(slopes[i]))))).toBeLessThan(.14);
    }
  });
  it("holds the real dorm access loop at ground level, not the campus apron plane",()=>{
    for(const z of [123,125,150,167,177,185]){
      const heights=heightAt("academy-dorms-cross",-400,z);
      expect(heights.length).toBeGreaterThan(0);
      for(const y of heights)expect(y).toBeCloseTo(0,5);
    }
    for(const z of [159,167,174,185])expect(heightAt("academy-dorms-frontage",-369,z)).toEqual([0]);
    for(const x of [-400,-385,-369])expect(heightAt("academy-dorms-north",x,185)).toEqual([0]);
    expect(BR_STRUCTURES.find(s=>s.id==="academy-dorms-1")!.position).toEqual({x:-384,y:0,z:167});
    expect(BR_STRUCTURES.find(s=>s.id==="academy-dorms-3")!.position.y).toBe(8);
    expect(BR_STRUCTURES.find(s=>s.id==="west-park-1")!.position).toEqual({x:-347,y:0,z:174});
  });

  it("climbs to the intact upper circulation road only on explicit access ramps",()=>{
    for(const [id,z] of [["academy-dorms-main",125],["service-4",125],["west-park-main",150]] as const){
      for(const [x,y] of [[-400,0],[-394,0],[-383,4],[-372,8],[-365,8]]){
        const heights=heightAt(id,x,z);
        expect(heights.length,id).toBeGreaterThan(0);
        for(const actual of heights)expect(actual,id).toBeCloseTo(y,5);
      }
    }
    for(const id of ["academy-dorms-cross","west-park-cross","west-park-main","service-21"]){
      const heights=heightAt(id,-400,150);
      expect(heights.length,id).toBeGreaterThan(0);
      for(const y of heights)expect(y,id).toBeCloseTo(0,5);
    }
  });
});
describe("West Overlook ground-floor streets",()=>{
  it("keeps the shop frontage, crossing and arterial feeder on one real floor",()=>{
    for(const id of ["west-overlook-main","west-overlook-cross","service-5"]){
      expect(heightAt(id,-405,15)).toEqual([0]);
    }
    for(const z of [-12,0,15,31,42])expect(heightAt("west-overlook-cross",-405,z)).toEqual([0]);
    for(const x of [-435,-430,-405,-397,-375])expect(heightAt("west-overlook-main",x,15)).toEqual([0]);
    const shop=BR_STRUCTURES.find(s=>s.id==="west-overlook-1")!;
    expect(shop.position).toEqual({x:-385,y:0,z:31});
    expect(shop.entrance).toBe("west");
    expect(shop.enterable).toBe(true);
    expect(BR_STRUCTURES.find(s=>s.id==="astra-student-hall")!.position.y).toBe(8);
  });
});

describe("Horizon Homes authored street frontage",()=>{
  it("eases both landing joins without separating overlapping road surfaces",()=>{
    for(const id of ["horizon-homes-cross","service-3"]){
      const pieces=BR_ROADS.filter(road=>road.id===id||road.id.startsWith(`${id}-grade-part-`));
      expect(pieces).toHaveLength(5);
      const slopes=pieces.map(road=>(road.to.y-road.from.y)/Math.hypot(road.to.x-road.from.x,road.to.z-road.from.z));
      expect(Math.abs(slopes[1])).toBeCloseTo(.2,8);
      expect(Math.abs(slopes[3])).toBeCloseTo(.2,8);
      for(const slope of slopes)expect(Math.abs(slope)).toBeLessThan(.4);
      for(let i=1;i<slopes.length;i++)expect(Math.abs(Math.atan(slopes[i])-Math.atan(slopes[i-1]))).toBeLessThan(.2);
    }
    for(const z of [-50,-49.5,-49,-43,-37,-36.5,-36]){
      const crossing=heightAt("horizon-homes-cross",-255,z),service=heightAt("service-3",-255,z);
      expect(crossing.length).toBeGreaterThan(0);expect(service.length).toBeGreaterThan(0);
      for(const a of crossing)for(const b of service)expect(a).toBeCloseTo(b,8);
    }
  });
  it("meets at one level junction instead of independently bridged road planes",()=>{
    for(const id of ["horizon-homes-main","horizon-homes-cross","service-3"]){
      const heights=heightAt(id,-255,-30);
      expect(heights.length,id).toBeGreaterThan(0);
      for(const height of heights)expect(height,id).toBeCloseTo(0,5);
    }
    for(const x of [-280,-265,-255,-245,-230])expect(heightAt("horizon-homes-main",x,-30)).toEqual([0]);
    for(const z of [-35,-30,-25,-15])for(const height of heightAt("horizon-homes-cross",-255,z))expect(height).toBeCloseTo(0,5);
    expect(BR_STRUCTURES.filter(s=>s.districtId==="horizon-homes").every(s=>s.position.y===0)).toBe(true);
  });

  it("connects the lower street to Nova with a deliberate continuous ramp, not a hovering frontage",()=>{
    const expected=[[-57,5],[-50,5],[-43,2.5],[-36,0],[-30,0],[-3,0]];
    for(const [z,top] of expected){
      const heights=heightAt("horizon-homes-cross",-255,z);
      expect(heights.length,`z=${z}`).toBeGreaterThan(0);
      for(const height of heights)expect(height,`z=${z}`).toBeCloseTo(top,5);
    }
    for(const [x,z] of [[-285,-30],[-310,-58.84615384615385],[-350,-105]]){
      const heights=heightAt("west-neighborhood-link-a",x,z);
      expect(heights.length).toBeGreaterThan(0);
      for(const height of heights)expect(height).toBeCloseTo(0,5);
    }
  });
});

describe("Central Security bridge-side frontage",()=>{
  it("keeps both local streets and their feeder at one ground-level junction",()=>{
    for(const id of ["central-security-main","central-security-cross","service-23"]){
      const heights=heightAt(id,-145,85);
      expect(heights.length,id).toBeGreaterThan(0);
      for(const height of heights)expect(height,id).toBeCloseTo(0,5);
    }
    for(const x of [-175,-160,-145,-130,-115])expect(heightAt("central-security-main",x,85)).toEqual([0]);
    for(const z of [58,72,85,98,112])expect(heightAt("central-security-cross",-145,z)).toEqual([0]);
  });
});

describe("Central Heights split-level frontage",()=>{
  it("keeps the shop/apartment street and Zero civic loop on their real ground floor",()=>{
    for(const z of [-109,-98,-82,-58,-42,-33]){
      const heights=heightAt("central-heights-cross",-65,z);
      expect(heights.length).toBeGreaterThan(0);
      for(const y of heights)expect(y).toBeCloseTo(0,5);
    }
    for(const id of ["central-heights-main","central-heights-cross","service-0","radial-0"]){
      const heights=heightAt(id,-65,-82);
      expect(heights.length,id).toBeGreaterThan(0);
      for(const y of heights)expect(y,id).toBeCloseTo(0,5);
    }
    for(const x of [-70,-45,0,45,70])expect(heightAt("zero-circulation-s",x,-58)).toEqual([0]);
    for(const z of [-58,-42,0,42,58])expect(heightAt("zero-circulation-w",-70,z)).toEqual([0]);
  });
  it("uses one shared Nova access grade outside the complete upper ring",()=>{
    for(const id of ["central-heights-main","service-0","radial-0"]){
      for(const [x,y] of [[-92,5],[-84,5],[-76.5,2.5],[-69,0]]){
        const heights=heightAt(id,x,-82);
        expect(heights.length,id).toBeGreaterThan(0);
        for(const actual of heights)expect(actual,id).toBeCloseTo(y,5);
      }
    }
  });
});

describe("Comet Hotel ground-floor arrival",()=>{
  it("eases both Nova access landings identically across every overlapping route",()=>{
    for(const [z,ids] of [[-82,["central-heights-main","service-0","radial-0"]],[-214,["comet-hotel-main","service-2"]]] as const){
      for(const id of ids){
        const segments=BR_ROADS.filter(r=>r.id.startsWith(`${id}-grade-part-`)&&r.from.z===z&&r.to.z===z&&Math.min(r.from.x,r.to.x)>=-84&&Math.max(r.from.x,r.to.x)<=-69);
        expect(segments,id).toHaveLength(3);
        const slopes=segments.map(r=>Math.abs((r.to.y-r.from.y)/(r.to.x-r.from.x)));
        expect(slopes[0]).toBeCloseTo(.2);expect(slopes[2]).toBeCloseTo(.2);
        expect(slopes[1]).toBeLessThan(.4);
        for(let i=1;i<slopes.length;i++)expect(Math.abs(Math.atan(slopes[i])-Math.atan(slopes[i-1]))).toBeLessThan(.15);
      }
      for(const x of [-84,-83,-80,-76.5,-73,-70,-69]){
        const reference=heightAt(ids[0],x,z)[0];
        for(const id of ids)for(const height of heightAt(id,x,z))expect(height,id).toBeCloseTo(reference,5);
      }
    }
  });
  it("joins the frontage, civic promenade and south avenue on the actual hotel floor",()=>{
    for(const z of [-241,-236,-230,-214,-200,-187]){
      const heights=heightAt("comet-hotel-cross",-65,z);
      expect(heights.length).toBeGreaterThan(0);
      for(const y of heights)expect(y).toBeCloseTo(0,5);
    }
    for(const id of ["comet-hotel-main","comet-hotel-cross","service-2","central-hotel-promenade-south","central-hotel-promenade-entry"]){
      const heights=heightAt(id,-65,-214);
      expect(heights.length,id).toBeGreaterThan(0);
      for(const y of heights)expect(y,id).toBeCloseTo(0,5);
    }
    expect(heightAt("hotel-south-avenue-entry",-65,-241)).toEqual([0]);
    expect(heightAt("hotel-south-avenue-entry",-65,-270)).toEqual([0]);
    expect(heightAt("hotel-south-avenue-link",-65,-270)).toEqual([0]);
    expect(heightAt("hotel-south-avenue-link",-76,-270)).toEqual([0]);
    expect(heightAt("hotel-south-avenue",-76,-270)).toEqual([0]);
    expect(heightAt("hotel-south-avenue",-76,-290)).toEqual([0]);
    const hotel=BR_STRUCTURES.find(s=>s.id==="comet-hotel-1")!;
    expect(hotel.position).toEqual({x:-94,y:0,z:-236});
    expect(hotel.entrance).toBe("east");
  });

  it("reserves one accessible grade beyond the upper ring rather than an overhead road at the door",()=>{
    for(const id of ["comet-hotel-main","service-2"]){
      for(const [x,y] of [[-92,5],[-84,5],[-76.5,2.5],[-69,0]]){
        const heights=heightAt(id,x,-214);
        expect(heights.length,id).toBeGreaterThan(0);
        for(const actual of heights)expect(actual,id).toBeCloseTo(y,5);
      }
    }
    for(const [id,x,z] of [["central-hotel-promenade",-32.5,-127.5],["central-hotel-promenade-south",-65,-200]] as const){
      expect(heightAt(id,x,z)).toEqual([0]);
    }
  });
});
