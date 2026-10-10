import { RECORDING_SAMPLE_INTERVAL_MS } from '../config/constants'
import type { CurrentMetrics, RecordingSample } from '../metrics/types'

/**
 * Holds recording samples purely in memory for the current session.
 * V1 deliberately has no persistence: no CSV writer, no backend, no
 * storage. The sample shape mirrors what a future exporter would need,
 * so this buffer can be handed off later without redesigning it.
 */
export class RecordingBuffer {
  private samples: RecordingSample[] = []
  private startedAt: number | null = null
  private lastSampleAt: number | null = null

  start(now: number): void {
    this.samples = []
    this.startedAt = now
    this.lastSampleAt = null
  }

  /** Called on every processed frame; only records at ~10 Hz. */
  maybeAddSample(metrics: CurrentMetrics): void {
    if (this.startedAt === null) return
    if (!metrics.faceDetected || !metrics.ear || metrics.mar === null || !metrics.headPose) return

    if (
      this.lastSampleAt !== null &&
      metrics.timestamp - this.lastSampleAt < RECORDING_SAMPLE_INTERVAL_MS
    ) {
      return
    }

    this.lastSampleAt = metrics.timestamp
    this.samples.push({
      timestamp: metrics.timestamp,
      elapsedTime: metrics.timestamp - this.startedAt,
      earLeft: metrics.ear.left,
      earRight: metrics.ear.right,
      earAverage: metrics.ear.average,
      mar: metrics.mar,
      perclos: metrics.perclos,
      blinkCount: metrics.blinkCount,
      blinkRate: metrics.blinkRate,
      pitch: metrics.headPose.pitch,
      yaw: metrics.headPose.yaw,
      roll: metrics.headPose.roll,
    })
  }

  stop(): { samples: RecordingSample[]; durationMs: number } {
    const durationMs = this.startedAt !== null ? (this.lastSampleAt ?? this.startedAt) - this.startedAt : 0
    const samples = this.samples
    return { samples, durationMs }
  }

  discard(): void {
    this.samples = []
    this.startedAt = null
    this.lastSampleAt = null
  }

  get sampleCount(): number {
    return this.samples.length
  }
}
