import {PR_BALANCE} from "./balance.js";
import type {PrTile} from "./types.js";
import type {Vec3} from "../index.js";

/** Authored gameplay geometry; decorative art should derive its deck heights and
 * perimeter from these tiles rather than maintaining a second arena layout. */
export const SHATTERDECK_LAYOUT_CONFIG=Object.freeze({
 deckHeights:Object.freeze([26,18.5,11,3.5] as const),
 hexLimits:Object.freeze([5,8,8,9] as const),
 tileRadius:PR_BALANCE.tileRadius,
 killY:-6.5,
 spawnCount:30,
 spawnEdgeBuffer:1,
});

const AXIAL_NEIGHBORS:readonly(readonly[number,number])[]=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
const hexRadius=(q:number,s:number)=>Math.max(Math.abs(q),Math.abs(s),Math.abs(q+s));
const tileKey=(deck:number,q:number,s:number)=>`${deck}:${q}:${s}`;

function spawnPoints(tiles:readonly PrTile[]):Vec3[]{
 const interior=SHATTERDECK_LAYOUT_CONFIG.hexLimits[0]-SHATTERDECK_LAYOUT_CONFIG.spawnEdgeBuffer;
 const candidates=tiles.filter(tile=>tile.deck===0&&hexRadius(tile.column,tile.row)<=interior);
 const selected=new Set<number>(),nearest=new Map(candidates.map(tile=>[tile.id,Infinity]));
 const spawns:Vec3[]=[];
 for(let index=0;index<SHATTERDECK_LAYOUT_CONFIG.spawnCount;index++){
  let best:PrTile|undefined=index===0?candidates.find(tile=>tile.column===0&&tile.row===0):undefined;
  // Stable axial enumeration breaks equal-distance ties. Updating the nearest
  // selected distance keeps the fixed 61-candidate selection bounded and cheap.
  if(!best)for(const candidate of candidates){
   if(selected.has(candidate.id))continue;
   if(!best||nearest.get(candidate.id)!>nearest.get(best.id)!+1e-9)best=candidate;
  }
  if(!best)throw new Error("Shatterdeck has insufficient buffered spawn tiles.");
  selected.add(best.id);spawns.push({...best.center});
  for(const candidate of candidates){
   const dx=candidate.center.x-best.center.x,dz=candidate.center.z-best.center.z;
   nearest.set(candidate.id,Math.min(nearest.get(candidate.id)!,dx*dx+dz*dz));
  }
 }
 return spawns;
}

export interface ShatterdeckLayout {tiles:PrTile[];spawns:Vec3[];killY:number}

/** Four fixed footprints: crown, broken annulus, linked wings and perforated
 * base. IDs stay dense and neighbors refer only to reciprocal same-deck sides. */
export function buildShatterdeckLayout():ShatterdeckLayout{
 const tiles:PrTile[]=[],config=SHATTERDECK_LAYOUT_CONFIG,r=config.tileRadius;
 const outer=Math.max(...config.hexLimits);
 for(let deck=0;deck<config.deckHeights.length;deck++)for(let q=-outer;q<=outer;q++)for(let s=-outer;s<=outer;s++){
  const radius=hexRadius(q,s);
  if(radius>config.hexLimits[deck])continue;
  if(deck===1&&(radius<2||q>2&&s===0))continue;
  if(deck===2&&Math.abs(q)<2&&Math.abs(s)>2)continue;
  if(deck===3&&radius>3&&(q-s)%4===0)continue;
  tiles.push({id:tiles.length,deck,column:q,row:s,center:{x:Math.sqrt(3)*r*(q+s/2),y:config.deckHeights[deck],z:1.5*r*s},neighbors:[]});
 }
 const lookup=new Map(tiles.map(tile=>[tileKey(tile.deck,tile.column,tile.row),tile.id]));
 for(const tile of tiles)for(const [dq,ds]of AXIAL_NEIGHBORS){
  const id=lookup.get(tileKey(tile.deck,tile.column+dq,tile.row+ds));
  if(id!==undefined)tile.neighbors.push(id);
 }
 return {tiles,spawns:spawnPoints(tiles),killY:config.killY};
}
