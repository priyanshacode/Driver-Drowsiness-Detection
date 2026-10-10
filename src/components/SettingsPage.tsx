import type { OverlayToggles } from '../config/constants'

const TOGGLE_META: { key: keyof OverlayToggles; label: string; description: string }[] = [
  { key: 'eyes', label: 'Eyes', description: 'Draw the eye contours used for EAR.' },
  { key: 'mouth', label: 'Mouth', description: 'Draw the mouth outline used for MAR.' },
  { key: 'headPose', label: 'Head Pose', description: 'Draw a 3-axis head orientation indicator.' },
  { key: 'faceMesh', label: 'Full Face Mesh', description: 'Draw the complete MediaPipe face mesh.' },
]

export function SettingsPage({
  toggles,
  onChange,
}: {
  toggles: OverlayToggles
  onChange: (next: OverlayToggles) => void
}) {
  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-1 text-slate-500">Control which overlays are drawn on the live video.</p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-base font-semibold text-slate-900">Landmark Visualization</h2>
        <p className="mb-4 text-sm text-slate-500">
          These only affect what is drawn on screen — EAR, MAR, PERCLOS, and head pose are always calculated
          regardless of these toggles.
        </p>

        <div className="divide-y divide-slate-100">
          {TOGGLE_META.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between py-3.5">
              <div>
                <p className="font-medium text-slate-800">{label}</p>
                <p className="text-sm text-slate-500">{description}</p>
              </div>
              <button
                role="switch"
                aria-checked={toggles[key]}
                onClick={() => onChange({ ...toggles, [key]: !toggles[key] })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  toggles[key] ? 'bg-blue-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    toggles[key] ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
