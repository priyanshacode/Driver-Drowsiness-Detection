export type CurrentMetrics = {
  timestamp: number
  faceDetected: boolean
  ear: { left: number; right: number; average: number } | null
  mar: number | null
  perclos: number | null
  blinkCount: number
  blinkRate: number
  headPose: { pitch: number; yaw: number; roll: number } | null
}

export type RecordingSample = {
  timestamp: number
  elapsedTime: number
  earLeft: number
  earRight: number
  earAverage: number
  mar: number
  perclos: number | null
  blinkCount: number
  blinkRate: number
  pitch: number
  yaw: number
  roll: number
}
