import { DrowsinessEvaluator } from './drowsinessRules.ts'
import { AlertAudioManager } from '../audio/alertAudio.ts'
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
    ear: { left: 0.30, right: 0.30, average: 0.30 },
    mar: 0.20,
    perclos: 4.0,
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    ...overrides,
  }
}

export function runDrowsinessTests(): { total: number; passed: number } {
  const tests: [string, () => void][] = [
    [
      'Normal blinks (duration < 500ms) do not trigger critical alert',
      () => {
        const evaluator = new DrowsinessEvaluator()
        // Open eyes at t=1000ms
        const r1 = evaluator.evaluate(1000, makeMetrics({ timestamp: 1000, ear: { left: 0.3, right: 0.3, average: 0.3 } }))
        assert(r1.level === 'normal', 't=1000 should be normal')

        // Eyes close at t=1100ms (blink start)
        const r2 = evaluator.evaluate(1100, makeMetrics({ timestamp: 1100, ear: { left: 0.1, right: 0.1, average: 0.1 } }))
        assert(r2.level === 'normal', 't=1100 blink start should not immediately alert')
        assert(r2.isEyeClosed === true, 'should detect closed eye')

        // Eyes still closed at t=1300ms (200ms blink closure)
        const r3 = evaluator.evaluate(1300, makeMetrics({ timestamp: 1300, ear: { left: 0.1, right: 0.1, average: 0.1 } }))
        assert(r3.level === 'normal', 't=1300 mid-blink (200ms) should be normal')

        // Eyes open at t=1400ms (blink finished, 300ms total)
        const r4 = evaluator.evaluate(1400, makeMetrics({ timestamp: 1400, ear: { left: 0.3, right: 0.3, average: 0.3 } }))
        assert(r4.level === 'normal', 't=1400 blink end should remain normal')
        assert(r4.isEyeClosed === false, 'should detect open eye')
      },
    ],
    [
      'Prolonged eye closure (>= 1.5s) triggers critical alert',
      () => {
        const evaluator = new DrowsinessEvaluator({ prolongedClosureThresholdMs: 1500 })

        // Eyes close at t=2000ms
        evaluator.evaluate(2000, makeMetrics({ timestamp: 2000, ear: { left: 0.12, right: 0.12, average: 0.12 } }))

        // After 1000ms (1.0s closure) -> still normal
        const rMid = evaluator.evaluate(3000, makeMetrics({ timestamp: 3000, ear: { left: 0.12, right: 0.12, average: 0.12 } }))
        assert(rMid.level === 'normal', '1.0s closure should not yet trigger critical alert')

        // After 1500ms (t=3500ms) -> triggers critical alert
        const rCrit = evaluator.evaluate(3500, makeMetrics({ timestamp: 3500, ear: { left: 0.12, right: 0.12, average: 0.12 } }))
        assert(rCrit.level === 'critical', '1.5s closure must trigger critical alert')
        assert(rCrit.prolongedClosureActive === true, 'prolongedClosureActive must be true')
        assert(rCrit.reason.includes('Prolonged eye closure'), 'reason must describe eye closure')
      },
    ],
    [
      'Missing face does not trigger drowsiness alert and clears closure timers',
      () => {
        const evaluator = new DrowsinessEvaluator({ prolongedClosureThresholdMs: 1500 })

        // Eyes closed for 1.0s
        evaluator.evaluate(1000, makeMetrics({ timestamp: 1000, ear: { left: 0.1, right: 0.1, average: 0.1 } }))
        evaluator.evaluate(2000, makeMetrics({ timestamp: 2000, ear: { left: 0.1, right: 0.1, average: 0.1 } }))

        // Face is suddenly lost at t=2500ms
        const rLost = evaluator.evaluate(2500, makeMetrics({ timestamp: 2500, faceDetected: false, ear: null }))
        assert(rLost.level === 'tracking-lost', 'missing face must return tracking-lost')
        assert(rLost.prolongedClosureActive === false, 'missing face must not be considered prolonged closure')
        assert(rLost.isEyeClosed === false, 'missing face must never be considered closed eyes')

        // Face returns with open eyes at t=4000ms: timer should have been reset
        const rReturn = evaluator.evaluate(4000, makeMetrics({ timestamp: 4000, faceDetected: true, ear: { left: 0.3, right: 0.3, average: 0.3 } }))
        assert(rReturn.level === 'normal', 'face return with open eyes must be normal')
      },
    ],
    [
      'PERCLOS warmup and null values do not alert, but high PERCLOS (>=15%) triggers warning',
      () => {
        const evaluator = new DrowsinessEvaluator({ perclosAlertThreshold: 15.0 })

        // During warmup, PERCLOS is null
        const rWarmup = evaluator.evaluate(1000, makeMetrics({ timestamp: 1000, perclos: null }))
        assert(rWarmup.level === 'normal', 'null PERCLOS during warmup must not alert')

        // Normal low PERCLOS (6%)
        const rLow = evaluator.evaluate(10000, makeMetrics({ timestamp: 10000, perclos: 6.0 }))
        assert(rLow.level === 'normal', 'low PERCLOS (6%) must be normal')

        // Elevated PERCLOS (18.5%)
        const rHigh = evaluator.evaluate(30000, makeMetrics({ timestamp: 30000, perclos: 18.5 }))
        assert(rHigh.level === 'warning', 'high PERCLOS (18.5%) must trigger warning')
        assert(rHigh.elevatedPerclosActive === true, 'elevatedPerclosActive must be true')
        assert(rHigh.reason.includes('PERCLOS'), 'reason must mention PERCLOS')
      },
    ],
    [
      'Sustained yawning (>=2.0s) triggers secondary warning; short mouth openings do not',
      () => {
        const evaluator = new DrowsinessEvaluator({ yawnMarThreshold: 0.5, yawnMinDurationMs: 2000 })

        // Normal mouth at t=1000ms
        evaluator.evaluate(1000, makeMetrics({ timestamp: 1000, mar: 0.2 }))

        // Mouth opens wide (MAR=0.65) at t=2000ms (talking / laughing briefly)
        evaluator.evaluate(2000, makeMetrics({ timestamp: 2000, mar: 0.65 }))

        // After 1000ms (t=3000ms, 1s duration) -> still normal
        const rShort = evaluator.evaluate(3000, makeMetrics({ timestamp: 3000, mar: 0.65 }))
        assert(rShort.level === 'normal', '1.0s wide mouth should not yet trigger yawn warning')

        // Mouth closes at t=3500ms
        const rClosed = evaluator.evaluate(3500, makeMetrics({ timestamp: 3500, mar: 0.2 }))
        assert(rClosed.level === 'normal', 'closed mouth should reset yawn timer')

        // Now mouth opens and stays wide for 2500ms (t=5000ms to t=7500ms)
        evaluator.evaluate(5000, makeMetrics({ timestamp: 5000, mar: 0.70 }))
        const rYawn = evaluator.evaluate(7500, makeMetrics({ timestamp: 7500, mar: 0.70 }))
        assert(rYawn.level === 'warning', 'sustained 2.5s mouth opening must trigger yawn warning')
        assert(rYawn.sustainedYawnActive === true, 'sustainedYawnActive must be true')
        assert(rYawn.reason.includes('yawning'), 'reason must mention yawning')
      },
    ],
    [
      'Hysteresis debouncing prevents premature alert flickering',
      () => {
        const evaluator = new DrowsinessEvaluator({
          prolongedClosureThresholdMs: 1500,
          eyeClosureRecoveryMs: 800,
        })

        // Eyes close from t=1000 to t=2600ms (1.6s -> triggers critical)
        evaluator.evaluate(1000, makeMetrics({ timestamp: 1000, ear: { left: 0.1, right: 0.1, average: 0.1 } }))
        const rCrit = evaluator.evaluate(2600, makeMetrics({ timestamp: 2600, ear: { left: 0.1, right: 0.1, average: 0.1 } }))
        assert(rCrit.level === 'critical', 'should be critical')

        // Eyelid flutters open for 200ms at t=2800ms
        const rFlutter = evaluator.evaluate(2800, makeMetrics({ timestamp: 2800, ear: { left: 0.3, right: 0.3, average: 0.3 } }))
        assert(rFlutter.level === 'critical', 'brief open eyes (200ms < 800ms recovery) must NOT clear critical alert')

        // Eyes stay open continuously for 900ms (at t=3700ms)
        const rRecovered = evaluator.evaluate(3700, makeMetrics({ timestamp: 3700, ear: { left: 0.3, right: 0.3, average: 0.3 } }))
        assert(rRecovered.level === 'normal', 'eyes continuously open >= 800ms must clear critical alert')
      },
    ],
    [
      'AlertAudioManager cooldown throttles repeated alarms',
      () => {
        const audio = new AlertAudioManager(4000)

        // Muted behavior
        audio.setMuted(true)
        assert(audio.isMuted() === true, 'should be muted')
        assert(audio.playAlert('critical', 1000) === false, 'playAlert when muted should return false')

        // Unmute
        audio.setMuted(false)
        assert(audio.isMuted() === false, 'should be unmuted')

        // Test normal or tracking-lost levels do not produce sound
        assert(audio.playAlert('normal', 1000) === false, 'normal level should not play')
        assert(audio.playAlert('tracking-lost', 1000) === false, 'tracking-lost level should not play')
      },
    ],
    [
      'Persistent warning plays sound once and does not repeat while continuously active or across tracking loss',
      () => {
        const audio = new AlertAudioManager(4000)

        // 1. Initial normal state does not play
        assert(audio.playAlert('normal', 500) === false, 'normal level must not play')

        // 2. Transition from normal to warning triggers chime once
        assert(audio.playAlert('warning', 1000) === true, 'initial warning transition must play chime')
        assert(audio.isWarningActive() === true, 'warningActive must be true')

        // 3. Persistent warning on immediate next video frames does not replay
        assert(audio.playAlert('warning', 1033) === false, 'warning on frame +33ms must not replay')
        assert(audio.playAlert('warning', 1066) === false, 'warning on frame +66ms must not replay')

        // 4. Persistent warning does NOT replay even after cooldown interval (4s, 10s, 60s) has elapsed
        assert(audio.playAlert('warning', 5000) === false, 'persistent warning at +4000ms must not replay')
        assert(audio.playAlert('warning', 10000) === false, 'persistent warning at +9000ms must not replay')
        assert(audio.playAlert('warning', 60000) === false, 'persistent warning at +59s must not replay')

        // 5. Temporary tracking loss preserves episode state and does not sound
        assert(audio.playAlert('tracking-lost', 61000) === false, 'tracking-lost must not sound')
        assert(audio.isWarningActive() === true, 'tracking-lost must preserve warningActive')

        // 6. Resuming tracking with persistent warning does NOT trigger repeated sounds
        assert(audio.playAlert('warning', 62000) === false, 'resuming tracking into ongoing warning must not replay')
      },
    ],
    [
      'Cleared and retriggered warning allows a new warning sound once condition returns to normal',
      () => {
        const audio = new AlertAudioManager(4000)

        // 1. First warning episode plays once
        assert(audio.playAlert('warning', 1000) === true, 'first warning episode must play')
        assert(audio.playAlert('warning', 2000) === false, 'first episode persistence must not replay')
        assert(audio.playAlert('warning', 5000) === false, 'first episode persistence across cooldown must not replay')

        // 2. Condition clears back to normal (e.g. PERCLOS drops below 15%)
        assert(audio.playAlert('normal', 7000) === false, 'normal level does not play sound')
        assert(audio.isWarningActive() === false, 'normal level must reset warningActive to false')
        assert(audio.playAlert('normal', 8000) === false, 'continued normal monitoring does not play sound')

        // 3. Second warning episode begins (e.g. driver becomes drowsy again)
        assert(audio.playAlert('warning', 10000) === true, 'second warning episode must play a new sound')
        assert(audio.isWarningActive() === true, 'warningActive must be true for second episode')
        assert(audio.playAlert('warning', 11000) === false, 'second episode persistence must not replay')

        // 4. Temporary tracking loss and recovery within second episode
        assert(audio.playAlert('tracking-lost', 12000) === false, 'tracking lost does not play')
        assert(audio.playAlert('warning', 13000) === false, 'tracking resumed does not replay within second episode')

        // 5. Second episode clears to normal
        audio.playAlert('normal', 15000)
        assert(audio.isWarningActive() === false, 'second episode cleared')

        // 6. Third episode begins
        assert(audio.playAlert('warning', 18000) === true, 'third warning episode must play')
      },
    ],
    [
      'Alert escalation from warning to critical bypasses warning cooldown while throttling repeated frames',
      () => {
        const audio = new AlertAudioManager(4000)

        // 1. First warning chime sounds at t=1000ms
        assert(audio.playAlert('warning', 1000) === true, 'initial warning must play')

        // 2. Persistent warning does not replay
        assert(audio.playAlert('warning', 1500) === false, 'warning persistence must not replay')

        // 3. Escalation to critical at t=2000ms (only 1s after warning) bypasses warning cooldown
        assert(
          audio.playAlert('critical', 2000) === true,
          'critical escalation at t=2000ms must bypass recent warning cooldown and play immediately'
        )

        // 4. Repeated critical on subsequent video frames (e.g. +33ms, +66ms) is strictly throttled
        assert(audio.playAlert('critical', 2033) === false, 'critical on next frame (+33ms) must be throttled')
        assert(audio.playAlert('critical', 2066) === false, 'critical on next frame (+66ms) must be throttled')
        assert(audio.playAlert('critical', 4000) === false, 'critical at 2s into 4s cooldown must be throttled')

        // 5. Critical repeats only after criticalCooldownMs (4000ms) has elapsed
        assert(audio.playAlert('critical', 6000) === true, 'critical after 4000ms cooldown must play')

        // 6. Critical recovering into warning is suppressed
        assert(audio.playAlert('warning', 6500) === false, 'warning right after critical must be suppressed')

        // 7. Clearing to normal allows future warning
        audio.playAlert('normal', 8000)
        assert(audio.playAlert('warning', 10000) === true, 'warning after clearing to normal must play')

        // 8. Resetting cooldowns allows immediate playback
        audio.resetCooldowns()
        assert(audio.playAlert('warning', 10100) === true, 'warning after resetCooldowns must play')
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

runDrowsinessTests()

