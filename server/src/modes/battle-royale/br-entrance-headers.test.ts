import {describe,expect,it} from 'vitest';
import {BR_STRUCTURES,brEntranceHeadroom} from '@planetfall/shared';
import {BrPhysicsWorld} from './br-physics.js';
describe('actual portal upper-wall collision',()=>{
 it('leaves each standing opening clear and blocks all new upper wall faces',()=>{
  const physics=new BrPhysicsWorld();
  try{
   for(const s of BR_STRUCTURES.filter(s=>s.enterable)){
    const ns=s.entrance==='north'||s.entrance==='south',sign=s.entrance==='north'||s.entrance==='east'?1:-1;
    const axis=ns?'z':'x',lateral=ns?'x':'z',normal={x:ns?0:-sign,y:0,z:ns?-sign:0};
    for(const across of [-1.8,0,1.8]){
     const low={...s.position,y:s.position.y+brEntranceHeadroom(s)-.15};
     low[axis]+=sign*(s.size[axis]/2+.8);low[lateral]+=across;
     expect(physics.rayDistance(low,normal,1.6),`${s.id} open ${across}`).toBe(1.6);
     const high={...low,y:low.y+.3};
     expect(physics.rayDistance(high,normal,1.6),`${s.id} header ${across}`).toBeCloseTo(.475,4);
    }
   }
  }finally{physics.dispose();}
 });
});
