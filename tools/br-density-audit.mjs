import * as map from "../shared/dist/index.js";

const segmentDistance=(point,from,to)=>{const dx=to.x-from.x,dz=to.z-from.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((point.x-from.x)*dx+(point.z-from.z)*dz)/length)):0;return Math.hypot(point.x-from.x-t*dx,point.z-from.z-t*dz)};
const inside=(point,polygon)=>{let result=false;for(let index=0,previous=polygon.length-1;index<polygon.length;previous=index++){const [x,z]=polygon[index],[px,pz]=polygon[previous];if((z>point.z)!==(pz>point.z)&&point.x<(px-x)*(point.z-z)/(pz-z)+x)result=!result}return result};
const rectDistance=(point,position,size)=>Math.hypot(Math.max(0,Math.abs(point.x-position.x)-size.x/2),Math.max(0,Math.abs(point.z-position.z)-size.z/2));
const contentDistance=point=>{
  let distance=Number.POSITIVE_INFINITY;
  for(const road of map.BR_ROADS)distance=Math.min(distance,segmentDistance(point,road.from,road.to)-road.width/2);
  for(const structure of map.BR_STRUCTURES)distance=Math.min(distance,rectDistance(point,structure.position,structure.size));
  for(const block of map.BR_MAP_BLOCKS.filter(entry=>["cover","platform","bridge"].includes(entry.kind)))distance=Math.min(distance,rectDistance(point,block.position,block.size));
  for(const feature of [...map.BR_SECONDARY_LOCATIONS,...map.BR_POIS,...map.BR_TRAVERSAL])distance=Math.min(distance,Math.hypot(point.x-feature.position.x,point.z-feature.position.z)-18);
  return distance;
};

const samples=[];
for(let x=-480;x<=480;x+=10)for(let z=-480;z<=480;z+=10){
  const point={x,z};
  const edgeDistance=Math.min(...map.BR_ISLAND_OUTLINE.map(([ax,az],index)=>{const [bx,bz]=map.BR_ISLAND_OUTLINE[(index+1)%map.BR_ISLAND_OUTLINE.length];return segmentDistance(point,{x:ax,z:az},{x:bx,z:bz})}));
  if(inside(point,map.BR_ISLAND_OUTLINE)&&edgeDistance>18)samples.push({...point,distance:contentDistance(point)});
}
samples.sort((left,right)=>right.distance-left.distance);
const separated=[];
for(const sample of samples)if(separated.every(other=>Math.hypot(sample.x-other.x,sample.z-other.z)>45)){separated.push(sample);if(separated.length===12)break}
console.log("Largest interior gaps (10m sampling, 18m edge exclusion):");
for(const sample of separated)console.log(`${sample.x.toString().padStart(4)}, ${sample.z.toString().padStart(4)} : ${sample.distance.toFixed(1)}m`);
