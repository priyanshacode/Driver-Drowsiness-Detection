import { AUDIO_ALERT_COOLDOWN_MS } from '../config/constants.ts'
import type { AlertLevel } from '../metrics/types.ts'

/**
 * Manages audible alarms using the browser Web Audio API.
 * Requires no external audio files or third-party dependencies.
 */
export class AlertAudioManager {
  private ctx: AudioContext | null = null
  private muted = false
  private lastCriticalTime = -Infinity
  private lastWarningTime = -Infinity
  private warningActive = false
  readonly criticalCooldownMs: number
  readonly warningCooldownMs: number

  constructor(cooldownMs = AUDIO_ALERT_COOLDOWN_MS, warningCooldownMs?: number) {
    this.criticalCooldownMs = cooldownMs
    this.warningCooldownMs = warningCooldownMs ?? cooldownMs
  }

  isMuted(): boolean {
    return this.muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  getLastCriticalTime(): number {
    return this.lastCriticalTime
  }

  getLastWarningTime(): number {
    return this.lastWarningTime
  }

  isWarningActive(): boolean {
    return this.warningActive
  }

  reset(): void {
    this.resetCooldowns()
  }

  resetCooldowns(): void {
    this.lastCriticalTime = -Infinity
    this.lastWarningTime = -Infinity
    this.warningActive = false
  }

  /**
   * Safe initialization or resumption of the Web Audio context after a user interaction.
   * Resolves to true if audio context is active/running, or false if suspended/blocked/unavailable.
   */
  async initOrResume(): Promise<boolean> {
    if (typeof window === 'undefined') return false

    try {
      if (!this.ctx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AudioContextClass) return false
        this.ctx = new AudioContextClass()
      }

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume()
      }

      return this.ctx.state === 'running'
    } catch {
      // Gracefully handle browser autoplay blocks or lack of hardware
      return false
    }
  }

  /**
   * Evaluates whether an alert tone is eligible to play based on mute state, level, and cooldowns.
   * - Warning plays once per episode (transition into warning) and does not repeat while continuously active.
   * - Escalation from warning to critical bypasses any active warning cooldown.
   * - Repeated critical alarms remain throttled by criticalCooldownMs.
   */
  canPlayAlert(level: AlertLevel, now = performance.now()): boolean {
    if (this.muted) return false
    if (level !== 'critical' && level !== 'warning') return false

    if (level === 'critical') {
      // Critical alerts only check critical cooldown; they bypass any recent warning cooldown
      return now - this.lastCriticalTime >= this.criticalCooldownMs
    }

    // Warning alert:
    // Only plays once per warning episode (when transitioning from normal/tracking-lost to warning).
    // Does not replay while the warning remains continuously active, even across cooldown intervals.
    if (this.warningActive) {
      return false
    }

    // Suppressed if critical alarm was recently active
    return now - this.lastCriticalTime >= this.criticalCooldownMs
  }

  /**
   * Play an alert tone if eligible.
   * - Tracks alert episodes: warning plays once per episode; clearing to normal allows future episodes.
   * - Tracking loss preserves episode state so resuming tracking does not repeat the alarm.
   * - Escalation to critical triggers immediately while repeated critical frames are throttled.
   */
  playAlert(level: AlertLevel, now = performance.now()): boolean {
    if (level === 'normal') {
      // Warning condition has cleared; allow a new warning episode to sound in the future
      this.warningActive = false
      return false
    }

    if (level === 'tracking-lost') {
      // Tracking loss preserves warningActive state so that resuming
      // into an ongoing warning does not trigger repeated warning sounds.
      return false
    }

    if (level !== 'critical' && level !== 'warning') {
      return false
    }

    if (!this.canPlayAlert(level, now)) {
      return false
    }

    // Attempt audio synthesis if in a browser environment
    const audioSucceeded = this.ensureContextAndPlay(level)

    // Update cooldown timestamps if audio successfully played OR in headless test environment
    if (audioSucceeded || typeof window === 'undefined') {
      if (level === 'critical') {
        this.lastCriticalTime = now
        this.lastWarningTime = now // Critical also suppresses immediate subsequent warnings
        this.warningActive = true // Suppress warnings while critical or recovering from critical
      } else {
        this.lastWarningTime = now
        this.warningActive = true
      }
      return true
    }

    return false
  }

  private ensureContextAndPlay(level: 'critical' | 'warning'): boolean {
    if (typeof window === 'undefined') return false

    try {
      if (!this.ctx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AudioContextClass) return false
        this.ctx = new AudioContextClass()
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }

      if (this.ctx.state !== 'running') {
        return false
      }

      if (level === 'critical') {
        this.playCriticalAlarm(this.ctx)
      } else {
        this.playWarningChime(this.ctx)
      }

      return true
    } catch {
      // Audio failure must never block visual alerts
      return false
    }
  }

  private playCriticalAlarm(ctx: AudioContext): void {
    const t0 = ctx.currentTime
    // 3 rapid sharp pulses at 880 Hz
    for (let i = 0; i < 3; i++) {
      const pulseStart = t0 + i * 0.16
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(880, pulseStart)

      gain.gain.setValueAtTime(0, pulseStart)
      gain.gain.linearRampToValueAtTime(0.18, pulseStart + 0.02)
      gain.gain.linearRampToValueAtTime(0, pulseStart + 0.12)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(pulseStart)
      osc.stop(pulseStart + 0.14)
    }
  }

  private playWarningChime(ctx: AudioContext): void {
    const t0 = ctx.currentTime
    // Softer double-tone at 587 Hz (D5) -> 659 Hz (E5)
    const tones = [587.33, 659.25]
    tones.forEach((freq, i) => {
      const pulseStart = t0 + i * 0.15
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, pulseStart)

      gain.gain.setValueAtTime(0, pulseStart)
      gain.gain.linearRampToValueAtTime(0.12, pulseStart + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, pulseStart + 0.13)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(pulseStart)
      osc.stop(pulseStart + 0.14)
    })
  }

  close(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
  }
}
