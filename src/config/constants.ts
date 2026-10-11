/**
 * Centralized configuration for DriveWatch V1.
 *
 * Keeping thresholds/windows here (rather than scattered through the
 * codebase) means the future calibration/personalization work can change
 * these values without touching calculation logic.
 */

/** EAR value below which an eye is considered "closed" for PERCLOS and closure detection. */
export const EAR_CLOSED_THRESHOLD = 0.2

/** Continuous eye-closure duration (ms) required to trigger a critical microsleep alert. */
export const PROLONGED_EYE_CLOSURE_MS = 1500

/**
 * Eye-opening recovery duration (ms) required to clear a critical prolonged-closure alert (hysteresis).
 * Prevents rapid alert flickering if the driver's eyelids flutter.
 */
export const EYE_CLOSURE_RECOVERY_MS = 800

/** PERCLOS rolling observation window, in milliseconds. */
export const PERCLOS_WINDOW_MS = 30_000

/**
 * Minimum amount of observed history (ms) required before PERCLOS is
 * reported. Avoids showing a misleadingly noisy percentage right after
 * startup. Per spec: do not estimate from the first 3-5 seconds.
 */
export const PERCLOS_WARMUP_MS = 5_000

/**
 * PERCLOS percentage threshold (0-100) above which an elevated fatigue warning is triggered.
 * Note: Prototype heuristic setting; not a clinically certified medical threshold.
 */
export const PERCLOS_ALERT_THRESHOLD = 15.0

/** MAR threshold above which mouth opening is considered a potential yawn. */
export const YAWN_MAR_THRESHOLD = 0.5

/** Minimum continuous duration (ms) of elevated MAR required to trigger a yawn secondary warning. */
export const YAWN_MIN_DURATION_MS = 2000

/** Cooldown duration (ms) between audible alarm bursts to prevent continuous screeching. */
export const AUDIO_ALERT_COOLDOWN_MS = 4000

/** Target sampling rate for the (in-memory only) recording buffer. */
export const RECORDING_SAMPLE_RATE_HZ = 10
export const RECORDING_SAMPLE_INTERVAL_MS = 1000 / RECORDING_SAMPLE_RATE_HZ

/** Visualization colors, matching the reference dashboard's palette. */
export const OVERLAY_COLORS = {
  eyes: '#22c55e',
  mouth: '#a855f7',
  headPose: '#3b82f6',
  mesh: 'rgba(59, 130, 246, 0.35)',
} as const

export type OverlayToggles = {
  eyes: boolean
  mouth: boolean
  headPose: boolean
  faceMesh: boolean
}

export const DEFAULT_OVERLAY_TOGGLES: OverlayToggles = {
  eyes: true,
  mouth: true,
  headPose: true,
  faceMesh: false,
}
