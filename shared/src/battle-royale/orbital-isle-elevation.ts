import type { Vec3 } from "../index.js";
import type { BrRoadSegment } from "./map.js";

/** Fixed level design: complete streets/blocks, not individual building lifts. */
export const BR_ELEVATION_REGIONS = [
  {id:"nova-commercial-deck",districtId:"nova-plaza",x:-175,z:-135,width:174,depth:170,height:5,apron:38},
  // Preserve the north edges while leaving a ground-level maintenance strip
  // between the southern retaining walls and the existing service pockets.
  {id:"astra-campus-deck",districtId:"astra-academy",x:-278,z:89,width:180,depth:134,height:8,apron:48},
  {id:"helios-power-deck",districtId:"helios-reactor",x:264,z:94,width:170,depth:140,height:6,apron:42},
  {id:"farm-production-deck",districtId:"orbital-farms",x:130,z:294,width:190,depth:148,height:4,apron:36},
  // A real transfer neighborhood replaces the bare underpass between power
  // and production. Its southern edge meets the Farms deck at the same level.
  {id:"farm-transfer-deck",districtId:"farm-transfer",x:194.5,z:198,width:101,depth:44,height:4,apron:24},
  {id:"transit-service-basin",districtId:"transit-court",x:137.5,z:92.5,width:85,depth:105,height:-3,apron:22}
] as const;
/** Existing connective decks must also hold a road at deck height until its
 * retaining edge. Previously a linear ramp began INSIDE the solid deck, and
 * was only traversable because the flat-floor shortcut ignored its side. */
export const BR_SECONDARY_GRADE_REGIONS=[
  {id:"emergency-depot-deck",x:-160,z:-420,width:80,depth:72,height:5.5,apron:32},
  {id:"east-checkpoint-deck",x:355,z:250,width:80,depth:92,height:4.5,apron:32},
  {id:"solar-field-deck",x:75,z:415,width:80,depth:72,height:4,apron:32},
  {id:"academy-commons-deck",x:-265,z:235,width:70,depth:66,height:5.5,apron:32},
  {id:"south-terminal-deck",x:15,z:-415,width:70,depth:66,height:3.5,apron:32},
  {id:"south-shipworks-deck",x:190,z:-400,width:70,depth:66,height:4,apron:32},
  {id:"east-freight-deck",x:330,z:-315,width:82,depth:78,height:8,apron:32},
  {id:"east-rim-deck",x:405,z:105,width:86,depth:70,height:6,apron:32}
] as const;
export function brRegionContains(region:typeof BR_ELEVATION_REGIONS[number],p:Pick<Vec3,"x"|"z">):boolean{
  return Math.abs(p.x-region.x)<=region.width/2&&Math.abs(p.z-region.z)<=region.depth/2;
}
/** Deck height only. Aprons are walkable road grades, not invisible terrain. */
export function brAuthoredDeckHeight(p:Pick<Vec3,"x"|"z">):number{
  return BR_ELEVATION_REGIONS.find(region=>brRegionContains(region,p))?.height??0;
}
export const BR_SUNKEN_REGIONS=BR_ELEVATION_REGIONS.filter(region=>region.height<0);
export function brBaseDeckHeight(p:Pick<Vec3,"x"|"z">):number{
  return BR_SUNKEN_REGIONS.find(region=>brRegionContains(region,p))?.height??0;
}
/** Real base-deck cutout shared by both Rapier implementations. A hidden y=0
 * collider must never seal the lower service court. */
export const BR_BASE_DECK_CELLS=(()=>{
  let cells=[{minX:-650,maxX:650,minZ:-650,maxZ:650,height:0}];
  for(const r of BR_SUNKEN_REGIONS){
    const x0=r.x-r.width/2,x1=r.x+r.width/2,z0=r.z-r.depth/2,z1=r.z+r.depth/2;
    cells=cells.flatMap(c=>{
      if(c.maxX<=x0||c.minX>=x1||c.maxZ<=z0||c.minZ>=z1)return[c];
      return [ {...c,maxX:x0},{...c,minX:x1},
        {...c,minX:x0,maxX:x1,maxZ:z0},{...c,minX:x0,maxX:x1,minZ:z1},
        {minX:x0,maxX:x1,minZ:z0,maxZ:z1,height:r.height}
      ].filter(cell=>cell.maxX>cell.minX&&cell.maxZ>cell.minZ);
    });
  }
  return cells;
})();
/** Outline-clipped floors shared by rendering and authoritative raycasts. */
export function brBaseDeckPolygons(outline:readonly (readonly [number,number])[]):Vec3[][]{
  return BR_BASE_DECK_CELLS.map(cell=>{
    let polygon=outline.map(([x,z])=>({x,y:cell.height,z}));
    for(const [axis,boundary,sign] of [["x",cell.minX,1],["x",cell.maxX,-1],["z",cell.minZ,1],["z",cell.maxZ,-1]] as const){
      const clipped:Vec3[]=[];
      for(let i=0;i<polygon.length;i++){
        const a=polygon[i],b=polygon[(i+1)%polygon.length],da=(a[axis]-boundary)*sign,db=(b[axis]-boundary)*sign;
        if(da>=0)clipped.push(a);
        if((da>=0)!==(db>=0)){const t=da/(da-db);clipped.push({x:a.x+(b.x-a.x)*t,y:cell.height,z:a.z+(b.z-a.z)*t});}
      }
      polygon=clipped;
    }
    // Split shared edges at neighbouring cell corners too. Without these
    // common vertices, quantizing an outer intersection bends one side of a
    // shared edge but not the other, leaving a thin triangular crack.
    polygon=polygon.flatMap((a,i)=>{
      const b=polygon[(i+1)%polygon.length],dx=b.x-a.x,dz=b.z-a.z,lengthSq=dx*dx+dz*dz;
      const splits=new Map<number,Vec3>();
      for(const neighbour of BR_BASE_DECK_CELLS)for(const x of [neighbour.minX,neighbour.maxX])for(const z of [neighbour.minZ,neighbour.maxZ]){
        const t=((x-a.x)*dx+(z-a.z)*dz)/lengthSq;
        if(t>1e-7&&t<1-1e-7&&Math.abs(dx*(z-a.z)-dz*(x-a.x))<1e-7)splits.set(t,{x,y:a.y,z});
      }
      return [a,...[...splits].sort(([a],[b])=>a-b).map(([,p])=>p)];
    });
    // New cell/outline intersections are fractional. Independently rounding x
    // and z into a GPU/Rapier Float32 buffer can push them OUTSIDE the island.
    // Quantize their edge parameter instead: integer outline coordinates and
    // a 15-bit dyadic parameter keep both coordinates exactly representable.
    // All neighbouring cells share the same point, preserving the total area
    // and boundary exactly (the split can move along the edge by millimetres).
    return polygon.map(p=>{
      if(Math.fround(p.x)===p.x&&Math.fround(p.z)===p.z)return p;
      for(let i=0;i<outline.length;i++){
        const [ax,az]=outline[i],[bx,bz]=outline[(i+1)%outline.length],dx=bx-ax,dz=bz-az;
        if(Math.abs(dx*(p.z-az)-dz*(p.x-ax))>1e-7)continue;
        const t=Math.round(((p.x-ax)*dx+(p.z-az)*dz)/(dx*dx+dz*dz)*32768)/32768;
        return {x:ax+dx*t,y:p.y,z:az+dz*t};
      }
      return p;
    });
  }).filter(polygon=>polygon.length>=3);
}
function roadHeight(p:Vec3):number{
  let raised=0;
  for(const r of BR_ELEVATION_REGIONS){
    const dx=Math.abs(p.x-r.x)-r.width/2,dz=Math.abs(p.z-r.z)-r.depth/2;
    if(r.height<0){if(dx<=0&&dz<=0)return r.height*Math.min(1,Math.min(-dx,-dz)/r.apron);}
    else raised=Math.max(raised,r.height*Math.max(0,1-Math.max(0,dx,dz)/r.apron));
  }
  return raised;
}

/** Cell boundaries share vertices but may have a very shallow concave corner
 * at a quantized outline intersection. A center fan would reverse that face. */
export function brTriangulateDeckPolygon(polygon:readonly Vec3[]):number[]{
  const remaining=polygon.map((_,i)=>i),indices:number[]=[];
  const cross=(a:Vec3,b:Vec3,c:Vec3)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
  while(remaining.length>3){
    let clipped=false;
    for(let i=0;i<remaining.length;i++){
      const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
      if(cross(polygon[a],polygon[b],polygon[c])<=0)continue;
      if(remaining.some(p=>p!==a&&p!==b&&p!==c&&cross(polygon[a],polygon[b],polygon[p])>=0&&cross(polygon[b],polygon[c],polygon[p])>=0&&cross(polygon[c],polygon[a],polygon[p])>=0))continue;
      indices.push(a,c,b);remaining.splice(i,1);clipped=true;break;
    }
    if(!clipped)throw new Error("Invalid shared island deck polygon");
  }
  indices.push(remaining[0],remaining[2],remaining[1]);return indices;
}
/** Sample explicit deck/apron boundaries. Shared junction endpoints evaluate
 * identically regardless of which street owns them. */
export function brGradeAuthoredRoad(road:BrRoadSegment):BrRoadSegment[]{
  const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz);
  const holds:Array<{height:number;from:number;to:number}>=[];
  for(const r of BR_SECONDARY_GRADE_REGIONS){
    const contains=(p:Vec3)=>Math.abs(p.x-r.x)<=r.width/2&&Math.abs(p.z-r.z)<=r.depth/2;
    if(road.to.y<=.101&&contains(road.from)&&!contains(road.to)&&Math.abs(road.from.y-r.height-.1)<.01){
      const exit=Math.min(...[
        Math.abs(dx)>1e-8?((r.x+Math.sign(dx)*r.width/2)-road.from.x)/dx:Infinity,
        Math.abs(dz)>1e-8?((r.z+Math.sign(dz)*r.depth/2)-road.from.z)/dz:Infinity
      ]);
      holds.push({height:r.height+.1,from:0,to:exit});
    }
    if(road.from.y<=.101&&contains(road.to)&&!contains(road.from)&&Math.abs(road.to.y-r.height-.1)<.01){
      const entry=1-Math.min(...[
        Math.abs(dx)>1e-8?((r.x-Math.sign(dx)*r.width/2)-road.to.x)/-dx:Infinity,
        Math.abs(dz)>1e-8?((r.z-Math.sign(dz)*r.depth/2)-road.to.z)/-dz:Infinity
      ]);
      holds.push({height:r.height+.1,from:entry,to:1});
    }
  }
  if(!holds.length&&!BR_ELEVATION_REGIONS.some(r=>Math.min(road.from.x,road.to.x)<=r.x+r.width/2+r.apron&&Math.max(road.from.x,road.to.x)>=r.x-r.width/2-r.apron&&Math.min(road.from.z,road.to.z)<=r.z+r.depth/2+r.apron&&Math.max(road.from.z,road.to.z)>=r.z-r.depth/2-r.apron))return[road];
  const amounts=new Set<number>([0,1]);
  for(const hold of holds)for(const t of [hold.from,hold.to])if(t>0&&t<1)amounts.add(t);
  for(const r of BR_ELEVATION_REGIONS)for(const margin of [0,r.height<0?-r.apron:r.apron]){
    for(const boundary of [r.x-r.width/2-margin,r.x+r.width/2+margin])if(Math.abs(dx)>.001){const t=(boundary-road.from.x)/dx;if(t>0&&t<1)amounts.add(t);}
    for(const boundary of [r.z-r.depth/2-margin,r.z+r.depth/2+margin])if(Math.abs(dz)>.001){const t=(boundary-road.from.z)/dz;if(t>0&&t<1)amounts.add(t);}
  }
  for(let i=1;i<Math.ceil(length/12);i++)amounts.add(i/Math.ceil(length/12));
  // An old downhill feeder can now join another raised deck. Interpolate
  // between its NEW endpoint heights, not the obsolete descent to y=0;
  // otherwise max(old grade,new apron) creates an unintended V-shaped dip.
  const endpointHeight=(p:Vec3)=>roadHeight(p)<0?roadHeight(p)+.1:Math.max(p.y,roadHeight(p)+.1);
  const fromY=endpointHeight(road.from),toY=endpointHeight(road.to);
  const points=[...amounts].sort((a,b)=>a-b).map(t=>{
    let y=fromY+(toY-fromY)*t;
    // Reparameterize this access ramp's slope outside its own deck only.
    // Do not raise unrelated promenades/bridges merely because they are near
    // an existing terrace; their authored elevations are already intentional.
    for(const hold of holds){
      const height=t>=hold.from&&t<=hold.to?hold.height:
        t<hold.from?fromY+(hold.height-fromY)*t/hold.from:
        hold.height+(toY-hold.height)*(t-hold.to)/(1-hold.to);
      y=Math.max(y,height);
    }
    const p={x:road.from.x+dx*t,y,z:road.from.z+dz*t},authored=roadHeight(p);
    return {...p,y:t===0?fromY:t===1?toY:authored<0?authored+.1:Math.max(p.y,authored+.1)};
  });
  const simplified:Vec3[]=[];
  for(const p of points){
    while(simplified.length>1){const a=simplified.at(-2)!,b=simplified.at(-1)!,ab=Math.hypot(b.x-a.x,b.z-a.z),bc=Math.hypot(p.x-b.x,p.z-b.z);if(Math.abs((b.y-a.y)/ab-(p.y-b.y)/bc)>.00001)break;simplified.pop();}
    simplified.push(p);
  }
  return simplified.slice(1).map((p,i)=>({...road,id:i===0?road.id:`${road.id}-grade-part-${i}`,from:simplified[i],to:p}));
}

/** A feeder can join the middle of an arterial grade, not just its endpoint.
 * Sample that actual supporting plane instead of independently evaluating the
 * terrain apron: an arterial may bridge above the apron between two decks. */
export function brJoinServiceGrades(roads:readonly BrRoadSegment[]):BrRoadSegment[]{
  return roads.map((road,index)=>{
    const routeId=road.id.replace(/-grade-part-\d+$/,"");
    if(road.kind!=="service"||!routeId.endsWith("-grade")||roads[index+1]?.id.startsWith(`${routeId}-grade-part-`))return road;
    let height=road.to.y;
    for(const arterial of roads){
      if(arterial.kind!=="arterial")continue;
      const dx=arterial.to.x-arterial.from.x,dz=arterial.to.z-arterial.from.z,lengthSq=dx*dx+dz*dz;
      const t=((road.to.x-arterial.from.x)*dx+(road.to.z-arterial.from.z)*dz)/lengthSq;
      if(t<0||t>1||Math.hypot(road.to.x-arterial.from.x-dx*t,road.to.z-arterial.from.z-dz*t)>.01)continue;
      height=Math.max(height,arterial.from.y+(arterial.to.y-arterial.from.y)*t);
    }
    return {...road,to:{...road.to,y:height}};
  });
}
