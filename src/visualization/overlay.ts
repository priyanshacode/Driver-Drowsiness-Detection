import { FaceLandmarker } from '@mediapipe/tasks-vision'
import { OVERLAY_COLORS, type OverlayToggles } from '../config/constants'
import { LEFT_EYE_OUTLINE, MOUTH_OUTLINE, NOSE_TIP, RIGHT_EYE_OUTLINE } from '../features/landmarkIndices'
import type { Point } from '../features/ear'
import type { HeadPose } from '../features/headPose'

/**
 * Draws visualization overlays onto a canvas positioned over the video.
 * Purely visual - these toggles never affect the underlying calculations,
 * which run regardless of what is drawn here.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  landmarks: Point[],
  toggles: OverlayToggles,
  headPose: HeadPose | null,
): void {
  ctx.clearRect(0, 0, width, height)

  if (toggles.faceMesh) {
    drawMesh(ctx, width, height, landmarks)
  }
  if (toggles.eyes) {
    drawOutline(ctx, width, height, landmarks, LEFT_EYE_OUTLINE, OVERLAY_COLORS.eyes)
    drawOutline(ctx, width, height, landmarks, RIGHT_EYE_OUTLINE, OVERLAY_COLORS.eyes)
  }
  if (toggles.mouth) {
    drawOutline(ctx, width, height, landmarks, MOUTH_OUTLINE, OVERLAY_COLORS.mouth)
  }
  if (toggles.headPose && headPose) {
    drawHeadPoseAxis(ctx, width, height, landmarks, headPose)
  }
}

function toPixel(p: Point, width: number, height: number) {
  return { x: p.x * width, y: p.y * height }
}

function drawOutline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  landmarks: Point[],
  indices: readonly number[] | number[],
  color: string,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  indices.forEach((idx, i) => {
    const { x, y } = toPixel(landmarks[idx], width, height)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.stroke()

  ctx.fillStyle = color
  indices.forEach((idx) => {
    const { x, y } = toPixel(landmarks[idx], width, height)
    ctx.beginPath()
    ctx.arc(x, y, 1.6, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawMesh(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  landmarks: Point[],
) {
  ctx.strokeStyle = OVERLAY_COLORS.mesh
  ctx.lineWidth = 1
  const connections = FaceLandmarker.FACE_LANDMARKS_TESSELATION
  ctx.beginPath()
  for (const conn of connections) {
    const a = toPixel(landmarks[conn.start], width, height)
    const b = toPixel(landmarks[conn.end], width, height)
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()
}

/** Draws a simple 3-axis indicator at the nose tip, oriented by yaw/pitch. */
function drawHeadPoseAxis(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  landmarks: Point[],
  headPose: HeadPose,
) {
  const origin = toPixel(landmarks[NOSE_TIP], width, height)
  const len = width * 0.08

  const yawRad = (headPose.yaw * Math.PI) / 180
  const pitchRad = (headPose.pitch * Math.PI) / 180
  const rollRad = (headPose.roll * Math.PI) / 180

  // Forward (blue) axis: projects yaw/pitch onto the image plane.
  const forward = {
    x: origin.x + Math.sin(yawRad) * len,
    y: origin.y - Math.sin(pitchRad) * len,
  }
  // Up (green) axis: rotated by roll.
  const up = {
    x: origin.x + Math.sin(rollRad) * len * 0.6,
    y: origin.y - Math.cos(rollRad) * len * 0.6,
  }
  // Side (red) axis: perpendicular to up.
  const side = {
    x: origin.x + Math.cos(rollRad) * len * 0.6,
    y: origin.y + Math.sin(rollRad) * len * 0.6,
  }

  ctx.lineWidth = 3
  ctx.strokeStyle = '#3b82f6'
  drawArrow(ctx, origin, forward)
  ctx.strokeStyle = '#22c55e'
  drawArrow(ctx, origin, up)
  ctx.strokeStyle = '#ef4444'
  drawArrow(ctx, origin, side)
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
}
