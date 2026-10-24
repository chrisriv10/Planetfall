import {describe,it,expect} from 'vitest';
import {prRound,prSpawn,prStepMotion} from '@planetfall/shared';
import {prIsBoosting} from './pr-feedback-state';
const input={sequence:1,moveX:0,moveZ:-1,jump:false,dive:false};
describe('PlanetRun dive and pad feedback',()=>{
 it('keeps the normal dive cue even though its speed matches a boost',()=>{
  const state=prSpawn({x:0,y:.6,z:4});state.grounded=true;
  prStepMotion(state,{...input,dive:true},1/30,2000,prRound('cargo-cyclone'),42);
  expect(Math.hypot(state.velocity.x,state.velocity.z)).toBe(13);
  expect(prIsBoosting(state,2000)).toBe(false);
 });
 it('identifies a real pad launch only during its active carry',()=>{
  const state=prSpawn({x:0,y:.6,z:-14});state.grounded=true;
  prStepMotion(state,input,1/30,2000,prRound('capacitor-causeway'),42);
  expect(Math.hypot(state.velocity.x,state.velocity.z)).toBe(13);
  expect(prIsBoosting(state,2000)).toBe(true);
  expect(prIsBoosting(state,state.diveUntil)).toBe(false);
 });
 it('does not treat a hazard stagger as a pad launch',()=>{
  const state=prSpawn({x:0,y:.6,z:4});state.diveUntil=2160;state.diveReadyAt=0;state.velocity.x=7;
  expect(prIsBoosting(state,2000)).toBe(false);
 });
});
