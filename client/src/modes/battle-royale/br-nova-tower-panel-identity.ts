import type { BrStructure } from "@planetfall/shared";
type Point=Readonly<{x:number;y:number;z:number}>;
export interface NovaPanel {readonly position:Point;readonly scale:Point}
export interface NovaPanelBounds {readonly min:Point;readonly max:Point}
export interface NovaPanelPart extends NovaPanel {finish:"dark"|"light"|"emissive"}
export interface NovaPanelReplacement {index:number;parts:NovaPanelPart[];wallIndex:number}
const axes=["x","y","z"] as const;
const bounds=(p:NovaPanel):NovaPanelBounds=>({min:{x:p.position.x-p.scale.x/2,y:p.position.y-p.scale.y/2,z:p.position.z-p.scale.z/2},max:{x:p.position.x+p.scale.x/2,y:p.position.y+p.scale.y/2,z:p.position.z+p.scale.z/2}});
const valid=(b:NovaPanelBounds)=>axes.every(a=>Number.isFinite(b.min[a])&&Number.isFinite(b.max[a])&&b.max[a]>b.min[a]);
const overlaps=(a:NovaPanelBounds,b:NovaPanelBounds)=>axes.every(k=>a.max[k]>b.min[k]-.02+1e-9&&a.min[k]<b.max[k]+.02-1e-9);

/** Tower B only. `structure` is the authoritative WORLD-elevation structure.
 * Original panels and returned parts use WORLD X/Z, BUILDING-LOCAL Y.
 * Wall/floor/forbidden bounds use WORLD coordinates including Y; convert once
 * here. Walls must be actual north/south shell walls, floors actual slabs.
 * Forbidden bounds include loot clearance volumes, stairs, doors and all other
 * dressing; omit only the original boards being replaced. No source mutation.
 * Replace only returned indices. Failed groups retain their original panel.
 */
export function buildBrNovaTowerPanelIdentity(structure:Readonly<BrStructure>,original:readonly NovaPanel[],
 wallBounds:readonly NovaPanelBounds[],floorBounds:readonly NovaPanelBounds[],forbidden:readonly NovaPanelBounds[]):NovaPanelReplacement[]{
 if(structure.id!=="nova-tower-b"||!structure.enterable)return [];
 const local=(b:NovaPanelBounds):NovaPanelBounds=>({min:{...b.min,y:b.min.y-structure.position.y},max:{...b.max,y:b.max.y-structure.position.y}});
 const walls=wallBounds.map(local),floors=floorBounds.map(local),obstacles=forbidden.map(local),result:NovaPanelReplacement[]=[];
 original.forEach((panel,index)=>{
  const old=bounds(panel);if(!valid(old)||panel.scale.x<2||panel.scale.y<1.9||panel.scale.z<.12-1e-9)return;
  const side=Math.sign(panel.position.z-structure.position.z);if(!side)return;
  const wallIndex=walls.findIndex(w=>valid(w)&&old.min.x>=w.min.x&&old.max.x<=w.max.x&&old.min.y>=w.min.y&&old.max.y<=w.max.y&&
   Math.abs((side>0?w.min.z:w.max.z)-panel.position.z)<.5&&Math.sign((w.min.z+w.max.z)/2-structure.position.z)===side);
  if(wallIndex<0)return;
  const wall=walls[wallIndex],inner=side>0?wall.min.z:wall.max.z,inward=-side;
  // Keep the cassette above the preserved lower dado rather than replacing
  // one overlap with another. This remains inside the old board's footprint.
  const envelope:NovaPanel={position:{...panel.position,z:inner+inward*.062},scale:{...panel.scale,y:Math.min(panel.scale.y,2.15),z:.12}},area=bounds(envelope);
  if(!floors.some(f=>valid(f)&&f.max.y<=old.min.y&&f.max.y>=old.min.y-3&&area.min.x>=f.min.x&&area.max.x<=f.max.x&&area.min.z>=f.min.z&&area.max.z<=f.max.z))return;
  if(obstacles.some(o=>overlaps(area,o)))return;
  const parts:NovaPanelPart[]=[];
  const add=(finish:NovaPanelPart["finish"],x:number,y:number,w:number,h:number,depth:number,offset:number)=>parts.push({finish,
   position:{x:panel.position.x+x,y:panel.position.y+y,z:inner+inward*offset},scale:{x:w,y:h,z:depth}});
  add("dark",0,0,panel.scale.x,envelope.scale.y,.07,.037);
  // Three maintenance cartridge faces with separate narrow status cores.
  // Broad unlabelled white area is replaced by organized dark equipment bays.
  for(const row of [-1,0,1]){
   add("light",-panel.scale.x*.06,row*.62,panel.scale.x*.7,.26,.025,.0875);
   add("emissive",panel.scale.x*.36,row*.62,.035,.12,.018,.111);
  }
  result.push({index,parts,wallIndex});
 });
 return result;
}
