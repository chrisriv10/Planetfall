import type { BrMapBlock, BrRoadSegment, BrStructure, BrTerrainPatch } from "./map.js";
import type { Vec3 } from "../index.js";

export interface BrGreenwayTree { id:string; band:string; position:Vec3; height:number; radius:number; color:"cyan"|"violet"|"mint"; }
// These planting bands frame interdistrict approaches, not the POI centers.
// Irregular clumps leave open travel and sightline gaps between their crowns.
const BANDS = [
  ["west-civic",-110,25,"cyan"], ["nova-civic",-55,-145,"violet"],
  ["west-salvage",-310,-75,"violet"], ["salvage-south",-275,-370,"violet"],
  ["south-transfer",75,-355,"cyan"], ["dock-civic",95,-215,"cyan"],
  ["dock-east",350,-215,"cyan"], ["east-power",440,5,"cyan"],
  ["northeast-garden",300,365,"mint"], ["north-arc",-110,315,"violet"],
  ["academy-mall",-295,180,"violet"], ["western-greenbelt",-445,245,"violet"],
  ["southern-greenbelt",-315,-435,"mint"], ["northern-greenbelt",-190,440,"mint"],
  ["central-garden",30,145,"cyan"], ["east-garden",300,175,"mint"],
  ["western-arrival",-340,210,"violet"], ["southwest-arrival",-230,-285,"violet"],
] as const;
const OFFSETS=[[-18,-9],[-9,-17],[2,-11],[12,-3],[-13,5],[-3,12],[9,18],[21,11]] as const;

export function buildBrGreenwayTrees(inputs:{roads:readonly BrRoadSegment[];structures:readonly BrStructure[];
  blocks:readonly BrMapBlock[];patches:readonly BrTerrainPatch[];reserved:readonly Vec3[];
  deckHeight:(point:Vec3)=>number;inside:(point:Vec3,inset:number)=>boolean}):BrGreenwayTree[]{
  const trees:BrGreenwayTree[]=[];
  for(const [band,x,z,color] of BANDS)for(const [index,[ox,oz]] of OFFSETS.entries()){
    const point={x:x+ox,y:0,z:z+oz},radius=2.6+(index%3)*.4,height=6.4+(index%4)*.65;
    if(!inputs.inside(point,radius+3)||inputs.deckHeight(point)!==0)continue;
    if(inputs.roads.some(r=>{
      const dx=r.to.x-r.from.x,dz=r.to.z-r.from.z,sq=dx*dx+dz*dz;
      const t=sq?Math.max(0,Math.min(1,((point.x-r.from.x)*dx+(point.z-r.from.z)*dz)/sq)):0;
      return Math.hypot(point.x-r.from.x-dx*t,point.z-r.from.z-dz*t)<r.width/2+radius+2;
    }))continue;
    if(inputs.structures.some(s=>Math.abs(point.x-s.position.x)<s.size.x/2+radius+2&&Math.abs(point.z-s.position.z)<s.size.z/2+radius+2))continue;
    if(inputs.blocks.some(b=>{
      const yaw=b.rotation?.y??0,dx=point.x-b.position.x,dz=point.z-b.position.z;
      const lx=dx*Math.cos(yaw)-dz*Math.sin(yaw),lz=dx*Math.sin(yaw)+dz*Math.cos(yaw);
      return Math.abs(lx)<b.size.x/2+radius+1&&Math.abs(lz)<b.size.z/2+radius+1
        &&b.position.y+b.size.y/2>.1&&b.position.y-b.size.y/2<height;
    }))continue;
    if(inputs.patches.some(p=>{
      if(p.kind!=="coolant"&&p.kind!=="landing")return false;
      const dx=point.x-p.position.x,dz=point.z-p.position.z;
      return Math.abs(dx*Math.cos(p.rotation)-dz*Math.sin(p.rotation))<p.size.x/2+radius
        &&Math.abs(dx*Math.sin(p.rotation)+dz*Math.cos(p.rotation))<p.size.z/2+radius;
    }))continue;
    if(inputs.reserved.some(p=>Math.hypot(point.x-p.x,point.z-p.z)<radius+3))continue;
    if(trees.some(t=>Math.hypot(t.position.x-point.x,t.position.z-point.z)<radius+t.radius+1))continue;
    trees.push({id:`greenway-${band}-${index}`,band,position:point,height,radius,color});
  }
  return trees;
}
export function brGreenwayTrunk(tree:BrGreenwayTree):BrMapBlock{
  const height=tree.height*.7;
  return {id:`${tree.id}-trunk`,districtId:"orbital-isle",kind:"wall",position:{...tree.position,y:tree.position.y+height/2},
    size:{x:.7,y:height,z:.7},color:"#354252"};
}
