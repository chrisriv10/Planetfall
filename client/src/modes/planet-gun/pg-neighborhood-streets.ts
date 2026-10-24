import {PG_MAP} from "@planetfall/shared";
import type {PgArtContext, PgArtMaterial} from "./pg-environment-builder";

type Rect=readonly [number,number,number,number];
/** Subtract real ground obstacles so paving never advertises a route through cover. */
function clearRect(rect:Rect):Rect[]{
  let result:Rect[]=[rect];
  for(const s of PG_MAP.solids){
    if(s.id==="orbital-deck"||s.center.y-s.half.y>.04||s.center.y+s.half.y<=0)continue;
    const l=s.center.x-s.half.x-.06,r=s.center.x+s.half.x+.06,n=s.center.z-s.half.z-.06,b=s.center.z+s.half.z+.06;
    result=result.flatMap(([x0,z0,x1,z1])=>{
      if(r<=x0||l>=x1||b<=z0||n>=z1)return [[x0,z0,x1,z1]as Rect];
      const cut:Rect[]=[];
      if(l>x0)cut.push([x0,z0,l,z1]);if(r<x1)cut.push([r,z0,x1,z1]);
      const a=Math.max(x0,l),c=Math.min(x1,r);
      if(n>z0)cut.push([a,z0,c,n]);if(b<z1)cut.push([a,b,c,z1]);
      return cut;
    });
  }
  return result.filter(([x0,z0,x1,z1])=>x1-x0>.02&&z1-z0>.02);
}

/** Static street network and garden silhouettes, backed by the shared map. */
export function buildPgNeighborhoodStreets(ctx:PgArtContext):void{
  const surface=(name:string,rect:Rect,material:PgArtMaterial="paving",y=.009)=>{
    clearRect(rect).forEach(([x0,z0,x1,z1],i)=>ctx.add(`${name}-${i}`,"box",material,[(x0+x1)/2,y,(z0+z1)/2,x1-x0,.008,z1-z0]));
  };
  // Continuous primary spine; the east widening carries pedestrians around the
  // transit pier and along the planted ticket-bank edge.
  surface("street-spine",[8,-20,12,35]);
  surface("street-pier-bypass",[10.9,.8,13.1,4.2]);
  surface("street-habitat",[-34,3,8,7]);
  surface("street-garden",[-12,-20,8,-16]);
  surface("street-engineering",[12,-9,39,-5]);
  surface("street-relay-approach",[-10,-11,8,-3]);
  surface("street-west-link",[-12,-16,-9,3]);
  surface("street-garden-step-approach",[-14,-30,-10,-28.4]);
  // Broad sidewalk bands and long restrained inlays are infrastructure, rather
  // than a field of isolated plates. Their entire height stays under 3cm.
  for(const [name,rect]of [
    ["spine-west",[7.1,-20,7.9,35]],["spine-east",[12.1,-20,12.9,35]],
    ["habitat-south",[-34,7.1,8,8]],["habitat-north",[-34,2.1,8,2.9]],
    ["engineering-north",[13,-10,39,-9.1]],["engineering-south",[13,-4.9,39,-4]],
    ["garden-north",[-12,-21,8,-20.1]],
  ] as const)surface(`walk-${name}`,rect,"ivory",.016);
  for(const z of [-15,-11,9,13,19,23,27,31])surface(`spine-guide-${z}`,[9.94,z,10.06,z+1.6],"cyan",.023);
  for(const x of [-32,-28,-24,-20,-16,-12,-4,0,4])surface(`habitat-guide-${x}`,[x,4.94,x+1.5,5.06],"amber",.023);
  // Crosswalks stay on the actual four-meter street surface.
  for(let i=0;i<6;i++){
    surface(`crossing-habitat-${i}`,[8.3,7.9+i*.48,11.7,8.14+i*.48],"ivory",.023);
    surface(`crossing-engineering-${i}`,[14.4+i*.48,-8.7,14.65+i*.48,-5.3],"ivory",.023);
  }
  // The relay is a purposeful small civic plaza. Rings are horizontal flush
  // paving segments, omitted wherever the real console occupies the ground.
  for(let i=0;i<32;i++){
    const angle=i*Math.PI/16,x=-2+Math.cos(angle)*5.35,z=-7+Math.sin(angle)*3.35;
    surface(`relay-plaza-inlay-${i}`,[x-.19,z-.07,x+.19,z+.07],"cyan",.024);
  }
  const terrace=PG_MAP.solids.find(s=>s.id==="habitat-garden-terrace");
  if(terrace){
    const {center:c,half:h}=terrace,top=c.y+h.y;
    ctx.add("garden-terrace-paving","box","paving",[c.x,top+.008,c.z,h.x*2-.08,.016,h.z*2-.08]);
    // Lift cap tops and offset outer faces from the opaque retaining body.
    // The maximum silhouette extension is 30mm, not a new obstacle.
    for(const z of [c.z-h.z+.048,c.z+h.z-.048])ctx.add(`garden-terrace-cap-${z}`,"box","ivory",[c.x,top-.005,z,h.x*2+.024,.07,.12]);
    for(let i=0;i<8;i++)ctx.add(`garden-retaining-course-${i}`,"box","frame",[c.x-h.x+.65+i*1.25,.6,c.z+h.z+.012,.035,1.1,.024]);
    for(const step of PG_MAP.solids.filter(s=>s.id.startsWith("habitat-garden-step-")))ctx.add(`${step.id}-nosing`,"box","ivory",[step.center.x,step.center.y+step.half.y+.009,step.center.z-step.half.z+.06,step.half.x*2,.018,.12]);
  }
  for(const bed of PG_MAP.solids.filter(s=>s.id.startsWith("garden-bed-")||s.id==="transit-ticket-bank")){
    const {center:c,half:h}=bed,top=c.y+h.y;
    ctx.add(`${bed.id}-soil`,"box","soil",[c.x,top+.006,c.z,h.x*2-.22,.012,h.z*2-.22]);
    // Butt-jointed rims avoid both coincident body faces and intersecting
    // corner rails. Soil sits 18mm below their top with a 12mm inset gap.
    for(const x of [c.x-h.x+.043,c.x+h.x-.043])ctx.add(`${bed.id}-rim-${x}`,"box","ivory",[x,top+.005,c.z,.11,.05,h.z*2+.024]);
    for(const z of [c.z-h.z+.043,c.z+h.z-.043])ctx.add(`${bed.id}-rim-${z}`,"box","ivory",[c.x,top+.005,z,h.x*2-.196,.05,.11]);
    const count=bed.id==="transit-ticket-bank"?7:3;
    for(let i=0;i<count;i++){
      const z=c.z-h.z+.55+i*(h.z*2-1.1)/Math.max(1,count-1),x=c.x+(i%2?-.45:.4);
      ctx.add(`${bed.id}-shrub-${i}`,"sphere","leaf",[x,top+.22,z,.65,.35,.58]);
    }
    ctx.add(`${bed.id}-irrigation`,"box","frame",[c.x-h.x+.25,top+.023,c.z,.035,.035,h.z*2-.5],undefined,true);
  }
  for(const trunk of PG_MAP.solids.filter(s=>s.id.startsWith("garden-tree-"))){
    const {center:c,half:h}=trunk,top=c.y+h.y;
    // Broad asymmetrical crown, supported by the real tall trunk. No tiny
    // decorative saplings: these form a legible skyline at player height.
    for(const [i,dx,dy,dz,sx,sy,sz]of [
      [0,0,-.55,0,2.1,1.45,1.85],[1,-1.35,-1.1,.3,1.55,1.1,1.45],
      [2,1.25,-.85,-.15,1.55,1.3,1.45],[3,.15,.45,.15,1.65,1.25,1.55],
      [4,-.25,-.75,1.15,1.55,1.1,1.35],
    ])ctx.add(`${trunk.id}-canopy-${i}`,"sphere","leaf",[c.x+dx,top+dy,c.z+dz,sx,sy,sz]);
  }
}
