import { EAR_CLOSED_THRESHOLD, PERCLOS_WARMUP_MS, PERCLOS_WINDOW_MS } from '../config/constants'

type Sample = {
  /** ms timestamp */
  t: number
  closed: boolean
}

/**
 * Time-based PERCLOS tracker using a rolling window.
 *
 * PERCLOS = closed-eye duration / total observed duration * 100
 *
 * Implemented by accumulating (timestamp, closed) samples and, on each
 * query, summing the *duration* between consecutive samples that fall
 * within the trailing window - not by counting frames. This keeps the
 * result correct even if the processing frame rate fluctuates.
 */
export class PerclosTracker {
  private samples: Sample[] = []
  private startTime: number | null = null

  /** Record one observation (called once per processed frame). */
  addSample(timestampMs: number, ear: number | null): void {
    if (this.startTime === null) this.startTime = timestampMs

    const closed = ear !== null && ear < EAR_CLOSED_THRESHOLD
    this.samples.push({ t: timestampMs, closed })

    const cutoff = timestampMs - PERCLOS_WINDOW_MS
    // Keep one sample before the cutoff so the earliest interval in the
    // window can still be measured accurately.
    let firstKeep = 0
    while (
      firstKeep < this.samples.length - 1 &&
      this.samples[firstKeep + 1].t <= cutoff
    ) {
      firstKeep++
    }
    if (firstKeep > 0) this.samples = this.samples.slice(firstKeep)
  }

  /** Returns the PERCLOS percentage (0-100), or null while still warming up. */
  getPerclos(now: number): number | null {
    if (this.startTime === null) return null
    if (now - this.startTime < PERCLOS_WARMUP_MS) return null
    if (this.samples.length < 2) return null

    const windowStart = Math.max(now - PERCLOS_WINDOW_MS, this.startTime)

    let closedMs = 0
    let observedMs = 0

    for (let i = 1; i < this.samples.length; i++) {
      const prev = this.samples[i - 1]
      const curr = this.samples[i]
      if (curr.t <= windowStart) continue

      const segStart = Math.max(prev.t, windowStart)
      const segDuration = curr.t - segStart
      if (segDuration <= 0) continue

      observedMs += segDuration
      // The eye state during a segment is attributed from the sample at
      // the end of that segment (closest available observation).
      if (curr.closed) closedMs += segDuration
    }

    if (observedMs <= 0) return null
    return (closedMs / observedMs) * 100
  }

  reset(): void {
    this.samples = []
    this.startTime = null
  }
}
