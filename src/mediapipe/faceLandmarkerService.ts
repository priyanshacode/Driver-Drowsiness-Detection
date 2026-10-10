import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'

/**
 * Thin wrapper around the MediaPipe Face Landmarker task.
 *
 * All MediaPipe-specific setup/API details live here so the rest of the
 * app (feature extraction, UI) only deals with plain landmark arrays and
 * can keep working if the underlying detector is swapped or upgraded.
 */
export class FaceLandmarkerService {
  private landmarker: FaceLandmarker | null = null
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.landmarker) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
      )
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
      })
    })()

    return this.initPromise
  }

  /** Runs detection for one video frame. Must be called with a monotonically increasing timestamp. */
  detectForVideo(video: HTMLVideoElement, timestampMs: number): FaceLandmarkerResult | null {
    if (!this.landmarker) return null
    return this.landmarker.detectForVideo(video, timestampMs)
  }

  get isReady(): boolean {
    return this.landmarker !== null
  }

  close(): void {
    this.landmarker?.close()
    this.landmarker = null
    this.initPromise = null
  }
}
