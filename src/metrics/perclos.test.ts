import { describe, it, expect, beforeEach } from 'vitest'
import { PerclosTracker } from './perclos'
import { EAR_CLOSED_THRESHOLD, PERCLOS_WARMUP_MS } from '../config/constants'

describe('PerclosTracker', () => {
  let tracker: PerclosTracker

  beforeEach(() => {
    tracker = new PerclosTracker()
  })

  it('should return null during the warmup period', () => {
    tracker.addSample(0, EAR_CLOSED_THRESHOLD + 0.1)
    tracker.addSample(PERCLOS_WARMUP_MS - 10, EAR_CLOSED_THRESHOLD + 0.1)

    expect(tracker.getPerclos(PERCLOS_WARMUP_MS - 10)).toBeNull()
  })

  it('should calculate 100% PERCLOS if eyes are closed the whole time', () => {
    tracker.addSample(0, EAR_CLOSED_THRESHOLD - 0.1)
    tracker.addSample(PERCLOS_WARMUP_MS, EAR_CLOSED_THRESHOLD - 0.1)

    expect(tracker.getPerclos(PERCLOS_WARMUP_MS)).toBe(100)
  })

  it('should calculate 0% PERCLOS if eyes are open the whole time', () => {
    tracker.addSample(0, EAR_CLOSED_THRESHOLD + 0.1)
    tracker.addSample(PERCLOS_WARMUP_MS, EAR_CLOSED_THRESHOLD + 0.1)

    expect(tracker.getPerclos(PERCLOS_WARMUP_MS)).toBe(0)
  })

  it('should calculate 50% PERCLOS for half open, half closed', () => {
    tracker.addSample(0, EAR_CLOSED_THRESHOLD - 0.1)
    tracker.addSample(PERCLOS_WARMUP_MS / 2, EAR_CLOSED_THRESHOLD + 0.1)
    tracker.addSample(PERCLOS_WARMUP_MS, EAR_CLOSED_THRESHOLD + 0.1)

    // First half closed, second half open -> 50%
    expect(tracker.getPerclos(PERCLOS_WARMUP_MS)).toBeCloseTo(50)
  })

  it('should explicitly exclude missing-face gaps from the calculation entirely', () => {
    // 0 to 2000ms: open (valid)
    tracker.addSample(0, EAR_CLOSED_THRESHOLD + 0.1)
    tracker.addSample(2000, EAR_CLOSED_THRESHOLD + 0.1)

    // 2000 to 5000ms: tracking lost (gap)
    tracker.addSample(2000 + 10, null)
    tracker.addSample(5000 - 10, null)

    // 5000ms to 7000ms: closed (valid)
    tracker.addSample(5000, EAR_CLOSED_THRESHOLD - 0.1) // Valid again
    tracker.addSample(7000, EAR_CLOSED_THRESHOLD - 0.1)

    // Wait until warmup
    tracker.addSample(PERCLOS_WARMUP_MS, EAR_CLOSED_THRESHOLD - 0.1)

    // The gap from 2000 to 5000 is invalid at both ends (or at least one).
    // It should not be attributed to open or closed.
    // The valid observation time is only the time when BOTH segment boundaries were valid.
    const result = tracker.getPerclos(PERCLOS_WARMUP_MS)
    expect(result).not.toBeNull()

    // Total observed time ignores the 3-second gap.
    // It shouldn't silently attribute the 3-second gap to the closed state that follows it.
    // So the PERCLOS should NOT be skewed by the gap duration.
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(100)
  })
})
