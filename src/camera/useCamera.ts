import { useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error'

export type CameraState = {
  status: CameraStatus
  errorMessage: string | null
}

/**
 * Handles webcam acquisition, permission/error states, and stream cleanup.
 * Deliberately knows nothing about MediaPipe or the UI beyond exposing a
 * <video> ref for callers to attach to.
 */
export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<CameraState>({ status: 'idle', errorMessage: null })
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState({ status: 'unavailable', errorMessage: 'This browser does not support camera access.' })
        return
      }

      setState({ status: 'requesting', errorMessage: null })

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setState({ status: 'active', errorMessage: null })
      } catch (err) {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setState({
            status: 'denied',
            errorMessage: 'Camera permission was denied. Allow camera access in your browser settings to continue.',
          })
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setState({ status: 'unavailable', errorMessage: 'No camera device was found on this system.' })
        } else {
          setState({
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'Unable to access the camera.',
          })
        }
      }
    }

    start()

    const videoEl = videoRef.current

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoEl) videoEl.srcObject = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return state
}
