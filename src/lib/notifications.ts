/**
 * NUQTA Synthesizer & Browser Notification Engine
 * Provides local device/browser notifications for:
 * 1. Focus session completion and break intervals
 * 2. Scheduled tasks at due times
 * 3. Daily morning & evening habit rituals
 * 4. Harmonic audio chimes via Web Audio API (no external MP3/WAV files required)
 */

import { useNuqtaStore } from '../store/nuqtaStore';
import type { AppNotification } from '../types';
import { renderNotificationText } from './notificationMessages';

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
  /** Where a click should land, e.g. `{ nav: 'tasks', entityId: 'abc' }`. */
  route?: { nav: string; entityId?: string };
  onClick?: () => void;
}

/**
 * Navigate to a notification's target entity. Routed clicks (from the page or the
 * service worker) all land here so a reminder opens the exact record it is about.
 */
export function openNotificationRoute(route?: { nav: string; entityId?: string }): void {
  if (!route || typeof window === 'undefined') return;
  const store = useNuqtaStore.getState();
  if (route.entityId) store.requestFocus(route.nav, route.entityId);
  store.setActiveNavTab(route.nav as never);
}

/** Listen for a routed click forwarded by the service worker. */
export function listenForNotificationRoutes(): () => void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return () => {};
  const handler = (event: MessageEvent) => {
    const data = event.data;
    if (data && data.type === 'nuqta-notification-click') {
      openNotificationRoute(data.route);
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

/**
 * Mirror an in-app notification to the OS/browser channel.
 *
 * This is an ADAPTER, not a second source of truth: the notification already exists in the
 * store by the time this runs, and the return value only reports whether the optional
 * channel accepted it. Permission is never requested here — a request must follow a user
 * gesture, so it lives in the settings UI. A refusal is silent by design; the in-app inbox
 * still holds the notification, so nothing is lost.
 */
export async function deliverBrowserNotification(
  notification: AppNotification,
  isAr: boolean
): Promise<boolean> {
  const text = renderNotificationText(
    typeof notification.meta?.messageId === 'string' ? notification.meta.messageId : undefined,
    notification.meta,
    { title: notification.title, body: notification.body },
    isAr
  );

  return NuqtaNotificationEngine.notify({
    title: text.title,
    body: text.body ?? '',
    tag: notification.dedupeKey,
    route: notification.route,
    chime: CHIME_BY_CATEGORY[notification.category]
  });
}

/** Each category gets a distinct, deliberate cue rather than one generic beep. */
const CHIME_BY_CATEGORY: Record<AppNotification['category'], ChimeType> = {
  focus: 'focus-complete',
  task: 'task-reminder',
  reminder: 'task-reminder',
  habit: 'habit-cue',
  goal: 'gentle-bell',
  health: 'gentle-bell',
  finance: 'gentle-bell',
  system: 'gentle-bell'
};

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
   *
   * Prefers the service worker registration (when present) so the notification is
   * shown through the OS channel and survives a backgrounded tab; falls back to a
   * page-level `Notification` when no service worker is registered (e.g. dev, or a
   * browser that blocks registration).
   */
  static notify(payload: NotificationPayload): boolean {
    const { title, body, tag, chime = 'gentle-bell', route, onClick } = payload;

    // 1. Play synthesizer chime
    try {
      nuqtaAudio.play(chime);
    } catch {}

    if (!this.isSupported() || Notification.permission !== 'granted') return false;

    const notificationTag = tag || 'nuqta-general';

    // 2. Prefer the service worker so the OS notification channel is used.
    const controller =
      typeof navigator !== 'undefined' && navigator.serviceWorker
        ? navigator.serviceWorker.controller
        : null;
    if (controller) {
      try {
        controller.postMessage({
          type: 'nuqta-notify',
          title,
          body,
          tag: notificationTag,
          route
        });
        return true;
      } catch (e) {
        console.warn('Service worker notification dispatch failed:', e);
      }
    }

    // 3. Fallback: a page-level notification.
    try {
      const notif = new Notification(title, {
        body,
        tag: notificationTag,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        silent: true // We handle our own pleasant audio synthesizer
      });

      notif.onclick = () => {
        window.focus();
        if (route) openNotificationRoute(route);
        if (onClick) onClick();
        notif.close();
      };

      return true;
    } catch (e) {
      console.warn('Native notification dispatch failed:', e);
    }

    return false;
  }
}
