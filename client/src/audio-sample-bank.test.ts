import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {AudioSampleBank} from "./audio-sample-bank";
import {FakeAudioContext,installAudioFakes} from "./audio-test-fakes";

describe("decoded recording voice bank",()=>{
  beforeEach(()=>{vi.useFakeTimers();installAudioFakes();});
  afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
  function setup(limit=3){const context=new FakeAudioContext(),bank=new AudioSampleBank({shot:"/shot.ogg",step:"/step.ogg"},limit,2);bank.attach(context as unknown as AudioContext);return {context,bank};}
  it("fetches and decodes each original once even with overlapping requests",async()=>{
    const {context,bank}=setup();await Promise.all(Array.from({length:50},()=>bank.load("shot")));
    expect(fetch).toHaveBeenCalledTimes(1);expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(bank.debugState()).toMatchObject({decodedBuffers:1,pendingFetches:0,decodedBytes:176400});
  });
  it("limits preload concurrency rather than decoding the whole library at once",async()=>{
    let active=0,peak=0;
    vi.stubGlobal("fetch",vi.fn(async()=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};}));
    const bank=new AudioSampleBank(Object.fromEntries(Array.from({length:30},(_,i)=>[String(i),`/${i}.ogg`])));
    bank.attach(new FakeAudioContext() as unknown as AudioContext);await bank.preload(Array.from({length:30},(_,i)=>String(i)),20);
    expect(peak).toBeLessThanOrEqual(3);expect(bank.decodedSampleCount).toBe(30);
  });
  it("protects high priority feedback and rejects farther low-priority arrivals at the cap",async()=>{
    const {context,bank}=setup();await bank.load("shot");
    bank.play("shot",{gain:.2,priority:5,distance:80});bank.play("shot",{gain:.2,priority:5,distance:20});bank.play("shot",{gain:.2,priority:95,distance:0});
    bank.play("shot",{gain:.2,priority:5,distance:70});
    expect(bank.activeVoiceCount).toBe(3);expect(context.sources).toHaveLength(4);
    expect(context.sources[0]!.disconnect).toHaveBeenCalled();expect(context.sources[2]!.disconnect).not.toHaveBeenCalled();
    bank.play("shot",{gain:.2,priority:5,distance:100});expect(context.sources).toHaveLength(4);
    expect(bank.debugState().peakVoices).toBe(3);
  });
  it("cancels pending decoded events when leaving their mode",async()=>{
    const {context,bank}=setup();bank.play("shot",{gain:.2,priority:50,group:"pg"});bank.stopGroup("pg");
    await bank.load("shot");await Promise.resolve();expect(context.sources).toHaveLength(0);
    bank.play("shot",{gain:.2,priority:50,group:"pg"});expect(context.sources).toHaveLength(1);
  });
  it("does not restart or extend a loop stop when inactive arrives every frame",async()=>{
    const {context,bank}=setup();await bank.load("shot");
    bank.setLoop("engine","shot",{gain:.08,priority:20,group:"br"});
    expect(context.gains[1]!.gain.setValueAtTime).toHaveBeenCalledWith(0,10);
    expect(context.gains[1]!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(.08,10.18);
    for(let i=0;i<20;i++){bank.stopLoop("engine");await vi.advanceTimersByTimeAsync(16);}
    expect(context.sources[0]!.stop).toHaveBeenCalledTimes(1);expect(bank.debugState().loopCount).toBe(0);
  });
  it("shares decoded buffers while each voice releases all nodes on completion",async()=>{
    const {context,bank}=setup();await bank.load("step");
    bank.play("step",{gain:.1,priority:45,pan:.9,cutoff:1700});bank.play("step",{gain:.1,priority:45,pan:-.9});
    expect(context.sources[0]!.buffer).toBe(context.sources[1]!.buffer);
    await vi.advanceTimersByTimeAsync(1100);expect(bank.activeVoiceCount).toBe(0);
    expect(context.sources.every(source=>source.disconnect.mock.calls.length===1)).toBe(true);
  });
  it("keeps missing assets silent without allocating any playback nodes",async()=>{
    const {context,bank}=setup();vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:404})));
    bank.play("shot",{gain:.2,priority:90});await bank.load("shot");await Promise.resolve();
    expect(context.sources).toHaveLength(0);expect(bank.decodedSampleCount).toBe(0);
  });
});
