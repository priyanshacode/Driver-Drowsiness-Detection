/**
 * Basic head pose (pitch/yaw/roll) estimation.
 *
 * Rather than hand-rolling a solvePnP-style landmark-to-pose solver, this
 * uses the facial transformation matrix that the MediaPipe Face Landmarker
 * can output directly (`outputFacialTransformationMatrixes: true`). That
 * matrix already encodes the face's 3D rotation relative to the camera, so
 * pose reduces to a standard rotation-matrix -> Euler-angle decomposition.
 *
 * This is intentionally simple ("basic head pose estimation is sufficient"
 * for V1) but kept isolated here so it can be swapped for a more advanced
 * approach later without touching the rest of the pipeline.
 */

export type HeadPose = {
  pitch: number
  yaw: number
  roll: number
}

/** MediaPipe's Matrix type: row/column counts plus column-major data. */
export type MediaPipeMatrix = {
  rows: number
  columns: number
  data: number[] | Float32Array
}

function get(m: MediaPipeMatrix, row: number, col: number): number {
  // MediaPipe Matrix payloads are stored column-major.
  return m.data[col * m.rows + row]
}

const RAD_TO_DEG = 180 / Math.PI

/**
 * Decomposes the rotation component of the 4x4 facial transformation
 * matrix into pitch/yaw/roll (degrees), using the standard
 * rotation-matrix-to-Euler-angle formulation.
 */
export function computeHeadPose(matrix: MediaPipeMatrix): HeadPose {
  const r00 = get(matrix, 0, 0)
  const r10 = get(matrix, 1, 0)
  const r20 = get(matrix, 2, 0)
  const r21 = get(matrix, 2, 1)
  const r22 = get(matrix, 2, 2)

  const sy = Math.sqrt(r00 * r00 + r10 * r10)
  const singular = sy < 1e-6

  let pitch: number
  let yaw: number
  let roll: number

  if (!singular) {
    pitch = Math.atan2(r21, r22)
    yaw = Math.atan2(-r20, sy)
    roll = Math.atan2(r10, r00)
  } else {
    const r12 = get(matrix, 1, 2)
    const r11 = get(matrix, 1, 1)
    pitch = Math.atan2(-r12, r11)
    yaw = Math.atan2(-r20, sy)
    roll = 0
  }

  return {
    pitch: pitch * RAD_TO_DEG,
    yaw: yaw * RAD_TO_DEG,
    roll: roll * RAD_TO_DEG,
  }
}
