import {afterEach,describe,expect,it,vi} from "vitest";
import type {GameSocket} from "../../network";
import {PgClock,pgClock} from "./pg-clock";

afterEach(()=>vi.useRealTimers());
describe("PlanetGun firing clock",()=>{
 it("estimates server time without assuming matching client wall clocks",()=>{
  const clock=new PgClock();expect(clock.now(100,2000)).toBe(2100);
  expect(clock.sample(100,120,1_700_000_000_110)).toBe(true);
  expect(clock.now(200,0)).toBe(1_700_000_000_200);
 });
 it("retains the lowest-RTT sample when rendering delays later callbacks",()=>{
  const clock=new PgClock();clock.sample(100,104,10_102);
  expect(clock.sample(500,580,10_510)).toBe(false);
  expect(clock.sample(1000,1300,11_000)).toBe(false);
  expect(clock.now(1500,0)).toBe(11_500);
  expect(clock.sample(2000,2002,12_001)).toBe(true);
 });
 it("rejects malformed and unsafe samples and resets its fallback on reconnect",()=>{
  const clock=new PgClock();
  for(const sample of [[100,99,1000],[0,101,1000],[NaN,10,1000],[0,10,Infinity]])expect(clock.sample(...sample as [number,number,number])).toBe(false);
  expect(clock.now(50,1000)).toBe(1050);clock.sample(0,10,2005);clock.reset();expect(clock.now(50,3000)).toBe(3050);
 });
 it("shares one bounded probe loop and discards acknowledgments from an old connection",()=>{
  vi.useFakeTimers();const events=new Map<string,()=>void>(),acks:((error:Error|null,time:number)=>void)[]=[];
  const socket={connected:false,on:vi.fn((name:string,fn:()=>void)=>events.set(name,fn)),timeout:vi.fn(()=>({emit:vi.fn((_event:string,ack:typeof acks[number])=>acks.push(ack))}))} as unknown as GameSocket;
  const clock=pgClock(socket);expect(pgClock(socket)).toBe(clock);expect(acks).toHaveLength(0);
  socket.connected=true;events.get("connect")!();expect(acks).toHaveLength(1);
  socket.connected=false;events.get("disconnect")!();acks[0](null,9000);expect(clock.now(0,100)).toBe(100);
  vi.advanceTimersByTime(60_000);expect(acks).toHaveLength(1);
  socket.connected=true;events.get("connect")!();vi.advanceTimersByTime(800);expect(acks).toHaveLength(4);
  const now=performance.now();acks.at(-1)!(null,now+5000);expect(clock.now(now,0)).toBeGreaterThan(now+4900);
  socket.connected=false;events.get("disconnect")!();expect(vi.getTimerCount()).toBe(0);
 });
});
