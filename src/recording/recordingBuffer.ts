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

  /** Called on every processed frame; records at ~10 Hz including tracking loss and ML telemetry. */
  maybeAddSample(
    metrics: CurrentMetrics,
    mobileViT?: {
      drowsyProbability: number
      nonDrowsyProbability: number
      label: 'Drowsy' | 'Non Drowsy' | 'Uncertain'
      inferenceTimeMs: number
    } | null,
  ): void {
    if (this.startedAt === null) return

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
      faceDetected: metrics.faceDetected,
      earLeft: metrics.ear?.left ?? null,
      earRight: metrics.ear?.right ?? null,
      earAverage: metrics.ear?.average ?? null,
      mar: metrics.mar ?? null,
      perclos: metrics.perclos ?? null,
      pitch: metrics.headPose?.pitch ?? null,
      yaw: metrics.headPose?.yaw ?? null,
      roll: metrics.headPose?.roll ?? null,
      alertLevel: metrics.alert?.level,
      alertReason: metrics.alert?.reason,
      mobileViTScore: mobileViT?.drowsyProbability ?? null,
      mobileViTNonDrowsy: mobileViT?.nonDrowsyProbability ?? null,
      mobileViTLabel: mobileViT?.label ?? null,
      mobileViTLatencyMs: mobileViT?.inferenceTimeMs ?? null,
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
