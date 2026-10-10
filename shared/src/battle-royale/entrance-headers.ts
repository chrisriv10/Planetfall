import type {BrMapBlock,BrStructure} from './map.js';

/** The pedestrian aperture has real upper wall, rather than a slit through
 * every storey. Cargo halls retain a taller portal; floor/roof/side walls and
 * the 4.8m circulation width are unchanged. Values are local above the base. */
export function brEntranceHeadroom(s:BrStructure):number {
 return Math.min(s.size.y-.4,s.floors>1?s.size.y/s.floors-.175:Infinity,
  ['warehouse','hangar'].includes(s.archetype)||s.id==='thruster-foundry'?4.8:3.2);
}
export function buildBrEntranceHeader(s:BrStructure):BrMapBlock|null {
 if(!s.enterable)return null;
 const head=brEntranceHeadroom(s),height=s.size.y-head;
 if(height<=0)return null;
 const ns=s.entrance==='north'||s.entrance==='south',sign=s.entrance==='north'||s.entrance==='east'?1:-1;
 return {id:`${s.id}-entrance-header`,districtId:s.districtId,
  position:{x:s.position.x+(ns?0:sign*s.size.x/2),y:s.position.y+head+height/2,z:s.position.z+(ns?sign*s.size.z/2:0)},
  size:{x:ns?4.8:.65,y:height,z:ns?.65:4.8},color:s.color,kind:'wall'};
}
