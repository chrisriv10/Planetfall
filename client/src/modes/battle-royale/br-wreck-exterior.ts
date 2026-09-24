import type { BrStructure, Vec3 } from "@planetfall/shared";

export type WreckExteriorPart={position:Vec3;scale:Vec3;rotationY?:number;rotationZ?:number;finish:"hull"|"frame"|"paint"|"scorch"|"rib"|"breach"|"stripe"};

/** Visual-only silhouette pieces anchored to the real fuselage roof. Thin
 * ground scars and high shell fragments avoid creating fake gameplay cover. */
export function buildWreckExterior(structure:BrStructure):WreckExteriorPart[]{
  const roof=structure.size.y+.18,halfX=structure.size.x/2,halfZ=structure.size.z/2;
  const parts:WreckExteriorPart[]=[
    {finish:"hull",position:{x:-5,y:roof,z:-halfZ-3.4},scale:{x:18,y:.22,z:6.4},rotationY:.08},
    {finish:"hull",position:{x:-7,y:roof+.08,z:halfZ+3},scale:{x:14,y:.22,z:5.6},rotationY:-.12},
    {finish:"paint",position:{x:-11,y:roof+.17,z:-halfZ-3.5},scale:{x:5.5,y:.08,z:5.8},rotationY:.08},
    {finish:"frame",position:{x:-halfX+7,y:roof+3,z:0},scale:{x:8,y:5.7,z:.38},rotationZ:-.24},
    {finish:"paint",position:{x:-halfX+8.3,y:roof+4.6,z:0},scale:{x:3.8,y:.18,z:.48},rotationZ:-.24},
    {finish:"scorch",position:{x:-halfX-8,y:.08,z:0},scale:{x:16,y:.025,z:5.5},rotationY:.04},
    {finish:"scorch",position:{x:-halfX-20,y:.075,z:3},scale:{x:8,y:.02,z:3.2},rotationY:-.1}
  ];
  // Shallow torn frame sections on both long walls break the clean warehouse
  // read. They stay outside the wall skin and are too thin to imply cover.
  for(const side of [-1,1]){
    for(const [index,x] of [-15,2,18].entries())parts.push({
      finish:"rib",position:{x,y:4.4,z:side*(halfZ+.46)},scale:{x:.34,y:6.9,z:.14},rotationZ:(index-1)*side*.14
    });
    parts.push({finish:"breach",position:{x:9,y:4.5,z:side*(halfZ+.5)},scale:{x:7.4,y:2.25,z:.12},rotationZ:side*.1});
    parts.push({finish:"stripe",position:{x:-20,y:7.25,z:side*(halfZ+.52)},scale:{x:5.6,y:.34,z:.1},rotationZ:-side*.08});
  }
  return parts;
}
