import type { OverlayToggles } from '../config/constants'

const TOGGLE_META: { key: keyof OverlayToggles; label: string; description: string }[] = [
  { key: 'eyes', label: 'Eye Contours', description: 'Visualize points mapped for EAR calculation.' },
  { key: 'mouth', label: 'Mouth Boundary', description: 'Visualize points mapped for MAR calculation.' },
  { key: 'headPose', label: 'Head Orientation Axis', description: 'Draw a 3-axis (pitch, yaw, roll) directional indicator.' },
  { key: 'faceMesh', label: 'Full Topology Mesh', description: 'Render the complete 468-point MediaPipe wireframe.' },
]

export function SettingsPage({
  toggles,
  onChange,
}: {
  toggles: OverlayToggles
  onChange: (next: OverlayToggles) => void
}) {
  return (
    <div className="mx-auto max-w-4xl flex-col gap-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">System Configuration</h1>
        <p className="mt-1 text-sm text-slate-500">Manage pipeline parameters and visualization preferences.</p>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm mb-6">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Telemetry Overlays</h2>
          <p className="text-xs text-slate-500 mt-1">
            Toggle real-time visual overlays on the camera feed. Feature extraction (EAR, MAR, PERCLOS) runs independently.
          </p>
        </div>

        <div className="divide-y divide-slate-100 p-2">
          {TOGGLE_META.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between px-3 py-4 hover:bg-slate-50 rounded-lg transition-colors">
              <div>
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{description}</p>
              </div>
              <button
                role="switch"
                aria-checked={toggles[key]}
                onClick={() => onChange({ ...toggles, [key]: !toggles[key] })}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  toggles[key] ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    toggles[key] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm opacity-60">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Advanced Parameters</h2>
            <p className="text-xs text-slate-500 mt-1">Configure thresholds for drowsiness classification.</p>
          </div>
          <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Read Only</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">EAR Threshold</label>
              <input type="text" disabled value="0.25 (Default)" className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">MAR Threshold</label>
              <input type="text" disabled value="0.50 (Default)" className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">PERCLOS Threshold</label>
              <input type="text" disabled value="15% (Default)" className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
