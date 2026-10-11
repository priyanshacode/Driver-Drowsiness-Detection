export type AlertLevel = 'normal' | 'warning' | 'critical' | 'tracking-lost'

export type DrowsinessAlert = {
  level: AlertLevel
  reason: string
}

export type CurrentMetrics = {
  timestamp: number
  faceDetected: boolean
  ear: { left: number; right: number; average: number } | null
  mar: number | null
  perclos: number | null
  headPose: { pitch: number; yaw: number; roll: number } | null
  alert?: DrowsinessAlert
}

export type RecordingSample = {
  timestamp: number
  elapsedTime: number
  earLeft: number
  earRight: number
  earAverage: number
  mar: number
  perclos: number | null
  pitch: number
  yaw: number
  roll: number
}
