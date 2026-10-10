import { describe, it, expect } from 'vitest'
import { computeEar } from './ear'

describe('computeEar', () => {
  it('should return valid EAR for standard eye points', () => {
    // Creating dummy points. computeEar just uses specific indices.
    // 468 points total
    const points = Array.from({ length: 468 }, () => ({ x: 0, y: 0 }))

    // LEFT_EYE_EAR = [33, 160, 158, 133, 153, 144]
    // Make a square-ish eye: p1=(0,0), p4=(10,0). p2=(3,3), p6=(3,-3). p3=(7,3), p5=(7,-3)
    points[33] = { x: 0, y: 0 }
    points[160] = { x: 3, y: 3 }
    points[158] = { x: 7, y: 3 }
    points[133] = { x: 10, y: 0 }
    points[153] = { x: 7, y: -3 }
    points[144] = { x: 3, y: -3 }

    // RIGHT_EYE_EAR = [362, 385, 387, 263, 373, 380]
    // Same for right eye
    points[362] = { x: 0, y: 0 }
    points[385] = { x: 3, y: 3 }
    points[387] = { x: 7, y: 3 }
    points[263] = { x: 10, y: 0 }
    points[373] = { x: 7, y: -3 }
    points[380] = { x: 3, y: -3 }

    const ear = computeEar(points)

    // vertical = dist(p2, p6) + dist(p3, p5) = 6 + 6 = 12
    // horizontal = 2 * dist(p1, p4) = 2 * 10 = 20
    // ear = 12 / 20 = 0.6
    expect(ear.left).toBeCloseTo(0.6)
    expect(ear.right).toBeCloseTo(0.6)
    expect(ear.average).toBeCloseTo(0.6)
  })

  it('should handle zero denominator (horizontal width = 0)', () => {
    const points = Array.from({ length: 468 }, () => ({ x: 0, y: 0 }))
    const ear = computeEar(points)
    expect(ear.left).toBe(0)
    expect(ear.right).toBe(0)
    expect(ear.average).toBe(0)
  })
})
