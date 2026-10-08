import * as map from "../shared/dist/index.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const segmentDistance=(point,from,to)=>{const dx=to.x-from.x,dz=to.z-from.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((point.x-from.x)*dx+(point.z-from.z)*dz)/length)):0;return Math.hypot(point.x-from.x-t*dx,point.z-from.z-t*dz)};
const inside=(point,polygon)=>{let result=false;for(let index=0,previous=polygon.length-1;index<polygon.length;previous=index++){const [x,z]=polygon[index],[px,pz]=polygon[previous];if((z>point.z)!==(pz>point.z)&&point.x<(px-x)*(point.z-z)/(pz-z)+x)result=!result}return result};
const rectDistance=(point,position,size,rotation=0)=>{
  const dx=point.x-position.x,dz=point.z-position.z,c=Math.cos(rotation),s=Math.sin(rotation);
  return Math.hypot(Math.max(0,Math.abs(c*dx-s*dz)-size.x/2),Math.max(0,Math.abs(s*dx+c*dz)-size.z/2));
};

/** A road or district-sized floor is not spatial enclosure. Keep pavement
 * proximity separate from nearby buildings/cover, so raising an empty slab or
 * drawing another road cannot make the perceived-density audit look solved.
 * Named POI/secondary centers are navigation metadata, not occupied content. */
export function brDensityAt(point,world=map){
  let enclosure=Infinity,pavement=Infinity;
  for(const structure of world.BR_STRUCTURES)enclosure=Math.min(enclosure,rectDistance(point,structure.position,structure.size));
  for(const block of world.BR_MAP_BLOCKS){
    if(block.kind!=="cover")continue;
    enclosure=Math.min(enclosure,rectDistance(point,block.position,block.size,block.rotation?.y));
  }
  for(const road of world.BR_ROADS)pavement=Math.min(pavement,Math.max(0,segmentDistance(point,road.from,road.to)-road.width/2));
  return {enclosure,pavement};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const samples=[];
  for(let x=-480;x<=480;x+=10)for(let z=-480;z<=480;z+=10){
    const point={x,z};
    const edgeDistance=Math.min(...map.BR_ISLAND_OUTLINE.map(([ax,az],index)=>{const [bx,bz]=map.BR_ISLAND_OUTLINE[(index+1)%map.BR_ISLAND_OUTLINE.length];return segmentDistance(point,{x:ax,z:az},{x:bx,z:bz})}));
    if(inside(point,map.BR_ISLAND_OUTLINE)&&edgeDistance>18)samples.push({...point,...brDensityAt(point)});
  }
  samples.sort((left,right)=>right.enclosure-left.enclosure);
  const separated=[];
  for(const sample of samples)if(separated.every(other=>Math.hypot(sample.x-other.x,sample.z-other.z)>45)){separated.push(sample);if(separated.length===12)break}
  console.log("Largest building/cover gaps (10m sampling, 18m edge exclusion; floors and POI centers excluded):");
  for(const sample of separated)console.log(`${sample.x.toString().padStart(4)}, ${sample.z.toString().padStart(4)} : ${sample.enclosure.toFixed(1)}m to enclosure, ${sample.pavement.toFixed(1)}m to road`);
  for(const threshold of [30,50,75])console.log(`${(100*samples.filter(sample=>sample.enclosure>threshold).length/samples.length).toFixed(1)}% of interior samples are over ${threshold}m from a building/cover footprint`);
  console.log("Geometric diagnostic only: trees, facade detail, sightlines and elevation framing still require ground-level screenshot review.");
}
