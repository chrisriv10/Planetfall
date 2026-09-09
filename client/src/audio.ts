export class GameAudio {
  private context: AudioContext | null = null;
  private readonly music: Record<"menu" | "game", HTMLAudioElement>;
  private musicScene: "menu" | "game" = "menu";
  private musicUnlocked = false;
  private musicFade: ReturnType<typeof setInterval> | null = null;
  private musicVolume = .8;
  private sfxVolume = .9;

  private get activeMusic(): HTMLAudioElement { return this.music[this.musicScene]; }
  private get musicTarget(): number { return (this.musicScene === "menu" ? .14 : .18) * this.musicVolume; }

  constructor() {
    this.music = {
      menu: this.makeMusic("/audio/low-battery.ogg"),
      game: this.makeMusic("/audio/bot-city.ogg")
    };
  }

  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
    this.musicUnlocked = true;
    const active = this.activeMusic;
    if (active.paused) {
      void active.play().then(() => this.fadeMusicIn()).catch(() => undefined);
    }
  }

  setMusicScene(scene: "menu" | "game"): void {
    if (scene === this.musicScene) return;
    const outgoing = this.activeMusic;
    this.musicScene = scene;
    const incoming = this.activeMusic;
    if (!this.musicUnlocked) { outgoing.pause(); outgoing.volume = 0; return; }
    incoming.volume = 0;
    void incoming.play().then(() => this.crossfadeMusic(outgoing, incoming)).catch(() => undefined);
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = Math.min(1, Math.max(0, music));
    this.sfxVolume = Math.min(1, Math.max(0, sfx));
    if (!this.activeMusic.paused) this.activeMusic.volume = this.musicTarget;
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

  private fadeMusicIn(): void {
    if (this.musicFade) clearInterval(this.musicFade);
    const active = this.activeMusic;
    this.musicFade = setInterval(() => {
      active.volume = Math.min(this.musicTarget, active.volume + .01);
      if (active.volume >= this.musicTarget && this.musicFade) {
        clearInterval(this.musicFade);
        this.musicFade = null;
      }
    }, 90);
  }

  private crossfadeMusic(outgoing: HTMLAudioElement, incoming: HTMLAudioElement): void {
    if (this.musicFade) clearInterval(this.musicFade);
    this.musicFade = setInterval(() => {
      outgoing.volume = Math.max(0, outgoing.volume - .012);
      incoming.volume = Math.min(this.musicTarget, incoming.volume + .012);
      if (outgoing.volume <= 0) outgoing.pause();
      if (outgoing.paused && incoming.volume >= this.musicTarget && this.musicFade) {
        clearInterval(this.musicFade);
        this.musicFade = null;
      }
    }, 70);
  }

  private duckMusic(duration: number, amount: number): void {
    const active = this.activeMusic;
    if (active.paused) return;
    active.volume = Math.min(active.volume, this.musicTarget * (1 - amount));
    setTimeout(() => { if (this.activeMusic === active) this.fadeMusicIn(); }, duration);
  }

  private makeMusic(source: string): HTMLAudioElement {
    const music = new Audio(source);
    music.loop = true;
    music.preload = "auto";
    music.volume = 0;
    return music;
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
