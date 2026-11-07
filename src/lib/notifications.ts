/**
 * NUQTA Synthesizer & Browser Notification Engine
 * Provides local device/browser notifications for:
 * 1. Focus session completion and break intervals
 * 2. Scheduled tasks at due times
 * 3. Daily morning & evening habit rituals
 * 4. Harmonic audio chimes via Web Audio API (no external MP3/WAV files required)
 */

type ChimeType = 'focus-complete' | 'break-start' | 'task-reminder' | 'habit-cue' | 'gentle-bell';

class AudioSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Generates a warm, harmonic acoustic chime without external media files
   */
  play(type: ChimeType = 'gentle-bell') {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === 'focus-complete') {
        // Calming 3-note ascending chord (E5 -> G#5 -> B5 -> E6)
        const notes = [659.25, 830.61, 987.77, 1318.51];
        notes.forEach((freq, idx) => {
          this.playTone(ctx, freq, now + idx * 0.14, 0.9, 'sine', 0.18);
        });
      } else if (type === 'break-start') {
        // Soft descending 2-note transition (A5 -> E5)
        [880.0, 659.25].forEach((freq, idx) => {
          this.playTone(ctx, freq, now + idx * 0.18, 0.7, 'triangle', 0.15);
        });
      } else if (type === 'task-reminder') {
        // Crisp dual chime (D6 -> A6)
        [1174.66, 1760.0].forEach((freq, idx) => {
          this.playTone(ctx, freq, now + idx * 0.1, 0.6, 'sine', 0.16);
        });
      } else if (type === 'habit-cue') {
        // Deep resonant tone (C5 -> G5)
        [523.25, 783.99].forEach((freq, idx) => {
          this.playTone(ctx, freq, now + idx * 0.16, 0.8, 'sine', 0.14);
        });
      } else {
        // Single gentle bell
        this.playTone(ctx, 880.0, now, 0.8, 'sine', 0.15);
      }
    } catch (e) {
      console.warn('AudioSynthesizer audio playback note:', e);
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    maxGain: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // Warm envelope: soft attack, gentle exponential decay
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(maxGain, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }
}

export const nuqtaAudio = new AudioSynthesizer();

export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  chime?: ChimeType;
  icon?: string;
  onClick?: () => void;
}

export class NuqtaNotificationEngine {
  private static permissionCache: NotificationPermission = 'default';

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  static getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  static async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const res = await Notification.requestPermission();
      this.permissionCache = res;
      // Play a quick chime to unlock audio context upon user gesture
      nuqtaAudio.play('gentle-bell');
      return res;
    } catch {
      return 'denied';
    }
  }

  /**
   * Dispatches a notification to the browser or OS if permitted,
   * alongside playing an acoustic synth chime.
   */
  static notify(payload: NotificationPayload): boolean {
    const { title, body, tag, chime = 'gentle-bell', onClick } = payload;

    // 1. Play synthesizer chime
    try {
      nuqtaAudio.play(chime);
    } catch {}

    // 2. Dispatch native Notification if allowed
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          tag: tag || 'nuqta-general',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          silent: true // We handle our own pleasant audio synthesizer
        });

        if (onClick) {
          notif.onclick = () => {
            window.focus();
            onClick();
            notif.close();
          };
        }

        return true;
      } catch (e) {
        console.warn('Native notification dispatch failed:', e);
      }
    }

    return false;
  }
}
