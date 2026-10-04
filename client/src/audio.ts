export class GameAudio {
  private context: AudioContext | null = null;
  private readonly music: Record<"menu" | "game", HTMLAudioElement>;
  private musicScene: "menu" | "game" = "menu";
  private musicUnlocked = false;
  private musicFade: ReturnType<typeof setInterval> | null = null;
  private musicTransition = 0;
  private musicVolume = .8;
  private sfxVolume = .9;
  private urgency = 0;
  private readonly samples = new Map<string, HTMLAudioElement>();
  private readonly brLoops = new Map<"starliner" | "skimmer" | "drop", HTMLAudioElement>();

  private get activeMusic(): HTMLAudioElement { return this.music[this.musicScene]; }
  private get musicTarget(): number { return (this.musicScene === "menu" ? .14 : .18) * this.musicVolume; }

  constructor() {
    this.music = {
      menu: this.makeMusic("/audio/low-battery.ogg"),
      game: this.makeMusic("/audio/bot-city.ogg")
    };
    this.registerSample("laser-small", "/audio/br/br-laser-small.ogg");
    this.registerSample("laser-large", "/audio/br/br-laser-large.ogg");
    this.registerSample("shield-hit", "/audio/br/br-shield-hit.ogg");
    this.registerSample("shield-break", "/audio/br/br-shield-break.ogg");
    this.registerSample("metal-impact", "/audio/br/br-metal-impact.ogg");
    this.registerSample("plasma-explosion", "/audio/br/br-plasma-explosion.ogg");
    this.registerSample("footstep-1", "/audio/br/br-footstep-1.ogg");
    this.registerSample("footstep-2", "/audio/br/br-footstep-2.ogg");
    this.brLoops.set("starliner", this.makeLoop("/audio/br/br-starliner-engine.ogg"));
    this.brLoops.set("skimmer", this.makeLoop("/audio/br/br-skimmer-engine.ogg"));
    // A filtered, quieter thruster layer gives freefall useful speed feedback
    // without introducing another large asset or masking combat cues.
    this.brLoops.set("drop", this.makeLoop("/audio/br/br-skimmer-engine.ogg"));
  }

  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
    this.musicUnlocked = true;
    const active = this.activeMusic;
    const transition = ++this.musicTransition;
    this.cancelMusicFade();
    this.stopInactiveMusic(active);
    if (active.paused) {
      active.volume = 0;
      void active.play().then(() => {
        if (transition !== this.musicTransition || active !== this.activeMusic) {
          this.stopMusic(active);
          return;
        }
        this.fadeMusicIn(active, transition);
      }).catch(() => undefined);
    } else {
      this.fadeMusicIn(active, transition);
    }
  }

  setMusicScene(scene: "menu" | "game"): void {
    if (scene === this.musicScene) {
      this.stopInactiveMusic(this.activeMusic);
      return;
    }
    this.musicScene = scene;
    const incoming = this.activeMusic;
    const transition = ++this.musicTransition;
    this.cancelMusicFade();
    this.stopInactiveMusic(incoming);
    incoming.playbackRate = scene === "game" ? 1 + this.urgency * .035 : 1;
    if (!this.musicUnlocked) {
      this.stopMusic(incoming);
      return;
    }
    incoming.volume = 0;
    void incoming.play().then(() => {
      if (transition !== this.musicTransition || incoming !== this.activeMusic) {
        this.stopMusic(incoming);
        return;
      }
      this.fadeMusicIn(incoming, transition);
    }).catch(() => undefined);
  }

  setUrgency(level: number): void {
    this.urgency = Math.min(2, Math.max(0, Math.round(level)));
    this.music.game.playbackRate = 1 + this.urgency * .035;
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = Math.min(1, Math.max(0, music));
    this.sfxVolume = Math.min(1, Math.max(0, sfx));
    const active = this.activeMusic;
    this.stopInactiveMusic(active);
    if (!active.paused) active.volume = this.musicTarget;
    for (const loop of this.brLoops.values()) {
      const mix = Number(loop.dataset.mix ?? "0");
      loop.volume = Math.min(1, mix * this.sfxVolume);
    }
  }

  setBrLoop(kind: "starliner" | "skimmer" | "drop", active: boolean, intensity = 1): void {
    const loop = this.brLoops.get(kind);
    if (!loop) return;
    const clamped = Math.min(1, Math.max(0, intensity));
    const mix = active ? (kind === "starliner" ? .22 : kind === "drop" ? .13 : .2) * (.45 + clamped * .55) : 0;
    loop.dataset.mix = String(mix);
    loop.playbackRate = kind === "starliner" ? .72 + clamped * .08 : kind === "drop" ? .78 + clamped * .35 : .72 + clamped * .5;
    loop.volume = mix * this.sfxVolume;
    if (!active || !this.musicUnlocked) {
      if (!active) { loop.pause(); loop.currentTime = 0; }
      return;
    }
    if (loop.paused) void loop.play().catch(() => undefined);
  }

  stopBrLoops(): void {
    for (const loop of this.brLoops.values()) { loop.pause(); loop.currentTime = 0; loop.dataset.mix = "0"; }
  }

  click(): void { this.tone(360, 0.04, "square", 0.025, 520); }
  pickup(): void { this.tone(720, 0.1, "sine", 0.05, 1180); }
  stolen(): void { this.tone(610, 0.08, "square", 0.045, 980); setTimeout(() => this.tone(880, 0.12, "triangle", 0.04, 1320), 65); }
  jump(): void { this.tone(190, 0.12, "triangle", 0.04, 330); }
  land(impact = 5): void {
    const weight = Math.min(1, Math.max(.35, impact / 11));
    this.noise(0.05 + weight * .06, 0.018 + weight * .025, 150 + weight * 120);
    this.tone(105 - weight * 25, 0.06 + weight * .06, "sine", 0.016 + weight * .024, 58);
  }
  burst(): void { this.noise(0.11, 0.045, 900); this.tone(170, 0.14, "sawtooth", 0.035, 360); }
  grapple(): void { this.tone(130, 0.16, "sawtooth", 0.035, 90); }
  tether(): void { this.tone(220, .12, "triangle", .035, 520); this.tone(92, .18, "sine", .02, 62); }
  grappleRelease(): void { this.tone(180, 0.07, "triangle", 0.025, 280); }
  cannonTrigger(heavy: boolean): void { this.tone(heavy ? 82 : 145, .055, "square", .018, heavy ? 64 : 118); }
  denied(): void { this.tone(125, .055, "square", .018, 92); }
  launch(): void { this.duckMusic(480, .55); this.noise(0.24, 0.1, 760); this.tone(110, 0.32, "sawtooth", 0.065, 520); }
  shove(): void { this.noise(0.09, 0.065, 420); this.tone(120, 0.11, "square", 0.045, 75); }
  sabotage(): void { this.noise(0.2, 0.035, 1200); this.tone(390, 0.28, "square", 0.035, 105); }
  intruder(): void { this.tone(520, 0.08, "square", 0.04, 350); setTimeout(() => this.tone(520, 0.08, "square", 0.035, 350), 120); }
  incoming(heavy: boolean): void {
    this.tone(heavy ? 190 : 310, heavy ? 0.2 : 0.12, "triangle", heavy ? 0.045 : 0.03, heavy ? 95 : 220);
    setTimeout(() => this.tone(heavy ? 150 : 280, 0.1, "square", heavy ? 0.035 : 0.022, heavy ? 80 : 210), heavy ? 170 : 130);
  }
  brWeapon(weapon: string): void {
    if (weapon === "pulse-rifle") { this.playSample("laser-small",.18,1.03);this.tone(210,.055,"square",.026,410); this.noise(.035,.018,1500); }
    else if (weapon === "nova-smg") { this.playSample("laser-small",.13,1.18);this.tone(310,.035,"sawtooth",.018,210); this.noise(.025,.014,2200); }
    else if (weapon === "photon-shotgun") { this.playSample("laser-large",.24,.76);this.duckMusic(120,.18);this.noise(.13,.085,720);this.tone(115,.15,"square",.055,58); }
    else if (weapon === "rail-laser") { this.playSample("laser-large",.22,1.14);this.tone(1080,.11,"sine",.04,1820);setTimeout(()=>this.tone(170,.18,"sawtooth",.046,72),42); }
    else if (weapon === "plasma-launcher") { this.playSample("plasma-explosion",.18,.82);this.tone(125,.22,"sine",.055,420);this.noise(.08,.035,520); }
    else if (weapon === "arc-blaster") { this.playSample("shield-hit",.15,1.18);this.tone(760,.08,"square",.028,280);setTimeout(()=>this.tone(1120,.055,"triangle",.018,650),28); }
    else if (weapon === "energy-saber") { this.noise(.09,.036,1300);this.tone(240,.16,"sawtooth",.035,480); }
  }
  hitConfirm(kind:"shield"|"hp"|"break"|"headshot"):void {
    const start=kind==="headshot"?980:kind==="break"?760:kind==="shield"?610:430;
    this.tone(start,kind==="break"?.13:.065,kind==="hp"?"square":"triangle",.025,kind==="break"?1260:start*1.18);
    if(kind==="break")this.noise(.09,.026,1800);
    if(kind==="shield")this.playSample("shield-hit",.12,1.08);
    else if(kind==="break")this.playSample("shield-break",.19,.96);
    else if(kind==="hp"||kind==="headshot")this.playSample("metal-impact",kind==="headshot"?.16:.1,kind==="headshot"?1.2:1);
  }
  footstep(sprinting=false):void { this.playSample(Math.random()>.5?"footstep-1":"footstep-2",sprinting?.11:.075,sprinting?1.08:.94);this.noise(.035,sprinting?.02:.013,sprinting?330:260);this.tone(sprinting?92:115,.035,"sine",.009,70); }
  slide():void { this.noise(.17,.03,540); }
  mantle():void { this.noise(.07,.023,420);this.tone(145,.08,"triangle",.016,95); }
  wings():void { this.tone(280,.28,"sine",.04,840);this.noise(.16,.025,1600); }
  brJumpShip():void { this.duckMusic(220,.2);this.noise(.18,.03,980);this.tone(150,.24,"sawtooth",.028,410); }
  brReload(weapon:string):void {
    const heavy=weapon==="photon-shotgun"||weapon==="plasma-launcher"||weapon==="rail-laser";
    this.tone(heavy?170:260,.07,"square",.018,heavy?120:340);
    setTimeout(()=>this.tone(heavy?310:470,.09,"triangle",.02,heavy?520:690),95);
  }
  brEmpty():void { this.tone(92,.045,"square",.018,72);setTimeout(()=>this.tone(76,.035,"square",.012,68),54); }
  brUseItem(shield=false):void { this.tone(shield?520:330,.2,"sine",.025,shield?910:540);this.noise(.06,.012,shield?1450:760); }
  brVoid(urgent=false):void { this.duckMusic(urgent?420:260,urgent?.34:.2);this.tone(urgent?118:175,urgent?.28:.2,"sawtooth",urgent?.04:.027,urgent?72:112);setTimeout(()=>this.tone(urgent?96:148,.16,"triangle",urgent?.03:.02,urgent?64:105),150); }
  brEvent(kind:"closing"|"safe"|"final"|"inventory"):void {
    if(kind==="inventory"){this.tone(420,.055,"triangle",.018,610);return;}
    const notes=kind==="final"?[155,116]:kind==="closing"?[310,235]:[440,620];
    notes.forEach((note,index)=>setTimeout(()=>this.tone(note,.13,kind==="final"?"sawtooth":"triangle",kind==="final"?.035:.024,note*.82),index*105));
  }
  critical(): void { this.tone(160, .16, "triangle", .035, 105); setTimeout(() => this.tone(130, .18, "triangle", .03, 82), 190); }
  rocket(): void { this.noise(0.18, 0.14, 600); this.tone(95, 0.18, "sawtooth", 0.07, 45); }
  asteroid(): void { this.duckMusic(520, .62); this.noise(0.28, 0.19, 320); this.tone(64, 0.3, "square", 0.08, 38); }
  cluster(): void { this.noise(.13, .08, 880); this.tone(220, .18, "square", .045, 410); }
  clusterBurst(): void {
    this.noise(.16, .08, 1100);
    [420, 560, 740].forEach((note, index) => setTimeout(() => this.tone(note, .07, "triangle", .025, note * 1.22), index * 28));
  }
  gravityBomb(): void { this.duckMusic(360, .38); this.tone(260, .32, "sine", .055, 52); this.tone(110, .25, "triangle", .035, 48); }
  explosion(heavy = false): void { if (heavy) this.duckMusic(850, .72); this.noise(heavy ? 0.7 : 0.42, heavy ? 0.3 : 0.2, heavy ? 170 : 260); }
  repair(): void { this.tone(420, 0.22, "sine", 0.04, 820); }
  countdown(value: number): void { this.tone(value === 0 ? 660 : 300 + value * 55, value === 0 ? .22 : .08, "square", value === 0 ? .045 : .025, value === 0 ? 980 : 360 + value * 55); }
  chaos(): void {
    this.duckMusic(700, .6);
    [220, 330, 494].forEach((note, index) => setTimeout(() => this.tone(note, .16, index === 2 ? "square" : "triangle", .035, note * 1.28), index * 85));
  }
  result(won: boolean): void {
    const notes = won ? [440, 554, 659, 880] : [280, 235, 196];
    notes.forEach((note, index) => setTimeout(() => this.tone(note, .18, "triangle", .035, note * 1.04), index * 110));
  }

  private fadeMusicIn(active: HTMLAudioElement, transition: number): void {
    this.cancelMusicFade();
    const timer = setInterval(() => {
      if (transition !== this.musicTransition || active !== this.activeMusic) {
        clearInterval(timer);
        if (this.musicFade === timer) this.musicFade = null;
        this.stopMusic(active);
        return;
      }
      active.volume = Math.min(this.musicTarget, active.volume + .01);
      if (active.volume >= this.musicTarget) {
        clearInterval(timer);
        if (this.musicFade === timer) this.musicFade = null;
      }
    }, 90);
    this.musicFade = timer;
  }
  highFive(): void { this.noise(.07, .035, 950); this.tone(520, .1, "square", .035, 840); setTimeout(() => this.tone(960, .1, "triangle", .026, 1220), 60); }
  levelUp(): void { [440, 554, 659, 880].forEach((note, index) => setTimeout(() => this.tone(note, .16, "triangle", .035, note * 1.1), index * 70)); }
  callout(heavy = false): void { this.duckMusic(300, .25); this.tone(heavy ? 110 : 210, .13, "square", heavy ? .044 : .03, heavy ? 72 : 330); }

  private cancelMusicFade(): void {
    if (!this.musicFade) return;
    clearInterval(this.musicFade);
    this.musicFade = null;
  }

  private stopMusic(track: HTMLAudioElement): void {
    track.pause();
    track.volume = 0;
  }

  private stopInactiveMusic(active: HTMLAudioElement): void {
    for (const track of Object.values(this.music)) {
      if (track !== active) this.stopMusic(track);
    }
  }

  private duckMusic(duration: number, amount: number): void {
    const active = this.activeMusic;
    if (active.paused) return;
    const transition = this.musicTransition;
    active.volume = Math.min(active.volume, this.musicTarget * (1 - amount));
    setTimeout(() => {
      if (this.activeMusic === active && transition === this.musicTransition) {
        this.fadeMusicIn(active, transition);
      }
    }, duration);
  }

  private makeMusic(source: string): HTMLAudioElement {
    const music = new Audio(source);
    music.loop = true;
    music.preload = "auto";
    music.volume = 0;
    return music;
  }

  private registerSample(name: string, source: string): void {
    const sample = new Audio(source);
    sample.preload = "auto";
    this.samples.set(name, sample);
  }

  private makeLoop(source: string): HTMLAudioElement {
    const loop = new Audio(source);
    loop.loop = true;
    loop.preload = "auto";
    loop.volume = 0;
    loop.dataset.mix = "0";
    return loop;
  }

  private playSample(name: string, volume: number, playbackRate = 1): void {
    if (!this.musicUnlocked) return;
    const template = this.samples.get(name);
    if (!template) return;
    const voice = template.cloneNode(true) as HTMLAudioElement;
    voice.volume = Math.min(1, Math.max(0, volume * this.sfxVolume));
    voice.playbackRate = Math.min(2, Math.max(.5, playbackRate));
    void voice.play().catch(() => undefined);
  }

  private tone(start: number, duration: number, type: OscillatorType, gain: number, end = start): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const volume = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    volume.gain.setValueAtTime(Math.max(.0001, gain * this.sfxVolume), now);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(volume).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private noise(duration: number, gain: number, cutoff: number): void {
    if (!this.context) return;
    const frames = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, frames, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) channel[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const volume = this.context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    volume.gain.value = gain * this.sfxVolume;
    source.buffer = buffer;
    source.connect(filter).connect(volume).connect(this.context.destination);
    source.start();
  }
}
