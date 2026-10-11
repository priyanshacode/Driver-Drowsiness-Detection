import {
  isValidCalibrationSample,
  computeBaselines,
  CalibrationTracker,
} from './calibration.ts'
import type { CurrentMetrics } from '../metrics/types.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

function makeMetrics(overrides: Partial<CurrentMetrics> = {}): CurrentMetrics {
  return {
    timestamp: 1000,
    faceDetected: true,
    ear: { left: 0.32, right: 0.30, average: 0.31 },
    mar: 0.15,
    perclos: 5.0,
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    ...overrides,
  }
}

export function runCalibrationTests(): { total: number; passed: number } {
  const tests: [string, () => void][] = [
    [
      'isValidCalibrationSample accepts valid face with positive finite EAR and MAR',
      () => {
        assert(isValidCalibrationSample(makeMetrics()), 'should accept valid metrics')
      },
    ],
    [
      'isValidCalibrationSample rejects sample when faceDetected is false',
      () => {
        assert(!isValidCalibrationSample(makeMetrics({ faceDetected: false })), 'should reject faceDetected=false')
      },
    ],
    [
      'isValidCalibrationSample rejects sample when ear is null or invalid',
      () => {
        assert(!isValidCalibrationSample(makeMetrics({ ear: null })), 'should reject ear=null')
        assert(!isValidCalibrationSample(makeMetrics({ ear: { left: 0, right: 0, average: 0 } })), 'should reject ear.average=0')
        assert(!isValidCalibrationSample(makeMetrics({ ear: { left: 0, right: 0, average: -0.1 } })), 'should reject negative ear')
        assert(!isValidCalibrationSample(makeMetrics({ ear: { left: 0, right: 0, average: Number.NaN } })), 'should reject NaN ear')
      },
    ],
    [
      'isValidCalibrationSample rejects sample when mar is null or invalid',
      () => {
        assert(!isValidCalibrationSample(makeMetrics({ mar: null })), 'should reject mar=null')
        assert(!isValidCalibrationSample(makeMetrics({ mar: 0 })), 'should reject mar=0')
        assert(!isValidCalibrationSample(makeMetrics({ mar: -0.2 })), 'should reject negative mar')
        assert(!isValidCalibrationSample(makeMetrics({ mar: Number.NaN })), 'should reject NaN mar')
      },
    ],
    [
      'computeBaselines computes arithmetic mean from collected samples',
      () => {
        const samples = {
          ear: [0.30, 0.32, 0.34],
          mar: [0.10, 0.20, 0.30],
        }
        const result = computeBaselines(samples, 3)
        assert(result !== null, 'result should not be null')
        assert(result!.sampleCount === 3, 'sample count should be 3')
        assert(Math.abs(result!.baseEar - 0.32) < 1e-6, 'baseEar mean should be 0.32')
        assert(Math.abs(result!.baseMar - 0.20) < 1e-6, 'baseMar mean should be 0.20')
      },
    ],
    [
      'computeBaselines returns null if sample count is below minimum',
      () => {
        const samples = {
          ear: [0.30, 0.32],
          mar: [0.10, 0.20],
        }
        assert(computeBaselines(samples, 5) === null, 'should return null when count < min')
      },
    ],
    [
      'CalibrationTracker accumulates valid time and advances progress towards 100%',
      () => {
        const tracker = new CalibrationTracker(5000, 5, 15000)
        tracker.start(0)

        const r1 = tracker.tick(1000, makeMetrics({ timestamp: 1000 }))
        assert(r1.status === 'in_progress', 'status should be in_progress')
        assert(r1.progress === 20, 'progress should be 20% at 1000ms')
        assert(r1.validSampleCount === 1, 'should have 1 sample')

        let tickResult = r1
        for (let t = 2000; t <= 5000; t += 1000) {
          tickResult = tracker.tick(t, makeMetrics({ timestamp: t }))
        }

        assert(tickResult.status === 'complete', 'status should be complete at 5000ms')
        assert(tickResult.progress === 100, 'progress should be 100%')
        assert(tickResult.validSampleCount === 5, 'should have 5 valid samples')
        assert(tickResult.result !== undefined, 'result should be defined')
        assert(tickResult.result!.baseEar > 0, 'baseEar should be > 0')
        assert(tickResult.result!.baseMar > 0, 'baseMar should be > 0')
      },
    ],
    [
      'CalibrationTracker does not advance progress or record samples when face is missing',
      () => {
        const tracker = new CalibrationTracker(5000, 5, 15000)
        tracker.start(0)

        tracker.tick(1000, makeMetrics({ timestamp: 1000 }))
        const prog1 = tracker.tick(1000, makeMetrics({ timestamp: 1000 })).progress

        const rMissing = tracker.tick(3000, makeMetrics({ faceDetected: false, timestamp: 3000 }))
        assert(rMissing.status === 'in_progress', 'status should be in_progress')
        assert(rMissing.progress === prog1, 'progress should not advance without face')
        assert(rMissing.validSampleCount === 1, 'sample count should not increase')

        const rReturn = tracker.tick(4000, makeMetrics({ faceDetected: true, timestamp: 4000 }))
        assert(rReturn.progress > prog1, 'progress should resume when face returns')
        assert(rReturn.validSampleCount === 2, 'sample count should increment')
      },
    ],
    [
      'CalibrationTracker rejects duplicate frames with identical timestamp',
      () => {
        const tracker = new CalibrationTracker(5000, 5, 15000)
        tracker.start(0)

        tracker.tick(16, makeMetrics({ timestamp: 100 }))
        tracker.tick(32, makeMetrics({ timestamp: 100 }))
        tracker.tick(48, makeMetrics({ timestamp: 100 }))

        assert(tracker.samples.ear.length === 1, 'duplicate timestamps should not be added')
      },
    ],
    [
      'CalibrationTracker times out if face is lost for too long',
      () => {
        const tracker = new CalibrationTracker(5000, 5, 15000)
        tracker.start(0)

        tracker.tick(1000, makeMetrics({ timestamp: 1000 }))
        const rTimeout = tracker.tick(16000, makeMetrics({ faceDetected: false, timestamp: 16000 }))
        assert(rTimeout.status === 'timeout', 'should timeout after 15s total elapsed without 5s valid')
        assert(rTimeout.error !== undefined, 'should have error message')
      },
    ],
    [
      'CalibrationTracker reports insufficient samples if 5000ms reached with too few unique samples',
      () => {
        const tracker = new CalibrationTracker(5000, 10, 15000)
        tracker.start(0)

        tracker.tick(2500, makeMetrics({ timestamp: 100 }))
        const rDone = tracker.tick(5000, makeMetrics({ timestamp: 200 }))

        assert(rDone.status === 'insufficient_samples', 'should fail when samples < minSamples')
        assert(rDone.error !== undefined, 'should have error message')
      },
    ],
  ]

  let passed = 0
  for (const [name, fn] of tests) {
    try {
      fn()
      passed++
      console.log(`  ✔ ${name}`)
    } catch (err) {
      console.error(`  ✖ ${name}:`, err)
    }
  }

  console.log(`\nTests: ${passed} passed, ${tests.length - passed} failed, ${tests.length} total`)
  if (passed !== tests.length) {
    throw new Error(`${tests.length - passed} test(s) failed`)
  }

  return { total: tests.length, passed }
}

runCalibrationTests()

