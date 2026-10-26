import type {PgWeaponId,PrRoundId} from "@planetfall/shared";
import {brSpatialMix,type AudioPosition} from "./br-spatial-audio";
import {AudioSampleBank} from "./audio-sample-bank";
import {AUDIO_CUES,AMBIENCE_LOOPS,MUSIC_TRACKS,PG_AUDIO_FAMILY,PG_RELOAD_PHASE,PR_AMBIENCE,PR_AUDIO_CUES,SAMPLE_URLS,WEAPON_AUDIO,type PrAudioCue,type WeaponAudioId} from "./audio-catalog";

export type MusicScene=keyof typeof MUSIC_TRACKS;
export type PgReloadAudioPhase=keyof typeof PG_RELOAD_PHASE;
export function musicSceneForScreen(screen:string):MusicScene {
  if(screen==="pgLobby"||screen==="pgHud"||screen==="pgResults")return "planet-gun";
  if(screen==="prLobby"||screen==="prHud"||screen==="prResults")return "planet-run";
  return screen==="brLobby"||screen==="brHud"||screen==="brResults"?"battle-royale":screen==="hud"?"game":"menu";
}
type Spatial={source:AudioPosition;listener:AudioPosition;yaw:number};
type MusicRoute={source:MediaElementAudioSourceNode;filter:BiquadFilterNode};

/** All player-facing effects are licensed recordings. The catalog owns sound
 * identities; this class owns scene/caller semantics and user settings. */
export class GameAudio {
  private context:AudioContext|null=null;
  private readonly bank=new AudioSampleBank(SAMPLE_URLS);
  private readonly music:Record<MusicScene,HTMLAudioElement>;
  private readonly musicRoutes=new WeakMap<HTMLAudioElement,MusicRoute>();
  private musicScene:MusicScene="menu";
  private musicUnlocked=false;
  private musicFade:ReturnType<typeof setInterval>|null=null;
  private musicTransition=0;
  private musicVolume=.8;
  private sfxVolume=.9;
  private urgency=0;
  private duckUntil=0;
  private duckAmount=0;
  private readonly choices=new Map<string,number>();
  private readonly lastCue=new Map<string,number>();
  private readonly desiredBrLoops=new Map<"starliner"|"skimmer"|"drop",number>();
  private pgAmbience=false;
  private prRound:PrRoundId|null=null;
  private beamActive=false;

  constructor(){
    this.music=Object.fromEntries(Object.entries(MUSIC_TRACKS).map(([scene,track])=>[scene,this.makeMusic(track.url)])) as Record<MusicScene,HTMLAudioElement>;
  }
  debugState(){return {...this.bank.debugState(),musicScene:this.musicScene,unlocked:this.musicUnlocked,musicElements:Object.keys(this.music).length};}
  private get activeMusic():HTMLAudioElement{return this.music[this.musicScene];}
  private get musicTarget():number {
    const duck=performance.now()<this.duckUntil?1-this.duckAmount:1;
    return MUSIC_TRACKS[this.musicScene].gain*this.musicVolume*duck*(this.musicScene==="game"?1+this.urgency*.025:1);
  }
  unlock():void {
    const wasUnlocked=this.musicUnlocked;
    if(!this.context){
      this.context=new AudioContext();
      // One shared mix guard catches crowded simultaneous transients. It only
      // processes recorded samples/music; it never creates a sound source.
      const mixGuard=this.context.createDynamicsCompressor();
      mixGuard.threshold.value=-5;mixGuard.knee.value=3;mixGuard.ratio.value=16;
      mixGuard.attack.value=.001;mixGuard.release.value=.14;mixGuard.connect(this.context.destination);
      this.bank.attach(this.context,mixGuard);this.bank.setVolume(this.sfxVolume);
      for(const [scene,track] of Object.entries(this.music)){
        const source=this.context.createMediaElementSource(track),filter=this.context.createBiquadFilter();
        filter.type="lowpass";filter.frequency.value=scene==="battle-royale"?12000:20000;filter.Q.value=.5;
        source.connect(filter).connect(mixGuard);this.musicRoutes.set(track,{source,filter});
      }
      const first=["ui.click","movement.footstep-composite","match.countdown",...Object.values(WEAPON_AUDIO).map(w=>w.fire)]
        .flatMap(id=>AUDIO_CUES[id]!.layers.flatMap(l=>l.pool.map(p=>p.sample)));
      void this.bank.preload(first).then(()=>this.bank.preload(Object.keys(SAMPLE_URLS)));
    }
    if(this.context.state==="suspended")void this.context.resume();
    this.musicUnlocked=true;if(!wasUnlocked||this.activeMusic.paused)this.startMusic();
    for(const [kind,intensity] of this.desiredBrLoops)this.setBrLoop(kind,true,intensity);
    if(this.pgAmbience)this.setPgAmbience(true);
    if(this.prRound)this.setPrAmbience(this.prRound);
    if(this.beamActive)this.pgBeam(true);
  }
  setMusicScene(scene:MusicScene):void {
    if(scene===this.musicScene)return;
    const previous=this.musicScene;this.musicScene=scene;this.musicTransition++;this.duckUntil=0;this.duckAmount=0;
    if(previous==="battle-royale")this.stopBrLoops();
    if(previous==="game")this.bank.stopGroup("classic");
    if(previous==="planet-run"){this.setPrAmbience(null);this.bank.stopGroup("pr");}
    if(previous==="planet-gun"){this.setPgAmbience(false);this.pgBeam(false);this.bank.stopGroup("pg");}
    if(this.musicUnlocked)this.startMusic();else this.stopMusic(this.activeMusic);
  }
  setUrgency(level:number):void {
    const urgency=Number.isFinite(level)?Math.min(2,Math.max(0,Math.round(level))):0;
    if(urgency===this.urgency)return;this.urgency=urgency;
    if(this.musicScene==="game"&&!this.activeMusic.paused)this.fadeMusic(this.activeMusic,this.musicTransition);
  }
  setVolumes(music:number,sfx:number):void {
    this.musicVolume=Number.isFinite(music)?Math.min(1,Math.max(0,music)):0;
    this.sfxVolume=Number.isFinite(sfx)?Math.min(1,Math.max(0,sfx)):0;
    this.bank.setVolume(this.sfxVolume);
    if(!this.activeMusic.paused)this.activeMusic.volume=this.musicTarget;
    this.stopInactiveMusic();
  }
  setBrLoop(kind:"starliner"|"skimmer"|"drop",active:boolean,intensity=1):void {
    if(!active){this.desiredBrLoops.delete(kind);this.bank.stopLoop("br."+kind);return;}
    const amount=Number.isFinite(intensity)?Math.min(1,Math.max(0,intensity)):0;
    this.desiredBrLoops.set(kind,amount);if(!this.musicUnlocked)return;
    const loop=AMBIENCE_LOOPS["br."+kind]!;
    this.bank.setLoop("br."+kind,loop.sample,{gain:loop.gain*(.45+amount*.55),rate:1,cutoff:kind==="starliner"?900:kind==="drop"?2400:6500,priority:25,group:"br",tag:"br."+kind});
  }
  stopBrLoops():void {this.desiredBrLoops.clear();this.bank.stopGroup("br");}
  setPgAmbience(active:boolean):void {
    this.pgAmbience=active;
    if(!active){this.bank.stopLoop("pg.outdoor");this.bank.stopLoop("pg.machinery");return;}
    if(this.musicUnlocked)for(const key of ["pg.outdoor","pg.machinery"])this.environment(key,"pg");
  }
  setPrAmbience(roundId:PrRoundId|null):void {
    this.prRound=roundId;const desired=roundId?PR_AMBIENCE[roundId]:null;
    for(const key of Object.values(PR_AMBIENCE))if(key!==desired)this.bank.stopLoop(key);
    if(desired&&this.musicUnlocked)this.environment(desired,"pr");
  }
  pgBeam(active:boolean):void {
    this.beamActive=active;
    if(!active){this.bank.stopLoop("pg.beam");return;}
    if(this.musicUnlocked)this.bank.setLoop("pg.beam","kenney-sci-fi:forceField_000",{gain:.045,priority:50,rate:1,group:"pg",tag:"pg.beam"});
  }
  pgWeapon(weapon:PgWeaponId):void {this.weapon(PG_AUDIO_FAMILY[weapon],false,undefined,"pg");}
  pgRemoteWeapon(weapon:PgWeaponId,source:AudioPosition,listener:AudioPosition,yaw:number):void {this.weapon(PG_AUDIO_FAMILY[weapon],true,{source,listener,yaw},"pg");}
  pgReloadPhase(weapon:PgWeaponId,phase:PgReloadAudioPhase):void {
    const family=WEAPON_AUDIO[PG_AUDIO_FAMILY[weapon]];
    const cues:Readonly<Partial<Record<string,string>>>=family.reload;
    const cue=cues[PG_RELOAD_PHASE[phase]];if(cue)this.cue(cue,undefined,"pg");
  }
  brRemoteWeapon(weapon:string,source:AudioPosition,listener:AudioPosition,yaw:number):void {this.weapon(weapon,true,{source,listener,yaw},"br");}
  brWeapon(weapon:string):void {this.weapon(weapon,false,undefined,"br");}
  brCharge():void {this.cue("br.charge",undefined,"br");}
  brScannerPulse(source:AudioPosition,listener:AudioPosition,yaw:number):void {this.cue("br.scanner",{source,listener,yaw},"br");}
  brRemoteFootstep(source:AudioPosition,listener:AudioPosition,yaw:number,sprinting=false):void {this.cue("movement.footstep-composite",{source,listener,yaw},this.currentGroup,sprinting?1.12:.85);}
  brImpact(source:AudioPosition,listener:AudioPosition,yaw:number):void {this.cue("br.impact",{source,listener,yaw},"br");}
  brFlyby(source:AudioPosition,listener:AudioPosition,yaw:number):void {this.cue("br.flyby",{source,listener,yaw},"br");}
  brLoot(crate=false):void {this.cue(crate?"br.crate":"br.loot",undefined,"br");}
  prCue(kind:PrAudioCue):void {this.cue(PR_AUDIO_CUES[kind],undefined,"pr");}
  click():void {this.cue("ui.click");}
  pickup():void {this.cue("classic.pickup");}
  stolen():void {this.cue("classic.stolen");}
  jump():void {this.cue("movement.jump");}
  land(impact=5):void {this.cue(impact>=8?"movement.land-heavy":"movement.land-light",undefined,this.currentGroup,Math.min(1.2,Math.max(.55,impact/9)));}
  burst():void {this.cue("movement.thrust");}
  grapple():void {this.cue("classic.grapple");}
  tether():void {this.cue("classic.tether");}
  grappleRelease():void {this.cue("classic.grapple-release");}
  cannonTrigger(heavy:boolean):void {this.cue(heavy?"classic.cannon-trigger-heavy":"classic.cannon-trigger");}
  denied():void {this.cue("ui.error");}
  launch():void {this.duckMusic(480,.35);this.cue("classic.launch");}
  shove():void {this.cue("classic.shove");}
  sabotage():void {this.cue("classic.sabotage");}
  intruder():void {this.cue("classic.intruder");}
  incoming(heavy:boolean):void {this.cue(heavy?"classic.incoming-heavy":"classic.incoming");}
  hitConfirm(kind:"shield"|"hp"|"break"|"headshot"):void {this.cue("br.hit-"+kind);}
  footstep(sprinting=false):void {this.cue("movement.footstep-composite",undefined,this.currentGroup,sprinting?1.12:.85);}
  slide():void {this.cue("movement.slide");}
  mantle():void {this.cue("movement.mantle");}
  wings():void {this.cue(this.musicScene==="planet-gun"?"movement.wallrun":"movement.wings");}
  brJumpShip():void {this.duckMusic(220,.2);this.cue("br.jump-ship",undefined,"br");}
  /** BR's legacy start event emits release only. PG phase completion belongs to
   * authoritative animation callbacks and is never scheduled here. */
  brReload(weapon:string):void {
    const family=this.family(weapon);if(family&&"release" in family.reload)this.cue(family.reload.release,undefined,"br");
  }
  brEmpty():void {this.cue("weapon.pulse-rifle.empty");}
  brUseItem(shield=false):void {this.cue(shield?"br.use-shield":"br.use-health",undefined,"br");}
  brVoid(urgent=false):void {this.duckMusic(420,.25);this.cue(urgent?"br.void-urgent":"br.void",undefined,"br");}
  brEvent(kind:"closing"|"safe"|"final"|"inventory"):void {this.cue(kind==="inventory"?"ui.inventory":"br.zone-"+kind,undefined,"br");}
  critical():void {this.cue("match.critical");}
  rocket():void {this.cue("classic.rocket");}
  asteroid():void {this.duckMusic(520,.45);this.cue("classic.asteroid");}
  cluster():void {this.cue("classic.cluster");}
  clusterBurst():void {this.cue("classic.cluster-burst");}
  gravityBomb():void {this.duckMusic(360,.25);this.cue("classic.gravity-bomb");}
  explosion(heavy=false):void {if(heavy)this.duckMusic(850,.5);this.cue(heavy?"classic.explosion-heavy":"classic.explosion");}
  repair():void {this.cue("classic.repair");}
  countdown(value:number):void {this.cue(value===0?"match.go":"match.countdown");}
  chaos():void {this.duckMusic(700,.4);this.cue("match.chaos");}
  result(won:boolean):void {this.cue(won?"match.win":"match.loss");}
  highFive():void {this.cue("social.high-five");}
  levelUp():void {this.cue("match.level-up");}
  callout(heavy=false):void {this.duckMusic(300,.2);this.cue(heavy?"match.callout-urgent":"match.callout");}

  private get currentGroup():string {return this.musicScene==="battle-royale"?"br":this.musicScene==="planet-gun"?"pg":this.musicScene==="planet-run"?"pr":"classic";}
  private family(weapon:string){return Object.hasOwn(WEAPON_AUDIO,weapon)?WEAPON_AUDIO[weapon as WeaponAudioId]:null;}
  private weapon(weapon:string,remote:boolean,spatial?:Spatial,group=this.currentGroup):void {
    const family=this.family(weapon);if(family)this.cue(remote?family.distant:family.fire,spatial,group);
  }
  private cue(id:string,spatial?:Spatial,group=this.currentGroup,scale=1):void {
    if(!this.musicUnlocked)return;
    const cue=AUDIO_CUES[id];if(!cue)return;
    const now=performance.now(),last=this.lastCue.get(id)??-Infinity;
    // Spatial events from separate pilots must not share a global cooldown.
    if(!spatial&&now-last<cue.cooldownMs)return;
    if(!spatial)this.lastCue.set(id,now);
    const mix=spatial?brSpatialMix(spatial.source,spatial.listener,spatial.yaw,cue.range||180):{gain:1,pan:0,cutoff:20000};
    if(mix.gain<.002)return;
    const distance=spatial?Math.hypot(spatial.source.x-spatial.listener.x,spatial.source.y-spatial.listener.y,spatial.source.z-spatial.listener.z):0;
    cue.layers.forEach((layer,index)=>{
      const key=id+":"+index,previous=this.choices.get(key)??-1,count=layer.pool.length;
      let chosen=Math.floor(Math.random()*(count>1&&previous>=0?count-1:count));if(count>1&&previous>=0&&chosen>=previous)chosen++;
      const sample=layer.pool[chosen]!;this.choices.set(key,chosen);
      this.bank.play(sample.sample,{gain:sample.gain*scale*mix.gain,rate:sample.rate*(1+(Math.random()*2-1)*sample.variation),pan:mix.pan,cutoff:mix.cutoff,priority:cue.priority,distance,duration:cue.duration,delaySeconds:layer.delayMs/1000,tag:id,group,limit:cue.limit});
    });
  }
  private environment(key:string,group:string):void {
    const loop=AMBIENCE_LOOPS[key];if(loop)this.bank.setLoop(key,loop.sample,{gain:loop.gain,priority:20,group,tag:key,cutoff:8500});
  }
  private makeMusic(source:string):HTMLAudioElement {
    const music=new Audio(source);music.loop=true;music.preload="metadata";music.volume=0;return music;
  }
  private startMusic():void {
    const active=this.activeMusic,transition=++this.musicTransition;this.cancelMusicFade();
    if(!active.paused){this.fadeMusic(active,transition);return;}
    active.volume=0;
    void active.play().then(()=>{
      if(active!==this.activeMusic){this.stopMusic(active);return;}
      if(transition===this.musicTransition)this.fadeMusic(active,transition);
    }).catch(()=>undefined);
  }
  private fadeMusic(active:HTMLAudioElement,transition:number):void {
    this.cancelMusicFade();
    this.musicFade=setInterval(()=>{
      if(transition!==this.musicTransition||active!==this.activeMusic){this.cancelMusicFade();return;}
      const target=this.musicTarget;active.volume=Math.max(0,Math.min(1,active.volume+Math.max(-.012,Math.min(.012,target-active.volume))));
      let outgoing=false;
      for(const track of Object.values(this.music))if(track!==active&&!track.paused){track.volume=Math.max(0,track.volume-.018);if(track.volume===0)this.stopMusic(track);else outgoing=true;}
      if(Math.abs(active.volume-target)<.0001&&!outgoing&&performance.now()>=this.duckUntil)this.cancelMusicFade();
    },45);
  }
  private duckMusic(duration:number,amount:number):void {
    if(this.activeMusic.paused)return;
    if(performance.now()>=this.duckUntil)this.duckAmount=0;
    this.duckUntil=Math.max(this.duckUntil,performance.now()+duration);this.duckAmount=Math.max(this.duckAmount,amount);
    this.activeMusic.volume=Math.min(this.activeMusic.volume,this.musicTarget);this.fadeMusic(this.activeMusic,this.musicTransition);
  }
  private cancelMusicFade():void {if(this.musicFade!==null){clearInterval(this.musicFade);this.musicFade=null;}}
  private stopMusic(track:HTMLAudioElement):void {track.pause();track.volume=0;}
  private stopInactiveMusic():void {for(const track of Object.values(this.music))if(track!==this.activeMusic)this.stopMusic(track);}
}
