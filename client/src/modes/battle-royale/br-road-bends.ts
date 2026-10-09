import { BR_STRUCTURES, brAuthoredDeckHeight, isInsideBrIslandInterior, type BrRoadSegment, type BrStructure, type Vec3 } from "@planetfall/shared";
export interface BrRoadBend { id:string; center:Vec3; radius:number; vertices:Vec3[]; insideFans:Vec3[][]; edge:Vec3[]; }

/** Round the outside of level road elbows with a pavement cap. The entire
 * original ribbon remains intact: route support, navigation and grade planes
 * never move. Caps only occupy the existing continuous floor at that height;
 * raised crossings and retaining edges must keep their authored boundaries. */
export function buildBrRoadBends(roads:readonly BrRoadSegment[],supported:(p:Vec3)=>number=brAuthoredDeckHeight,structures:readonly BrStructure[]=BR_STRUCTURES):BrRoadBend[]{
  const nodes=new Map<string,{point:Vec3;roads:BrRoadSegment[]}>();
  for(const road of roads){
    if(Math.abs(road.from.y-road.to.y)>1e-6)continue;
    for(const point of [road.from,road.to]){
      const key=`${point.x.toFixed(4)}:${point.y.toFixed(4)}:${point.z.toFixed(4)}`;
      const node=nodes.get(key)??{point,roads:[]};node.roads.push(road);nodes.set(key,node);
    }
  }
  const result:BrRoadBend[]=[];
  for(const [id,node] of nodes){
    if(node.roads.length!==2)continue;
    const [a,b]=node.roads;if(Math.abs(a.width-b.width)>.01)continue;
    const direction=(road:BrRoadSegment)=>{
      const end=Math.hypot(road.from.x-node.point.x,road.from.z-node.point.z)<.001?road.to:road.from;
      const dx=end.x-node.point.x,dz=end.z-node.point.z,length=Math.hypot(dx,dz);
      return {x:dx/length,z:dz/length,length};
    };
    const u=direction(a),v=direction(b),dot=u.x*v.x+u.z*v.z;
    if(dot<-.95||dot>.9||Math.min(u.length,v.length)<a.width)continue;
    const radius=a.width/2,vertices:Vec3[]=[];
    for(let i=0;i<24;i++){
      const angle=i*Math.PI*2/24;
      vertices.push({x:node.point.x+Math.cos(angle)*radius,y:node.point.y-.065,z:node.point.z+Math.sin(angle)*radius});
    }
    if(vertices.some(p=>!isInsideBrIslandInterior(p)||Math.abs(supported(p)-(node.point.y-.1))>.01))continue;
    const insideFans:Vec3[][]=[],edge:Vec3[]=[];
    // Tangential inside fillet at a near-right-angle elbow, leaving the full
    // old road corridor intact. Eight triangles partition the added wedge.
    if(Math.abs(dot)<.05){
      const r=a.width*.65,corner={x:node.point.x+(u.x+v.x)*radius,y:node.point.y-.065,z:node.point.z+(u.z+v.z)*radius};
      const center={x:corner.x+(u.x+v.x)*r,y:corner.y,z:corner.z+(u.z+v.z)*r};
      for(let i=0;i<=8;i++){
        const angle=i*Math.PI/16;
        edge.push({x:center.x-u.x*r*Math.cos(angle)-v.x*r*Math.sin(angle),y:center.y,z:center.z-u.z*r*Math.cos(angle)-v.z*r*Math.sin(angle)});
      }
      const clear=[corner,...edge].every(p=>isInsideBrIslandInterior(p)&&Math.abs(supported(p)-(node.point.y-.1))<.01
        &&structures.every(s=>Math.abs(p.x-s.position.x)>s.size.x/2+.8||Math.abs(p.z-s.position.z)>s.size.z/2+.8));
      if(clear)for(let i=0;i<8;i++){
        const triangle=[corner,edge[i],edge[i+1]],cross=(triangle[1].x-corner.x)*(triangle[2].z-corner.z)-(triangle[1].z-corner.z)*(triangle[2].x-corner.x);
        insideFans.push(cross<0?triangle.reverse():triangle);
      }else edge.length=0;
    }
    result.push({id:`bend-${id}`,center:node.point,radius,vertices,insideFans,edge});
  }
  return result;
}
