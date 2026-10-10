import { EAR_CLOSED_THRESHOLD, BLINK_MIN_DURATION_MS, BLINK_MAX_DURATION_MS, BLINK_RATE_WINDOW_MS } from '../config/constants'

type Sample = {
  t: number
  valid: boolean
}

export class BlinkTracker {
  private blinkTimestamps: number[] = []
  private closureStartTime: number | null = null
  private totalBlinks: number = 0
  private samples: Sample[] = []

  /**
   * Processes a single frame's EAR measurement.
   * A blink is counted when the eyes transition from closed to open,
   * AND the closure duration is between BLINK_MIN_DURATION_MS and BLINK_MAX_DURATION_MS.
   */
  addSample(timestampMs: number, ear: number | null): void {
    const valid = ear !== null
    this.samples.push({ t: timestampMs, valid })

    if (ear === null) {
      // If face tracking is lost, cancel any ongoing blink closure to avoid
      // interpreting long missing periods as a single long blink.
      this.closureStartTime = null
    } else {
      const isClosed = ear < EAR_CLOSED_THRESHOLD

      if (isClosed) {
        if (this.closureStartTime === null) {
          this.closureStartTime = timestampMs
        }
      } else {
        if (this.closureStartTime !== null) {
          const duration = timestampMs - this.closureStartTime
          if (duration >= BLINK_MIN_DURATION_MS && duration <= BLINK_MAX_DURATION_MS) {
            this.blinkTimestamps.push(timestampMs)
            this.totalBlinks++
          }
          this.closureStartTime = null
        }
      }
    }

    // Clean up old blinks outside the rate window
    const cutoff = timestampMs - BLINK_RATE_WINDOW_MS
    let firstKeepBlink = 0
    while (firstKeepBlink < this.blinkTimestamps.length && this.blinkTimestamps[firstKeepBlink] <= cutoff) {
      firstKeepBlink++
    }
    if (firstKeepBlink > 0) {
      this.blinkTimestamps = this.blinkTimestamps.slice(firstKeepBlink)
    }

    // Clean up old samples outside the rate window, keeping one prior sample for valid interval calculation
    let firstKeepSample = 0
    while (firstKeepSample < this.samples.length - 1 && this.samples[firstKeepSample + 1].t <= cutoff) {
      firstKeepSample++
    }
    if (firstKeepSample > 0) {
      this.samples = this.samples.slice(firstKeepSample)
    }
  }

  /** Gets total blinks counted since tracker initialization (or reset). */
  getTotalBlinks(): number {
    return this.totalBlinks
  }

  /**
   * Gets the blink rate per minute, calculated using actual valid observation time
   * within the rolling window.
   */
  getBlinkRate(now: number): number {
    if (this.samples.length < 2) return 0

    const windowStart = Math.max(now - BLINK_RATE_WINDOW_MS, this.samples[0].t)
    let observedMs = 0

    for (let i = 1; i < this.samples.length; i++) {
      const prev = this.samples[i - 1]
      const curr = this.samples[i]
      if (curr.t <= windowStart) continue

      const segStart = Math.max(prev.t, windowStart)
      const segDuration = curr.t - segStart

      // Only count segment if BOTH boundaries are valid, to exclude gaps.
      if (segDuration > 0 && curr.valid && prev.valid) {
        observedMs += segDuration
      }
    }

    if (observedMs <= 0) return 0
    const countInWindow = this.blinkTimestamps.length

    // Scale count to a per-minute rate based on valid observation duration
    return (countInWindow / observedMs) * 60_000
  }

  reset(): void {
    this.blinkTimestamps = []
    this.closureStartTime = null
    this.totalBlinks = 0
    this.samples = []
  }
}
