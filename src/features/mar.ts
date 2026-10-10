import { MOUTH_MAR } from './landmarkIndices'
import type { Point } from './ear'

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Mouth Aspect Ratio, averaged over three vertical landmark pairs and
 * normalized by mouth width (the same style of formulation as the 6-point
 * EAR, generalized to the mouth's inner-lip geometry):
 *
 * MAR = mean(verticalDistances) / horizontalDistance
 */
export function computeMar(landmarks: Point[]): number {
  const verticalDistances = MOUTH_MAR.verticalPairs.map(([a, b]) =>
    dist(landmarks[a], landmarks[b]),
  )
  const meanVertical =
    verticalDistances.reduce((sum, d) => sum + d, 0) / verticalDistances.length

  const [leftIdx, rightIdx] = MOUTH_MAR.horizontal
  const horizontal = dist(landmarks[leftIdx], landmarks[rightIdx])

  if (horizontal === 0) return 0
  return meanVertical / horizontal
}
