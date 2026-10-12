import {describe,it,expect} from "vitest";
import {brGravityColumnOpacity,BR_GRAVITY_COLUMN_BASE_OPACITY,BR_GRAVITY_COLUMN_PULSE_AMPLITUDE,BR_GRAVITY_COLUMN_PULSE_RATE} from "./br-gravity-column-presentation";
describe("restrained gravity-column opacity",()=>{
 it("uses the authored mean and small symmetric pulse",()=>{
  expect(BR_GRAVITY_COLUMN_BASE_OPACITY).toBe(.14);expect(BR_GRAVITY_COLUMN_PULSE_AMPLITUDE).toBe(.035);
  expect(brGravityColumnOpacity(0)).toBe(.14);
  expect(brGravityColumnOpacity(Math.PI/(2*BR_GRAVITY_COLUMN_PULSE_RATE))).toBeCloseTo(.175);
  expect(brGravityColumnOpacity(3*Math.PI/(2*BR_GRAVITY_COLUMN_PULSE_RATE))).toBeCloseTo(.105);
 });
 it("is finite and bounded for ordinary, negative and extreme times",()=>{
  for(const t of [NaN,Infinity,-Infinity])expect(brGravityColumnOpacity(t)).toBe(.14);
  for(const t of [-Number.MAX_VALUE,Number.MAX_VALUE,-1e12,1e12,...Array.from({length:2001},(_,i)=>(i-1000)*.037)]){
   const opacity=brGravityColumnOpacity(t);expect(Number.isFinite(opacity)).toBe(true);
   expect(opacity).toBeGreaterThanOrEqual(.105-1e-12);expect(opacity).toBeLessThanOrEqual(.175+1e-12);
  }
 });
 it("has a stable mean and continuous cycle boundary",()=>{
  const period=Math.PI*2/BR_GRAVITY_COLUMN_PULSE_RATE;
  let sum=0;for(let i=0;i<1000;i++)sum+=brGravityColumnOpacity(i*period/1000);
  expect(sum/1000).toBeCloseTo(.14,12);
  expect(brGravityColumnOpacity(period-1e-6)).toBeCloseTo(brGravityColumnOpacity(period+1e-6),6);
 });
});
