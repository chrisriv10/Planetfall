import {describe,expect,it} from 'vitest';
import {BR_STRUCTURES,BR_MAP_BLOCKS,BR_ENTRANCE_HEADERS,brEntranceHeadroom,buildBrEntranceHeader,BR_BALANCE} from './index.js';
describe('collision-backed pedestrian portals',()=>{
 it('closes every upper entrance slit with one literal wall while retaining the full circulation width',()=>{
  expect(BR_ENTRANCE_HEADERS).toHaveLength(107);
  expect(BR_MAP_BLOCKS.slice(-107)).toEqual(BR_ENTRANCE_HEADERS);
  for(const s of BR_STRUCTURES){
   const header=buildBrEntranceHeader(s);
   if(!s.enterable){expect(header).toBeNull();continue;}
   const ns=s.entrance==='north'||s.entrance==='south',h=header!;
   expect(h.position.y-h.size.y/2).toBeCloseTo(s.position.y+brEntranceHeadroom(s),8);
   expect(h.position.y+h.size.y/2).toBeCloseTo(s.position.y+s.size.y,8);
   expect(h.size[ns?'x':'z']).toBe(4.8);expect(h.size[ns?'z':'x']).toBe(.65);
   expect(brEntranceHeadroom(s)-.36).toBeGreaterThan(BR_BALANCE.playerHeight+.5);
   expect(BR_MAP_BLOCKS.filter(b=>b.id===h.id)).toHaveLength(1);
  }
 });
 it('keeps cargo portals taller and follows elevated foundations exactly once',()=>{
  for(const s of BR_STRUCTURES.filter(s=>s.enterable)){
   const cargo=['warehouse','hangar'].includes(s.archetype)||s.id==='thruster-foundry';
   expect(brEntranceHeadroom(s)).toBe(Math.min(s.size.y-.4,s.floors>1?s.size.y/s.floors-.175:Infinity,cargo?4.8:3.2));
   const raised={...s,position:{...s.position,y:s.position.y+11}};
   expect(buildBrEntranceHeader(raised)!.position.y-buildBrEntranceHeader(s)!.position.y).toBeCloseTo(11,8);
  }
 });
});
