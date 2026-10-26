import {vi,type Mock} from "vitest";

export class FakeParameter {
  value=0;
  cancelScheduledValues:Mock<(time:number)=>void>=vi.fn();
  setValueAtTime=vi.fn((value:number)=>{this.value=value;});
  linearRampToValueAtTime=vi.fn((value:number)=>{this.value=value;});
}
export class FakeNode {
  gain=new FakeParameter();pan=new FakeParameter();frequency=new FakeParameter();Q=new FakeParameter();type="";
  threshold=new FakeParameter();knee=new FakeParameter();ratio=new FakeParameter();attack=new FakeParameter();release=new FakeParameter();
  connect=vi.fn(()=>this);disconnect:Mock<()=>void>=vi.fn();
}
export class FakeBufferSource extends FakeNode {
  buffer:AudioBuffer|null=null;loop=false;playbackRate=new FakeParameter();onended:(()=>void)|null=null;
  timer:ReturnType<typeof setTimeout>|null=null;
  start:Mock<(when?:number)=>void>=vi.fn();
  stop=vi.fn((when=0)=>{
    if(this.timer)clearTimeout(this.timer);
    this.timer=setTimeout(()=>this.onended?.(),Math.max(0,when-10)*1000);
  });
}
export const fakeBuffer={duration:1,length:44100,numberOfChannels:1} as AudioBuffer;
export class FakeAudioContext {
  static instances:FakeAudioContext[]=[];
  currentTime=10;state="running";destination={};
  sources:FakeBufferSource[]=[];gains:FakeNode[]=[];
  constructor(){FakeAudioContext.instances.push(this);}
  resume=vi.fn(()=>Promise.resolve());
  decodeAudioData=vi.fn(async()=>fakeBuffer);
  createGain=vi.fn(()=>{const gain=new FakeNode();gain.gain.value=1;this.gains.push(gain);return gain;});
  createBufferSource=vi.fn(()=>{const source=new FakeBufferSource();this.sources.push(source);return source;});
  createBiquadFilter=vi.fn(()=>new FakeNode());
  createStereoPanner=vi.fn(()=>new FakeNode());
  createMediaElementSource=vi.fn(()=>new FakeNode());
  createDynamicsCompressor=vi.fn(()=>new FakeNode());
}
export class FakeAudio {
  static instances:FakeAudio[]=[];
  loop=false;preload="";volume=0;playbackRate=1;paused=true;currentTime=0;plays=0;
  constructor(public src=""){FakeAudio.instances.push(this);}
  play(){this.paused=false;this.plays++;return Promise.resolve();}
  pause(){this.paused=true;}
  cloneNode(){throw new Error("Effects must not clone HTML audio elements");}
}
export function installAudioFakes(){
  FakeAudio.instances=[];FakeAudioContext.instances=[];
  vi.stubGlobal("Audio",FakeAudio);vi.stubGlobal("AudioContext",FakeAudioContext);
  return vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)})));
}
