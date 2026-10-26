import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {GameAudio,musicSceneForScreen} from "./audio";
import {AUDIO_CUES,MUSIC_TRACKS,PG_AUDIO_FAMILY,PR_AUDIO_CUES,SAMPLE_URLS,WEAPON_AUDIO} from "./audio-catalog";
import {AudioSampleBank} from "./audio-sample-bank";
import {FakeAudio,FakeAudioContext,installAudioFakes} from "./audio-test-fakes";

describe("licensed game audio integration",()=>{
  beforeEach(()=>{vi.useFakeTimers();installAudioFakes();});
  afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
  async function ready(){const audio=new GameAudio();audio.unlock();await (audio as unknown as {bank:AudioSampleBank}).bank.preload(Object.keys(SAMPLE_URLS));return audio;}
  it("retains one BR music playhead across lobby, combat, results and rematch",async()=>{
    const audio=await ready(),track=FakeAudio.instances.find(entry=>entry.src===MUSIC_TRACKS["battle-royale"].url)!;
    for(const screen of ["brLobby","brHud","brResults","brLobby"]){
      audio.setMusicScene(musicSceneForScreen(screen));await Promise.resolve();await vi.advanceTimersByTimeAsync(1200);track.currentTime=42;
      expect(track.paused).toBe(false);expect(track.plays).toBe(1);
    }
    expect(track.currentTime).toBe(42);
    audio.setMusicScene("menu");await Promise.resolve();await vi.advanceTimersByTimeAsync(1200);expect(track.paused).toBe(true);
  });
  it("crossfades scenes and keeps user music/SFX settings independent",async()=>{
    const audio=await ready();await vi.advanceTimersByTimeAsync(1200);
    const menu=FakeAudio.instances.find(entry=>entry.src===MUSIC_TRACKS.menu.url)!;expect(menu.volume).toBeCloseTo(MUSIC_TRACKS.menu.gain*.8);
    audio.setMusicScene("planet-gun");await Promise.resolve();expect(menu.paused).toBe(false);await vi.advanceTimersByTimeAsync(1200);expect(menu.paused).toBe(true);
    audio.setVolumes(.5,.25);const pg=FakeAudio.instances.find(entry=>entry.src===MUSIC_TRACKS["planet-gun"].url)!;
    expect(pg.volume).toBeCloseTo(MUSIC_TRACKS["planet-gun"].gain*.5);
    expect(FakeAudioContext.instances[0]!.gains[0]!.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(.25,10.035);
  });
  it("bounds weapon voices without HTML audio cloning or new media routes per shot",async()=>{
    const audio=await ready(),context=FakeAudioContext.instances[0]!;
    for(let i=0;i<40;i++)audio.pgRemoteWeapon("pulse",{x:1,y:0,z:0},{x:0,y:0,z:0},0);
    expect(audio.debugState().oneShotCount).toBeLessThanOrEqual(16);expect(audio.debugState().activeVoices).toBeGreaterThan(0);
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(5);expect(FakeAudio.instances).toHaveLength(5);
    expect(context.createDynamicsCompressor).toHaveBeenCalledTimes(1);
    const count=context.sources.length;audio.pgRemoteWeapon("pulse",{x:400,y:0,z:0},{x:0,y:0,z:0},0);expect(context.sources).toHaveLength(count);
  });
  it("uses phase events for reload contacts and schedules no completion after start",async()=>{
    const audio=await ready(),bank=(audio as unknown as {bank:AudioSampleBank}).bank,play=vi.spyOn(bank,"play");
    audio.pgReloadPhase("orbit","start");const count=play.mock.calls.length;expect(count).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(4000);expect(play).toHaveBeenCalledTimes(count);
    audio.pgReloadPhase("orbit","insert");expect(play.mock.calls.length).toBeGreaterThan(count);
    const phase=WEAPON_AUDIO[PG_AUDIO_FAMILY.orbit].reload.insert;
    expect(play.mock.calls.at(-1)![0]).toBe(AUDIO_CUES[phase]!.layers[0]!.pool[0]!.sample);
  });
  it("does not immediately repeat a step recording, even with a constant random source",async()=>{
    const audio=await ready(),bank=(audio as unknown as {bank:AudioSampleBank}).bank,play=vi.spyOn(bank,"play");vi.spyOn(Math,"random").mockReturnValue(0);
    const heard:string[]=[];
    for(let i=0;i<6;i++){audio.footstep();heard.push(play.mock.calls.at(-1)![0]);await vi.advanceTimersByTimeAsync(120);}
    expect(heard.every((sample,i)=>i===0||sample!==heard[i-1])).toBe(true);
  });
  it("replaces PR environment loops without cutting the qualification effect",async()=>{
    const audio=await ready();audio.setMusicScene("planet-run");audio.setPrAmbience("cargo-cyclone");audio.setPrAmbience("solar-sweep");
    audio.prCue("qualify");audio.setPrAmbience(null);
    expect(audio.debugState().oneShotCount).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(250);expect(audio.debugState().loopCount).toBe(0);
    audio.setPgAmbience(true);expect(audio.debugState().loopCount).toBe(2);audio.setMusicScene("planet-gun");
    audio.setMusicScene("menu");await vi.advanceTimersByTimeAsync(250);expect(audio.debugState().loopCount).toBe(0);
  });
  it("has a recorded replacement for all PR state cues and canonical PG identities",()=>{
    expect(Object.keys(PR_AUDIO_CUES)).toHaveLength(14);
    for(const cue of Object.values(PR_AUDIO_CUES))expect(AUDIO_CUES[cue]!.layers.length).toBeGreaterThan(0);
    expect(Object.keys(PG_AUDIO_FAMILY)).toEqual(expect.arrayContaining(["helix","arc","prism","orbit"]));
    const orbit=WEAPON_AUDIO[PG_AUDIO_FAMILY.orbit],comet=WEAPON_AUDIO[PG_AUDIO_FAMILY.comet];
    expect(AUDIO_CUES[orbit.fire]!.layers[0]!.pool[0]!.sample).not.toBe(AUDIO_CUES[comet.fire]!.layers[0]!.pool[0]!.sample);
  });
});
