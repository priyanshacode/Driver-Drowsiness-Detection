import {
  calculateFaceCropBox,
  normalizeRgbPixel,
  softmax2,
  smoothPrediction,
  evaluateTemporalPolicy,
} from './mobileViTService.ts'
import type { BoundingBox } from '../metrics/types.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

export function runMobileViTUnitTests(): { total: number; passed: number } {
  const tests: [string, () => void][] = [
    [
      'calculateFaceCropBox generates square crop with 35% margin around face',
      () => {
        const faceBox: BoundingBox = { x: 0.4, y: 0.3, width: 0.2, height: 0.4 }
        const crop = calculateFaceCropBox(1280, 720, faceBox)

        assert(crop.sWidth === crop.sHeight, 'crop must be square')
        assert(crop.sWidth > 288, 'crop must expand with margin around the face')
        assert(crop.sx >= 0 && crop.sy >= 0, 'crop must stay within upper bounds')
        assert(crop.sx + crop.sWidth <= 1280, 'crop must not exceed video width')
        assert(crop.sy + crop.sHeight <= 720, 'crop must not exceed video height')
      },
    ],
    [
      'calculateFaceCropBox clamps properly near image boundaries',
      () => {
        const nearEdgeBox: BoundingBox = { x: 0.01, y: 0.01, width: 0.3, height: 0.3 }
        const crop = calculateFaceCropBox(1280, 720, nearEdgeBox)

        assert(crop.sx >= 0, 'sx must be non-negative')
        assert(crop.sy >= 0, 'sy must be non-negative')
        assert(crop.sWidth === crop.sHeight, 'boundary crop must remain square')
      },
    ],
    [
      'calculateFaceCropBox falls back to center-square crop when faceBox is null or invalid',
      () => {
        const cropNull = calculateFaceCropBox(1280, 720, null)
        assert(cropNull.sWidth === 720, 'fallback width must equal min dimension 720')
        assert(cropNull.sHeight === 720, 'fallback height must equal min dimension 720')
        assert(cropNull.sx === (1280 - 720) / 2, 'fallback sx must be centered horizontally')
        assert(cropNull.sy === 0, 'fallback sy must be 0')

        const cropInvalid = calculateFaceCropBox(1280, 720, { x: 0, y: 0, width: 0, height: 0 })
        assert(cropInvalid.sWidth === 720, 'invalid box should fallback to center crop')
      },
    ],
    [
      'normalizeRgbPixel applies ImageNet mean and std correctly',
      () => {
        const [r0, g0, b0] = normalizeRgbPixel(0, 0, 0)
        assert(Math.abs(r0 - (-0.485 / 0.229)) < 1e-4, 'black red normalization')
        assert(Math.abs(g0 - (-0.456 / 0.224)) < 1e-4, 'black green normalization')
        assert(Math.abs(b0 - (-0.406 / 0.225)) < 1e-4, 'black blue normalization')

        const [r255, g255, b255] = normalizeRgbPixel(255, 255, 255)
        assert(Math.abs(r255 - ((1 - 0.485) / 0.229)) < 1e-4, 'white red normalization')
        assert(Math.abs(g255 - ((1 - 0.456) / 0.224)) < 1e-4, 'white green normalization')
        assert(Math.abs(b255 - ((1 - 0.406) / 0.225)) < 1e-4, 'white blue normalization')
      },
    ],
    [
      'softmax2 verifies class 0 is Drowsy and class 1 is Non Drowsy',
      () => {
        const eq = softmax2(2.5, 2.5)
        assert(Math.abs(eq.prob0 - 0.5) < 1e-5, 'equal logits should produce 0.5')
        assert(Math.abs(eq.prob1 - 0.5) < 1e-5, 'equal logits should produce 0.5')

        // High class 0 logit -> Drowsy
        const drowsy = softmax2(4.0, 0.0)
        assert(drowsy.prob0 > 0.98, 'high class 0 logit should give >98% probability')
        assert(drowsy.prob1 < 0.02, 'low class 1 logit should give <2% probability')

        // High class 1 logit -> Non Drowsy
        const nonDrowsy = softmax2(0.0, 4.0)
        assert(nonDrowsy.prob1 > 0.98, 'high class 1 logit should give >98% probability')
        assert(nonDrowsy.prob0 < 0.02, 'low class 0 logit should give <2% probability')
      },
    ],
    [
      'smoothPrediction damps single-frame fluctuations',
      () => {
        const first = smoothPrediction(null, 0.2, 0.5)
        assert(first === 0.2, 'first sample without history returns raw value')

        const smoothed = smoothPrediction(first, 0.8, 0.5)
        assert(Math.abs(smoothed - 0.5) < 1e-4, 'smoothing should damp spike to 0.5')

        const smoothed2 = smoothPrediction(smoothed, 0.8, 0.5)
        assert(Math.abs(smoothed2 - 0.65) < 1e-4, 'sustained value progressively climbs')
      },
    ],
    [
      'evaluateTemporalPolicy requires sustained evidence (>=3 frames) before declaring Drowsy',
      () => {
        // 1. Normal awake driver with low drowsy prob (0.20)
        const awake = evaluateTemporalPolicy(0.20, 0)
        assert(awake.label === 'Non Drowsy', '0.20 should classify as Non Drowsy')
        assert(awake.temporalState === 'alert', 'should be in alert state')
        assert(awake.newSustainedCount === 0, 'sustained count should be 0')

        // 2. Ambiguous weak score (0.55): must NOT classify as Drowsy!
        const weak = evaluateTemporalPolicy(0.55, 0)
        assert(weak.label === 'Uncertain', '0.55 weak score must classify as Uncertain, NOT Drowsy')
        assert(weak.temporalState === 'inconclusive', 'should be inconclusive')
        assert(weak.newSustainedCount === 0, 'sustained count should remain 0')

        // 3. Frame 1 of elevated score (0.75): must NOT declare Drowsy immediately!
        const frame1 = evaluateTemporalPolicy(0.75, 0)
        assert(frame1.label === 'Uncertain', 'frame 1 of high score must report Uncertain/Evaluating')
        assert(frame1.temporalState === 'evaluating_evidence', 'state must be evaluating_evidence')
        assert(frame1.newSustainedCount === 1, 'sustained count should advance to 1')

        // 4. Frame 2 of elevated score (0.75): still evaluating
        const frame2 = evaluateTemporalPolicy(0.75, frame1.newSustainedCount)
        assert(frame2.label === 'Uncertain', 'frame 2 of high score must remain Uncertain/Evaluating')
        assert(frame2.newSustainedCount === 2, 'sustained count should advance to 2')

        // 5. Frame 3 of sustained elevated score (0.75): declares Drowsy!
        const frame3 = evaluateTemporalPolicy(0.75, frame2.newSustainedCount)
        assert(frame3.label === 'Drowsy', 'frame 3 of sustained score must declare Drowsy')
        assert(frame3.temporalState === 'sustained_drowsy', 'state must be sustained_drowsy')
        assert(frame3.newSustainedCount === 3, 'sustained count should be 3')

        // 6. Driver opens eyes (prob drops to 0.35): immediately clears back to Non Drowsy
        const recovered = evaluateTemporalPolicy(0.35, frame3.newSustainedCount)
        assert(recovered.label === 'Non Drowsy', 'recovery must immediately clear to Non Drowsy')
        assert(recovered.newSustainedCount === 0, 'sustained count must reset to 0')
        assert(recovered.temporalState === 'alert', 'state must return to alert')
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

  console.log(`\nMobileViT Tests: ${passed} passed, ${tests.length - passed} failed, ${tests.length} total`)
  if (passed !== tests.length) {
    throw new Error(`${tests.length - passed} test(s) failed`)
  }

  return { total: tests.length, passed }
}

runMobileViTUnitTests()
