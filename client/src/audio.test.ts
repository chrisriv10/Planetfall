import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {GameAudio,musicSceneForScreen} from "./audio";

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
  afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

  it("keeps the same BR track playing through lobby, gameplay, results and rematch",async()=>{
    vi.useFakeTimers();
    const audio=new GameAudio();Object.assign(audio,{musicUnlocked:true});
    const track=FakeAudio.instances.find(entry=>entry.src.endsWith("orbital-drift.ogg"))!;
    for(const screen of ["brLobby","brHud","brResults","brLobby"]){
      audio.setMusicScene(musicSceneForScreen(screen));
      await Promise.resolve();await vi.advanceTimersByTimeAsync(1200);
      track.currentTime=42;
      expect(track.paused).toBe(false);
      expect(track.plays).toBe(1);
    }
    expect(track.currentTime).toBe(42);
    audio.setMusicScene(musicSceneForScreen("home"));
    await Promise.resolve();await vi.advanceTimersByTimeAsync(1200);
    expect(track.paused).toBe(true);
    expect(musicSceneForScreen("hud")).toBe("game");
  });

  it("starts the first transport loop from silence, not the Web Audio default gain",()=>{
    const audio=new GameAudio();
    const parameter=(value=0)=>({value,cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()});
    const node=()=>({connect(){return this;},disconnect:vi.fn(),frequency:parameter(),Q:parameter(),gain:parameter(),pan:parameter()});
    const gainNode={...node(),gain:parameter(1)};
    Object.assign(audio,{musicUnlocked:true,context:{currentTime:12,destination:{},createMediaElementSource:node,createBiquadFilter:node,createGain:()=>gainNode,createStereoPanner:node}});
    audio.setBrLoop("starliner",true);
    expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0,12);
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(.065*.9,12.18);
    const loop=FakeAudio.instances.find(entry=>entry.src.endsWith("br-starliner-engine.ogg"))!;
    expect(loop.plays).toBe(1);
  });

  it("finishes a loop fade even when inactive is reported every frame",async()=>{
    vi.useFakeTimers();
    const audio=new GameAudio();
    const parameter=()=>({value:0,cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()});
    const node=()=>({connect(){return this;},disconnect:vi.fn(),frequency:parameter(),Q:parameter(),gain:parameter(),pan:parameter()});
    Object.assign(audio,{musicUnlocked:true,context:{currentTime:0,destination:{},createMediaElementSource:node,createBiquadFilter:node,createGain:node,createStereoPanner:node}});
    audio.setBrLoop("starliner",true);
    const loop=FakeAudio.instances.find(entry=>entry.src.endsWith("br-starliner-engine.ogg"))!;
    expect(loop.paused).toBe(false);
    for(let i=0;i<20;i++){audio.setBrLoop("starliner",false);await vi.advanceTimersByTimeAsync(16);}
    expect(loop.paused).toBe(true);
    expect(loop.currentTime).toBe(0);
  });

  it("bounds remote voices and fades the previous music scene out",async()=>{
    vi.useFakeTimers();
    const audio=new GameAudio();Object.assign(audio,{musicUnlocked:true});
    const menu=FakeAudio.instances.find(entry=>entry.src.endsWith("low-battery.ogg"))!;
    menu.paused=false;menu.volume=.14;
    audio.setMusicScene("battle-royale");await Promise.resolve();
    expect(menu.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(1200);
    expect(menu.paused).toBe(true);
    const source={x:1,y:0,z:0},listener={x:0,y:0,z:0};
    for(let i=0;i<30;i++)audio.brRemoteWeapon("pulse-rifle",source,listener,0);
    expect(FakeAudio.instances.filter(x=>x.src.endsWith("br-laser-small.ogg")&&!x.paused)).toHaveLength(16);
    audio.stopBrLoops();
    expect(FakeAudio.instances.filter(x=>x.src.endsWith("br-laser-small.ogg")&&!x.paused)).toHaveLength(0);
  });

  it("preloads the curated local sample set and stops all continuous mode loops",()=>{
    const audio=new GameAudio();
    const sources=FakeAudio.instances.map(entry=>entry.src);
    expect(sources.filter(source=>source.startsWith("/audio/br/")&&!source.endsWith("orbital-drift.ogg"))).toHaveLength(11);
    expect(sources).toContain("/audio/br/orbital-drift.ogg");
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
