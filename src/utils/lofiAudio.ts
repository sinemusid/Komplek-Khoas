/**
 * Procedural Chill Lofi Audio Engine berbasis Web Audio API (100% lokal, tanpa file audio eksternal).
 * Menghasilkan progresi akor warm electric-piano (Rhodes), bass lembut, dan tekstur vinyl halus
 * yang tetap mengalir mulus antara peta perumahan dan interior auditorium.
 */

// Progresi akor lofi jazz yang hangat & menenangkan (Fmaj7 -> Em7 -> Dm9 -> Cmaj7)
const CHORD_PROGRESSION_HZ: number[][] = [
  [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
  [164.81, 196.0, 246.94, 293.66, 392.0], // Em7
  [146.83, 174.61, 220.0, 261.63, 329.63], // Dm9
  [130.81, 164.81, 196.0, 246.94, 293.66], // Cmaj9
];

const MELODY_NOTES_HZ = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 440.0, 493.88];

class LofiAudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lofiFilter: BiquadFilterNode | null = null;
  private crackleNode: AudioBufferSourceNode | null = null;
  private stepTimer: number | null = null;
  private chordIndex = 0;
  private beatCounter = 0;
  private playing = false;
  private mutedByUser = false;
  private listeners = new Set<(playing: boolean) => void>();

  public isPlaying(): boolean {
    return this.playing;
  }

  public isMutedByUser(): boolean {
    return this.mutedByUser;
  }

  public subscribe(listener: (playing: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.playing);
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0001;

      // Warm low-pass filter untuk karakter lofi lembut & tidak menusuk telinga
      this.lofiFilter = this.ctx.createBiquadFilter();
      this.lofiFilter.type = 'lowpass';
      this.lofiFilter.frequency.value = 1350;
      this.lofiFilter.Q.value = 0.7;

      this.lofiFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private startVinylCrackle(ctx: AudioContext) {
    if (this.crackleNode || !this.masterGain) return;
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      // Hiss tape sangat halus + sesekali dust pop lembut
      const hiss = (Math.random() * 2 - 1) * 0.008;
      const pop = Math.random() < 0.00028 ? (Math.random() * 2 - 1) * 0.16 : 0;
      data[i] = hiss + pop;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1800;
    hp.Q.value = 0.9;

    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.14;

    src.connect(hp);
    hp.connect(crackleGain);
    crackleGain.connect(this.masterGain);
    src.start();
    this.crackleNode = src;
  }

  private playRhodesChord(ctx: AudioContext, notes: number[], startTime: number, duration: number) {
    if (!this.lofiFilter) return;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      // Sedikit detune untuk efek tape wobble lofi yang hangat
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.detune.setValueAtTime((idx % 2 === 0 ? 1 : -1) * 4.5, startTime);

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq * 0.5, startTime);

      const subGain = ctx.createGain();
      subGain.gain.value = idx === 0 ? 0.38 : 0.12;

      // Arpeggio mikro halus agar terdengar seperti sentuhan tangan manusia
      const t0 = startTime + idx * 0.045;
      const peak = idx === 0 ? 0.095 : 0.055;

      noteGain.gain.setValueAtTime(0.0001, t0);
      noteGain.gain.linearRampToValueAtTime(peak, t0 + 0.09);
      noteGain.gain.exponentialRampToValueAtTime(peak * 0.45, t0 + duration * 0.6);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(noteGain);
      subOsc.connect(subGain);
      subGain.connect(noteGain);
      noteGain.connect(this.lofiFilter!);

      osc.start(t0);
      subOsc.start(t0);
      osc.stop(t0 + duration + 0.08);
      subOsc.stop(t0 + duration + 0.08);
    });
  }

  private playGentleBellNote(ctx: AudioContext, freq: number, startTime: number) {
    if (!this.lofiFilter) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.032, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.45);

    osc.connect(gain);
    gain.connect(this.lofiFilter);
    osc.start(startTime);
    osc.stop(startTime + 1.5);
  }

  private scheduleStep() {
    if (!this.playing || !this.ctx) return;
    const now = this.ctx.currentTime + 0.05;
    const chord = CHORD_PROGRESSION_HZ[this.chordIndex % CHORD_PROGRESSION_HZ.length];

    // Mainkan akor hangat setiap bar (~3.2 detik)
    this.playRhodesChord(this.ctx, chord, now, 3.1);

    // Tambahan melodi lembut sesekali di ketukan kedua
    if (this.beatCounter % 2 === 1) {
      const note = MELODY_NOTES_HZ[this.beatCounter % MELODY_NOTES_HZ.length];
      this.playGentleBellNote(this.ctx, note, now + 1.55);
    }

    this.chordIndex = (this.chordIndex + 1) % CHORD_PROGRESSION_HZ.length;
    this.beatCounter += 1;
  }

  public async play(fromUserAction = true): Promise<boolean> {
    if (fromUserAction) {
      this.mutedByUser = false;
    }
    if (this.mutedByUser) return false;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch {
      return false;
    }

    if (this.playing) return true;

    this.playing = true;
    this.startVinylCrackle(ctx);

    const now = ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
    this.masterGain.gain.linearRampToValueAtTime(0.24, now + 1.1);

    this.scheduleStep();
    this.stepTimer = window.setInterval(() => {
      this.scheduleStep();
    }, 3200);

    this.notify();
    return true;
  }

  public pause(userInitiated = true) {
    if (userInitiated) {
      this.mutedByUser = true;
    }
    if (!this.playing) {
      this.notify();
      return;
    }

    this.playing = false;
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.45);
    }

    this.notify();
  }

  public async toggle(): Promise<boolean> {
    if (this.playing) {
      this.pause(true);
      return false;
    }
    return this.play(true);
  }
}

export const lofiAudio = new LofiAudioController();
