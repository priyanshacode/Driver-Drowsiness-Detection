import { describe, it, expect } from 'vitest'
import { computeMar } from './mar'

describe('computeMar', () => {
  it('should return valid MAR for standard mouth points', () => {
    const points = Array.from({ length: 468 }, () => ({ x: 0, y: 0 }))

    // horizontal = [78, 308]
    // verticalPairs = [[82, 87], [13, 14], [312, 317]]
    points[78] = { x: 0, y: 0 }
    points[308] = { x: 10, y: 0 }

    points[82] = { x: 2, y: 2 }; points[87] = { x: 2, y: -2 }
    points[13] = { x: 5, y: 2 }; points[14] = { x: 5, y: -2 }
    points[312] = { x: 8, y: 2 }; points[317] = { x: 8, y: -2 }

    const mar = computeMar(points)

    // horizontal = 10
    // meanVertical = (4 + 4 + 4) / 3 = 4
    // mar = 4 / 10 = 0.4
    expect(mar).toBeCloseTo(0.4)
  })

  it('should handle zero denominator (horizontal width = 0)', () => {
    const points = Array.from({ length: 468 }, () => ({ x: 0, y: 0 }))
    const mar = computeMar(points)
    expect(mar).toBe(0)
  })
})
