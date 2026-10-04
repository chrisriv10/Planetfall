import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {GameAudio} from "./audio";

class FakeAudio {
  static instances:FakeAudio[]=[];
  loop=false;preload="";volume=0;playbackRate=1;paused=true;currentTime=0;
  dataset:Record<string,string>={};plays=0;
  constructor(public src=""){FakeAudio.instances.push(this);}
  play(){this.paused=false;this.plays++;return Promise.resolve();}
  pause(){this.paused=true;}
  cloneNode(){return new FakeAudio(this.src);}
}

describe("Battle Royale sample audio lifecycle",()=>{
  beforeEach(()=>{FakeAudio.instances=[];vi.stubGlobal("Audio",FakeAudio);});
  afterEach(()=>vi.unstubAllGlobals());

  it("preloads the curated local sample set and stops all continuous mode loops",()=>{
    const audio=new GameAudio();
    const sources=FakeAudio.instances.map(entry=>entry.src);
    expect(sources.filter(source=>source.startsWith("/audio/br/"))).toHaveLength(11);
    expect(new Set(sources)).toContain("/audio/br/br-starliner-engine.ogg");
    expect(new Set(sources)).toContain("/audio/br/br-footstep-1.ogg");
    // Simulate the one-time browser gesture without constructing Web Audio;
    // loop lifecycle itself belongs to HTMLAudioElement.
    Object.assign(audio,{musicUnlocked:true});
    audio.setBrLoop("starliner",true,.8);
    audio.setBrLoop("skimmer",true,1);
    const starliner=FakeAudio.instances.find(entry=>entry.src.endsWith("br-starliner-engine.ogg"))!;
    const skimmer=FakeAudio.instances.find(entry=>entry.src.endsWith("br-skimmer-engine.ogg"))!;
    expect(starliner.paused).toBe(false);expect(skimmer.paused).toBe(false);
    expect(starliner.volume).toBeGreaterThan(0);expect(skimmer.volume).toBeGreaterThan(0);
    audio.stopBrLoops();
    expect(starliner.paused).toBe(true);expect(skimmer.paused).toBe(true);
    expect(starliner.currentTime).toBe(0);expect(skimmer.currentTime).toBe(0);
  });
});
