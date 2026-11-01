import {pgCapsuleClear,type PgMap,type Vec3} from "@planetfall/shared";

/** Settle static round loot onto real support; recover void drops to a safe route. */
export function pgSupportedModeDrop(position:Vec3,map:PgMap):Vec3 {
 const settle=(point:Vec3):Vec3|null=>{
  const tops=map.solids.filter(s=>Math.abs(point.x-s.center.x)<=s.half.x&&Math.abs(point.z-s.center.z)<=s.half.z)
   .map(s=>s.center.y+s.half.y).filter(y=>y<=point.y+.1).sort((a,b)=>b-a);
  for(const y of tops){const candidate={x:point.x,y,z:point.z};if(pgCapsuleClear(candidate,.5,map))return candidate;}
  return null;
 };
 if([position.x,position.y,position.z].every(Number.isFinite)){
  const supported=settle(position);if(supported)return supported;
 }
 const candidates=map.navigation.filter(n=>n.position.y===0).sort((a,b)=>Math.hypot(a.position.x-position.x,a.position.z-position.z)-Math.hypot(b.position.x-position.x,b.position.z-position.z));
 for(const node of candidates){const supported=settle(node.position);if(supported)return supported;}
 throw new Error("PlanetGun map has no supported round-drop recovery point");
}
