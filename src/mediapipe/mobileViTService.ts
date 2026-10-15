import * as ort from 'onnxruntime-web'
import type { BoundingBox } from '../metrics/types'

// Configure ONNX Runtime Web for reliable browser execution:
// 1. Point wasmPaths to jsdelivr CDN matching onnxruntime-web package version.
// 2. Set numThreads to 1 to avoid requiring SharedArrayBuffer / COOP & COEP server headers.
if (typeof window !== 'undefined') {
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/'
  ort.env.wasm.numThreads = 1
}

export type MobileViTStatus = 'loading' | 'ready' | 'error'

export type TemporalDecisionState =
  | 'alert'
  | 'evaluating_evidence'
  | 'sustained_drowsy'
  | 'inconclusive'

export type MobileViTPrediction = {
  label: 'Drowsy' | 'Non Drowsy' | 'Uncertain'
  temporalState: TemporalDecisionState
  sustainedCount: number
  sustainedRequiredFrames: number
  confidence: number // 0-100%
  drowsyProbability: number // raw 0-100%
  nonDrowsyProbability: number // raw 0-100%
  smoothedDrowsyProb: number // 0-100%
  logitDrowsy: number
  logitNonDrowsy: number
  inferenceTimeMs: number
  faceCropUsed: boolean
  cropBox: CropBox
  cropDataUrl?: string
}

export type CropBox = {
  sx: number
  sy: number
  sWidth: number
  sHeight: number
}

export const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const
export const IMAGENET_STD = [0.229, 0.224, 0.225] as const

// Conservative decision policy constants to eliminate single-frame false positives:
export const DEFAULT_ELEVATED_DROWSY_THRESHOLD = 0.65 // 65% Drowsy
export const DEFAULT_ALERT_THRESHOLD = 0.45 // 45% Drowsy (55% Non-Drowsy)
export const DEFAULT_SUSTAINED_FRAMES = 3 // 3 consecutive cycles (~4.5 seconds)

/**
 * Calculates a square face crop bounding box with padding around the detected face.
 * Falls back to center-square crop if no face bounding box is provided.
 */
export function calculateFaceCropBox(
  videoWidth: number,
  videoHeight: number,
  faceBox?: BoundingBox | null,
): CropBox {
  if (!faceBox || faceBox.width <= 0 || faceBox.height <= 0) {
    const side = Math.max(1, Math.min(videoWidth, videoHeight))
    const sx = Math.max(0, (videoWidth - side) / 2)
    const sy = Math.max(0, (videoHeight - side) / 2)
    return { sx, sy, sWidth: side, sHeight: side }
  }

  // Convert normalized face box to pixel coordinates
  const pixelBoxW = faceBox.width * videoWidth
  const pixelBoxH = faceBox.height * videoHeight
  const cx = (faceBox.x + faceBox.width / 2) * videoWidth
  const cy = (faceBox.y + faceBox.height / 2) * videoHeight

  // Expand with 35% margin to capture full head context (forehead, chin, ears)
  let side = Math.max(pixelBoxW, pixelBoxH) * 1.35
  side = Math.min(side, Math.min(videoWidth, videoHeight))

  let sx = cx - side / 2
  let sy = cy - side / 2

  // Clamp within video frame boundaries
  if (sx < 0) sx = 0
  if (sy < 0) sy = 0
  if (sx + side > videoWidth) sx = videoWidth - side
  if (sy + side > videoHeight) sy = videoHeight - side

  return {
    sx: Math.round(sx),
    sy: Math.round(sy),
    sWidth: Math.round(side),
    sHeight: Math.round(side),
  }
}

/**
 * Normalizes an 8-bit RGB pixel into standard ImageNet planar values.
 */
export function normalizeRgbPixel(r: number, g: number, b: number): [number, number, number] {
  return [
    (r / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0],
    (g / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1],
    (b / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2],
  ]
}

/**
 * Numerically stable 2-class softmax.
 * Class-to-index mapping:
 * - Index 0 = Drowsy
 * - Index 1 = Non Drowsy
 */
export function softmax2(
  logit0: number,
  logit1: number,
): { prob0: number; prob1: number } {
  const maxLogit = Math.max(logit0, logit1)
  const exp0 = Math.exp(logit0 - maxLogit)
  const exp1 = Math.exp(logit1 - maxLogit)
  const sum = exp0 + exp1
  return {
    prob0: exp0 / sum,
    prob1: exp1 / sum,
  }
}

/**
 * Applies temporal exponential moving average smoothing over incoming probability.
 */
export function smoothPrediction(
  previousSmoothed: number | null,
  rawProb: number,
  alpha = 0.50,
): number {
  if (previousSmoothed === null || !Number.isFinite(previousSmoothed)) {
    return rawProb
  }
  return alpha * rawProb + (1 - alpha) * previousSmoothed
}

export type TemporalDecisionResult = {
  label: 'Drowsy' | 'Non Drowsy' | 'Uncertain'
  temporalState: TemporalDecisionState
  newSustainedCount: number
  confidence: number
}

/**
 * Evaluates the temporal decision policy requiring sustained evidence across frames:
 * 1. Alert (Non Drowsy): smoothed probability <= alertThreshold (default 0.45). Resets sustained counter.
 * 2. Elevated Drowsy: smoothed probability >= elevatedThreshold (default 0.65). Increments sustained counter.
 *    Only flags 'Drowsy' after sustainedRequiredFrames (default 3) consecutive cycles.
 * 3. Inconclusive (Uncertain): ambiguous zone (0.45 - 0.65). Flags 'Uncertain'.
 */
export function evaluateTemporalPolicy(
  smoothedDrowsyProb: number,
  currentSustainedCount: number,
  options?: {
    elevatedThreshold?: number
    alertThreshold?: number
    sustainedRequiredFrames?: number
  },
): TemporalDecisionResult {
  const elevatedThreshold = options?.elevatedThreshold ?? DEFAULT_ELEVATED_DROWSY_THRESHOLD
  const alertThreshold = options?.alertThreshold ?? DEFAULT_ALERT_THRESHOLD
  const requiredFrames = options?.sustainedRequiredFrames ?? DEFAULT_SUSTAINED_FRAMES

  if (smoothedDrowsyProb <= alertThreshold) {
    return {
      label: 'Non Drowsy',
      temporalState: 'alert',
      newSustainedCount: 0,
      confidence: (1 - smoothedDrowsyProb) * 100,
    }
  }

  if (smoothedDrowsyProb >= elevatedThreshold) {
    const nextCount = currentSustainedCount + 1
    if (nextCount >= requiredFrames) {
      return {
        label: 'Drowsy',
        temporalState: 'sustained_drowsy',
        newSustainedCount: nextCount,
        confidence: smoothedDrowsyProb * 100,
      }
    }
    // Elevated but not yet sustained across required cycles: report Uncertain (Evaluating)
    return {
      label: 'Uncertain',
      temporalState: 'evaluating_evidence',
      newSustainedCount: nextCount,
      confidence: smoothedDrowsyProb * 100,
    }
  }

  // Ambiguous zone (alertThreshold < smoothedDrowsyProb < elevatedThreshold)
  return {
    label: 'Uncertain',
    temporalState: 'inconclusive',
    newSustainedCount: Math.max(0, currentSustainedCount - 1),
    confidence: Math.max(smoothedDrowsyProb, 1 - smoothedDrowsyProb) * 100,
  }
}

export class MobileViTService {
  private session: ort.InferenceSession | null = null
  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null
  private inputBuffer = new Float32Array(3 * 224 * 224)
  private smoothedDrowsyProb: number | null = null
  private sustainedCount = 0

  async init(modelPath = '/models/mobilevitv2_drowsiness.onnx'): Promise<void> {
    if (this.session) return

    try {
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })
    } catch (err) {
      throw new Error(
        `Failed to initialize MobileViT ONNX session from ${modelPath}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }

    this.ensureCanvas()
  }

  private ensureCanvas(): void {
    if (this.canvas && this.context) return
    if (typeof document === 'undefined') return

    this.canvas = document.createElement('canvas')
    this.canvas.width = 224
    this.canvas.height = 224
    this.context = this.canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false,
    })
  }

  async predict(
    video: HTMLVideoElement,
    faceBox?: BoundingBox | null,
    includeCropPreview = false,
  ): Promise<MobileViTPrediction> {
    if (!this.session) {
      throw new Error('MobileViT model is not initialized.')
    }

    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      throw new Error('Camera frame is not ready.')
    }

    const t0 = performance.now()
    this.ensureCanvas()

    if (!this.context || !this.canvas) {
      throw new Error('Canvas 2D context is not available.')
    }

    // 1. Calculate proper square face crop instead of squashing entire 16:9 frame
    const crop = calculateFaceCropBox(video.videoWidth, video.videoHeight, faceBox)

    // 2. Draw cropped face into reusable 224x224 canvas
    this.context.drawImage(
      video,
      crop.sx,
      crop.sy,
      crop.sWidth,
      crop.sHeight,
      0,
      0,
      224,
      224,
    )

    let cropDataUrl: string | undefined
    if (includeCropPreview) {
      try {
        cropDataUrl = this.canvas.toDataURL('image/jpeg', 0.8)
      } catch {
        // Ignore data URL export failures in restricted environments
      }
    }

    // 3. Extract pixel data and normalize into pre-allocated input buffer (CHW planar format)
    const imgData = this.context.getImageData(0, 0, 224, 224).data
    const planeSize = 224 * 224

    for (let pixel = 0; pixel < planeSize; pixel++) {
      const offset = pixel * 4
      this.inputBuffer[pixel] =
        (imgData[offset] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0]
      this.inputBuffer[planeSize + pixel] =
        (imgData[offset + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1]
      this.inputBuffer[2 * planeSize + pixel] =
        (imgData[offset + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2]
    }

    // 4. Run ONNX model inference
    const tensor = new ort.Tensor('float32', this.inputBuffer, [1, 3, 224, 224])
    const results = await this.session.run({ input: tensor })
    const logits = results.logits?.data

    if (!logits || logits.length < 2) {
      throw new Error('Unexpected MobileViT model output format.')
    }

    const logitDrowsy = Number(logits[0])
    const logitNonDrowsy = Number(logits[1])

    // 5. Interpret logits: class 0 = Drowsy, class 1 = Non Drowsy
    const { prob0: rawDrowsyProb, prob1: rawNonDrowsyProb } = softmax2(
      logitDrowsy,
      logitNonDrowsy,
    )

    // 6. Temporal smoothing to reduce single-frame fluctuations
    const smoothed = smoothPrediction(this.smoothedDrowsyProb, rawDrowsyProb, 0.50)
    this.smoothedDrowsyProb = smoothed

    // 7. Temporal Decision Policy requiring sustained evidence
    const policyResult = evaluateTemporalPolicy(smoothed, this.sustainedCount)
    this.sustainedCount = policyResult.newSustainedCount

    const inferenceTimeMs = Math.round(performance.now() - t0)

    return {
      label: policyResult.label,
      temporalState: policyResult.temporalState,
      sustainedCount: this.sustainedCount,
      sustainedRequiredFrames: DEFAULT_SUSTAINED_FRAMES,
      confidence: Math.round(policyResult.confidence * 10) / 10,
      drowsyProbability: Math.round(rawDrowsyProb * 1000) / 10,
      nonDrowsyProbability: Math.round(rawNonDrowsyProb * 1000) / 10,
      smoothedDrowsyProb: Math.round(smoothed * 1000) / 10,
      logitDrowsy: Math.round(logitDrowsy * 1000) / 1000,
      logitNonDrowsy: Math.round(logitNonDrowsy * 1000) / 1000,
      inferenceTimeMs,
      faceCropUsed: Boolean(faceBox && faceBox.width > 0 && faceBox.height > 0),
      cropBox: crop,
      cropDataUrl,
    }
  }

  resetSmoothing(): void {
    this.smoothedDrowsyProb = null
    this.sustainedCount = 0
  }

  close(): void {
    this.session?.release()
    this.session = null
    this.canvas = null
    this.context = null
    this.smoothedDrowsyProb = null
    this.sustainedCount = 0
  }
}