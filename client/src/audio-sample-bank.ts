/** Reusable decoded recordings; each event creates only bounded lightweight
 * Web Audio playback nodes. Music continues to stream separately. */
export interface SamplePlayback {
  gain:number; priority:number; rate?:number; pan?:number; cutoff?:number;
  distance?:number; duration?:number|null; delaySeconds?:number; tag?:string;
  group?:string; limit?:number; loop?:boolean;
}
type Voice = {source:AudioBufferSourceNode;gain:GainNode;filter:BiquadFilterNode;pan:StereoPannerNode;
  priority:number;distance:number;started:number;tag:string;group:string;loop:boolean;loopKey?:string;stopping:boolean};
type LoopRequest = {sample:string;options:SamplePlayback;voice?:Voice;generation:number};

export class AudioSampleBank {
  private context:AudioContext|null=null;
  private output:GainNode|null=null;
  private readonly buffers=new Map<string,AudioBuffer>();
  private readonly loads=new Map<string,Promise<AudioBuffer|null>>();
  private readonly voices=new Set<Voice>();
  private readonly loops=new Map<string,LoopRequest>();
  private readonly generations=new Map<string,number>();
  private volume=.9;
  private sequence=0;
  private pending=0;
  private activeLoads=0;
  private readonly loadQueue:Array<()=>Promise<void>>=[];
  private peakVoices=0;
  private decodedBytes=0;
  private epoch=0;
  constructor(private readonly urls:Readonly<Record<string,string>>,readonly voiceLimit=16,readonly loopLimit=4) {}

  attach(context:AudioContext,destination:AudioNode=context.destination):void {
    if(this.context===context)return;
    this.context=context;
    this.output=context.createGain();this.output.gain.value=this.volume;
    this.output.connect(destination);
  }
  setVolume(value:number):void {
    this.volume=Number.isFinite(value)?Math.min(1,Math.max(0,value)):0;
    if(this.output&&this.context)this.ramp(this.output.gain,this.volume,.035);
  }
  async load(id:string):Promise<AudioBuffer|null> {
    const existing=this.buffers.get(id);if(existing)return existing;
    const pending=this.loads.get(id);if(pending)return pending;
    const context=this.context,url=this.urls[id];if(!context||!url)return null;
    this.pending++;
    const task=new Promise<AudioBuffer|null>(resolve=>{
      this.loadQueue.push(async()=>{
        try {
          const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);
          const buffer=await context.decodeAudioData(await response.arrayBuffer());
          this.buffers.set(id,buffer);this.decodedBytes+=buffer.length*buffer.numberOfChannels*4;resolve(buffer);
        } catch {resolve(null);} // Missing recordings stay silent, never synthesized.
        finally {this.pending--;}
      });
    });
    this.loads.set(id,task);this.pumpLoads();return task;
  }
  async preload(ids:readonly string[],concurrency=3):Promise<void> {
    const unique=[...new Set(ids)];let index=0;
    await Promise.all(Array.from({length:Math.min(concurrency,unique.length)},async()=>{
      while(index<unique.length)await this.load(unique[index++]!);
    }));
  }
  /** An unloaded cue may wait at most 120 ms; old gunshots are never replayed
   * seconds later after decoding. stopGroup also invalidates pending requests. */
  play(id:string,options:SamplePlayback):void {
    if(!this.context||!Number.isFinite(options.gain)||options.gain<=0)return;
    const buffer=this.buffers.get(id);
    if(buffer){this.start(buffer,options);return;}
    const group=options.group??"game",generation=this.generations.get(group)??0,epoch=this.epoch,requested=performance.now();
    void this.load(id).then(decoded=>{
      if(decoded&&this.epoch===epoch&&performance.now()-requested<=120&&(this.generations.get(group)??0)===generation)this.start(decoded,options);
    });
  }
  setLoop(key:string,id:string,options:SamplePlayback):void {
    const old=this.loops.get(key);
    if(old?.sample===id){
      old.options=options;
      if(old.voice&&!old.voice.stopping){this.ramp(old.voice.gain.gain,options.gain,.18);if(options.rate)old.voice.source.playbackRate.value=options.rate;return;}
      return; // A single outstanding decode owns this request.
    }
    if(old)this.stopLoop(key);
    const request:LoopRequest={sample:id,options,generation:++this.sequence};this.loops.set(key,request);
    const start=(buffer:AudioBuffer|null)=>{
      if(!buffer||this.loops.get(key)!==request)return;
      const voice=this.start(buffer,{...request.options,loop:true});
      if(voice){voice.loopKey=key;request.voice=voice;}
    };
    const buffer=this.buffers.get(id);if(buffer)start(buffer);else void this.load(id).then(start);
  }
  stopLoop(key:string):void {
    const request=this.loops.get(key);if(!request)return;
    this.loops.delete(key);if(request.voice)this.stopVoice(request.voice,.18);
  }
  stopGroup(group:string):void {
    this.generations.set(group,(this.generations.get(group)??0)+1);
    for(const [key,loop] of this.loops)if(loop.options.group===group)this.stopLoop(key);
    for(const voice of this.voices)if(voice.group===group&&!voice.loop)this.stopVoice(voice,.025);
  }
  stopAll():void {
    this.epoch++;
    for(const key of this.loops.keys())this.stopLoop(key);
    for(const voice of this.voices)this.stopVoice(voice,.025);
    for(const group of this.generations.keys())this.generations.set(group,(this.generations.get(group)??0)+1);
  }
  get activeVoiceCount():number {return this.voices.size;}
  get decodedSampleCount():number {return this.buffers.size;}
  debugState(){
    let loopCount=0;for(const voice of this.voices)if(voice.loop)loopCount++;
    return {activeVoices:this.voices.size,maxVoices:this.voiceLimit+this.loopLimit,peakVoices:this.peakVoices,oneShotCount:this.voices.size-loopCount,oneShotLimit:this.voiceLimit,loopCount,loopLimit:this.loopLimit,decodedBuffers:this.buffers.size,decodedBytes:this.decodedBytes,pendingFetches:this.activeLoads,pendingLoads:this.pending,queuedLoads:this.loadQueue.length,cachedRequests:this.loads.size};
  }
  private pumpLoads():void {
    while(this.activeLoads<3&&this.loadQueue.length){
      const load=this.loadQueue.shift()!;this.activeLoads++;
      void load().finally(()=>{this.activeLoads--;this.pumpLoads();});
    }
  }
  private start(buffer:AudioBuffer,options:SamplePlayback):Voice|null {
    const context=this.context;if(!context||!this.output)return null;
    const loop=options.loop??false;
    const peers=[...this.voices].filter(v=>v.loop===loop);
    const tagged=peers.filter(v=>v.tag===(options.tag??""));
    if(options.limit&&tagged.length>=options.limit)this.release(this.lowest(tagged));
    if(peers.filter(v=>this.voices.has(v)).length>=(loop?this.loopLimit:this.voiceLimit)){
      const victim=this.lowest(peers.filter(v=>this.voices.has(v)));
      if(victim.priority>options.priority||(victim.priority===options.priority&&victim.distance<(options.distance??0)))return null;
      this.release(victim);
    }
    const rate=Math.min(1.25,Math.max(.8,options.rate??1));
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),pan=context.createStereoPanner();
    source.buffer=buffer;source.loop=loop;source.playbackRate.value=rate;
    filter.type="lowpass";filter.frequency.value=Math.min(20_000,Math.max(300,options.cutoff??20_000));filter.Q.value=.5;
    pan.pan.value=Math.min(.9,Math.max(-.9,options.pan??0));gain.gain.value=0;
    source.connect(filter).connect(gain).connect(pan).connect(this.output);
    const start=context.currentTime+Math.max(0,options.delaySeconds??0);
    const voice:Voice={source,gain,filter,pan,priority:options.priority,distance:options.distance??0,started:++this.sequence,tag:options.tag??"",group:options.group??"game",loop,stopping:false};
    this.voices.add(voice);this.peakVoices=Math.max(this.peakVoices,this.voices.size);source.onended=()=>this.release(voice,false);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(Math.max(0,Math.min(1,options.gain)),start+(loop?.18:.006));
    source.start(start);
    if(!loop){
      const duration=Math.max(.012,Math.min(buffer.duration/rate,options.duration??buffer.duration/rate));
      gain.gain.setValueAtTime(Math.max(0,Math.min(1,options.gain)),start+Math.max(.006,duration-.018));
      gain.gain.linearRampToValueAtTime(0,start+duration);source.stop(start+duration+.005);
    }
    return voice;
  }
  private lowest(voices:Voice[]):Voice {
    return voices.reduce((a,b)=>b.priority<a.priority||(b.priority===a.priority&&(b.distance>a.distance||(b.distance===a.distance&&b.started<a.started)))?b:a);
  }
  private ramp(parameter:AudioParam,value:number,seconds:number):void {
    if(!this.context)return;
    const now=this.context.currentTime;parameter.cancelScheduledValues(now);parameter.setValueAtTime(parameter.value,now);parameter.linearRampToValueAtTime(value,now+seconds);
  }
  private stopVoice(voice:Voice,fade:number):void {
    if(voice.stopping||!this.context)return;
    voice.stopping=true;this.ramp(voice.gain.gain,0,fade);
    try{voice.source.stop(this.context.currentTime+fade+.005);}catch{this.release(voice,false);}
  }
  private release(voice:Voice,stop=true):void {
    if(!this.voices.delete(voice))return;
    voice.source.onended=null;
    if(stop)try{voice.source.stop();}catch{/* already ended */}
    for(const node of [voice.source,voice.filter,voice.gain,voice.pan])node.disconnect();
  }
}
