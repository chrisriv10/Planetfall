import {expect,it} from 'vitest';
import {BR_MAP_BLOCKS,BR_STRUCTURES,brBlockTopSurfaceAt,brFloorHeightAt} from '@planetfall/shared';
import {BrPhysicsWorld} from './br-physics.js';

it('agrees with real Rapier roof-ramp support throughout all four orientations',()=>{
 const physics=new BrPhysicsWorld(),sides=new Set<string>();let samples=0;
 try{
  for(const s of BR_STRUCTURES.filter(s=>s.roofAccess)){
   const block=BR_MAP_BLOCKS.find(b=>b.id===`${s.id}-roof-ramp`)!;
   const side=s.roofAccessSide??s.entrance,ns=side==='north'||side==='south',sign=side==='north'||side==='east'?1:-1;
   sides.add(side);const run=Math.max(10,s.size.y*2.35);
   for(const fraction of [.2,.5,.8]){
    const point={x:block.position.x+(ns?0:sign*run*(fraction-.5)),z:block.position.z+(ns?sign*run*(fraction-.5):0)};
    const top=brBlockTopSurfaceAt(block,point)!;
    expect(top).not.toBeNull();
    expect(physics.rayDistance({...point,y:top+.05},{x:0,y:-1,z:0},.3),s.id).toBeCloseTo(.05,4);
    expect(brFloorHeightAt({...point,y:top},top+.1),s.id).toBeCloseTo(top,4);samples++;
   }
  }
  expect(sides.size).toBe(4);expect(samples).toBeGreaterThanOrEqual(27);
 }finally{physics.dispose();}
});

it('does not invent a road floor inside an empty corner of a diagonal ribbon',()=>{
 const point={x:324.8125,y:4.5,z:202.5},physics=new BrPhysicsWorld();
 try{
  expect(brFloorHeightAt(point,7)).toBeCloseTo(4.5,6);
  expect(physics.rayDistance({...point,y:4.55},{x:0,y:-1,z:0},1)).toBeCloseTo(.05,4);
 }finally{physics.dispose();}
});
