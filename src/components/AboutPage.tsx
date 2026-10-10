export function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold text-slate-900">About</h1>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
        <p>
          DriveWatch is an in-progress research prototype for a VIT Chennai innovative design project on driver
          drowsiness measurement.
        </p>
        <p className="mt-3">
          This build (V1) is a facial-measurement layer only: live webcam capture, MediaPipe face landmark
          detection, and derived EAR / MAR / PERCLOS / head-pose values. It does not yet classify drowsiness.
        </p>
      </div>
    </div>
  )
}
