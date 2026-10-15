export type AlertLevel = 'normal' | 'warning' | 'critical' | 'tracking-lost'

export type DrowsinessAlert = {
  level: AlertLevel
  reason: string
}

export type BoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

export type CurrentMetrics = {
  timestamp: number
  faceDetected: boolean
  faceBox?: BoundingBox | null
  ear: { left: number; right: number; average: number } | null
  mar: number | null
  perclos: number | null
  headPose: { pitch: number; yaw: number; roll: number } | null
  alert?: DrowsinessAlert
}

export type RecordingSample = {
  timestamp: number
  elapsedTime: number
  faceDetected: boolean
  earLeft: number | null
  earRight: number | null
  earAverage: number | null
  mar: number | null
  perclos: number | null
  pitch: number | null
  yaw: number | null
  roll: number | null
  alertLevel?: AlertLevel
  alertReason?: string
  mobileViTScore?: number | null // Drowsy probability 0-100%
  mobileViTNonDrowsy?: number | null // Non-Drowsy probability 0-100%
  mobileViTLabel?: 'Drowsy' | 'Non Drowsy' | 'Uncertain' | null
  mobileViTLatencyMs?: number | null
}
