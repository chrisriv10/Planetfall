import { BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, brAuthoredDeckHeight, brBlockPlanarHalfExtents, isInsideBrIslandInterior, type BrMapBlock, type BrRoadSegment, type BrStructure, type Vec3 } from "@planetfall/shared";
export interface BrRoadBend {
  id:string; center:Vec3; radius:number; vertices:Vec3[]; insideFans:Vec3[][]; edge:Vec3[];
  /** Distances measured outward from the common endpoint to the inside tangencies. */
  arms:{roadId:string;direction:{x:number;z:number};tangent:number}[];
  outerEdge:Vec3[];
}
let productionBends:BrRoadBend[]|undefined;
const copyBends=(bends:readonly BrRoadBend[])=>bends.map(b=>({...b,center:{...b.center},
  vertices:b.vertices.map(p=>({...p})),insideFans:b.insideFans.map(t=>t.map(p=>({...p}))),
  edge:b.edge.map(p=>({...p})),outerEdge:b.outerEdge.map(p=>({...p})),
  arms:b.arms.map(a=>({...a,direction:{...a.direction}}))}));

/** Round supported level elbows without removing any of the literal ribbons.
 * Tangent reach is capped at 45% of each leg, leaving space for the next join. */
export function buildBrRoadBends(roads:readonly BrRoadSegment[],supported:(p:Vec3)=>number=brAuthoredDeckHeight,structures:readonly BrStructure[]=BR_STRUCTURES,blocks:readonly BrMapBlock[]=roads===BR_ROADS?BR_MAP_BLOCKS:[]):BrRoadBend[]{
  const production=roads===BR_ROADS&&supported===brAuthoredDeckHeight&&structures===BR_STRUCTURES&&blocks===BR_MAP_BLOCKS;
  if(production&&productionBends)return copyBends(productionBends);
  const nodes=new Map<string,{point:Vec3;roads:BrRoadSegment[]}>();
  for(const road of roads)for(const point of [road.from,road.to]){
    const key=`${point.x.toFixed(4)}:${point.y.toFixed(4)}:${point.z.toFixed(4)}`;
    const node=nodes.get(key)??{point,roads:[]};node.roads.push(road);nodes.set(key,node);
  }
  const result:BrRoadBend[]=[];
  for(const [id,node] of nodes){
    if(node.roads.length!==2)continue;
    const [a,b]=node.roads;
    if(Math.abs(a.width-b.width)>.01||node.roads.some(r=>Math.abs(r.from.y-r.to.y)>1e-6))continue;
    // An endpoint on the interior of another road is a branch, not an elbow.
    if(roads.some(r=>{
      if(node.roads.includes(r))return false;
      const dx=r.to.x-r.from.x,dz=r.to.z-r.from.z,lengthSq=dx*dx+dz*dz;
      const t=lengthSq?((node.point.x-r.from.x)*dx+(node.point.z-r.from.z)*dz)/lengthSq:-1;
      return t>=0&&t<=1&&Math.hypot(node.point.x-r.from.x-dx*t,node.point.z-r.from.z-dz*t)<.001
        &&Math.abs(r.from.y+(r.to.y-r.from.y)*t-node.point.y)<.001;
    }))continue;
    const direction=(road:BrRoadSegment)=>{
      const end=Math.hypot(road.from.x-node.point.x,road.from.z-node.point.z)<.001?road.to:road.from;
      const dx=end.x-node.point.x,dz=end.z-node.point.z,length=Math.hypot(dx,dz);
      return {x:dx/length,z:dz/length,length};
    };
    const u=direction(a),v=direction(b),dot=u.x*v.x+u.z*v.z;
    if(!Number.isFinite(dot)||dot<-.999||dot>.9)continue;
    const radius=a.width/2,vertices:Vec3[]=[];
    // Check whole polygons, not just their boundary: a support hole or a small
    // wall footprint can lie between vertices. Convex SAT covers wall overlap.
    const clearPolygon=(polygon:Vec3[])=>{
      // A base-height region can extend underneath a solid raised deck or
      // retaining wall. Keep the full pavement/curb footprint out of solids
      // at this elevation rather than trusting the region height alone.
      for(const block of blocks){
        const r=block.rotation,a=Math.cos(r?.x??0),b=Math.sin(r?.x??0),c=Math.cos(r?.y??0),d=Math.sin(r?.y??0),e=Math.cos(r?.z??0),f=Math.sin(r?.z??0);
        const halfY=Math.abs(a*f+b*e*d)*block.size.x/2+Math.abs(a*e-b*f*d)*block.size.y/2+Math.abs(b*c)*block.size.z/2;
        if(block.position.y+halfY<=node.point.y-.1+.01||block.position.y-halfY>=node.point.y+.08)continue;
        const half=brBlockPlanarHalfExtents(block);
        const axes=[{x:1,z:0},{x:0,z:1},...polygon.map((p,i)=>{const q=polygon[(i+1)%polygon.length];return{x:p.z-q.z,z:q.x-p.x};})];
        if(!axes.some(axis=>{
          const values=polygon.map(p=>p.x*axis.x+p.z*axis.z),center=block.position.x*axis.x+block.position.z*axis.z;
          const extent=Math.abs(axis.x)*(half.x+.2)+Math.abs(axis.z)*(half.z+.2);
          return Math.max(...values)<center-extent||Math.min(...values)>center+extent;
        }))return false;
      }
      // The island-height sampler does not include road grade planes. Reject
      // overlap with their complete ribbon (including the curb half-width),
      // even when no centerline or polygon vertex enters that ribbon.
      for(const road of roads){
        if(node.roads.includes(road)||Math.abs(road.from.y-node.point.y)<1e-6&&Math.abs(road.to.y-node.point.y)<1e-6)continue;
        const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz);if(length<1e-6)continue;
        const ux=dx/length,uz=dz/length,cx=(road.from.x+road.to.x)/2,cz=(road.from.z+road.to.z)/2;
        const axes=[{x:ux,z:uz},{x:-uz,z:ux},...polygon.map((p,i)=>{const q=polygon[(i+1)%polygon.length];return{x:p.z-q.z,z:q.x-p.x};})];
        if(!axes.some(axis=>{
          const values=polygon.map(p=>p.x*axis.x+p.z*axis.z),center=cx*axis.x+cz*axis.z;
          const extent=Math.abs(ux*axis.x+uz*axis.z)*(length/2+.2)+Math.abs(-uz*axis.x+ux*axis.z)*(road.width/2+.2);
          return Math.max(...values)<center-extent||Math.min(...values)>center+extent;
        }))return false;
      }
      for(const s of structures){
        const axes=[{x:1,z:0},{x:0,z:1},...polygon.map((p,i)=>{const q=polygon[(i+1)%polygon.length];return{x:p.z-q.z,z:q.x-p.x};})];
        const separate=axes.some(axis=>{
          const values=polygon.map(p=>p.x*axis.x+p.z*axis.z),center=s.position.x*axis.x+s.position.z*axis.z;
          const extent=Math.abs(axis.x)*(s.size.x/2+.8)+Math.abs(axis.z)*(s.size.z/2+.8);
          return Math.max(...values)<center-extent||Math.min(...values)>center+extent;
        });
        if(!separate)return false;
      }
      const first=polygon[0];
      for(let i=1;i<polygon.length-1;i++){
        const p=polygon[i],q=polygon[i+1];
        const steps=Math.max(1,Math.ceil(Math.max(Math.hypot(p.x-first.x,p.z-first.z),Math.hypot(q.x-first.x,q.z-first.z),Math.hypot(q.x-p.x,q.z-p.z))/.4));
        for(let j=0;j<=steps;j++)for(let k=0;k<=steps-j;k++){
          const sample={x:first.x+(p.x-first.x)*j/steps+(q.x-first.x)*k/steps,y:first.y,z:first.z+(p.z-first.z)*j/steps+(q.z-first.z)*k/steps};
          if(!isInsideBrIslandInterior(sample)||Math.abs(supported(sample)-(node.point.y-.1))>.01)return false;
        }
      }
      return true;
    };
    for(let i=0;i<24;i++){
      const angle=i*Math.PI*2/24;
      vertices.push({x:node.point.x+Math.cos(angle)*radius,y:node.point.y-.065,z:node.point.z+Math.sin(angle)*radius});
    }
    if(!clearPolygon(vertices))continue;
    const insideFans:Vec3[][]=[],edge:Vec3[]=[],outerEdge:Vec3[]=[],arms:BrRoadBend["arms"]=[];
    const sin=Math.sqrt(1-dot*dot),cotHalf=Math.sqrt((1+dot)/(1-dot));
    const r=Math.min(a.width*.65,Math.min(u.length,v.length)*.45/cotHalf-radius);
    if(r>.15){
      const corner={x:node.point.x+(u.x+v.x)*radius/sin,y:node.point.y-.065,z:node.point.z+(u.z+v.z)*radius/sin};
      const center={x:corner.x+(u.x+v.x)*r/sin,y:corner.y,z:corner.z+(u.z+v.z)*r/sin};
      const start={x:corner.x+v.x*r*cotHalf,z:corner.z+v.z*r*cotHalf};
      const end={x:corner.x+u.x*r*cotHalf,z:corner.z+u.z*r*cotHalf};
      const angle=Math.atan2(start.z-center.z,start.x-center.x);
      const sweep=Math.atan2((start.x-center.x)*(end.z-center.z)-(start.z-center.z)*(end.x-center.x),
        (start.x-center.x)*(end.x-center.x)+(start.z-center.z)*(end.z-center.z));
      for(let i=0;i<=8;i++)edge.push({x:center.x+r*Math.cos(angle+sweep*i/8),y:center.y,z:center.z+r*Math.sin(angle+sweep*i/8)});
      const triangles=edge.slice(0,-1).map((p,i)=>{
        const triangle=[corner,p,edge[i+1]],cross=(p.x-corner.x)*(edge[i+1].z-corner.z)-(p.z-corner.z)*(edge[i+1].x-corner.x);
        return cross<0?triangle.reverse():triangle;
      });
      if(triangles.every(clearPolygon)){
        insideFans.push(...triangles);
        arms.push({roadId:a.id,direction:u,tangent:(radius+r)*cotHalf},{roadId:b.id,direction:v,tangent:(radius+r)*cotHalf});
        const cross=u.x*v.z-u.z*v.x,sign=Math.sign(cross);
        const startAngle=Math.atan2(-u.x*sign,u.z*sign);
        const outerSweep=-sign*(Math.PI-Math.acos(dot));
        for(let i=0;i<=8;i++)outerEdge.push({x:node.point.x+radius*Math.cos(startAngle+outerSweep*i/8),y:node.point.y-.065,z:node.point.z+radius*Math.sin(startAngle+outerSweep*i/8)});
      }else edge.length=0;
    }
    result.push({id:`bend-${id}`,center:node.point,radius,vertices,insideFans,edge,arms,outerEdge});
  }
  if(production){productionBends=result;return copyBends(result);}
  return result;
}
