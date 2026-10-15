import { useEffect, useRef, useState } from 'react'
import {
  MobileViTService,
  type MobileViTPrediction,
  type MobileViTStatus,
} from '../mediapipe/mobileViTService'
import type { BoundingBox } from '../metrics/types'

export type UseMobileViTOptions = {
  intervalMs?: number
  includeCropPreview?: boolean
}

export function useMobileViT(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  cameraActive: boolean,
  faceDetected = true,
  faceBox?: BoundingBox | null,
  options?: UseMobileViTOptions,
) {
  const serviceRef = useRef<MobileViTService | null>(null)
  const busyRef = useRef(false)
  const faceDetectedRef = useRef(faceDetected)
  const faceBoxRef = useRef(faceBox)
  const includeCropPreviewRef = useRef(options?.includeCropPreview ?? false)

  const intervalMs = options?.intervalMs ?? 1500

  const [status, setStatus] = useState<MobileViTStatus>('loading')
  const [prediction, setPrediction] = useState<MobileViTPrediction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInferring, setIsInferring] = useState(false)

  // Keep refs synchronized without mutating during render
  useEffect(() => {
    faceDetectedRef.current = faceDetected
    faceBoxRef.current = faceBox
    includeCropPreviewRef.current = options?.includeCropPreview ?? false
    if (!faceDetected) {
      serviceRef.current?.resetSmoothing()
    }
  }, [faceDetected, faceBox, options?.includeCropPreview])

  // Initialize MobileViT ONNX session once
  useEffect(() => {
    let cancelled = false
    const service = new MobileViTService()
    serviceRef.current = service

    async function initialize() {
      try {
        await service.init()
        if (!cancelled) {
          setStatus('ready')
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load MobileViT ONNX model.',
          )
        }
      }
    }

    void initialize()

    return () => {
      cancelled = true
      if (serviceRef.current === service) {
        serviceRef.current = null
      }
      service.close()
    }
  }, [])

  // Periodic inference loop (~1.5s interval), strictly sequential without overlap
  useEffect(() => {
    if (!cameraActive || status !== 'ready') {
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function runPredictionLoop() {
      if (cancelled) return

      // Only run inference if:
      // 1. A face is currently detected in frame (avoids false-drowsy predictions on empty background walls).
      // 2. Video element is ready with positive dimensions.
      // 3. Service is loaded and no other inference is in flight.
      const video = videoRef.current
      const service = serviceRef.current

      if (
        faceDetectedRef.current &&
        video &&
        service &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        !busyRef.current
      ) {
        busyRef.current = true
        setIsInferring(true)

        try {
          const result = await service.predict(
            video,
            faceBoxRef.current,
            includeCropPreviewRef.current,
          )
          if (!cancelled) {
            setPrediction(result)
            setError(null)
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? err.message
                : 'MobileViT prediction failed.',
            )
          }
        } finally {
          busyRef.current = false
          if (!cancelled) {
            setIsInferring(false)
          }
        }
      }

      if (!cancelled) {
        timer = setTimeout(runPredictionLoop, intervalMs)
      }
    }

    // Schedule initial prediction run
    timer = setTimeout(runPredictionLoop, 500)

    return () => {
      cancelled = true
      if (timer !== undefined) {
        clearTimeout(timer)
      }
      busyRef.current = false
    }
  }, [cameraActive, status, intervalMs, videoRef])

  return {
    status,
    prediction: faceDetected ? prediction : null,
    error,
    isInferring,
  }
}