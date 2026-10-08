import { BR_ROADS, BR_ROAD_ROUTES, type BrRoadSegment, type Vec3 } from "@planetfall/shared";
import { brRoadDetailClear, brRoadRouteId } from "./br-road-detail";

export type BrRoadMarkingRole="curb"|"edge-light"|"dash"|"crossing"|"lamp-post"|"lamp-bulb";
export interface BrRoadMarking {
  role:BrRoadMarkingRole;
  routeId:string;
  pieceId:string;
  position:Vec3;
  scale:Vec3;
  rotationY:number;
  rotationZ:number;
}
type Clear=(road:BrRoadSegment,x:number,z:number)=>boolean;

/** Static presentation transforms. Stations belong to whole authored routes;
 * Pieces are supplied in authored path order; split geometry at grade seams
 * and bends, never restart spacing there or project onto an endpoint chord.
 * All Y values follow the visible pavement (road endpoint Y minus .065).
 * Uses existing unit boxes/materials, with no lights, physics or frame work. */
export function buildBrRoadMarkings(
  routes:readonly BrRoadSegment[]=BR_ROAD_ROUTES,
  pieces:readonly BrRoadSegment[]=BR_ROADS,
  isClear:Clear=brRoadDetailClear,
):BrRoadMarking[]{
  const result:BrRoadMarking[]=[];
  const byRoute=new Map<string,BrRoadSegment[]>();
  for(const piece of pieces){const id=brRoadRouteId(piece),list=byRoute.get(id)??[];list.push(piece);byRoute.set(id,list);}
  for(const route of routes){
    let length=0;
    const segments=(byRoute.get(brRoadRouteId(route))??[]).map(piece=>{
      const dx=piece.to.x-piece.from.x,dz=piece.to.z-piece.from.z,span=Math.hypot(dx,dz);
      const from=length;
      if(span>1e-6)length+=span;
      return {piece,from,to:length,run:0,ux:span?dx/span:0,uz:span?dz/span:0,
        angle:-Math.atan2(dz,dx),slope:span?(piece.to.y-piece.from.y)/span:0};
    }).filter(s=>s.to-s.from>1e-6);
    if(length<1e-6)continue;
    // Corner trimming belongs to a whole straight run, even when tiny grade
    // pieces subdivide the corner's inset. Collinear seams add no new gaps.
    const runs:{from:number;to:number;startTurn:number;endTurn:number}[]=[];
    for(const [index,segment] of segments.entries()){
      const previous=segments[index-1];
      const cross=previous?previous.ux*segment.uz-previous.uz*segment.ux:0;
      const dot=previous?previous.ux*segment.ux+previous.uz*segment.uz:1;
      const bend=previous&&(Math.abs(cross)>1e-8||dot<0);
      if(!previous||bend){
        // Signed tan(turn/2): inside strips need an inset, outside ones do not.
        const turn=bend?(cross||1)/Math.max(1e-8,1+dot):0;
        if(previous)runs[runs.length-1].endTurn=turn;
        runs.push({from:segment.from,to:segment.to,startTurn:turn,endTurn:0});
      }else runs[runs.length-1].to=segment.to;
      segment.run=runs.length-1;
    }
    const cornerInset=(turn:number,offset:number,width:number)=>{
      const inset=offset*turn+width/2*Math.abs(turn);
      return inset>0?inset+.075:0;
    };
    const point=(segment:typeof segments[number],distance:number,offset:number)=>({
      x:segment.piece.from.x+segment.ux*(distance-segment.from)-segment.uz*offset,
      z:segment.piece.from.z+segment.uz*(distance-segment.from)+segment.ux*offset});
    // Check the full detail footprint at sub-metre spacing, including edges,
    // so a center-clear curb cannot cross a doorway or a junction at its end.
    const clearPiece=(segment:typeof segments[number],from:number,to:number,offset:number,width:number)=>{
      const steps=Math.max(1,Math.ceil((to-from)/.5));
      for(let i=0;i<=steps;i++)for(const side of [-.5,0,.5]){
        const p=point(segment,from+(to-from)*i/steps,offset+width*side);
        if(!isClear(route,p.x,p.z))return false;
      }
      return true;
    };
    const clear=(from:number,to:number,offset:number,width:number)=>{
      for(const segment of segments){
        const a=Math.max(from,segment.from),b=Math.min(to,segment.to);
        if(b-a<1e-6)continue;
        if(!clearPiece(segment,a,b,offset,width))return false;
      }
      return true;
    };
    const strip=(role:BrRoadMarkingRole,from:number,to:number,offset:number,width:number,height:number,lift:number)=>{
      if(!clear(from,to,offset,width))return;
      for(const segment of segments){
        const run=runs[segment.run];
        const a=Math.max(from,segment.from,run.from+cornerInset(run.startTurn,offset,width));
        const b=Math.min(to,segment.to,run.to-cornerInset(run.endTurn,offset,width));
        if(b-a<1e-6)continue;
        const d=(a+b)/2,p=point(segment,d,offset);
        result.push({role,routeId:route.id,pieceId:segment.piece.id,
          position:{...p,y:segment.piece.from.y+(d-segment.from)*segment.slope-.065+lift},
          scale:{x:(b-a)*Math.hypot(1,segment.slope),y:height,z:width},rotationY:segment.angle,rotationZ:Math.atan(segment.slope)});
      }
    };
    const sections=Math.ceil(length/6),section=length/sections;
    for(let index=0;index<sections;index++)for(const side of [-1,1]){
      const d=(index+.5)*section;
      strip("curb",index*section+.075,(index+1)*section-.075,side*route.width*.49,.38,.07,.039);
      if(index%4===0)strip("edge-light",d-.85,d+.85,side*route.width*.43,.065,.016,.037);
    }
    const dashCount=Math.max(2,Math.floor(length/12));
    for(let index=0;index<dashCount;index++){
      const d=(index+.5)*length/dashCount;
      strip("dash",Math.max(0,d-1.6),Math.min(length,d+1.6),0,.18,.012,.013);
    }
    if(length>100&&route.id.startsWith("ring-"))for(const fraction of [.11,.89])for(let stripe=-2;stripe<=2;stripe++){
      const d=Math.max(length*.04,Math.min(length*.96,fraction*length+stripe*2.25));
      strip("crossing",d-.36,d+.36,0,route.width*.58,.025,.017);
    }
    const lampCount=Math.max(1,Math.floor(length/58));
    for(let index=1;index<lampCount;index++)for(const side of [-1,1]){
      const d=index*length/lampCount,offset=side*route.width*.62;
      const segment=segments.find(s=>d>=s.from-1e-8&&d<=s.to+1e-8);
      if(!segment)continue;
      if(!clearPiece(segment,d-.21,d+.21,offset,.42))continue;
      const p=point(segment,d,offset),surface=segment.piece.from.y+(d-segment.from)*segment.slope-.065;
      for(const [role,lift,x,y,z] of [["lamp-post",2.215,.22,4.5,.22],["lamp-bulb",4.585,.42,.18,.42]] as const)
        result.push({role,routeId:route.id,pieceId:segment.piece.id,position:{...p,y:surface+lift},scale:{x,y,z},rotationY:segment.angle,rotationZ:0});
    }
  }
  return result;
}
