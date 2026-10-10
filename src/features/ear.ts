import { LEFT_EYE_EAR, RIGHT_EYE_EAR } from './landmarkIndices'

export type Point = { x: number; y: number; z?: number }

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Standard geometric Eye Aspect Ratio for a 6-point eye contour:
 * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 */
function eyeAspectRatio(points: Point[]): number {
  const [p1, p2, p3, p4, p5, p6] = points
  const vertical = dist(p2, p6) + dist(p3, p5)
  const horizontal = 2 * dist(p1, p4)
  if (horizontal === 0) return 0
  return vertical / horizontal
}

export type EarResult = {
  left: number
  right: number
  average: number
}

/**
 * Computes left/right/average EAR from the full 468-point landmark list.
 * `landmarks` are normalized [0,1] image-space coordinates as returned by
 * the MediaPipe Face Landmarker.
 */
export function computeEar(landmarks: Point[]): EarResult {
  const left = eyeAspectRatio(LEFT_EYE_EAR.map((i) => landmarks[i]))
  const right = eyeAspectRatio(RIGHT_EYE_EAR.map((i) => landmarks[i]))
  return { left, right, average: (left + right) / 2 }
}
