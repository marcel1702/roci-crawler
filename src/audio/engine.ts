import { DEFAULT_SETTINGS } from '../core/settings';
import type { Settings } from '../core/settings';

export type SfxName =
  | 'hit'
  | 'hurt'
  | 'shoot'
  | 'swing'
  | 'boom'
  | 'ability'
  | 'potion'
  | 'pickup'
  | 'chest'
  | 'levelUp'
  | 'kill'
  | 'boss'
  | 'unlock'
  | 'win'
  | 'lose'
  | 'whoosh'
  | 'click';

export type MusicMode = 'off' | 'hub' | 'mission' | 'boss';

interface Tone {
  type?: OscillatorType;
  freq: number;
  /** Zielfrequenz am Ende (gleitet exponentiell). */
  to?: number;
  dur: number;
  vol: number;
  delay?: number;
}

interface Noise {
  dur: number;
  vol: number;
  filter: BiquadFilterType;
  freq: number;
  /** Zielfrequenz des Filters am Ende. */
  to?: number;
  delay?: number;
}

/** Mindestabstand (s) zwischen zwei gleichen Effekten, damit Trefferserien nicht zu Brei werden. */
const MIN_GAP: Partial<Record<SfxName, number>> = { hit: 0.05, hurt: 0.08, shoot: 0.05, swing: 0.08, kill: 0.06, pickup: 0.05 };

const NOTE = (semitonesFromA4: number): number => 440 * 2 ** (semitonesFromA4 / 12);

/** Akkorde der Musik (Halbtöne relativ zu A4): ruhige Flächen, ohne Melodie. */
const CHORDS: Record<Exclude<MusicMode, 'off'>, number[]> = {
  hub: [-24, -17, -9, -5],
  mission: [-26, -19, -14, -10],
  boss: [-28, -21, -16, -13],
};

/**
 * Platzhalter-Audio ohne Dateien: Effekte und Flächenmusik werden mit WebAudio erzeugt. Der Ton startet erst nach der
 * ersten Bedienung (Browser-Regel) und läuft ohne Unterstützung still weiter.
 */
export class AudioEngine {
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<SfxName, number>();
  private mode: MusicMode = 'off';
  private musicNodes: { stop: () => void } | null = null;
  private pulseTimer: ReturnType<typeof setInterval> | null = null;
  private onChange: ((settings: Settings) => void) | null = null;

  /** Übernimmt gespeicherte Einstellungen und wartet auf die erste Bedienung. */
  init(settings: Settings, onChange: (settings: Settings) => void): void {
    this.settings = { ...settings };
    this.onChange = onChange;
    const unlock = (): void => {
      this.ensure();
      for (const event of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(event, unlock, true);
    };
    for (const event of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(event, unlock, true);
    // Taste M schaltet überall stumm (am Tablet: Lautsprecher-Taste im HUD).
    window.addEventListener('keydown', (event) => {
      if (event.key === 'm' || event.key === 'M') this.toggleMuted();
    });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  setMuted(muted: boolean): void {
    this.settings = { ...this.settings, muted };
    this.applyVolumes();
    this.onChange?.(this.settings);
  }

  toggleMuted(): boolean {
    this.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  /** Wählt die Hintergrundmusik; ohne Bedienung des Spielers startet sie, sobald der Ton freigegeben ist. */
  setMusic(mode: MusicMode): void {
    this.mode = mode;
    this.startMusic();
  }

  play(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx || this.settings.muted || ctx.state !== 'running') return;
    const gap = MIN_GAP[name];
    if (gap !== undefined) {
      const last = this.lastPlayed.get(name) ?? -Infinity;
      if (ctx.currentTime - last < gap) return;
      this.lastPlayed.set(name, ctx.currentTime);
    }
    this.sfx(name);
  }

  // ---------------------------------------------------------------- Aufbau

  /** Erstellt den Audiokontext, sobald es erlaubt ist (nach einer Bedienung). */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(ctx.destination);
      this.noiseBuffer = this.makeNoise(ctx);
      this.applyVolumes();
      void ctx.resume();
      this.startMusic();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private applyVolumes(): void {
    if (!this.master || !this.sfxBus || !this.musicBus || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : 1, now, 0.03);
    this.sfxBus.gain.value = 0.55 * this.settings.sfxVolume;
    this.musicBus.gain.value = 0.35 * this.settings.musicVolume;
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Einfaches deterministisches Rauschen (Kongruenzgenerator); Klang braucht keinen Spielzufall.
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = (seed / 0xffffffff) * 2 - 1;
    }
    return buffer;
  }

  // ---------------------------------------------------------------- Bausteine

  private tone(spec: Tone): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const start = ctx.currentTime + (spec.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.type ?? 'sine';
    osc.frequency.setValueAtTime(spec.freq, start);
    if (spec.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.to), start + spec.dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(spec.vol, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.dur);
    osc.connect(gain).connect(bus);
    osc.start(start);
    osc.stop(start + spec.dur + 0.02);
  }

  private noise(spec: Noise): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !this.noiseBuffer) return;
    const start = ctx.currentTime + (spec.delay ?? 0);
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = spec.filter;
    filter.frequency.setValueAtTime(spec.freq, start);
    if (spec.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), start + spec.dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(spec.vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.dur);
    source.connect(filter).connect(gain).connect(bus);
    source.start(start);
    source.stop(start + spec.dur + 0.02);
  }

  private arpeggio(notes: number[], type: OscillatorType, step: number, vol: number): void {
    notes.forEach((semitone, i) => this.tone({ type, freq: NOTE(semitone), dur: step * 1.6, vol, delay: i * step }));
  }

  private sfx(name: SfxName): void {
    switch (name) {
      case 'hit':
        this.noise({ dur: 0.07, vol: 0.5, filter: 'bandpass', freq: 900 });
        this.tone({ type: 'square', freq: 170, to: 80, dur: 0.08, vol: 0.18 });
        break;
      case 'hurt':
        this.tone({ type: 'sawtooth', freq: 130, to: 55, dur: 0.16, vol: 0.4 });
        this.noise({ dur: 0.1, vol: 0.4, filter: 'lowpass', freq: 500 });
        break;
      case 'shoot':
        this.tone({ type: 'square', freq: 900, to: 220, dur: 0.1, vol: 0.16 });
        break;
      case 'swing':
        this.noise({ dur: 0.09, vol: 0.25, filter: 'highpass', freq: 1200, to: 3000 });
        break;
      case 'boom':
        this.noise({ dur: 0.4, vol: 0.8, filter: 'lowpass', freq: 600, to: 120 });
        this.tone({ freq: 95, to: 38, dur: 0.35, vol: 0.5 });
        break;
      case 'ability':
        this.tone({ freq: 330, to: 660, dur: 0.22, vol: 0.28 });
        this.tone({ type: 'triangle', freq: 660, to: 990, dur: 0.18, vol: 0.18, delay: 0.05 });
        break;
      case 'potion':
        this.tone({ freq: 500, to: 800, dur: 0.2, vol: 0.28 });
        this.tone({ freq: 700, to: 1050, dur: 0.16, vol: 0.18, delay: 0.1 });
        break;
      case 'pickup':
        this.tone({ freq: 880, dur: 0.07, vol: 0.22 });
        this.tone({ freq: 1320, dur: 0.1, vol: 0.2, delay: 0.06 });
        break;
      case 'chest':
        this.arpeggio([3, 7, 10, 15], 'triangle', 0.08, 0.26);
        break;
      case 'levelUp':
        this.arpeggio([3, 7, 10, 15, 19], 'triangle', 0.1, 0.3);
        break;
      case 'kill':
        this.tone({ type: 'triangle', freq: 230, to: 105, dur: 0.14, vol: 0.28 });
        this.noise({ dur: 0.06, vol: 0.3, filter: 'bandpass', freq: 600 });
        break;
      case 'boss':
        this.tone({ type: 'sawtooth', freq: 72, to: 44, dur: 1, vol: 0.5 });
        this.tone({ type: 'square', freq: 145, to: 60, dur: 0.7, vol: 0.18 });
        this.noise({ dur: 0.9, vol: 0.3, filter: 'lowpass', freq: 300, to: 80 });
        break;
      case 'unlock':
        this.tone({ freq: 660, to: 990, dur: 0.25, vol: 0.28 });
        this.tone({ freq: 990, to: 1320, dur: 0.25, vol: 0.2, delay: 0.12 });
        break;
      case 'win':
        this.arpeggio([-2, 2, 5, 10, 14], 'triangle', 0.14, 0.3);
        break;
      case 'lose':
        this.tone({ type: 'sawtooth', freq: 220, to: 50, dur: 0.9, vol: 0.4 });
        break;
      case 'whoosh':
        this.noise({ dur: 0.32, vol: 0.35, filter: 'bandpass', freq: 400, to: 2200 });
        break;
      case 'click':
        this.tone({ type: 'square', freq: 1200, dur: 0.035, vol: 0.1 });
        break;
    }
  }

  // ---------------------------------------------------------------- Musik

  /** Weiche Flächen: pro Akkordton ein Oszillator, Tiefpass mit langsamem Wabern; im Bosskampf zusätzlich ein Puls. */
  private startMusic(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    this.musicNodes?.stop();
    this.musicNodes = null;
    if (this.pulseTimer) clearInterval(this.pulseTimer);
    this.pulseTimer = null;
    if (!ctx || !bus || this.mode === 'off') return;

    const mode = this.mode;
    const chord = CHORDS[mode];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mode === 'boss' ? 520 : 380;
    filter.Q.value = 2;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = mode === 'boss' ? 0.35 : 0.12;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filter.frequency);
    filter.connect(out).connect(bus);

    const oscillators = chord.map((semitone, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.value = NOTE(semitone);
      osc.detune.value = (i - 1.5) * 6;
      const gain = ctx.createGain();
      gain.gain.value = 0.12;
      osc.connect(gain).connect(filter);
      osc.start();
      return osc;
    });
    lfo.start();

    if (mode === 'boss') {
      const bass = NOTE(chord[0] as number);
      this.pulseTimer = setInterval(() => {
        if (!this.ctx || this.settings.muted || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(bass * 2, now);
        osc.frequency.exponentialRampToValueAtTime(bass, now + 0.18);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.connect(gain).connect(bus);
        osc.start(now);
        osc.stop(now + 0.32);
      }, 520);
    }

    this.musicNodes = {
      stop: () => {
        const now = ctx.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setTargetAtTime(0.0001, now, 0.3);
        window.setTimeout(() => {
          for (const osc of oscillators) osc.stop();
          lfo.stop();
          out.disconnect();
        }, 1500);
      },
    };
  }
}
