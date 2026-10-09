import type { BrMapBlock, BrRoadSegment, BrStructure } from "./map.js";
import type { Vec3 } from "../index.js";

/** Exposed links only. Streets on solid district decks need no extra piers. */
export const BR_SUPPORTED_BRIDGE_ROUTES = [
  "ring-west", "radial-3", "ring-ne", "south-transfer-bridge",
  "south-rim-boardwalk-main", "west-transit-avenue", "comet-hotel-main",
  "central-heights-main", "service-24-grade", "nova-north-descent",
  "southwest-salvage-grade", "east-freight-engine-grade",
] as const;
export const BR_BRIDGE_PIER_WIDTH = 1.25;
type Inputs = {
  roads: readonly BrRoadSegment[];
  blocks: readonly BrMapBlock[];
  structures: readonly BrStructure[];
  reserved: readonly Vec3[];
  deckHeight: (point: Vec3) => number;
  inside: (point: Vec3, inset: number) => boolean;
};

function bounds(block: BrMapBlock) {
  const { x: rx = 0, y: ry = 0, z: rz = 0 } = block.rotation ?? {};
  const a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry),e=Math.cos(rz),f=Math.sin(rz);
  const x=block.size.x/2,y=block.size.y/2,z=block.size.z/2;
  return { x:Math.abs(c*e)*x+Math.abs(c*f)*y+Math.abs(d)*z,
    y:Math.abs(b*d*e+a*f)*x+Math.abs(-b*d*f+a*e)*y+Math.abs(b*c)*z,
    z:Math.abs(-a*d*e+b*f)*x+Math.abs(a*d*f+b*e)*y+Math.abs(a*c)*z };
}

/** Deterministic authored-route construction, evaluated once with the map.
 * Both supports in a station must be clear; otherwise retain the open span.
 * Full footprints exclude lower streets, buildings/doors, sockets, traversal
 * and existing solids. No road plane, deck, structure or loot socket moves.
 */
export function buildBrBridgePiers(inputs: Inputs): BrMapBlock[] {
  const result: BrMapBlock[] = [], half=BR_BRIDGE_PIER_WIDTH/2;
  const blockBounds=inputs.blocks.map(block=>({block,half:bounds(block)}));
  for(const routeId of BR_SUPPORTED_BRIDGE_ROUTES){
    const pieces=inputs.roads.filter(road=>road.id.replace(/-grade-part-\d+$/, "")===routeId);
    if(!pieces.length)continue;
    const lengths=pieces.map(p=>Math.hypot(p.to.x-p.from.x,p.to.z-p.from.z));
    const length=lengths.reduce((sum,n)=>sum+n,0);
    if(!Number.isFinite(length)||length<30)continue;
    for(let distance=12,station=0;distance<length-10;distance+=24,station++){
      let remaining=distance,index=0;
      while(index<pieces.length-1&&remaining>lengths[index])remaining-=lengths[index++];
      const piece=pieces[index],run=lengths[index];if(run<.001)continue;
      const t=remaining/run,ux=(piece.to.x-piece.from.x)/run,uz=(piece.to.z-piece.from.z)/run;
      const slope=Math.atan2(piece.to.y-piece.from.y,run);
      const center={x:piece.from.x+ux*remaining,y:piece.from.y+(piece.to.y-piece.from.y)*t,z:piece.from.z+uz*remaining};
      // Touch the underside of the real .34m slab, not its visible top ribbon.
      const top=center.y-.1-.34/Math.cos(slope),offset=piece.width*.34;
      const stationParts: BrMapBlock[]=[];
      for(const side of [-1,1]){
        const point={x:center.x-uz*offset*side,y:0,z:center.z+ux*offset*side};
        const ground=inputs.deckHeight(point);point.y=ground;
        if(!Number.isFinite(top)||top-ground<2.3||!inputs.inside(point,3))break;
        // Keep a standing capsule's approach on the same floor too, including
        // beside sunken courtyards and retaining edges.
        const groundBuffer=half+1.5;
        const footprint=[point,...[-groundBuffer,groundBuffer].flatMap(x=>[-groundBuffer,groundBuffer].map(z=>({...point,x:point.x+x,z:point.z+z})))];
        if(footprint.some(p=>Math.abs(inputs.deckHeight(p)-ground)>.01))break;
        if(inputs.structures.some(s=>Math.abs(point.x-s.position.x)<s.size.x/2+half+2
          &&Math.abs(point.z-s.position.z)<s.size.z/2+half+2))break;
        if(inputs.reserved.some(p=>Math.hypot(point.x-p.x,point.z-p.z)<half+3))break;
        const lowerRoad=inputs.roads.some(road=>{
          if(road.id.replace(/-grade-part-\d+$/, "")===routeId)return false;
          const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,sq=dx*dx+dz*dz;
          const u=sq?Math.max(0,Math.min(1,((point.x-road.from.x)*dx+(point.z-road.from.z)*dz)/sq)):0;
          const floor=road.from.y+(road.to.y-road.from.y)*u-.1;
          return floor<top-.4&&floor>=ground-.5
            &&Math.hypot(point.x-road.from.x-dx*u,point.z-road.from.z-dz*u)<road.width/2+half+1.5;
        });
        if(lowerRoad)break;
        const height=top-ground,position={...point,y:ground+height/2};
        if(blockBounds.some(({block,half:bh})=>{
          if(pieces.some(p=>block.id===`${p.id}-surface`))return false;
          return Math.abs(position.x-block.position.x)<half+bh.x-.02
            &&Math.abs(position.z-block.position.z)<half+bh.z-.02
            &&Math.abs(position.y-block.position.y)<height/2+bh.y-.02;
        }))break;
        if(result.some(p=>Math.abs(p.position.x-point.x)<BR_BRIDGE_PIER_WIDTH+.5
          &&Math.abs(p.position.z-point.z)<BR_BRIDGE_PIER_WIDTH+.5))break;
        const districtId=inputs.blocks.find(b=>b.id===`${piece.id}-surface`)?.districtId??"orbital-isle";
        stationParts.push({id:`bridge-pier-${routeId}-${station}-${side<0?"left":"right"}`,districtId,
          position,size:{x:BR_BRIDGE_PIER_WIDTH,y:height,z:BR_BRIDGE_PIER_WIDTH},color:"#355c76",kind:"wall"});
      }
      if(stationParts.length===2)result.push(...stationParts);
    }
  }
  return result;
}
