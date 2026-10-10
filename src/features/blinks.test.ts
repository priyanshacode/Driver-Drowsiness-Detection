import { describe, it, expect, beforeEach } from 'vitest'
import { BlinkTracker } from './blinks'
import { EAR_CLOSED_THRESHOLD, BLINK_MIN_DURATION_MS, BLINK_MAX_DURATION_MS } from '../config/constants'

describe('BlinkTracker', () => {
  let tracker: BlinkTracker

  beforeEach(() => {
    tracker = new BlinkTracker()
  })

  it('should initialize with zero blinks', () => {
    expect(tracker.getTotalBlinks()).toBe(0)
    expect(tracker.getBlinkRate(0)).toBe(0)
  })

  it('should count a normal blink within duration bounds', () => {
    tracker.addSample(0, EAR_CLOSED_THRESHOLD + 0.1) // open
    tracker.addSample(50, EAR_CLOSED_THRESHOLD - 0.1) // closed
    tracker.addSample(50 + BLINK_MIN_DURATION_MS + 10, EAR_CLOSED_THRESHOLD + 0.1) // open

    expect(tracker.getTotalBlinks()).toBe(1)
  })

  it('should ignore closures shorter than BLINK_MIN_DURATION_MS', () => {
    tracker.addSample(0, EAR_CLOSED_THRESHOLD + 0.1) // open
    tracker.addSample(50, EAR_CLOSED_THRESHOLD - 0.1) // closed
    tracker.addSample(50 + BLINK_MIN_DURATION_MS - 10, EAR_CLOSED_THRESHOLD + 0.1) // open too early

    expect(tracker.getTotalBlinks()).toBe(0)
  })

  it('should ignore closures longer than BLINK_MAX_DURATION_MS (prolonged closure)', () => {
    tracker.addSample(0, EAR_CLOSED_THRESHOLD + 0.1) // open
    tracker.addSample(50, EAR_CLOSED_THRESHOLD - 0.1) // closed
    tracker.addSample(50 + BLINK_MAX_DURATION_MS + 10, EAR_CLOSED_THRESHOLD + 0.1) // open too late

    expect(tracker.getTotalBlinks()).toBe(0)
  })

  it('should handle face loss safely and cancel ongoing blink', () => {
    tracker.addSample(0, EAR_CLOSED_THRESHOLD - 0.1) // closed
    tracker.addSample(50, null) // lost face
    tracker.addSample(50 + BLINK_MIN_DURATION_MS, EAR_CLOSED_THRESHOLD + 0.1) // open

    expect(tracker.getTotalBlinks()).toBe(0)
  })

  it('should calculate blink rate scaled by actual valid observation time', () => {
    // Simulate 10 seconds of valid tracking, during which 2 valid blinks happen
    const duration = 10_000

    tracker.addSample(0, EAR_CLOSED_THRESHOLD + 0.1) // Valid sample at t=0

    // Blink 1
    tracker.addSample(1000, EAR_CLOSED_THRESHOLD - 0.1)
    tracker.addSample(1000 + BLINK_MIN_DURATION_MS, EAR_CLOSED_THRESHOLD + 0.1)

    // Blink 2
    tracker.addSample(5000, EAR_CLOSED_THRESHOLD - 0.1)
    tracker.addSample(5000 + BLINK_MIN_DURATION_MS, EAR_CLOSED_THRESHOLD + 0.1)

    // End of 10s observation
    tracker.addSample(duration, EAR_CLOSED_THRESHOLD + 0.1)

    expect(tracker.getTotalBlinks()).toBe(2)

    // In 10 seconds, we had 2 blinks. Scaled to 60s, that's 12 blinks/min.
    expect(tracker.getBlinkRate(duration)).toBeCloseTo(12)
  })
})
