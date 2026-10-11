import {
  EAR_CLOSED_THRESHOLD,
  PROLONGED_EYE_CLOSURE_MS,
  EYE_CLOSURE_RECOVERY_MS,
  PERCLOS_ALERT_THRESHOLD,
  YAWN_MAR_THRESHOLD,
  YAWN_MIN_DURATION_MS,
} from '../config/constants.ts'
import type { AlertLevel, DrowsinessAlert, CurrentMetrics } from '../metrics/types.ts'

/**
 * Detailed telemetry state returned by the evaluator.
 */
export type DrowsinessEvaluation = DrowsinessAlert & {
  isEyeClosed: boolean
  closureDurationMs: number
  prolongedClosureActive: boolean
  elevatedPerclosActive: boolean
  sustainedYawnActive: boolean
  yawnDurationMs: number
}

/**
 * State-based drowsiness rule evaluator.
 *
 * PROTOTYPE NOTICE & LIMITATION:
 * The thresholds and heuristics implemented here (e.g. 1.5s continuous closure, 15% PERCLOS)
 * are experimental engineering prototype heuristics for developer evaluation and driver assistance
 * exploration. They are NOT certified medical, safety-critical, or clinical diagnostic thresholds.
 */
export class DrowsinessEvaluator {
  private eyeClosureStartTime: number | null = null
  private prolongedClosureTriggered = false
  private recoveryStartTime: number | null = null

  private yawnStartTime: number | null = null
  private yawnActive = false

  readonly prolongedClosureThresholdMs: number
  readonly eyeClosureRecoveryMs: number
  readonly perclosAlertThreshold: number
  readonly yawnMarThreshold: number
  readonly yawnMinDurationMs: number
  readonly earClosedThreshold: number

  constructor(options?: {
    prolongedClosureThresholdMs?: number
    eyeClosureRecoveryMs?: number
    perclosAlertThreshold?: number
    yawnMarThreshold?: number
    yawnMinDurationMs?: number
    earClosedThreshold?: number
  }) {
    this.prolongedClosureThresholdMs = options?.prolongedClosureThresholdMs ?? PROLONGED_EYE_CLOSURE_MS
    this.eyeClosureRecoveryMs = options?.eyeClosureRecoveryMs ?? EYE_CLOSURE_RECOVERY_MS
    this.perclosAlertThreshold = options?.perclosAlertThreshold ?? PERCLOS_ALERT_THRESHOLD
    this.yawnMarThreshold = options?.yawnMarThreshold ?? YAWN_MAR_THRESHOLD
    this.yawnMinDurationMs = options?.yawnMinDurationMs ?? YAWN_MIN_DURATION_MS
    this.earClosedThreshold = options?.earClosedThreshold ?? EAR_CLOSED_THRESHOLD
  }

  evaluate(
    now: number,
    metrics: Pick<CurrentMetrics, 'faceDetected' | 'ear' | 'mar' | 'perclos' | 'headPose'>
  ): DrowsinessEvaluation {
    // Rule 1: Handle face-lost condition safely.
    // NEVER interpret a missing face as closed eyes or a drowsiness state.
    if (!metrics.faceDetected) {
      this.resetTimers()
      return {
        level: 'tracking-lost',
        reason: 'Face tracking lost — please reposition within camera view',
        isEyeClosed: false,
        closureDurationMs: 0,
        prolongedClosureActive: false,
        elevatedPerclosActive: false,
        sustainedYawnActive: false,
        yawnDurationMs: 0,
      }
    }

    // Evaluate eye state
    const earVal = metrics.ear?.average ?? null
    const isClosed = earVal !== null && earVal < this.earClosedThreshold

    let closureDurationMs = 0
    if (isClosed) {
      if (this.eyeClosureStartTime === null) {
        this.eyeClosureStartTime = now
      }
      closureDurationMs = Math.max(0, now - this.eyeClosureStartTime)
      this.recoveryStartTime = null // Reset recovery timer while eyes remain closed

      if (closureDurationMs >= this.prolongedClosureThresholdMs) {
        this.prolongedClosureTriggered = true
      }
    } else {
      // Eyes are open. If a prolonged closure alert was triggered, apply hysteresis debounce:
      // Require eyes to remain continuously open for eyeClosureRecoveryMs before clearing the alert.
      if (this.prolongedClosureTriggered) {
        if (this.recoveryStartTime === null) {
          this.recoveryStartTime = now
        }
        const openDuration = now - this.recoveryStartTime
        if (openDuration >= this.eyeClosureRecoveryMs) {
          this.prolongedClosureTriggered = false
          this.recoveryStartTime = null
          this.eyeClosureStartTime = null
        }
      } else {
        this.eyeClosureStartTime = null
        this.recoveryStartTime = null
      }
    }

    // Evaluate yawn state (Secondary indicator)
    const marVal = metrics.mar
    let yawnDurationMs = 0
    if (marVal !== null && marVal >= this.yawnMarThreshold) {
      if (this.yawnStartTime === null) {
        this.yawnStartTime = now
      }
      yawnDurationMs = Math.max(0, now - this.yawnStartTime)
      if (yawnDurationMs >= this.yawnMinDurationMs) {
        this.yawnActive = true
      }
    } else {
      this.yawnStartTime = null
      this.yawnActive = false
    }

    // Evaluate PERCLOS (Sustained fatigue indicator)
    // Only valid after warmup period (when perclos !== null and valid observation history exists).
    const perclosVal = metrics.perclos
    const elevatedPerclos =
      perclosVal !== null &&
      Number.isFinite(perclosVal) &&
      perclosVal >= this.perclosAlertThreshold

    // Hierarchy of decisions
    let level: AlertLevel = 'normal'
    let reason = 'Driver alert — normal facial telemetry'

    if (this.prolongedClosureTriggered) {
      level = 'critical'
      reason = `Critical: Prolonged eye closure detected (${(closureDurationMs / 1000).toFixed(1)}s microsleep hazard)`
    } else if (elevatedPerclos) {
      level = 'warning'
      reason = `Elevated PERCLOS (${perclosVal.toFixed(1)}%) — sustained eye closure rate`
    } else if (this.yawnActive) {
      level = 'warning'
      reason = `Secondary warning: Sustained yawning detected (${(yawnDurationMs / 1000).toFixed(1)}s)`
    }

    return {
      level,
      reason,
      isEyeClosed: isClosed,
      closureDurationMs,
      prolongedClosureActive: this.prolongedClosureTriggered,
      elevatedPerclosActive: elevatedPerclos,
      sustainedYawnActive: this.yawnActive,
      yawnDurationMs,
    }
  }

  reset(): void {
    this.resetTimers()
  }

  private resetTimers(): void {
    this.eyeClosureStartTime = null
    this.prolongedClosureTriggered = false
    this.recoveryStartTime = null
    this.yawnStartTime = null
    this.yawnActive = false
  }
}
