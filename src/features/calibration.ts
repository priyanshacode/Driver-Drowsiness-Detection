import type { CurrentMetrics } from '../metrics/types'

export type CalibrationResult = {
  baseEar: number
  baseMar: number
  sampleCount: number
}

export type CalibrationTickResult = {
  status: 'in_progress' | 'complete' | 'timeout' | 'insufficient_samples'
  progress: number
  validSampleCount: number
  result?: CalibrationResult
  error?: string
}

export function isValidCalibrationSample(metrics: CurrentMetrics | null | undefined): boolean {
  if (!metrics || !metrics.faceDetected) return false
  if (!metrics.ear || typeof metrics.ear.average !== 'number') return false
  if (!Number.isFinite(metrics.ear.average) || metrics.ear.average <= 0) return false
  if (typeof metrics.mar !== 'number' || !Number.isFinite(metrics.mar) || metrics.mar <= 0) return false
  return true
}

export function computeBaselines(
  samples: { ear: number[]; mar: number[] },
  minSamples = 20
): CalibrationResult | null {
  if (samples.ear.length < minSamples || samples.mar.length < minSamples) {
    return null
  }
  const sumEar = samples.ear.reduce((acc, v) => acc + v, 0)
  const sumMar = samples.mar.reduce((acc, v) => acc + v, 0)
  return {
    baseEar: sumEar / samples.ear.length,
    baseMar: sumMar / samples.mar.length,
    sampleCount: samples.ear.length,
  }
}

export class CalibrationTracker {
  readonly targetDurationMs: number
  readonly minSamples: number
  readonly maxTimeoutMs: number

  private accumulatedValidMs = 0
  private totalElapsedMs = 0
  private lastTickTime = 0
  private lastSampleTimestamp = -1

  readonly samples: { ear: number[]; mar: number[] } = { ear: [], mar: [] }

  constructor(targetDurationMs = 5000, minSamples = 20, maxTimeoutMs = 15000) {
    this.targetDurationMs = targetDurationMs
    this.minSamples = minSamples
    this.maxTimeoutMs = maxTimeoutMs
  }

  start(now: number) {
    this.accumulatedValidMs = 0
    this.totalElapsedMs = 0
    this.lastTickTime = now
    this.lastSampleTimestamp = -1
    this.samples.ear.length = 0
    this.samples.mar.length = 0
  }

  tick(now: number, metrics: CurrentMetrics): CalibrationTickResult {
    const dt = Math.max(0, now - this.lastTickTime)
    this.lastTickTime = now
    this.totalElapsedMs += dt

    const isValid = isValidCalibrationSample(metrics)

    if (isValid) {
      this.accumulatedValidMs += dt
      if (metrics.timestamp !== this.lastSampleTimestamp) {
        this.lastSampleTimestamp = metrics.timestamp
        this.samples.ear.push(metrics.ear!.average)
        this.samples.mar.push(metrics.mar!)
      }
    }

    const progress = Math.min(100, (this.accumulatedValidMs / this.targetDurationMs) * 100)

    if (this.totalElapsedMs >= this.maxTimeoutMs && this.accumulatedValidMs < this.targetDurationMs) {
      return {
        status: 'timeout',
        progress,
        validSampleCount: this.samples.ear.length,
        error: 'Calibration timed out. Face was not continuously visible. Please keep your face aligned with the camera and try again.',
      }
    }

    if (this.accumulatedValidMs >= this.targetDurationMs) {
      const baselines = computeBaselines(this.samples, this.minSamples)
      if (baselines) {
        return {
          status: 'complete',
          progress: 100,
          validSampleCount: this.samples.ear.length,
          result: baselines,
        }
      } else {
        return {
          status: 'insufficient_samples',
          progress: 100,
          validSampleCount: this.samples.ear.length,
          error: `Insufficient valid samples collected (${this.samples.ear.length} / ${this.minSamples} required). Please maintain a neutral resting face and try again.`,
        }
      }
    }

    return {
      status: 'in_progress',
      progress,
      validSampleCount: this.samples.ear.length,
    }
  }
}
