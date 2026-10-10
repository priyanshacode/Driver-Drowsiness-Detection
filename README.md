# DriveWatch V1

Real-time driver-drowsiness *measurement* prototype (VIT Chennai IDP). This build only
does live facial measurement — no drowsiness classification, no ML, no GPS.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`) in Chrome or Edge, and allow
camera access when prompted. Internet access is required once on first load, to fetch the
MediaPipe WASM runtime and face landmark model from Google's CDN (no server-side/backend
component is used — everything runs in your browser after that).

```bash
npm run build     # production build -> dist/
npm run preview   # preview the production build locally
```

## What it does

- Live webcam feed with real-time MediaPipe Face Landmarker detection (runs on-device, WASM/GPU).
- Calculates, every frame: left/right/average **EAR**, **MAR**, and **head pose** (pitch/yaw/roll).
- Tracks **Blink Count** and **Blink Rate** (rolling 1-minute window, >= 100ms closure filter).
- Tracks **PERCLOS** (30s rolling window, fixed EAR < 0.20 threshold). Missing faces are safely excluded from the calculation.
- Draws toggleable overlays (eyes / mouth / head-pose axis / full face mesh) — toggles only
  affect drawing, not calculation.
- Simple in-memory recording buffer (~10 Hz samples), discarded on reload — no persistence.

See the code comments in `src/features/`, `src/metrics/perclos.ts`, and
`src/hooks/useDrowsinessPipeline.ts` for how each piece works.

## Known limitations (V1, by design)

- PERCLOS threshold and window are fixed, not personalized/calibrated.
- Head pose is a basic Euler-angle decomposition of MediaPipe's facial transformation
  matrix — good enough to see pitch/yaw/roll trend, not metrically precise.
- No drowsiness/fatigue classification exists yet — "Current Status" intentionally shows `—`.
- Single-face only; if multiple faces are in frame, MediaPipe's first detected face is used.
